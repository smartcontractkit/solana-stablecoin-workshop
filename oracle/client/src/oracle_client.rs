use anyhow::Result;
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    pubkey::Pubkey,
    instruction::{Instruction, AccountMeta},
    signer::{Signer, keypair::Keypair},
    transaction::Transaction,
    system_program,
};
use chainlink_data_streams_report::report::v3::ReportDataV3;
use num_traits::ToPrimitive;
use num_bigint::BigInt;
use snap::raw::Encoder;

// Constants for Chainlink Data Streams on Devnet
const VERIFIER_PROGRAM_ID: &str = "Gt9S41PtjR58CbG9JhJ3J6vxesqrNAswbWYbLNTMZA3c";
const ACCESS_CONTROLLER: &str = "2k3DsgwBoqrnvXKVvd7jX7aptNxdcRBdcd5HkYsGgbrb";

/// Client for interacting with the Oracle program
pub struct OracleClient {
    rpc_client: RpcClient,
    program_id: Pubkey,
    verifier_program_id: Pubkey,
    access_controller: Pubkey,
}

impl OracleClient {
    pub fn new(rpc_url: &str, program_id: Pubkey) -> Result<Self> {
        let verifier_program_id = VERIFIER_PROGRAM_ID.parse()
            .map_err(|_| anyhow::anyhow!("Invalid verifier program ID"))?;
        let access_controller = ACCESS_CONTROLLER.parse()
            .map_err(|_| anyhow::anyhow!("Invalid access controller"))?;
            
        Ok(Self {
            rpc_client: RpcClient::new(rpc_url),
            program_id,
            verifier_program_id,
            access_controller,
        })
    }
    
    /// Verify and store price data using real Chainlink Data Streams report
    pub async fn verify_and_store(
        &self,
        compressed_report: Vec<u8>,
        report_data: &ReportDataV3,
        feed_id: [u8; 32],
        payer: &Keypair,
    ) -> Result<String> {
        println!("🔮 Verifying and storing price data in oracle");
        println!("📦 Report size: {} bytes", compressed_report.len());
        println!("💰 Price: {}", report_data.benchmark_price);
        println!("⏰ Timestamp: {}", report_data.observations_timestamp);
        
        // Derive required PDAs
        let (verifier_account, _) = Pubkey::find_program_address(
            &[b"verifier"],
            &self.verifier_program_id,
        );
        
        // Derive config account (uses first 32 bytes of the ORIGINAL report as seed, like the working test)
        let (config_account, _) = Pubkey::find_program_address(
            &[&compressed_report[0..32]], // First 32 bytes of the original report
            &self.verifier_program_id,
        );
        
        let (price_feed_pda, _) = Pubkey::find_program_address(
            &[b"price_feed", &feed_id],
            &self.program_id,
        );
        
        // Convert BigInt price to u64 with proper scaling
        // Chainlink uses 18 decimals, but we need to scale it down to fit in u64
        // We'll use 8 decimals for the oracle (like traditional price feeds)
        let divisor = BigInt::from(10_000_000_000i64); // 1e10 to convert 18 decimals to 8 decimals
        let price_scaled = &report_data.benchmark_price / &divisor;
        let expected_price = price_scaled
            .to_u64()
            .ok_or_else(|| anyhow::anyhow!("Price too large to fit in u64 even after scaling"))?;
        
        let timestamp = report_data.observations_timestamp as u64;
        
        // Accounts derived successfully
        
        // Compress report using snappy
        let mut encoder = Encoder::new();
        let snappy_compressed = encoder.compress_vec(&compressed_report)
            .map_err(|e| anyhow::anyhow!("Failed to compress report: {}", e))?;
        
        // Use the snappy compressed version for the transaction
        let final_report = snappy_compressed;
        
        // Create instruction data (this would need to match the Anchor IDL)
        // For now, let's create a placeholder instruction
        let instruction_data = self.create_verify_and_store_instruction_data(
            &final_report,
            &feed_id,
            expected_price,
            timestamp,
        )?;
        
        let accounts = vec![
            AccountMeta::new_readonly(verifier_account, false),
            AccountMeta::new_readonly(self.access_controller, false),
            AccountMeta::new_readonly(payer.pubkey(), true),
            AccountMeta::new(config_account, false),
            AccountMeta::new_readonly(self.verifier_program_id, false),
            AccountMeta::new(price_feed_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ];
        
        let instruction = Instruction {
            program_id: self.program_id,
            accounts,
            data: instruction_data,
        };
        
        // Create and send transaction
        let recent_blockhash = self.rpc_client.get_latest_blockhash()?;
        let transaction = Transaction::new_signed_with_payer(
            &[instruction],
            Some(&payer.pubkey()),
            &[payer],
            recent_blockhash,
        );
        
        println!("📤 Sending verify_and_store transaction...");
        let signature = self.rpc_client.send_and_confirm_transaction(&transaction)?;
        println!("✅ Transaction confirmed: {}", signature);
        
        Ok(signature.to_string())
    }
    
    /// Initialize a PriceFeed account for the given feed_id
    pub async fn initialize_price_feed(
        &self,
        feed_id: [u8; 32],
        payer: &Keypair,
    ) -> Result<String> {
        println!("🏗️ Initializing PriceFeed account for feed: {}", hex::encode(&feed_id));
        
        let (price_feed_pda, _) = Pubkey::find_program_address(
            &[b"price_feed", &feed_id],
            &self.program_id,
        );
        
        println!("📍 PriceFeed PDA: {}", price_feed_pda);
        
        // Check if account already exists
        match self.rpc_client.get_account(&price_feed_pda) {
            Ok(_) => {
                println!("✅ PriceFeed account already exists");
                return Ok("account_already_exists".to_string());
            }
            Err(_) => {
                println!("🔨 Creating new PriceFeed account");
            }
        }
        
        // Create instruction data for initialize_price_feed
        // Discriminator from IDL: [68, 180, 81, 20, 102, 213, 145, 233]
        let mut data = Vec::new();
        data.extend_from_slice(&[68, 180, 81, 20, 102, 213, 145, 233]);
        data.extend_from_slice(&feed_id); // feed_id: [u8; 32]
        
        let accounts = vec![
            AccountMeta::new(price_feed_pda, false),
            AccountMeta::new_readonly(payer.pubkey(), true),
            AccountMeta::new_readonly(system_program::id(), false),
        ];
        
        let instruction = Instruction {
            program_id: self.program_id,
            accounts,
            data,
        };
        
        let recent_blockhash = self.rpc_client.get_latest_blockhash()?;
        let transaction = Transaction::new_signed_with_payer(
            &[instruction],
            Some(&payer.pubkey()),
            &[payer],
            recent_blockhash,
        );
        
        println!("📤 Sending initialize_price_feed transaction...");
        let signature = self.rpc_client.send_and_confirm_transaction(&transaction)?;
        println!("✅ PriceFeed initialized: {}", signature);
        
        Ok(signature.to_string())
    }

    /// Create instruction data for verify_and_store using correct Anchor format
    fn create_verify_and_store_instruction_data(
        &self,
        compressed_report: &[u8],
        feed_id: &[u8; 32],
        expected_price: u64,
        timestamp: u64,
    ) -> Result<Vec<u8>> {
        let mut data = Vec::new();
        
        // Instruction discriminator from IDL: [147, 8, 128, 128, 175, 219, 217, 252]
        data.extend_from_slice(&[147, 8, 128, 128, 175, 219, 217, 252]);
        
        // Serialize parameters according to Anchor format:
        // 1. signed_report: bytes (length prefix + data)
        data.extend_from_slice(&(compressed_report.len() as u32).to_le_bytes());
        data.extend_from_slice(compressed_report);
        
        // 2. feed_id: [u8; 32] (no length prefix for fixed arrays)
        data.extend_from_slice(feed_id);
        
        // 3. expected_price: u64
        data.extend_from_slice(&expected_price.to_le_bytes());
        
        // 4. timestamp: u64
        data.extend_from_slice(&timestamp.to_le_bytes());
        
        // Instruction data prepared
        
        Ok(data)
    }
    
    /// Read current price from oracle PriceFeed account
    #[allow(dead_code)]
    pub async fn get_price(&self, feed_id: [u8; 32]) -> Result<(u64, u64)> {
        let (price_feed_pda, _) = Pubkey::find_program_address(
            &[b"price_feed", &feed_id],
            &self.program_id,
        );
        
        println!("📊 Reading price from PDA: {}", price_feed_pda);
        
        // Try to fetch the account
        match self.rpc_client.get_account(&price_feed_pda) {
            Ok(account) => {
                println!("✅ Found PriceFeed account ({} bytes)", account.data.len());
                // TODO: Deserialize the PriceFeed struct to get actual price and timestamp
                // For now, return placeholder values
                Ok((0, 0))
            }
            Err(e) => {
                println!("⚠️ PriceFeed account not found: {}", e);
                Ok((0, 0))
            }
        }
    }
}
