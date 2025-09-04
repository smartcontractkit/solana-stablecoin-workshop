use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Burn},
};
use anchor_lang::solana_program::program as solana_program;

declare_id!("7HebG1xx5GjmJw3yxCpRWBV2yCt7VspRUk4ponx35jpR");

// Oracle program ID (our deployed oracle)
const ORACLE_PROGRAM_ID: Pubkey = pubkey!("9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1");

#[program]
pub mod stablecoin_program {
    use super::*;

    /// Initialize the stablecoin mint
    pub fn initialize_mint(
        _ctx: Context<InitializeMint>,
        decimals: u8,
    ) -> Result<()> {
        msg!("Stablecoin mint initialized with {} decimals", decimals);
        // Note: The mint is already initialized by the #[account(init)] constraint
        // No additional initialization needed here
        Ok(())
    }

    /// Deposit collateral and mint stablecoins based on oracle price
    pub fn deposit_and_mint(
        ctx: Context<DepositAndMint>,
        collateral_amount: u64,
        feed_id: [u8; 32],
    ) -> Result<()> {
        let collateral_sol = collateral_amount as f64 / 1_000_000_000.0;
        msg!("Depositing {} lamports ({:.9} SOL) as collateral", collateral_amount, collateral_sol);

        // Step 1: Get price from oracle via CPI
        let oracle_program = ctx.accounts.oracle_program.to_account_info();
        let oracle_accounts = oracle::cpi::accounts::GetPrice {
            price_feed: ctx.accounts.oracle_price_feed.clone(),
        };
        
        let oracle_ctx = CpiContext::new(oracle_program, oracle_accounts);
        oracle::cpi::get_price(oracle_ctx)?;
        
        // Extract price and timestamp from return data
        let return_data = anchor_lang::solana_program::program::get_return_data()
            .ok_or(StablecoinError::OraclePriceNotAvailable)?;
        
        if return_data.0 != ORACLE_PROGRAM_ID {
            return Err(StablecoinError::OraclePriceNotAvailable.into());
        }
        
        // Parse return data: (price: u64, timestamp: u64) = 16 bytes total
        if return_data.1.len() != 16 {
            return Err(StablecoinError::OraclePriceNotAvailable.into());
        }
        
        let price_bytes = &return_data.1[0..8];
        let timestamp_bytes = &return_data.1[8..16];
        
        let oracle_price = u64::from_le_bytes(price_bytes.try_into().unwrap()); // Price with 8 decimals
        let oracle_timestamp = u64::from_le_bytes(timestamp_bytes.try_into().unwrap());
        
        let oracle_price_usd = oracle_price as f64 / 100_000_000.0; // Convert 8 decimals to USD
        msg!("Oracle price: {} raw (${:.8} USD per SOL), timestamp: {}", oracle_price, oracle_price_usd, oracle_timestamp);
        
        // Convert oracle price (8 decimals) to USD per SOL
        // Oracle price has 8 decimals: 200000000000 = $200.00000000
        let lamports_per_sol = 1_000_000_000u128; // 1e9 lamports = 1 SOL
        let oracle_decimals = 100_000_000u128; // 1e8 for oracle price scaling
        
        // Calculate USD value using u128 to prevent overflow: (collateral_lamports * oracle_price_8_decimals) / (lamports_per_sol * oracle_decimals)
        let collateral_value_usd = ((collateral_amount as u128) * (oracle_price as u128)) / (lamports_per_sol * oracle_decimals);
        let collateral_value_usd = collateral_value_usd as u64; // Convert back to u64
        
        // Step 2: Calculate mint amount (1:1 USD backing for simplicity)
        let mint_amount = collateral_value_usd * 10u64.pow(ctx.accounts.mint.decimals as u32);
        
        let stablecoin_amount = mint_amount as f64 / 10u64.pow(ctx.accounts.mint.decimals as u32) as f64;
        msg!("Collateral value: ${} USD, Minting: {} raw units ({:.6} USD stablecoins)", collateral_value_usd, mint_amount, stablecoin_amount);

        // Step 3: Transfer collateral from user to vault
        let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.collateral_vault.key(),
            collateral_amount,
        );
        
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.collateral_vault.to_account_info(),
            ],
        )?;

        // Step 4: Mint stablecoins to user
        let mint_seeds = &[
            b"mint_authority".as_ref(),
            &[ctx.bumps.mint_authority],
        ];
        let signer_seeds = &[&mint_seeds[..]];

        // For multisig minting, we need to construct the instruction manually
        // because Anchor's MintTo doesn't support remaining_accounts for multisig signers
        
        // Create the mint_to instruction manually for multisig
        use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
        
        let mint_to_ix = Instruction {
            program_id: ctx.accounts.token_program.key(),
            accounts: vec![
                AccountMeta::new(ctx.accounts.mint.key(), false),
                AccountMeta::new(ctx.accounts.user_token_account.key(), false),
                AccountMeta::new_readonly(ctx.accounts.multisig_mint_authority.key(), false),
                AccountMeta::new_readonly(ctx.accounts.mint_authority.key(), true), // Our PDA signs
            ],
            data: {
                let mut data = vec![7]; // MintTo instruction discriminator
                data.extend_from_slice(&mint_amount.to_le_bytes());
                data
            },
        };
        
        // Build account infos for the instruction
        let mut account_infos = vec![
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.multisig_mint_authority.to_account_info(),
        ];
        
        // Add our PDA as a signer for the multisig
        account_infos.push(ctx.accounts.mint_authority.to_account_info());
        
        // Invoke the SPL Token instruction with our PDA signing
        solana_program::invoke_signed(
            &mint_to_ix,
            &account_infos,
            signer_seeds,
        )?;

        msg!("Successfully minted {} raw units ({:.6} USD stablecoins)", mint_amount, stablecoin_amount);
        Ok(())
    }

    /// Burn stablecoins and withdraw collateral
    pub fn burn_and_withdraw(
        ctx: Context<BurnAndWithdraw>,
        burn_amount: u64,
        feed_id: [u8; 32],
    ) -> Result<()> {
        let stablecoin_usd_amount = burn_amount as f64 / 10u64.pow(ctx.accounts.mint.decimals as u32) as f64;
        msg!("Burning {} raw units ({:.6} USD stablecoins) and withdrawing collateral", burn_amount, stablecoin_usd_amount);

        // Step 1: Get current price from oracle
        let oracle_program = ctx.accounts.oracle_program.to_account_info();
        let oracle_accounts = oracle::cpi::accounts::GetPrice {
            price_feed: ctx.accounts.oracle_price_feed.clone(),
        };
        
        let oracle_ctx = CpiContext::new(oracle_program, oracle_accounts);
        oracle::cpi::get_price(oracle_ctx)?;

        // Extract price and timestamp from return data
        let return_data = anchor_lang::solana_program::program::get_return_data()
            .ok_or(StablecoinError::OraclePriceNotAvailable)?;
        
        if return_data.0 != ORACLE_PROGRAM_ID {
            return Err(StablecoinError::OraclePriceNotAvailable.into());
        }
        
        // Parse return data: (price: u64, timestamp: u64) = 16 bytes total
        if return_data.1.len() != 16 {
            return Err(StablecoinError::OraclePriceNotAvailable.into());
        }
        
        let price_bytes = &return_data.1[0..8];
        let timestamp_bytes = &return_data.1[8..16];
        
        let oracle_price = u64::from_le_bytes(price_bytes.try_into().unwrap()); // Price with 8 decimals
        let oracle_timestamp = u64::from_le_bytes(timestamp_bytes.try_into().unwrap());
        
        let oracle_price_usd_burn = oracle_price as f64 / 100_000_000.0; // Convert 8 decimals to USD
        msg!("Oracle price for burn: {} raw (${:.8} USD per SOL), timestamp: {}", oracle_price, oracle_price_usd_burn, oracle_timestamp);

        // Step 2: Calculate collateral to return
        // Convert oracle price (8 decimals) to calculate collateral return
        let lamports_per_sol = 1_000_000_000u128; // 1e9 lamports = 1 SOL
        let oracle_decimals = 100_000_000u128; // 1e8 for oracle price scaling
        let usd_value = burn_amount / 10u64.pow(ctx.accounts.mint.decimals as u32);
        
        // Calculate collateral using u128 to prevent overflow: (usd_value * lamports_per_sol * oracle_decimals) / oracle_price_8_decimals
        let collateral_amount = ((usd_value as u128) * lamports_per_sol * oracle_decimals) / (oracle_price as u128);
        let collateral_amount = collateral_amount as u64; // Convert back to u64

        msg!("Returning {} lamports collateral for {} USD value", collateral_amount, usd_value);

        // Step 3: Burn stablecoins
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::burn(cpi_ctx, burn_amount)?;

        // Step 4: Return collateral to user using system program transfer with PDA signing
        let vault_seeds = &[
            b"collateral_vault".as_ref(),
            &[ctx.bumps.collateral_vault],
        ];
        let signer_seeds = &[&vault_seeds[..]];

        // Use system program to transfer lamports from vault (PDA) to user
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.collateral_vault.to_account_info(),
            to: ctx.accounts.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
            signer_seeds,
        );
        anchor_lang::system_program::transfer(cpi_ctx, collateral_amount)?;

        let collateral_sol = collateral_amount as f64 / 1_000_000_000.0;
        msg!("Successfully burned {} raw units ({:.6} USD stablecoins) and returned {} lamports ({:.9} SOL)", burn_amount, stablecoin_usd_amount, collateral_amount, collateral_sol);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        payer = payer,
        mint::decimals = 6,
        mint::authority = mint_authority,
        mint::freeze_authority = mint_authority,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        seeds = [b"mint_authority"],
        bump
    )]
    /// CHECK: This is a PDA used as mint authority
    pub mint_authority: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositAndMint<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(
        seeds = [b"mint_authority"],
        bump
    )]
    /// CHECK: This is a PDA used as mint authority (now a multisig signer)
    pub mint_authority: UncheckedAccount<'info>,
    
    /// CHECK: Multisig mint authority account
    pub multisig_mint_authority: UncheckedAccount<'info>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"collateral_vault"],
        bump
    )]
    /// CHECK: This is a PDA used as collateral vault
    pub collateral_vault: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    // Oracle CPI accounts
    /// CHECK: Oracle program ID is validated
    #[account(address = ORACLE_PROGRAM_ID)]
    pub oracle_program: UncheckedAccount<'info>,
    
    /// CHECK: Oracle price feed account - validated by oracle program
    pub oracle_price_feed: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BurnAndWithdraw<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"collateral_vault"],
        bump
    )]
    /// CHECK: This is a PDA used as collateral vault
    pub collateral_vault: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    // Oracle CPI accounts
    /// CHECK: Oracle program ID is validated
    #[account(address = ORACLE_PROGRAM_ID)]
    pub oracle_program: UncheckedAccount<'info>,
    
    /// CHECK: Oracle price feed account - validated by oracle program
    pub oracle_price_feed: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Oracle CPI module
pub mod oracle {
    use super::*;
    
    pub mod cpi {
        use super::*;
        
        pub mod accounts {
            use super::*;
            
            #[derive(Accounts)]
            pub struct GetPrice<'info> {
                /// CHECK: Price feed account validated by oracle program
                pub price_feed: UncheckedAccount<'info>,
            }
        }
        
        pub fn get_price<'info>(ctx: CpiContext<'_, '_, '_, 'info, accounts::GetPrice<'info>>) -> Result<()> {
            let ix = anchor_lang::solana_program::instruction::Instruction {
                program_id: ORACLE_PROGRAM_ID,
                accounts: vec![
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        ctx.accounts.price_feed.key(),
                        false,
                    ),
                ],
                data: [238, 38, 193, 106, 228, 32, 210, 33].to_vec(), // get_price discriminator
            };
            
            anchor_lang::solana_program::program::invoke(
                &ix,
                &[ctx.accounts.price_feed.to_account_info()],
            )?;
            
            Ok(())
        }
    }
}

#[error_code]
pub enum StablecoinError {
    #[msg("Invalid collateral amount")]
    InvalidCollateralAmount,
    #[msg("Insufficient collateral")]
    InsufficientCollateral,
    #[msg("Oracle price not available")]
    OraclePriceNotAvailable,
    #[msg("Invalid mint amount")]
    InvalidMintAmount,
    #[msg("Insufficient stablecoin balance")]
    InsufficientStablecoinBalance,
}