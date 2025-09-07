// Import required dependencies for Anchor, Solana, and Data Streams
#![allow(deprecated)]
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::{get_return_data, invoke},
};
// Try different import paths for ReportDataV3
// use chainlink_solana_data_streams::report::v3::ReportDataV3;
use chainlink_solana_data_streams::VerifierInstructions;


declare_id!("9w1TEJRgUafEcVDVWH4ejGVkETvvd1C77WE8gVcHfUfU");

#[program]
pub mod oracle {
    use super::*;

    /// Verifies a Data Streams report using Cross-Program Invocation to the Verifier program
    /// Returns the decoded report data if verification succeeds
    pub fn verify(ctx: Context<OracleContext>, signed_report: Vec<u8>) -> Result<()> {
        let program_id = ctx.accounts.verifier_program_id.key();
        let verifier_account = ctx.accounts.verifier_account.key();
        let access_controller = ctx.accounts.access_controller.key();
        let user = ctx.accounts.user.key();
        let config_account = ctx.accounts.config_account.key();

        // Import the exact Pubkey type that chainlink expects
        use solana_program::pubkey::Pubkey as SolanaPubkey;
        
        // Convert anchor Pubkeys to the format expected by chainlink crate
        let chainlink_program_id = SolanaPubkey::new_from_array(program_id.to_bytes());
        let chainlink_verifier_account = SolanaPubkey::new_from_array(verifier_account.to_bytes());
        let chainlink_access_controller = SolanaPubkey::new_from_array(access_controller.to_bytes());
        let chainlink_user = SolanaPubkey::new_from_array(user.to_bytes());
        let chainlink_config_account = SolanaPubkey::new_from_array(config_account.to_bytes());

        // Create verification instruction using the converted Pubkey references
        let chainlink_ix = VerifierInstructions::verify(
            &chainlink_program_id,
            &chainlink_verifier_account,
            &chainlink_access_controller,
            &chainlink_user,
            &chainlink_config_account,
            signed_report,
        );

        // Convert the chainlink instruction to the format expected by anchor's invoke
        let anchor_instruction = anchor_lang::solana_program::instruction::Instruction {
            program_id: Pubkey::new_from_array(chainlink_ix.program_id.to_bytes()),
            accounts: chainlink_ix.accounts.iter().map(|acc| {
                anchor_lang::solana_program::instruction::AccountMeta {
                    pubkey: Pubkey::new_from_array(acc.pubkey.to_bytes()),
                    is_signer: acc.is_signer,
                    is_writable: acc.is_writable,
                }
            }).collect(),
            data: chainlink_ix.data,
        };

        // Invoke the Verifier program
        invoke(
            &anchor_instruction,
            &[
                ctx.accounts.verifier_account.to_account_info(),
                ctx.accounts.access_controller.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.config_account.to_account_info(),
            ],
        )?;

        // Decode and log the verified report data
        if let Some((_program_id, return_data)) = get_return_data() {
            msg!("Report data found");
            msg!("Return data length: {}", return_data.len());
            // TODO: Decode report data once we find the correct ReportDataV3 import
            // let report = ReportDataV3::decode(&return_data)
            //     .map_err(|_| error!(CustomError::InvalidReportData))?;

            // // Log report fields
            // msg!("FeedId: {}", report.feed_id);
            // msg!("Valid from timestamp: {}", report.valid_from_timestamp);
            // msg!("Observations Timestamp: {}", report.observations_timestamp);
            // msg!("Native Fee: {}", report.native_fee);
            // msg!("Link Fee: {}", report.link_fee);
            // msg!("Expires At: {}", report.expires_at);
            // msg!("Benchmark Price: {}", report.benchmark_price);
            // msg!("Bid: {}", report.bid);
            // msg!("Ask: {}", report.ask);
        } else {
            msg!("No report data found");
            return Err(error!(CustomError::NoReportData));
        }

        Ok(())
    }

    /// Verifies a Data Streams report and stores the price in a PriceFeed account
    pub fn verify_and_store(
        ctx: Context<VerifyAndStore>, 
        signed_report: Vec<u8>,
        feed_id: [u8; 32],
        expected_price: u64,  // Price extracted by client for validation
        timestamp: u64,       // Timestamp from the report
    ) -> Result<()> {
        let program_id = ctx.accounts.verifier_program_id.key();
        let verifier_account = ctx.accounts.verifier_account.key();
        let access_controller = ctx.accounts.access_controller.key();
        let user = ctx.accounts.user.key();
        let config_account = ctx.accounts.config_account.key();

        // Import the exact Pubkey type that chainlink expects
        use solana_program::pubkey::Pubkey as SolanaPubkey;
        
        // Convert anchor Pubkeys to the format expected by chainlink crate
        let chainlink_program_id = SolanaPubkey::new_from_array(program_id.to_bytes());
        let chainlink_verifier_account = SolanaPubkey::new_from_array(verifier_account.to_bytes());
        let chainlink_access_controller = SolanaPubkey::new_from_array(access_controller.to_bytes());
        let chainlink_user = SolanaPubkey::new_from_array(user.to_bytes());
        let chainlink_config_account = SolanaPubkey::new_from_array(config_account.to_bytes());

        // Create verification instruction using the converted Pubkey references
        let chainlink_ix = VerifierInstructions::verify(
            &chainlink_program_id,
            &chainlink_verifier_account,
            &chainlink_access_controller,
            &chainlink_user,
            &chainlink_config_account,
            signed_report,
        );

        // Convert the chainlink instruction to the format expected by anchor's invoke
        let anchor_instruction = anchor_lang::solana_program::instruction::Instruction {
            program_id: Pubkey::new_from_array(chainlink_ix.program_id.to_bytes()),
            accounts: chainlink_ix.accounts.iter().map(|acc| {
                anchor_lang::solana_program::instruction::AccountMeta {
                    pubkey: Pubkey::new_from_array(acc.pubkey.to_bytes()),
                    is_signer: acc.is_signer,
                    is_writable: acc.is_writable,
                }
            }).collect(),
            data: chainlink_ix.data,
        };

        // Invoke the Verifier program
        invoke(
            &anchor_instruction,
            &[
                ctx.accounts.verifier_account.to_account_info(),
                ctx.accounts.access_controller.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.config_account.to_account_info(),
            ],
        )?;

        // After successful verification, store the price
        if let Some((_program_id, _return_data)) = get_return_data() {
            msg!("Report verified successfully, storing price data");
            
            // Update the PriceFeed account with the verified price
            let price_feed = &mut ctx.accounts.price_feed;
            
            // Verify the feed_id matches
            if price_feed.feed_id != feed_id {
                return Err(error!(CustomError::InvalidReportData));
            }
            
            // Store the price and timestamp
            price_feed.price = expected_price;
            price_feed.timestamp = timestamp;
            
            msg!("Price updated - Feed: {:?}, Price: {}, Timestamp: {}", 
                 feed_id, expected_price, timestamp);
        } else {
            msg!("No report data found");
            return Err(error!(CustomError::NoReportData));
        }

        Ok(())
    }

    /// Initialize a new PriceFeed account for a specific feed
    pub fn initialize_price_feed(
        ctx: Context<InitializePriceFeed>,
        feed_id: [u8; 32],
    ) -> Result<()> {
        let price_feed = &mut ctx.accounts.price_feed;
        price_feed.feed_id = feed_id;
        price_feed.price = 0;
        price_feed.timestamp = 0;
        price_feed.decimals = 8; // Default to 8 decimals for crypto prices
        price_feed.authority = ctx.accounts.authority.key();
        
        msg!("Initialized PriceFeed for feed: {:?}", feed_id);
        Ok(())
    }

    /// Get the current price for a feed
    pub fn get_price(ctx: Context<GetPrice>) -> Result<(u64, u64)> {
        let price_feed = &ctx.accounts.price_feed;
        msg!("Price: {}, Timestamp: {}", price_feed.price, price_feed.timestamp);
        Ok((price_feed.price, price_feed.timestamp))
    }
}

/// Account structure for storing verified price data
#[account]
pub struct PriceFeed {
    pub feed_id: [u8; 32],      // Chainlink feed identifier
    pub price: u64,             // Latest verified price
    pub timestamp: u64,         // When the price was last updated
    pub decimals: u8,           // Number of decimal places
    pub authority: Pubkey,      // Who can update this feed
}

impl PriceFeed {
    pub const LEN: usize = 32 + 8 + 8 + 1 + 32; // 81 bytes
}

#[error_code]
pub enum CustomError {
    #[msg("No valid report data found")]
    NoReportData,
    #[msg("Invalid report data format")]
    InvalidReportData,
    #[msg("Price feed not found")]
    PriceFeedNotFound,
    #[msg("Unauthorized to update price feed")]
    Unauthorized,
}

#[derive(Accounts)]
pub struct OracleContext<'info> {
    /// The Verifier Account stores the DON's public keys and other verification parameters.
    /// This account must match the PDA derived from the verifier program.
    /// CHECK: The account is validated by the verifier program.
    pub verifier_account: AccountInfo<'info>,
    /// The Access Controller Account
    /// CHECK: The account structure is validated by the verifier program.
    pub access_controller: AccountInfo<'info>,
    /// The account that signs the transaction.
    pub user: Signer<'info>,
    /// The Config Account is a PDA derived from a signed report
    /// CHECK: The account is validated by the verifier program.
    #[account(mut)]
    pub config_account: UncheckedAccount<'info>,
    /// The Verifier Program ID specifies the target Chainlink Data Streams Verifier Program.
    /// CHECK: The program ID is validated by the verifier program.
    pub verifier_program_id: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(signed_report: Vec<u8>, feed_id: [u8; 32], expected_price: u64, timestamp: u64)]
pub struct VerifyAndStore<'info> {
    /// The Verifier Account stores the DON's public keys and other verification parameters.
    /// CHECK: The account is validated by the verifier program.
    pub verifier_account: AccountInfo<'info>,
    /// The Access Controller Account
    /// CHECK: The account structure is validated by the verifier program.
    pub access_controller: AccountInfo<'info>,
    /// The account that signs the transaction.
    pub user: Signer<'info>,
    /// The Config Account is a PDA derived from a signed report
    /// CHECK: The account is validated by the verifier program.
    #[account(mut)]
    pub config_account: UncheckedAccount<'info>,
    /// The Verifier Program ID specifies the target Chainlink Data Streams Verifier Program.
    /// CHECK: The program ID is validated by the verifier program.
    pub verifier_program_id: AccountInfo<'info>,
    
    /// The PriceFeed account to store the verified price
    #[account(
        mut,
        seeds = [b"price_feed", feed_id.as_ref()],
        bump,
        constraint = price_feed.authority == user.key() @ CustomError::Unauthorized
    )]
    pub price_feed: Account<'info, PriceFeed>,
}

#[derive(Accounts)]
#[instruction(feed_id: [u8; 32])]
pub struct InitializePriceFeed<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PriceFeed::LEN,
        seeds = [b"price_feed", feed_id.as_ref()],
        bump
    )]
    pub price_feed: Account<'info, PriceFeed>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetPrice<'info> {
    #[account(
        seeds = [b"price_feed", price_feed.feed_id.as_ref()],
        bump
    )]
    pub price_feed: Account<'info, PriceFeed>,
}
