use anyhow::{Result, Context};
use chainlink_data_streams_report::feed_id::ID;
use chainlink_data_streams_report::report::{decode_full_report, v3::ReportDataV3};
use chainlink_data_streams_sdk::client::Client;
use chainlink_data_streams_sdk::config::Config;
use log::{info, debug, warn};
use num_bigint::BigInt;
use num_traits::{ToPrimitive, Zero};
use std::env;

/// Chainlink Data Streams client for fetching and decoding reports
pub struct ChainlinkClient {
    client: Client,
    sol_usd_feed_id: ID,
}

impl ChainlinkClient {
    /// Create a new Chainlink client from environment variables
    pub fn from_env() -> Result<Self> {
        dotenv::dotenv().ok(); // Load .env file
        
        let client_id = env::var("DATASTREAMS_CLIENT_ID")
            .context("DATASTREAMS_CLIENT_ID not found in environment")?;
        let client_secret = env::var("DATASTREAMS_CLIENT_SECRET")
            .context("DATASTREAMS_CLIENT_SECRET not found in environment")?;
        let rest_url = env::var("DATASTREAMS_HOSTNAME")
            .context("DATASTREAMS_HOSTNAME not found in environment")?;
        let ws_url = env::var("DATASTREAMS_WS_HOSTNAME")
            .context("DATASTREAMS_WS_HOSTNAME not found in environment")?;
        let feed_id_hex = env::var("FEED_ID")
            .context("FEED_ID not found in environment")?;

        info!("🔗 Initializing Chainlink Data Streams client");
        info!("📊 REST URL: {}", rest_url);
        info!("🔌 WebSocket URL: {}", ws_url);
        info!("🎯 SOL/USD Feed ID: {}", feed_id_hex);

        // Initialize the configuration
        let config = Config::new(
            client_id,
            client_secret,
            rest_url,
            ws_url,
        ).build()
        .context("Failed to build Chainlink config")?;

        // Initialize the client
        let client = Client::new(config)
            .context("Failed to create Chainlink client")?;

        // Parse the feed ID
        let sol_usd_feed_id = ID::from_hex_str(&feed_id_hex)
            .context("Failed to parse SOL/USD feed ID")?;

        Ok(Self {
            client,
            sol_usd_feed_id,
        })
    }
    
    /// Fetch the latest compressed report for SOL/USD
    pub async fn fetch_latest_sol_usd_report(&self) -> Result<Vec<u8>> {
        info!("🔗 Fetching latest SOL/USD report from Chainlink Data Streams");
        
        let response = self.client
            .get_latest_report(self.sol_usd_feed_id)
            .await
            .context("Failed to fetch latest report from Chainlink")?;

        info!("✅ Received report from Chainlink");
        debug!("📊 Feed ID: {}", response.report.feed_id.to_hex_string());
        debug!("⏰ Valid from: {}", response.report.valid_from_timestamp);
        debug!("🕐 Observations: {}", response.report.observations_timestamp);
        
        // Log the raw report for debugging
        info!("🔍 Raw full_report (first 100 chars): {}", &response.report.full_report[0..100.min(response.report.full_report.len())]);

        // Convert hex string to bytes (remove 0x prefix if present)
        let hex_report = if response.report.full_report.starts_with("0x") {
            &response.report.full_report[2..]
        } else {
            &response.report.full_report
        };

        let decoded_report = hex::decode(hex_report)
            .context("Failed to decode hex report data")?;

        info!("📦 Decoded report size: {} bytes", decoded_report.len());
        info!("🔍 First 32 bytes: {:?}", &decoded_report[0..32.min(decoded_report.len())]);
        
        Ok(decoded_report)
    }

    /// Fetch a report for a specific timestamp
    #[allow(dead_code)]
    pub async fn fetch_sol_usd_report_at_timestamp(&self, timestamp: i64) -> Result<Vec<u8>> {
        info!("🔗 Fetching SOL/USD report at timestamp: {}", timestamp);
        
        let timestamp_u128 = timestamp as u128;
        let response = self.client
            .get_report(self.sol_usd_feed_id, timestamp_u128)
            .await
            .context("Failed to fetch report at timestamp from Chainlink")?;

        info!("✅ Received historical report from Chainlink");
        debug!("📊 Feed ID: {}", response.report.feed_id.to_hex_string());
        debug!("⏰ Valid from: {}", response.report.valid_from_timestamp);
        debug!("🕐 Observations: {}", response.report.observations_timestamp);

        // Convert hex string to bytes
        let hex_report = if response.report.full_report.starts_with("0x") {
            &response.report.full_report[2..]
        } else {
            &response.report.full_report
        };

        let compressed_report = hex::decode(hex_report)
            .context("Failed to decode hex report data")?;

        info!("📦 Compressed report size: {} bytes", compressed_report.len());
        Ok(compressed_report)
    }
    
    /// Decode a compressed report into structured data
    pub fn decode_report(&self, compressed_report: &[u8]) -> Result<ReportDataV3> {
        info!("📊 Decoding compressed report");
        debug!("📦 Report size: {} bytes", compressed_report.len());

        // Decode the full report structure
        let (_report_context, report_blob) = decode_full_report(compressed_report)
            .context("Failed to decode full report structure")?;

        // Decode the report data using V3 schema
        let report_data = ReportDataV3::decode(&report_blob)
            .context("Failed to decode report data as V3")?;

        info!("✅ Successfully decoded report data");
        info!("💰 Raw Price: {}", report_data.benchmark_price);
        info!("📉 Raw Bid: {}", report_data.bid);
        info!("📈 Raw Ask: {}", report_data.ask);
        info!("⏰ Observations timestamp: {}", report_data.observations_timestamp);
        info!("🔢 Valid from timestamp: {}", report_data.valid_from_timestamp);
        
        // Debug: Let's see what the actual scale is
        let price_f64 = self.bigint_to_f64(&report_data.benchmark_price);
        info!("🔍 Debug - Raw price as f64: {}", price_f64);
        info!("🔍 Debug - Price / 1e8: {}", price_f64 / 100_000_000.0);
        info!("🔍 Debug - Price / 1e18: {}", price_f64 / 1_000_000_000_000_000_000.0);

        Ok(report_data)
    }

    /// Get the SOL/USD feed ID
    pub fn get_sol_usd_feed_id(&self) -> &ID {
        &self.sol_usd_feed_id
    }

    /// Fetch and decode the latest SOL/USD price in one call
    pub async fn get_latest_sol_usd_price(&self) -> Result<ReportDataV3> {
        let compressed_report = self.fetch_latest_sol_usd_report().await?;
        let decoded_report = self.decode_report(&compressed_report)?;
        Ok(decoded_report)
    }

    /// Validate that the report data is reasonable
    pub fn validate_report_data(&self, report_data: &ReportDataV3) -> Result<()> {
        // Basic validation checks
        if report_data.benchmark_price <= BigInt::zero() {
            anyhow::bail!("Invalid price: must be positive");
        }

        if report_data.bid > report_data.benchmark_price {
            warn!("⚠️ Bid price higher than benchmark price");
        }

        if report_data.ask < report_data.benchmark_price {
            warn!("⚠️ Ask price lower than benchmark price");
        }

        // Check timestamp is recent (within last hour)
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let obs_timestamp = report_data.observations_timestamp as i64;
        if (now - obs_timestamp).abs() > 3600 {
            warn!("⚠️ Report data is more than 1 hour old");
        }

        info!("✅ Report data validation passed");
        Ok(())
    }

    /// Helper function to convert BigInt price to f64 for display
    pub fn bigint_to_f64(&self, price: &BigInt) -> f64 {
        price.to_f64().unwrap_or(0.0)
    }
}
