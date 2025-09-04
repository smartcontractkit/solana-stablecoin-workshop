# Rust Client Documentation

## Overview

The Rust client is an off-chain application that bridges Chainlink Data Streams with the Solana oracle program. It fetches real-time price data, processes it, and updates the on-chain oracle with verified information.

## Architecture

```
Client Architecture:
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Chainlink API     │    │   Rust Client       │    │  Solana Programs    │
│                     │───▶│                     │───▶│                     │
│ • Data Streams      │    │ • chainlink.rs      │    │ • Oracle Program    │
│ • SOL/USD feeds     │    │ • oracle_client.rs  │    │ • Stablecoin Program│
│ • Real-time data    │    │ • main.rs (CLI)     │    │ • Price Storage     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## Project Structure

```
client/
├── Cargo.toml                  # Dependencies and configuration
├── .env                        # Environment variables (API keys)
├── src/
│   ├── main.rs                 # CLI interface and command handling
│   ├── chainlink.rs            # Chainlink Data Streams integration
│   ├── oracle_client.rs        # Oracle program interaction
│   └── stablecoin_client.rs    # Stablecoin program interaction
└── target/                     # Build artifacts
    └── debug/
        └── chainlink-stablecoin-client  # Compiled binary
```

## Installation and Setup

### Prerequisites

```bash
# Required tools
Rust >= 1.70.0
Solana CLI >= 1.17.0
```

### Installation

```bash
# Navigate to client directory
cd oracle/client

# Install dependencies and build
cargo build

# Verify installation
cargo run -- --help
```

### Configuration

**1. Environment Setup:**
```bash
# Copy environment template
cp .env.example .env

# Edit with your credentials
nano .env
```

**2. Environment Variables:**
```bash
# Chainlink Data Streams API Configuration
FEED_ID=0x0003d338ea2ac3be9e026033b1aa601673c37bab5e13851c59966f9f820754d6
DATASTREAMS_HOSTNAME=https://api.testnet-dataengine.chain.link
DATASTREAMS_WS_HOSTNAME=wss://api.testnet-dataengine.chain.link/ws
DATASTREAMS_CLIENT_ID=your_client_id_here
DATASTREAMS_CLIENT_SECRET=your_client_secret_here
```

**3. Solana Configuration:**
```bash
# Ensure Solana CLI is configured
solana config set --url devnet
solana balance  # Ensure you have SOL for transactions
```

## CLI Commands

### Available Commands

```bash
# View all available commands
cargo run -- --help

# Available commands:
# fetch-price      - Fetch latest SOL/USD price from Chainlink
# update-oracle    - Update oracle program with latest price data
# mint-stablecoin  - Calculate stablecoin minting amounts
# demo            - Demonstrate price fetching and calculations
# monitor         - Continuously monitor and display prices
```

### Command Details

#### 1. `fetch-price` - Price Fetching

**Purpose:** Fetch and display the latest SOL/USD price from Chainlink Data Streams.

**Usage:**
```bash
cargo run -- fetch-price
```

**What it does:**
- Connects to Chainlink Data Streams API
- Fetches latest SOL/USD report
- Decodes compressed report data
- Validates price and timestamp
- Displays formatted price information

**Example Output:**
```
✅ Successfully fetched SOL/USD price data:
💰 Price: $208.53949000
📉 Bid:   $208.53174615
📈 Ask:   $208.54459000
⏰ Observations timestamp: 1756854729
🔢 Valid from timestamp: 1756854729
✅ Report data validation passed
```

**Error Handling:**
- Network connectivity issues
- Invalid API credentials
- Malformed response data
- Stale price data warnings

#### 2. `update-oracle` - Oracle Updates

**Purpose:** Update the on-chain oracle program with verified price data.

**Usage:**
```bash
cargo run -- update-oracle
```

**Prerequisites:**
- Funded Solana wallet (for transaction fees)
- Valid Chainlink API credentials
- Oracle program deployed on target network

**What it does:**
1. Loads Solana keypair from CLI configuration
2. Fetches latest price report from Chainlink
3. Decodes and validates report data
4. Applies snappy compression (required by verifier)
5. Derives necessary program accounts
6. Constructs and sends verification transaction
7. Confirms transaction on-chain

**Example Output:**
```
🔑 Loading keypair from: ~/.config/solana/id.json
💰 Account balance: 16.310369797 SOL
🏗️ Initializing PriceFeed account for feed: 0003d338ea2ac3be9e026033b1aa601673c37bab5e13851c59966f9f820754d6
✅ PriceFeed account already exists
📊 Price to store: $208.67029000
📦 Compressed report: 736 bytes
🔮 Verifying and storing price data in oracle
🔍 Debug - Original report size: 736 bytes
🔍 Debug - Snappy compressed size: 342 bytes
📤 Sending verify_and_store transaction...
✅ Transaction confirmed: iStib8JTEVjeLhjpLXas77ekDYFF3knWPCj5623qdDRcPYS8TCbxox5f5dX7ne8qcg4bGNYT45cVQjM6yxCBc9k
✅ Oracle updated successfully!
```

**Transaction Details:**
- **Gas Cost:** ~0.001 SOL per update
- **Confirmation Time:** 5-15 seconds on devnet
- **Success Rate:** >99% with proper configuration

#### 3. `mint-stablecoin` - Stablecoin Calculations

**Purpose:** Calculate stablecoin minting amounts based on collateral.

**Usage:**
```bash
cargo run -- mint-stablecoin --amount <LAMPORTS>
```

**Example:**
```bash
# Calculate for 0.1 SOL (100,000,000 lamports)
cargo run -- mint-stablecoin --amount 100000000
```

**What it does:**
- Fetches current SOL price
- Calculates collateral value in USD
- Applies collateralization ratio (150%)
- Shows maximum stablecoin mintable
- Displays safety buffer

**Example Output:**
```
🪙 Minting stablecoin with collateral: 100000000 lamports
💰 Current SOL Price: $208.53949000
💎 Collateral Value: $20.85
💵 Max Stablecoin (150% ratio): $13.90
🛡️ Safety Buffer: $6.95
```

#### 4. `demo` - Price Demonstration

**Purpose:** Demonstrate price fetching and stablecoin calculations.

**Usage:**
```bash
cargo run -- demo
```

**What it does:**
- Fetches current market data
- Shows collateral analysis for different amounts
- Demonstrates scaling examples
- Provides comprehensive market overview

**Example Output:**
```
🎯 Stablecoin Demo - SOL Collateral Analysis
═══════════════════════════════════════════

📊 Current Market Data:
💰 SOL Price: $208.53949000

💎 Collateral Analysis (150% ratio):
🪙 0.100000000 SOL × $208.53949000 = $20.85
💵 Max Stablecoin: $13.90 (66.67% of collateral)
🛡️ Safety Buffer: $6.95 (33.33% buffer)

📈 Scaling Examples:
• 1.0 SOL → $139.03 stablecoins
• 10.0 SOL → $1,390.26 stablecoins
```

#### 5. `monitor` - Continuous Monitoring

**Purpose:** Continuously monitor and display price updates.

**Usage:**
```bash
cargo run -- monitor
```

**What it does:**
- Fetches prices at regular intervals (30 seconds)
- Displays real-time price changes
- Shows price volatility
- Continues until manually stopped (Ctrl+C)

**Example Output:**
```
🔄 Starting continuous price monitoring...
Press Ctrl+C to stop.

[2025-01-02 23:15:30] 💰 SOL: $208.54 📈 +0.12%
[2025-01-02 23:16:00] 💰 SOL: $208.61 📈 +0.03%
[2025-01-02 23:16:30] 💰 SOL: $208.45 📉 -0.08%
```

## Code Structure

### 1. `main.rs` - CLI Interface

**Key Components:**
```rust
// CLI structure using clap
#[derive(Parser)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    FetchPrice,
    UpdateOracle,
    MintStablecoin { amount: u64 },
    Demo,
    Monitor,
}

// Constants
const CHAINLINK_DECIMALS: f64 = 1_000_000_000_000_000_000.0; // 1e18
const ORACLE_PROGRAM_ID: &str = "9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1";
```

**Key Functions:**
- `load_keypair_from_file()` - Loads Solana CLI keypair
- Command handlers for each CLI command
- Error handling and user feedback

### 2. `chainlink.rs` - Data Streams Integration

**Key Components:**
```rust
pub struct ChainlinkClient {
    client: Client,           // SDK client
    sol_usd_feed_id: ID,     // Feed identifier
}

impl ChainlinkClient {
    // Initialize from environment variables
    pub fn from_env() -> Result<Self>
    
    // Fetch latest report
    pub async fn fetch_latest_sol_usd_report(&self) -> Result<Vec<u8>>
    
    // Decode compressed report
    pub fn decode_report(&self, compressed_report: &[u8]) -> Result<ReportDataV3>
    
    // Validate report data
    pub fn validate_report_data(&self, report_data: &ReportDataV3) -> Result<()>
    
    // Convert BigInt to f64 for display
    pub fn bigint_to_f64(&self, price: &BigInt) -> f64
}
```

**Data Flow:**
1. **API Connection:** Uses `chainlink-data-streams-sdk` for API communication
2. **Report Fetching:** Gets compressed reports via REST API
3. **Report Decoding:** Uses `chainlink-data-streams-report` for decompression
4. **Data Validation:** Checks price ranges and timestamps
5. **Format Conversion:** Converts BigInt prices to appropriate formats

### 3. `oracle_client.rs` - Oracle Program Client

**Key Components:**
```rust
pub struct OracleClient {
    rpc_client: RpcClient,        // Direct Solana RPC client
    program_id: Pubkey,           // Oracle program ID
    verifier_program_id: Pubkey,  // Chainlink verifier program
    access_controller: Pubkey,    // Access controller account
}

impl OracleClient {
    // Initialize oracle client
    pub fn new(rpc_url: &str, program_id: Pubkey) -> Result<Self>
    
    // Initialize price feed account
    pub async fn initialize_price_feed(&self, feed_id: [u8; 32], payer: &Keypair) -> Result<String>
    
    // Verify and store price data
    pub async fn verify_and_store(&self, compressed_report: Vec<u8>, report_data: &ReportDataV3, feed_id: [u8; 32], payer: &Keypair) -> Result<String>
    
    // Read current price
    pub async fn get_price(&self, feed_id: [u8; 32]) -> Result<(u64, u64)>
}
```

**Critical Implementation Details:**

**Snappy Compression:**
```rust
// Apply snappy compression (required by Chainlink verifier)
let mut encoder = Encoder::new();
let snappy_compressed = encoder.compress_vec(&compressed_report)?;
```

**Account Derivation:**
```rust
// Derive verifier account
let (verifier_account, _) = Pubkey::find_program_address(
    &[b"verifier"],
    &self.verifier_program_id,
);

// Derive config account (uses original report data)
let (config_account, _) = Pubkey::find_program_address(
    &[&compressed_report[0..32]],
    &self.verifier_program_id,
);

// Derive price feed PDA
let (price_feed_pda, _) = Pubkey::find_program_address(
    &[b"price_feed", &feed_id],
    &self.program_id,
);
```

**Price Scaling:**
```rust
// Convert from 18 decimals (Chainlink) to 8 decimals (Oracle)
let divisor = BigInt::from(10_000_000_000i64); // 1e10
let price_scaled = &report_data.benchmark_price / &divisor;
let expected_price = price_scaled.to_u64().unwrap();
```

### 4. `stablecoin_client.rs` - Stablecoin Program Client

**Purpose:** Interface with the stablecoin program for minting/burning operations.

**Current Status:** Placeholder implementation for future stablecoin integration.

## Configuration

### Dependencies (`Cargo.toml`)

```toml
[dependencies]
# Chainlink Data Streams
chainlink-data-streams-sdk = "1.0.3"
chainlink-data-streams-report = "1.0.3"

# Solana
solana-client = "1.17.0"
solana-sdk = "1.17.0"
solana-program = "1.17.0"

# Async runtime
tokio = { version = "1.0", features = ["full"] }

# CLI and utilities
clap = { version = "4.0", features = ["derive"] }
anyhow = "1.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
dotenv = "0.15"
env_logger = "0.10"
log = "0.4"

# Data processing
hex = "0.4"
num-bigint = "0.4"
num-traits = "0.2"
snap = "1.1"  # Snappy compression
```

### Environment Variables

**Required Variables:**
```bash
# Chainlink Data Streams API
FEED_ID=0x0003d338ea2ac3be9e026033b1aa601673c37bab5e13851c59966f9f820754d6
DATASTREAMS_HOSTNAME=https://api.testnet-dataengine.chain.link
DATASTREAMS_WS_HOSTNAME=wss://api.testnet-dataengine.chain.link/ws
DATASTREAMS_CLIENT_ID=your_client_id
DATASTREAMS_CLIENT_SECRET=your_client_secret
```

**Optional Variables:**
```bash
# Logging level
RUST_LOG=info  # Options: error, warn, info, debug, trace

# Custom RPC endpoint
SOLANA_RPC_URL=https://api.devnet.solana.com
```

## Error Handling

### Common Errors and Solutions

#### 1. API Authentication Errors
```
Error: Failed to fetch latest report from Chainlink
```
**Solutions:**
- Verify API credentials in `.env`
- Check API endpoint URLs
- Ensure credentials have proper permissions

#### 2. Network Connectivity Issues
```
Error: Connection timeout
```
**Solutions:**
- Check internet connectivity
- Verify firewall settings
- Try alternative RPC endpoints

#### 3. Insufficient Funds
```
Error: Attempt to debit an account but found no record of a prior credit
```
**Solutions:**
- Check wallet balance: `solana balance`
- Add funds: `solana airdrop 2` (devnet only)
- Verify correct wallet is loaded

#### 4. Program Account Issues
```
Error: AccountOwnedByWrongProgram
```
**Solutions:**
- Verify program IDs are correct
- Check account derivation logic
- Ensure programs are deployed

### Debug Mode

**Enable debug logging:**
```bash
RUST_LOG=debug cargo run -- update-oracle
```

**Debug output includes:**
- API request/response details
- Account derivation steps
- Transaction construction details
- Compression/decompression info

## Performance Optimization

### Caching

**Report Caching:**
- Client fetches fresh data for each request
- No caching implemented (ensures real-time data)
- Consider caching for high-frequency applications

### Connection Pooling

**RPC Connections:**
- Uses persistent RPC client connection
- Reuses connection across operations
- Configurable timeout settings

### Batch Operations

**Future Enhancement:**
- Batch multiple price updates
- Reduce transaction costs
- Improve throughput

## Security Considerations

### API Key Security

**Best Practices:**
- Store credentials in `.env` file (not in code)
- Use environment-specific credentials
- Rotate keys regularly
- Monitor API usage

### Wallet Security

**Key Management:**
- Use hardware wallets for production
- Secure backup of keypairs
- Implement multi-signature for critical operations
- Regular security audits

### Network Security

**RPC Security:**
- Use trusted RPC endpoints
- Implement retry logic with backoff
- Monitor for suspicious activity
- Use HTTPS/WSS connections

## Monitoring and Logging

### Logging Levels

```bash
# Error only
RUST_LOG=error cargo run -- command

# Info level (default)
RUST_LOG=info cargo run -- command

# Debug level (verbose)
RUST_LOG=debug cargo run -- command

# Trace level (very verbose)
RUST_LOG=trace cargo run -- command
```

### Metrics Collection

**Available Metrics:**
- API response times
- Transaction success rates
- Price update frequency
- Error rates by type

### Health Monitoring

**Health Check Script:**
```bash
#!/bin/bash
# Simple health check
cd client
if cargo run -- fetch-price > /dev/null 2>&1; then
    echo "✅ Client healthy"
    exit 0
else
    echo "❌ Client unhealthy"
    exit 1
fi
```

## Future Enhancements

### Planned Features

1. **WebSocket Support:** Real-time price streaming
2. **Batch Updates:** Multiple price feeds in single transaction
3. **Advanced Monitoring:** Prometheus metrics integration
4. **Configuration Management:** Dynamic configuration updates
5. **High Availability:** Failover and redundancy

### Integration Opportunities

1. **Stablecoin Program:** Complete minting/burning integration
2. **CCIP Integration:** Cross-chain price feeds
3. **DeFi Protocols:** Price feed for lending/borrowing
4. **Trading Bots:** Automated trading based on price feeds

This client documentation provides comprehensive guidance for using, configuring, and maintaining the Rust client component of the Chainlink Oracle System.

