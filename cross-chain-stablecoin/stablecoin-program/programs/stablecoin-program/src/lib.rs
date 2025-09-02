use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, MintTo, Burn},
};

declare_id!("EWmZfjm93yvKzpD8idETKHBb73qDVMYmyWtnjvZn4cTs");

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
        msg!("Depositing {} lamports as collateral", collateral_amount);

        // Step 1: Get price from oracle via CPI
        let oracle_program = ctx.accounts.oracle_program.to_account_info();
        let oracle_accounts = oracle::cpi::accounts::GetPrice {
            price_feed: ctx.accounts.oracle_price_feed.clone(),
        };
        
        let oracle_ctx = CpiContext::new(oracle_program, oracle_accounts);
        oracle::cpi::get_price(oracle_ctx)?;
        
        // Extract price and timestamp from return data
        // Note: In a real implementation, we'd parse the return data properly
        // For now, we'll use a mock price calculation
        // Mock: 1 SOL = $200 USD, so 1 SOL (1e9 lamports) = $200
        let sol_price_usd = 200u64; // $200 per SOL
        let lamports_per_sol = 1_000_000_000u64; // 1e9 lamports = 1 SOL
        let collateral_value_usd = (collateral_amount * sol_price_usd) / lamports_per_sol;
        
        // Step 2: Calculate mint amount (1:1 USD backing for simplicity)
        let mint_amount = collateral_value_usd * 10u64.pow(ctx.accounts.mint.decimals as u32);
        
        msg!("Collateral value: {} USD, Minting: {} stablecoins", collateral_value_usd, mint_amount);

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

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        
        token::mint_to(cpi_ctx, mint_amount)?;

        msg!("Successfully minted {} stablecoins", mint_amount);
        Ok(())
    }

    /// Burn stablecoins and withdraw collateral
    pub fn burn_and_withdraw(
        ctx: Context<BurnAndWithdraw>,
        burn_amount: u64,
        feed_id: [u8; 32],
    ) -> Result<()> {
        msg!("Burning {} stablecoins", burn_amount);

        // Step 1: Get current price from oracle
        let oracle_program = ctx.accounts.oracle_program.to_account_info();
        let oracle_accounts = oracle::cpi::accounts::GetPrice {
            price_feed: ctx.accounts.oracle_price_feed.clone(),
        };
        
        let oracle_ctx = CpiContext::new(oracle_program, oracle_accounts);
        oracle::cpi::get_price(oracle_ctx)?;

        // Step 2: Calculate collateral to return
        // Mock: 1 SOL = $200 USD
        let sol_price_usd = 200u64; // $200 per SOL
        let lamports_per_sol = 1_000_000_000u64; // 1e9 lamports = 1 SOL
        let usd_value = burn_amount / 10u64.pow(ctx.accounts.mint.decimals as u32);
        let collateral_amount = (usd_value * lamports_per_sol) / sol_price_usd;

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

        // Step 4: Return collateral to user
        let vault_seeds = &[
            b"collateral_vault".as_ref(),
            &[ctx.bumps.collateral_vault],
        ];
        let signer_seeds = &[&vault_seeds[..]];

        **ctx.accounts.collateral_vault.to_account_info().try_borrow_mut_lamports()? -= collateral_amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += collateral_amount;

        msg!("Successfully burned {} stablecoins and returned {} lamports", burn_amount, collateral_amount);
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
    /// CHECK: This is a PDA used as mint authority
    pub mint_authority: UncheckedAccount<'info>,
    
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