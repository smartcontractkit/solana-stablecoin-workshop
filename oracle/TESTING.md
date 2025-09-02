# Testing Guide

## Overview

This guide covers comprehensive testing for the Chainlink Oracle System, including both on-chain program tests and off-chain client tests.

## Test Architecture

```
Testing Structure:
├── TypeScript Tests (On-chain)
│   ├── enhanced_oracle_test.ts    # Full oracle workflow
│   └── verify_test.ts             # Basic verification
├── Rust Client Tests (Off-chain)
│   ├── Unit tests                 # Individual component tests
│   └── Integration tests          # End-to-end client tests
└── Manual Testing
    ├── Price fetching             # Real data validation
    ├── Oracle updates             # Live transaction tests
    └── Error scenarios            # Edge case handling
```

## TypeScript Tests (On-chain Programs)

### Setup

```bash
# Install dependencies
yarn install

# Ensure Solana is configured for devnet
solana config set --url devnet

# Ensure you have a funded keypair
solana balance
# If balance is low: solana airdrop 2
```

### Running Tests

```bash
# Run all tests
anchor test

# Run tests without rebuilding/redeploying
anchor test --skip-build --skip-deploy

# Run specific test file
yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/enhanced_oracle_test.ts
```

### Test Files

#### 1. `enhanced_oracle_test.ts` - Comprehensive Oracle Testing

**What it tests:**
- Data Streams report parsing (mock data)
- PriceFeed account initialization
- Report verification and price storage
- Price reading functionality
- get_price instruction execution

**Test Flow:**
```typescript
1. Parse mock Data Streams report
   ├── Extract feed ID, price, timestamp
   ├── Apply snappy compression
   └── Validate parsed data

2. Initialize PriceFeed account
   ├── Derive PDA for price feed
   ├── Create account with proper seeds
   └── Set authority and initial state

3. Verify and store price
   ├── Call verify_and_store instruction
   ├── Pass compressed report to verifier
   ├── Store verified price on-chain
   └── Validate transaction success

4. Read stored price
   ├── Fetch PriceFeed account data
   ├── Verify stored values match input
   └── Check timestamp and authority

5. Test get_price instruction
   ├── Call get_price instruction
   ├── Verify instruction execution
   └── Check program logs
```

**Expected Output:**
```
🧪 Enhanced Oracle Test with Data Streams SDK Parsing
═══════════════════════════════════════════════════════

📊 Step 1: Parsing Data Streams Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Report parsed successfully!
📋 Feed ID: d1be62b7496ad4897b984db99243e0921906f66ded15149d993ef42c68b77637
💰 Price: 200000000000 (2000 USD)
⏰ Timestamp: 1756853815
🔢 Decimals: 8

🏗️ Step 2: Initialize PriceFeed Account
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 PriceFeed PDA: 6rGXnH9JhqJ4L2Az7A5RRxxE8qp3rzmHGWXVqb8VPxEx
✅ PriceFeed initialized!

🔄 Step 3: Verify Report and Store Price
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Verification and storage successful!

📖 Step 4: Read Stored Price
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Price data retrieved!
📋 Stored Feed ID: d1be62b7496ad4897b984db99243e0921906f66ded15149d993ef42c68b77637
💰 Stored Price: 200000000000 (2000 USD)

🧪 Step 5: Test get_price Instruction
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ get_price instruction executed!

🎉 All tests completed successfully!
```

#### 2. `verify_test.ts` - Basic Verification Tests

**What it tests:**
- Basic verification workflow
- Error handling scenarios
- Account validation

### Test Data

**Mock Report Structure:**
```typescript
// Hex string representing a mock Chainlink Data Streams report
const hexString = "0x00064f2cd1be62b7496ad4897b984db99243e0921906f66ded15149d993ef42c..."

// Parsed data structure
interface ParsedReport {
  feedId: Uint8Array     // 32-byte feed identifier
  price: bigint          // Price with 8 decimals
  timestamp: bigint      // Unix timestamp
  decimals: number       // Always 8 for this implementation
}
```

**Key Accounts:**
```typescript
// Chainlink verifier program (devnet)
const VERIFIER_PROGRAM_ID = "Gt9S41PtjR58CbG9JhJ3J6vxesqrNAswbWYbLNTMZA3c"

// Access controller (devnet)
const ACCESS_CONTROLLER = "2k3DsgwBoqrnvXKVvd7jX7aptNxdcRBdcd5HkYsGgbrb"

// Account derivations
verifierAccount = PDA["verifier", VERIFIER_PROGRAM_ID]
configAccount = PDA[report[0:32], VERIFIER_PROGRAM_ID]
priceFeedPda = PDA["price_feed", feedId, ORACLE_PROGRAM_ID]
```

## Rust Client Tests (Off-chain)

### Setup

```bash
cd client

# Build client
cargo build

# Set up environment
cp .env.example .env
# Edit .env with your Chainlink credentials
```

### Running Client Tests

```bash
# Test price fetching (no wallet required)
cargo run -- fetch-price

# Test oracle updates (requires funded wallet)
cargo run -- update-oracle

# Test demo calculations
cargo run -- demo

# Test continuous monitoring
cargo run -- monitor

# Run with debug logging
RUST_LOG=debug cargo run -- fetch-price
```

### Client Test Scenarios

#### 1. Price Fetching Test

**Command:**
```bash
cargo run -- fetch-price
```

**What it tests:**
- Chainlink Data Streams API connectivity
- Report fetching and decoding
- Price validation and formatting

**Expected Output:**
```
✅ Successfully fetched SOL/USD price data:
💰 Price: $208.53949000
📉 Bid:   $208.53174615
📈 Ask:   $208.54459000
⏰ Observations timestamp: 1756854729
🔢 Valid from timestamp: 1756854729
✅ Report data validation passed
```

#### 2. Oracle Update Test

**Command:**
```bash
cargo run -- update-oracle
```

**What it tests:**
- Real Chainlink report fetching
- Snappy compression application
- Account derivation accuracy
- Transaction construction and sending
- On-chain verification process

**Expected Output:**
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

#### 3. Demo Calculation Test

**Command:**
```bash
cargo run -- demo
```

**What it tests:**
- Price fetching integration
- Stablecoin calculation logic
- Collateral ratio calculations

**Expected Output:**
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

### Integration Testing

#### End-to-End Workflow Test

**Complete workflow:**
```bash
# 1. Fetch current price
cargo run -- fetch-price

# 2. Update oracle with latest data
cargo run -- update-oracle

# 3. Verify update with demo calculation
cargo run -- demo

# 4. Check on-chain data (using TypeScript)
cd ..
anchor test --skip-build --skip-deploy
```

## Error Testing

### Common Error Scenarios

#### 1. Network Connectivity Issues

**Test:**
```bash
# Temporarily disable network and run
cargo run -- fetch-price
```

**Expected Error:**
```
❌ Failed to fetch price: Failed to fetch latest report from Chainlink
```

#### 2. Invalid Credentials

**Test:**
```bash
# Set invalid credentials in .env
DATASTREAMS_CLIENT_ID=invalid
cargo run -- fetch-price
```

**Expected Error:**
```
❌ Failed to fetch price: Authentication failed
```

#### 3. Insufficient Funds

**Test:**
```bash
# Use unfunded keypair
cargo run -- update-oracle
```

**Expected Error:**
```
❌ Failed to update oracle: RPC response error -32002: Transaction simulation failed: Attempt to debit an account but found no record of a prior credit
```

#### 4. Stale Data

**Test:**
```bash
# Modify timestamp validation in chainlink.rs to be very strict
cargo run -- fetch-price
```

**Expected Warning:**
```
⚠️ Report data is more than 1 hour old
```

## Performance Testing

### Latency Testing

**Measure API response times:**
```bash
# Time the price fetching
time cargo run -- fetch-price

# Monitor continuous updates
cargo run -- monitor
```

**Expected Performance:**
- API fetch: < 2 seconds
- Report decoding: < 100ms
- Transaction confirmation: 5-15 seconds

### Load Testing

**Continuous monitoring:**
```bash
# Run for extended period
timeout 300 cargo run -- monitor  # Run for 5 minutes
```

## Test Environment Setup

### Development Environment

```bash
# 1. Solana setup
solana config set --url devnet
solana-keygen new
solana airdrop 2

# 2. Anchor setup
anchor --version  # Should be 0.31.1
yarn install

# 3. Client setup
cd client
cargo build
cp .env.example .env
# Configure .env with credentials

# 4. Verify setup
anchor test
cargo run -- fetch-price
```

### CI/CD Testing

**GitHub Actions workflow example:**
```yaml
name: Oracle Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Solana
        run: |
          sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
          echo "$HOME/.local/share/solana/install/active_release/bin" >> $GITHUB_PATH
      - name: Install Anchor
        run: npm install -g @coral-xyz/anchor-cli@0.31.1
      - name: Run tests
        run: |
          solana-keygen new --no-bip39-passphrase
          anchor test
```

## Debugging Tests

### Debug Commands

```bash
# Verbose logging
RUST_LOG=debug cargo run -- update-oracle

# Solana transaction logs
solana logs --url devnet

# Account inspection
solana account <ACCOUNT_ADDRESS> --url devnet

# Program inspection
solana program show 9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1 --url devnet
```

### Common Debug Scenarios

#### 1. Transaction Failures

**Debug steps:**
1. Check account balances: `solana balance`
2. Verify program deployment: `solana program show <PROGRAM_ID>`
3. Check transaction logs: `solana logs`
4. Validate account derivation in client code

#### 2. Price Discrepancies

**Debug steps:**
1. Compare client output with Chainlink API directly
2. Verify decimal scaling (18 → 8 decimals)
3. Check timestamp validation logic
4. Validate price range expectations

#### 3. Account Issues

**Debug steps:**
1. Verify PDA derivation matches program expectations
2. Check account initialization status
3. Validate account ownership and permissions
4. Ensure proper seed values for account derivation

## Test Maintenance

### Updating Tests

**When to update tests:**
- Program interface changes
- New features added
- Bug fixes implemented
- Environment changes (new program IDs, etc.)

**Update checklist:**
1. Update mock data if report format changes
2. Update expected outputs in documentation
3. Update account addresses if programs are redeployed
4. Update API endpoints if Chainlink changes URLs
5. Update dependency versions in Cargo.toml/package.json

### Test Data Management

**Mock data location:**
- TypeScript tests: Embedded hex strings in test files
- Rust client: Uses real API data (no mocks needed)

**Updating mock data:**
1. Capture real report from Chainlink API
2. Replace hex string in test files
3. Update expected parsed values
4. Verify tests still pass

## Conclusion

This testing framework ensures comprehensive coverage of:
- ✅ On-chain program functionality
- ✅ Off-chain client integration
- ✅ Real-world data handling
- ✅ Error scenarios and edge cases
- ✅ Performance characteristics
- ✅ End-to-end workflows

Regular testing with this framework ensures the oracle system remains reliable and accurate for stablecoin operations.
