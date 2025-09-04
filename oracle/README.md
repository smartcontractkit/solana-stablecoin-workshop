# Chainlink Oracle System Documentation

## Overview

This oracle system integrates **Chainlink Data Streams** with **Solana** to provide verified price feeds for a stablecoin system. The architecture consists of two main components:

1. **Oracle Program** - On-chain Solana program that verifies Chainlink reports and stores price data
2. **Rust Client** - Off-chain client that fetches real-time data from Chainlink and updates the oracle

## Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Chainlink Data    │    │    Rust Client      │    │   Oracle Program    │
│     Streams API     │───▶│                     │───▶│    (On-chain)       │
│                     │    │  - Fetches reports  │    │  - Verifies reports │
│  - SOL/USD feeds    │    │  - Snappy compress  │    │  - Stores prices    │
│  - Real-time data   │    │  - Sends to oracle  │    │  - Provides feeds   │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                                                │
                                                                ▼
                                                       ┌─────────────────────┐
                                                       │  Stablecoin Program │
                                                       │                     │
                                                       │  - Uses price feeds │
                                                       │  - Mints stablecoins│
                                                       │  - Manages collateral│
                                                       └─────────────────────┘
```

## Project Structure

```
oracle/
├── README.md                    # This documentation
├── Anchor.toml                  # Anchor workspace configuration
├── package.json                 # TypeScript dependencies
├── programs/                    # Solana programs
│   ├── oracle/                  # Oracle program
│   │   ├── Cargo.toml          # Oracle program dependencies
│   │   └── src/lib.rs          # Oracle program implementation
│   └── stablecoin/             # Stablecoin program
│       ├── Cargo.toml          # Stablecoin program dependencies
│       └── src/lib.rs          # Stablecoin program implementation
├── client/                     # Rust client
│   ├── Cargo.toml              # Client dependencies
│   ├── src/
│   │   ├── main.rs             # CLI interface
│   │   ├── chainlink.rs        # Chainlink Data Streams integration
│   │   ├── oracle_client.rs    # Oracle program client
│   │   └── stablecoin_client.rs # Stablecoin program client
│   └── .env                    # Environment configuration
├── tests/                      # TypeScript tests
│   ├── enhanced_oracle_test.ts # Comprehensive oracle tests
│   └── verify_test.ts          # Basic verification tests
└── target/                     # Build artifacts
    ├── deploy/                 # Deployed program binaries
    ├── idl/                    # Generated IDL files
    └── types/                  # Generated TypeScript types
```

## Quick Start

### Prerequisites

1. **Solana CLI** installed and configured
2. **Anchor Framework** (v0.31.1)
3. **Node.js** and **Yarn**
4. **Rust** toolchain
5. **Chainlink Data Streams API credentials**

### Setup

1. **Install dependencies:**
   ```bash
   # Install TypeScript dependencies
   yarn install
   
   # Install Rust client dependencies
   cd client && cargo build
   ```

2. **Configure environment:**
   ```bash
   # Copy and configure environment variables
   cp client/.env.example client/.env
   # Edit client/.env with your Chainlink credentials
   ```

3. **Configure Solana:**
   ```bash
   # Set to devnet
   solana config set --url devnet
   
   # Create/load keypair
   solana-keygen new  # or load existing
   
   # Airdrop SOL for testing
   solana airdrop 2
   ```

## Components

### 1. Oracle Program (`programs/oracle/src/lib.rs`)

**Purpose:** Verifies Chainlink Data Streams reports and stores verified price data on-chain.

**Key Functions:**
- `verify_and_store()` - Verifies a Chainlink report and stores the price
- `initialize_price_feed()` - Creates a new price feed account
- `get_price()` - Retrieves current price for a feed

**Account Structure:**
```rust
pub struct PriceFeed {
    pub feed_id: [u8; 32],      // Chainlink feed identifier
    pub price: u64,             // Price with 8 decimals
    pub timestamp: u64,         // Last update timestamp
    pub decimals: u8,           // Price decimals (8)
    pub authority: Pubkey,      // Update authority
}
```

### 2. Stablecoin Program (`programs/stablecoin/src/lib.rs`)

**Purpose:** Manages stablecoin minting/burning using oracle price feeds.

**Key Functions:**
- `initialize_mint()` - Initialize the stablecoin mint
- `deposit_and_mint()` - Deposit collateral and mint stablecoins

### 3. Rust Client (`client/src/`)

**Purpose:** Off-chain client that fetches real-time data and updates the oracle.

**Components:**

#### `main.rs` - CLI Interface
```bash
# Available commands:
cargo run -- fetch-price        # Fetch latest SOL/USD price
cargo run -- update-oracle      # Update oracle with latest price
cargo run -- mint-stablecoin    # Calculate stablecoin amounts
cargo run -- demo              # Demo price fetching
cargo run -- monitor           # Continuous price monitoring
```

#### `chainlink.rs` - Data Streams Integration
- Fetches real-time SOL/USD data from Chainlink testnet
- Decodes compressed reports using `chainlink-data-streams-report`
- Validates price data and timestamps

#### `oracle_client.rs` - Oracle Program Client
- Sends verified reports to the oracle program
- Applies snappy compression (required by verifier)
- Manages account derivation and transaction construction

## Testing

### TypeScript Tests

**Run all tests:**
```bash
anchor test
```

**Individual test files:**

1. **`enhanced_oracle_test.ts`** - Comprehensive oracle testing
   - Tests report parsing with mock data
   - Verifies price feed initialization
   - Tests verification and storage
   - Validates price reading

2. **`verify_test.ts`** - Basic verification tests
   - Simple verification workflow
   - Error handling tests

### Rust Client Tests

**Test client functionality:**
```bash
cd client

# Test price fetching
cargo run -- fetch-price

# Test oracle updates (requires funded wallet)
cargo run -- update-oracle

# Test demo calculations
cargo run -- demo
```

## Deployment

### Deploy Programs

```bash
# Build and deploy both programs
anchor build
anchor deploy

# Deploy specific program
anchor deploy --program oracle
anchor deploy --program stablecoin
```

**Program IDs (Devnet):**
- Oracle: `9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1`
- Stablecoin: `CtQ7Dim2Q623X6R4JuGnGXmCLLi3uAzrY2dSdqJyhCSD`

### Environment Configuration

**Required environment variables** (`client/.env`):
```bash
# Chainlink Data Streams API
FEED_ID=0x0003d338ea2ac3be9e026033b1aa601673c37bab5e13851c59966f9f820754d6
DATASTREAMS_HOSTNAME=https://api.testnet-dataengine.chain.link
DATASTREAMS_WS_HOSTNAME=wss://api.testnet-dataengine.chain.link/ws
DATASTREAMS_CLIENT_ID=your_client_id
DATASTREAMS_CLIENT_SECRET=your_client_secret
```

## Usage Examples

### 1. Fetch Latest Price

```bash
cd client
cargo run -- fetch-price
```

**Expected Output:**
```
✅ Successfully fetched SOL/USD price data:
💰 Price: $208.53949000
📉 Bid:   $208.53174615
📈 Ask:   $208.54459000
⏰ Observations timestamp: 1756854729
```

### 2. Update Oracle

```bash
cd client
cargo run -- update-oracle
```

**Expected Output:**
```
🔑 Loading keypair from: ~/.config/solana/id.json
💰 Account balance: 16.310369797 SOL
✅ PriceFeed account already exists
📊 Price to store: $208.67029000
✅ Oracle updated successfully!
🔗 Transaction: iStib8JTEVjeLhjpLXas77ekDYFF3knWPCj5623qdDRcPYS8TCbxox5f5dX7ne8qcg4bGNYT45cVQjM6yxCBc9k
```

### 3. Run Oracle Tests

```bash
anchor test
```

**Expected Output:**
```
🧪 Enhanced Oracle Test with Data Streams SDK Parsing
✅ Data Streams report parsing: PASSED
✅ PriceFeed initialization: PASSED
✅ Verification and storage: PASSED
✅ Price reading: PASSED
✅ get_price instruction: PASSED
```

## Technical Details

### Data Flow

1. **Client fetches data** from Chainlink Data Streams API
2. **Report decoding** using `chainlink-data-streams-report` crate
3. **Snappy compression** applied to report (required by verifier)
4. **Transaction construction** with proper account derivation
5. **On-chain verification** by Chainlink verifier program
6. **Price storage** in oracle program's PriceFeed account

### Key Technical Insights

**Snappy Compression Requirement:**
- Real Chainlink Data Streams reports must be snappy compressed before sending to the verifier
- This was discovered through reverse engineering the working test vs. real data formats

**Account Derivation:**
- Config account uses first 32 bytes of the **original** (uncompressed) report
- Price feed account uses feed ID as seed
- Verifier account uses "verifier" string as seed

**Price Scaling:**
- Chainlink provides prices with 18 decimals
- Oracle stores prices with 8 decimals
- Client handles conversion: `price / 1e10`

## Troubleshooting

### Common Issues

1. **"Decompression failed" error:**
   - Ensure snappy compression is applied to reports
   - Check report format matches expected structure

2. **"AccountOwnedByWrongProgram" error:**
   - Verify access controller address is correct
   - Check verifier program ID matches devnet deployment

3. **"Insufficient funds" error:**
   - Ensure wallet has sufficient SOL for transactions
   - Run `solana airdrop 2` on devnet

4. **Client compilation errors:**
   - Check Rust version compatibility
   - Verify all dependencies are properly installed

### Debug Commands

```bash
# Check account balances
solana balance

# View transaction logs
solana logs --url devnet

# Check program deployment
solana program show 9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1

# Debug client with verbose logging
RUST_LOG=debug cargo run -- update-oracle
```

## Development

### Adding New Features

1. **Program changes:** Modify `programs/oracle/src/lib.rs`
2. **Client changes:** Update relevant files in `client/src/`
3. **Tests:** Add tests in `tests/` directory
4. **Rebuild:** `anchor build && cd client && cargo build`

### Code Structure

**Program Architecture:**
- Uses Anchor framework for Solana program development
- Implements Cross-Program Invocation (CPI) to Chainlink verifier
- Stores verified data in Program Derived Addresses (PDAs)

**Client Architecture:**
- Async Rust client using `tokio`
- Direct RPC client (avoids anchor-client dependency conflicts)
- Modular design with separate concerns

## Next Steps

1. **Stablecoin Integration** - Complete stablecoin minting/burning cycle
2. **CCIP Integration** - Add cross-chain functionality
3. **Production Deployment** - Deploy to mainnet with proper security
4. **Monitoring** - Add comprehensive logging and alerting

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review test outputs for expected behavior
3. Use debug logging for detailed error information
4. Verify environment configuration is correct

