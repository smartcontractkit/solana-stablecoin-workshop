# Oracle-Backed Stablecoin with CCIP Cross-Chain Integration

## Complete Step-by-Step Implementation Guide

This document provides comprehensive instructions for building a fully functional oracle-backed stablecoin system with Chainlink Cross-Chain Interoperability Protocol (CCIP) integration, enabling seamless cross-chain token transfers between Solana and Ethereum.

## 🎯 System Overview

**What We're Building:**
- **Oracle-backed stablecoin** using Chainlink Data Streams SDK (SOL/USD price feeds)
- **Cross-chain token transfers** via Chainlink CCIP (Solana ↔ Ethereum)
- **Production-ready architecture** with proper multisig authority management
- **Real-time price verification** and on-chain storage

**Key Components:**
1. **Oracle Program** - Verifies and stores Chainlink Data Streams SDK reports on Solana
2. **Stablecoin Program** - Mints tokens based on oracle price data via CPI
3. **CCIP Integration** - Enables cross-chain transfers using Chainlink infrastructure
4. **Multisig Authority** - Manages mint authority for both oracle and CCIP operations

---

## 📋 Prerequisites

### Required Tools
```bash
# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.4/install)"

# Anchor Framework
npm install -g @coral-xyz/anchor-cli

# Git
# Install via your system package manager
```

### Required Accounts
- **Solana Wallet** with devnet SOL
- **Ethereum Wallet** with Sepolia ETH
- **Chainlink Data Streams SDK** access


## 🔧 Environment Setup (Required Before Phase 1)

### Step 0.1: Clone the Workshop Repository
```bash
git clone https://github.com/smartcontractkit/solana-stablecoin-workshop
```

```bash
cd solana-stablecoin-workshop
```

```bash
# Initialize and update all submodules (required for CCIP integration)
# ⚠️ WARNING: This can take 5+ minutes depending on your environment
git submodule update --init --recursive
```

**📦 Submodule Initialization:**
The repository contains two essential submodules:
- `smart-contract-examples/` - Contains Chainlink CCIP Hardhat contracts
- `solana-starter-kit/` - Contains Solana CCIP integration scripts

**Note:** Git clone creates empty submodule directories by default. The `git submodule update --init --recursive` command downloads all the actual submodule content.

### Step 0.2: Setup Environment Files
The project uses a centralized environment system with symlinks already configured for consistency across directories.

```bash
# Copy the example file to create your .env at the project root
cp .env.example .env
```

```bash
# Create symlinks so all directories use the same .env file
ln -sf ../.env oracle/.env
```

```bash
ln -sf ../../.env cross-chain-stablecoin/stablecoin-program/.env
```

```bash
ln -sf ../../../../.env smart-contract-examples/ccip/cct/hardhat/.env
```

```bash
ln -sf ../.env solana-starter-kit/.env
```


**📁 Pre-configured File Structure:**
```
.env.example                   # Template file at project root
.env                          # Main environment file (created from .env.example)
oracle/.env -> ../.env        # Oracle symlink points to root .env
cross-chain-stablecoin/stablecoin-program/.env -> ../../.env
smart-contract-examples/ccip/cct/hardhat/.env -> ../../../../.env
```

**✨ How It Works:** All subdirectory `.env` files are symlinks pointing to the root `.env`. When you edit any `.env` file (like `oracle/.env`), you're actually editing the root `.env`, and changes automatically propagate to all directories!


### Step 0.3: Review .env File Structure
```bash
# Check the current .env file (located at project root, symlinked throughout)
vim .env
```

> **📝** Vim: `i` to edit, `Esc` then `:wq` to save

```bash

# The file is organized by deployment phases:
# - PHASE 1: Oracle Program Deployment (partially pre-filled, requires DATASTREAMS credentials from instructor)
# - PHASE 2: Stablecoin Program Deployment (to be filled along the way)
# - PHASE 3: CCIP Integration (to be filled along the way)
# - PHASE 4: Ethereum Side Deployment (to be filled along the way)
```

### Step 0.4: Important .env File Notes

**🔑 Chainlink Data Streams Credentials:**
You'll need to obtain `DATASTREAMS_CLIENT_ID` and `DATASTREAMS_CLIENT_SECRET` from your instructor. These credentials are required for accessing Chainlink Data Streams in Phase 1.

**⚠️ Special Characters in API Secrets:**
If your `DATASTREAMS_CLIENT_SECRET` contains special characters (`&`, `<`, `>`, `*`, etc.), make sure it's properly quoted:

```bash
# ✅ Correct - quoted secret
DATASTREAMS_CLIENT_SECRET="your-secret-with-special&characters<here>"

# ❌ Wrong - unquoted secret (will cause parsing errors)
DATASTREAMS_CLIENT_SECRET=your-secret-with-special&characters<here>
```

**📍 Values to Fill Before We Start:**
- `SOL_ADMIN_WALLET`: Populate itwith your current Solana wallet
- `FEED_ID`: Chainlink SOL/USD feed ID for Data Streams
- `DATASTREAMS_*`: Chainlink Data Streams configuration (requires instructor credentials)
- `ETHEREUM_SEPOLIA_RPC_URL`: Public Ethereum testnet endpoint
- `CCIP_POOL_PROGRAM`: Static CCIP pool program ID

**🔄 Values to Fill During Deployment:**
- `ORACLE_PROGRAM_ID`, `ORACLE_PRICE_FEED_PDA`: Generated in Phase 1
- `SOL_TOKEN_MINT`: Generated in Phase 2
- `SOL_POOL_STATE_PDA`, `SOL_POOL_SIGNER_PDA`: Generated in Phase 3
- `ETH_TOKEN_ADDRESS`, `ETH_TOKEN_POOL`: Generated in Phase 4

### Step 0.5: Verify Environment Loading
```bash
# Test that environment variables load correctly
source .env
echo "FEED_ID: $FEED_ID"
```

**Note:** If you see parsing errors, check for unquoted special characters in your `.env` file.

---

## 🏗️ Phase 1: Oracle Program Deployment

### Step 1.1: Setup Oracle Program
```bash
cd oracle
```

### Step 1.2: Build and Deploy Oracle Program
```bash
# Build the oracle program
anchor build
```

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet
```

**Note:** Copy the deployed program ID from the output - you'll need this later.
**Example:** `9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1`

### Step 1.3: Update Oracle Program ID in Environment
```bash
# Edit the .env file to add your deployed Oracle Program ID
vim .env
# Or use nano if you prefer: nano .env
```

**📝 What to update:**
Find the line `ORACLE_PROGRAM_ID=` and update it with your program ID from Step 1.2:
```bash
# Before:
ORACLE_PROGRAM_ID=

# After (example):
ORACLE_PROGRAM_ID=9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1
```

**⚠️ Important:** The client reads `ORACLE_PROGRAM_ID` from the `.env` file, so this step is required for the oracle client to work with your deployed program.

### Step 1.4: Initialize Oracle Price Feed
```bash
source .env
```
```bash
cd client
cargo run -- update-oracle
```

**Expected Output:**
```
✅ Oracle updated successfully!
🔗 Transaction: [transaction-hash]
📊 Price: $205.26 (example)
📍 PriceFeed PDA: HqqVks96kxdktt3jUvmoeF9dsc9pWgXVfYG27ri8Xi6C
```

**Key Addresses to Save:**

Each workshop participant will get their own unique addresses:

- **Oracle Program ID:** `[your-unique-oracle-program-id]` *(generated during your deployment)*
- **Price Feed PDA:** `[your-unique-price-feed-pda]` *(derived from your oracle program)*

**⚠️ Important:** Every participant will have different addresses! The Price Feed PDA is derived from YOUR specific deployed oracle program ID. Make sure to update your `.env` file with YOUR addresses from the deployment output.

**Example addresses (for reference only):**
- Oracle Program ID: `9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1`
- Price Feed PDA: `HqqVks96kxdktt3jUvmoeF9dsc9pWgXVfYG27ri8Xi6C`

### Step 1.5: Update Oracle Price Feed PDA in Environment
```bash
# Edit the .env file to add your oracle price feed PDA from Step 1.4 output
vim ../.env
```

**📝 What to update:**
Find the line `ORACLE_PRICE_FEED_PDA=` and update it with the PDA from Step 1.4 output:
```bash
# Before:
ORACLE_PRICE_FEED_PDA=

# After (use the PDA from Step 1.4 "📍 PriceFeed PDA: ..."):
ORACLE_PRICE_FEED_PDA=HqqVks96kxdktt3jUvmoeF9dsc9pWgXVfYG27ri8Xi6C
```

**📝 Checkpoint:** Your `.env` file should now contain YOUR unique Oracle Program ID and Price Feed PDA. These addresses are specific to your deployment and different from other workshop participants.

---

## 🪙 Phase 2: Stablecoin Program Deployment

### Step 2.1: Setup Stablecoin Program
```bash
# Navigate to stablecoin program (from oracle directory)
cd ../../cross-chain-stablecoin/stablecoin-program
```

### Step 2.2: Configure Program for CCIP Compatibility
The stablecoin program includes two minting instructions:
- `deposit_and_mint_single` - For wallet authority (CCIP setup phase)
- `deposit_and_mint_multisig` - For multisig authority (post-CCIP phase)

### Step 2.3: Update Stablecoin Program for Your Oracle (Critical)
```bash
# Load your oracle program ID from .env
source .env
```

```bash
# Navigate to the stablecoin program source directory
cd programs/stablecoin-program/src/
```

```bash
# Update the stablecoin program to recognize your oracle BEFORE deployment
vim lib.rs

# Find line 11 that looks like:
# const ORACLE_PROGRAM_ID: Pubkey = pubkey!("9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1");
# 
# Replace the program ID with your oracle program ID from .env:
# const ORACLE_PROGRAM_ID: Pubkey = pubkey!("YOUR_ORACLE_PROGRAM_ID_HERE");
```

```bash
# Return to the stablecoin program root directory
cd ../../..
```

**⚠️ Why This Step is Required:** The stablecoin program has a security constraint that only allows interaction with a specific oracle program. We update this constraint to recognize your oracle as legitimate before deployment.

### Step 2.4: Build and Deploy Stablecoin Program
```bash
# Build with your oracle program ID configured
anchor build
```

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet
```

**Key Address to Save:**
- **Stablecoin Program ID:** `[your-stablecoin-program-id]` *(copy this address)*

**⚠️ Critical Step:** Update your `.env` file with the deployed program ID:
```bash
# Update .env with the stablecoin program ID (REQUIRED for PDA derivation)
vim .env
# Find STABLECOIN_PROGRAM_ID= and add your program ID from the deployment output above
# Example: STABLECOIN_PROGRAM_ID=GpBchCTBC6HbmX8j4AHfGDukuxTyvWR5BTqfosVK2SBU
```

```bash
# Load your stablecoin program ID from .env
source .env
```

**📝 Why This Step is Critical:** The PDA derivation script in Step 2.5 requires the correct `STABLECOIN_PROGRAM_ID` to generate the proper mint authority PDA. Without this, you'll get incorrect PDAs that won't work with your deployed program.

### Step 2.5: Derive Stablecoin Mint Authority PDA
```bash
# Install Node.js dependencies for PDA derivation script
npm install
```

```bash
# Derive the stablecoin program's mint authority PDA (needed for multisig in Phase 3)
npx ts-node utils/derive-pdas.ts
```

> 💡 **TypeScript issues?** If `ts-node` fails, see [TypeScript Execution Issues](#7-typescript-execution-issues) for the `tsx` alternative.

```bash
# Update .env file with the mint authority PDA
vim .env
# Find SOL_MINT_AUTHORITY_PDA= and add the mint authority PDA from the output above
```

**Expected Output:**
```
🔑 Deriving Stablecoin Program Mint Authority PDA...

📋 Stablecoin Program PDA:
   🏦 Mint Authority PDA: 9YourActualPDAAddressHere123456789

📋 Environment Variable to Update:
   SOL_MINT_AUTHORITY_PDA="9YourActualPDAAddressHere123456789"

✅ Use this PDA in your multisig creation command
```

**Key Address to Save:**
- **Mint Authority PDA:** `9YourActualPDAAddressHere123456789` *(needed for Phase 3 multisig)*

### Step 2.6: Create Initial Oracle-Backed Stablecoin Token
```bash
# Load environment variables
source .env
```

```bash
# Create token with wallet authority (required for CCIP setup)
ANCHOR_PROVIDER_URL="https://api.devnet.solana.com" \
ANCHOR_WALLET="/Users/$(whoami)/.config/solana/id.json" \
npx ts-node create-token-for-ccip.ts
```

**⚠️ Troubleshooting:** If you get "Blockhash not found" errors, this is usually a temporary network issue. Wait a few seconds and retry the command.

**Expected Output:**
```
✅ Token created successfully!
🪙 New mint address: [your-token-mint-address]
🔗 Transaction: [transaction-hash]
```

> **💡 Token Decimals:** This stablecoin uses 6 decimals (like USDC). So 1,000,000 tokens = 1.0 actual tokens, and 18,000,000 tokens = 18.0 actual tokens.

**Key Address to Save:**
- **Stablecoin Token Mint:** `[your-token-mint-address]` *(copy this address)*

```bash
# Update .env with the token mint and other required variables
vim .env
```

**📝 What to update in .env:**
- Find and update: `SOL_TOKEN_MINT=[your-token-mint-address-from-above]`
- Find and update: `SOL_ADMIN_WALLET=[your-solana-wallet-address]`
- Add if not present: `CCIP_POOL_PROGRAM=41FGToCmdaWa1dgZLKFAjvmx6e6AjVTX7SVRibvsMGVB`

```bash
# Load the updated variables
source .env
```


---

## 🌉 Phase 3: CCIP Integration (Solana Side)

### Step 3.1: Setup Solana Starter Kit
```bash
# Navigate to the existing solana-starter-kit submodule (from stablecoin-program directory)
cd ../../solana-starter-kit
```

```bash
# Install dependencies
npm install
```

### Step 3.2: Load Environment Variables
```bash
# Load variables from .env (set in previous phases)
source .env
```

```bash
# Verify required variables are set
echo "🪙 Token Mint: $SOL_TOKEN_MINT"
echo "🏊 Pool Program: $CCIP_POOL_PROGRAM"
```

### Step 3.3: Initialize CCIP Token Pool
```bash
npm run svm:pool:initialize -- \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM
```

**Expected Output:**
```
✅ POOL INITIALIZED SUCCESSFULLY
📍 Pool State PDA: [your-pool-state-pda]
📍 Pool Signer PDA: [your-pool-signer-pda]
🔗 Transaction: [transaction-hash]
```

**Key Addresses to Save:**
- **Pool State PDA:** `[your-pool-state-pda]` *(copy this address)*
- **Pool Signer PDA:** `[your-pool-signer-pda]` *(copy this address)*

```bash
# Update .env with the pool addresses
vim .env
```

**📝 What to update in .env:**
- Add: `SOL_POOL_STATE_PDA=[your-pool-state-pda-from-above]`
- Add: `SOL_POOL_SIGNER_PDA=[your-pool-signer-pda-from-above]`

```bash
# Load the updated variables
source .env
```

### Step 3.4: Set Up CCIP Administration
```bash
# Propose administrator
npm run svm:admin:propose-administrator -- \
  --token-mint $SOL_TOKEN_MINT \
  --administrator $SOL_ADMIN_WALLET
```

```bash
# Accept admin role
npm run svm:admin:accept-admin-role -- \
  --token-mint $SOL_TOKEN_MINT
```

### Step 3.5: Create SPL Token Multisig (Critical for CCIP + Oracle Integration)

**⚠️ Prerequisites Check:** Before creating the multisig, ensure all required addresses are set:
```bash
# Load environment variables
source .env

# Verify all required addresses are set
echo "🔍 Verifying multisig prerequisites:"
echo "📍 Pool Signer PDA: $SOL_POOL_SIGNER_PDA"
echo "👤 Admin Wallet: $SOL_ADMIN_WALLET"
echo "🔑 Mint Authority PDA: $SOL_MINT_AUTHORITY_PDA"
```

**📝 If any address shows as empty:**
- `SOL_ADMIN_WALLET`: Run `solana address` and update your `.env` file
- `SOL_POOL_SIGNER_PDA`: Complete Step 3.3 (Initialize CCIP Token Pool)
- `SOL_MINT_AUTHORITY_PDA`: Complete Step 2.5 (Derive Stablecoin Mint Authority PDA)

```bash
# Create 1-of-3 multisig with Pool Signer PDA, Admin Wallet, and Stablecoin Mint Authority PDA
spl-token create-multisig 1 \
  $SOL_POOL_SIGNER_PDA \
  $SOL_ADMIN_WALLET \
  $SOL_MINT_AUTHORITY_PDA
```

**Expected Output:**
```
Creating 1/3 multisig [your-multisig-address] under program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA

Signature: [transaction-signature]
```

**Key Address to Save:**
- **Multisig Address:** `[your-multisig-address]` *(copy this for the next step)*

### Step 3.6: Transfer Mint Authority to Multisig
```bash
# Update .env with the multisig address from Step 3.5
vim .env
# Add this line with your actual multisig address from above:
# SOL_MULTISIG_ADDRESS=[your-multisig-address-from-above]
```

```bash
# Load variables and transfer authority
source .env
spl-token authorize $SOL_TOKEN_MINT mint $SOL_MULTISIG_ADDRESS
```

### Step 3.7: Create Address Lookup Table (ALT)
```bash
npm run svm:admin:create-alt -- \
  --token-mint $SOL_TOKEN_MINT \
  --pool-program $CCIP_POOL_PROGRAM \
  --additional-addresses $SOL_MULTISIG_ADDRESS
```

**Expected Output:**
```
✅ ALT created successfully!
ALT Address: [your-alt-address]
```

**Key Address to Save:**
- **ALT Address:** `[your-alt-address]` *(copy this for the next step)*

### Step 3.8: Register Pool with CCIP Router
```bash
# Update .env with the ALT address from Step 3.7
vim .env
# Add this line with your actual ALT address from above:
# SOL_ALT_ADDRESS=[your-alt-address-from-above]

# Load the updated variables
source .env

npm run svm:admin:set-pool -- \
  --token-mint $SOL_TOKEN_MINT \
  --lookup-table $SOL_ALT_ADDRESS \
  --writable-indices 3,4,7
```

---

## 🔗 Phase 4: Ethereum Side Deployment

### Step 4.1: Setup Ethereum Environment
```bash
# Navigate to Hardhat directory (from solana-starter-kit directory)
cd ../smart-contract-examples/ccip/cct/hardhat
```

```bash
# Load and export environment variables for Hardhat
set -a  # Automatically export all variables
```

```bash
source .env
```

```bash
set +a  # Stop auto-exporting
```

```bash
# Verify Ethereum variables are set
echo "🔗 Ethereum RPC: $ETHEREUM_SEPOLIA_RPC_URL"
echo "🔑 Private Key: ${PRIVATE_KEY:0:10}..." # Show only first 10 chars for security
echo "🔍 Etherscan API: ${ETHERSCAN_API_KEY:0:10}..."
```

**ℹ️ What `set -a` does:** This command exports all variables to child processes (like Hardhat), ensuring they're available to Node.js.

**📝 Note:** If any Ethereum variables show as empty, update your root `.env` file:
```bash
# Update .env file (symlinked to root) directly
vim .env
# Add these lines with your actual credentials:
# PRIVATE_KEY=0x[your-private-key-here]
# ETHERSCAN_API_KEY=[your-etherscan-api-key-here]

# Load the updated variables
source .env
```

### Step 4.2: Install Dependencies
```bash
# Install Node.js dependencies
npm install
```

### Step 4.3: Compile Contracts
```bash
npx hardhat compile
```

**Expected Output:**
```
Generating typings for: 57 artifacts in dir: typechain-types for target: ethers-v6
Successfully generated 172 typings!
Compiled 58 Solidity files successfully (evm target: paris).
```

### Step 4.4: Setup Ethereum Wallet and Get Testnet ETH

**⚠️ Prerequisites for Ethereum Deployment:**

Before deploying contracts, ensure you have:

1. **Private Key in .env file:**
```bash
# Edit your .env file to add your Ethereum private key
vim .env
# Add this line with your actual private key:
# PRIVATE_KEY=0x[your-64-character-private-key-here]
```

2. **Testnet ETH for gas fees:**
   - Visit: https://faucet.chain.link/
   - Connect your Ethereum wallet
   - Request Sepolia ETH (you'll need ~0.01 ETH for deployments)
   - Wait for the transaction to confirm

3. **Verify setup:**
```bash
# Reload environment variables
set -a
```

```bash
source .env
```

```bash
set +a
```

```bash
# Check your setup
echo "🔑 Private Key: ${PRIVATE_KEY:0:10}..."
echo "🔗 RPC URL: $ETHEREUM_SEPOLIA_RPC_URL"
```

### Step 4.5: Deploy ERC20 Token for Oracle-Backed Stablecoin
```bash
npx hardhat deployToken \
  --network sepolia \
  --name "Oracle-Backed Stablecoin" \
  --symbol "OBSC" \
  --decimals 6 \
  --premint 0 \
  --maxsupply 1000000000000000
```

**Expected Output:**
```
Token deployed to: [your-ethereum-token-address]
```

**Key Address to Save:**
- **Ethereum Token:** `[your-ethereum-token-address]` *(copy this address)*

```bash
# Update .env with the Ethereum token address
vim .env
# Find ETH_TOKEN_ADDRESS= and add your token address from the deployment output above
```

```bash
# Reload environment variables after updating .env
source .env
```

### Step 4.6: Deploy TokenPool
```bash
# Load the Ethereum token address
source .env
```

```bash
# Deploy token pool
npx hardhat deployTokenPool \
  --network sepolia \
  --tokenaddress $ETH_TOKEN_ADDRESS \
  --pooltype burnMint \
  --localtokendecimals 6
```

**Expected Output:**
```
Token pool deployed to: [your-ethereum-token-pool-address]
```

**Key Address to Save:**
- **Ethereum TokenPool:** `[your-ethereum-token-pool-address]` *(copy this address)*

```bash
# Update .env with the token pool address
vim .env
# Find ETH_TOKEN_POOL= and add your token pool address from the deployment output above

# Load the updated variables
source .env
```

### Step 4.7: Claim and Accept Admin Role
```bash
# Claim admin
npx hardhat claimAdmin \
  --network sepolia \
  --tokenaddress $ETH_TOKEN_ADDRESS
```

```bash
# Accept admin role
npx hardhat acceptAdminRole \
  --network sepolia \
  --tokenaddress $ETH_TOKEN_ADDRESS
```

### Step 4.8: Register Pool with TokenAdminRegistry
```bash
npx hardhat setPool \
  --network sepolia \
  --tokenaddress $ETH_TOKEN_ADDRESS \
  --pooladdress $ETH_TOKEN_POOL
```

### Step 4.9: Configure Cross-Chain Connectivity (Ethereum → Solana)
```bash
npx hardhat applyChainUpdates \
  --network sepolia \
  --pooladdress $ETH_TOKEN_POOL \
  --remotechain solanaDevnet \
  --remotetokenaddress $SOL_TOKEN_MINT \
  --remotepooladdresses $SOL_POOL_STATE_PDA
```

---

## 🔄 Phase 5: Complete Cross-Chain Configuration

### Step 5.1: Configure Solana → Ethereum Connectivity
```bash
# Navigate back to solana-starter-kit (from hardhat directory)
cd ../../../../solana-starter-kit

# Load environment variables
source .env

# Initialize chain remote config
npm run svm:pool:init-chain-remote-config -- \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM \
  --remote-chain ethereum-sepolia \
  --token-address $ETH_TOKEN_ADDRESS \
  --decimals 6
```

**⚠️ Expected Behavior:** You will see "Error: Chain config not found" in the output - this is expected behavior since we are creating the configuration for the first time. The script will continue and successfully create the new configuration.

### Step 5.2: Add Ethereum Pool Address
```bash
npm run svm:pool:edit-chain-remote-config -- \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM \
  --remote-chain ethereum-sepolia \
  --pool-addresses $ETH_TOKEN_POOL \
  --token-address $ETH_TOKEN_ADDRESS \
  --decimals 6
```

---

## 🚀 Phase 6: Testing and Token Operations

### Step 6.1: Update Oracle with Fresh Price Data
```bash
# Navigate to oracle client (from solana-starter-kit directory)
cd ../oracle/client
cargo run -- update-oracle
```

### Step 6.2: Mint Oracle-Backed Stablecoin Tokens
```bash
# Navigate to stablecoin program directory
cd ../../cross-chain-stablecoin/stablecoin-program
```

```bash
# Load environment variables and configure Anchor wallet from default id.json directory
source .env
export ANCHOR_WALLET="/Users/$(whoami)/.config/solana/id.json"
```

**📝 What `ANCHOR_WALLET` does:**
- **Keypair Loading**: Tells Anchor which wallet file to use for signing transactions
- **Transaction Authority**: This wallet will be the transaction payer and signer
- **Default Location**: Points to your default Solana CLI wallet

```bash
# Create token account
spl-token create-account $SOL_TOKEN_MINT
```

```bash
# Mint oracle-backed stablecoins using Chainlink datastream-backed price data
npx ts-node mint-oracle-backed.ts
```

**Expected Output:**
```
🔮 Minting oracle-backed stablecoins...
💰 Collateral: 0.1 SOL (100,000,000 lamports)
📊 Using real SOL/USD price from Chainlink Data Streams SDK
✅ Oracle-backed minting successful!
🔗 Transaction: [transaction-hash]
💰 Tokens minted: ~[X.X] USD worth (based on current SOL price)
```

### Step 6.3: Create Pool Token Account (Required for CCIP)
```bash
spl-token create-account $SOL_TOKEN_MINT \
  --owner $SOL_POOL_SIGNER_PDA \
  --fee-payer ~/.config/solana/id.json
```

**Expected Output:**
```
Creating account [your-pool-token-account-address]
```

**Key Address to Save:**
- **Pool Token Account:** `[your-pool-token-account-address]` *(copy this address)*

```bash
# Update .env with the pool token account
vim .env
# Add this line with your actual pool token account address from above:
# POOL_TOKEN_ACCOUNT=[your-pool-token-account-address-from-above]
```

### Step 6.4: Delegate Token Authority to CCIP
```bash
# Navigate to solana-starter-kit for CCIP operations
cd ../../solana-starter-kit
```

```bash
# Load environment variables
source .env
```

```bash
# Delegate token authority to CCIP
npm run svm:token:delegate -- --token-mint $SOL_TOKEN_MINT
```

**Expected Output:**
```
✅ Token delegation successful!
Delegate: 2AjuzTy6z2webxEUu7eZ1DkAyLagZaqH2dgzhbBYjJiG (CCIP fee-billing PDA)
```

---

## 🌉 Phase 7: Execute Cross-Chain Transfer

### Step 7.1: Verify Token Balance
```bash
spl-token balance $SOL_TOKEN_MINT
```

### Step 7.2: Execute Cross-Chain Transfer (Solana → Ethereum)

**⚠️ Prerequisites:** Before executing the transfer, ensure your Ethereum receiver address is set:

```bash
# Set your Ethereum receiver address
vim .env
```

**📝 What to add in .env:**
- Add: `ETH_RECEIVER_ADDRESS=[your-ethereum-wallet-address]`

**💡 Important:** Use the same Ethereum wallet address where you want to receive the tokens. This should be the wallet you used for Ethereum deployment steps.

```bash
# Load the updated variables
source .env
```

```bash
# Check your current token balance first
spl-token balance $SOL_TOKEN_MINT
```

```bash
# Transfer your oracle-minted tokens (replace with your actual balance)
npm run svm:token-transfer -- \
  --token-mint $SOL_TOKEN_MINT \
  --token-amount [your-token-balance-from-above] \
  --destination-chain ethereum-sepolia \
  --receiver-address $ETH_RECEIVER_ADDRESS
```

**⚠️ Important:** 
- Use `--token-amount` (not `--amount`) to specify the token amount
- Use `--receiver-address` (not `--destination-address`) to specify the Ethereum recipient address

**Expected Output:**
```
✅ TOKEN TRANSFER SENT SUCCESSFULLY
EVM Receiver Address: [your-ethereum-wallet-address]
Transaction Signature: [transaction-signature]
CCIP Message ID: [ccip-message-id]
✅ Sent [your-specified-amount] tokens (preserves oracle-backed USD value)
```

**💡 Critical:** Always specify `--amount` with your exact token balance to ensure the correct oracle-backed USD value transfers to Ethereum. The system will burn exactly what you specify on Solana and mint the same amount on Ethereum.

### Step 7.3: Monitor Transfer Progress
- **Solana Explorer:** https://explorer.solana.com/tx/[transaction-hash]?cluster=devnet
- **CCIP Explorer:** https://ccip.chain.link/msg/[message-id]

---

## 🧪 Testing (Optional but Recommended)

After completing the deployment, you can run comprehensive tests to verify all components are working correctly.

### Test Prerequisites
```bash
# Navigate to the stablecoin program directory (from oracle directory)
cd ../cross-chain-stablecoin/stablecoin-program
```

```bash
# Make test script executable
chmod +x test-individual.sh
```

### Test Categories

#### Test Oracle Integration (3 tests)
```bash
./test-individual.sh oracle
```
**Tests:** Real Chainlink price integration and oracle program functionality

#### Test Stablecoin Program Logic (4 tests)
```bash
./test-individual.sh stablecoin
```
**Tests:** Program logic verification and token operations

#### Test Complete Integration (4 tests)
```bash
./test-individual.sh integration
```
**Tests:** Complete CPI functionality between oracle and stablecoin programs

#### Test CCIP Multisig Authority (2 tests)
```bash
./test-individual.sh ccip
```
**Tests:** Multisig authority verification for CCIP operations

#### Run All Tests Together (13 tests total)
```bash
./test-individual.sh all
```

### Expected Results

#### ✅ **Successful Test Categories:**
- ✅ **Stablecoin Tests:** 4 passing - Program logic verification  
- ✅ **CCIP Tests:** 2 passing - Multisig authority verification

#### ✅ **Oracle Tests (3/3 passing):**
- ✅ **Setup Test:** Mint creation with multisig authority
- ✅ **Data Structure Test:** Oracle price feed validation  
- ✅ **Integration Test:** Oracle CPI cross-program invocation

**All oracle tests should pass** after completing Step 2.4 (updating the stablecoin program for your oracle). This demonstrates:

- ✅ **Environment variables are loading correctly** (your oracle program ID is read from `.env`)
- ✅ **Security constraints are working** (allows your authorized oracle program)
- ✅ **Cross-program invocation succeeds** (the CPI call completes successfully)

### Test Parameters and Configuration

**📋 Parameter Source:** All test parameters are automatically loaded from your `.env` file, including:
- `ORACLE_PROGRAM_ID` - Your deployed oracle program
- `STABLECOIN_PROGRAM_ID` - Your deployed stablecoin program  
- `ORACLE_PRICE_FEED_PDA` - Your oracle price feed PDA
- `SOL_TOKEN_MINT` - Your token mint address
- `SOL_MULTISIG_ADDRESS` - Your multisig address
- `DATASTREAMS_*` - Chainlink Data Streams credentials

**🔄 No Manual Configuration Required:** The tests use the same environment variables you set during deployment, ensuring consistency between your deployed programs and test execution.

### 🎯 **All Tests Should Pass**

After completing Step 2.4 (updating the stablecoin program for your oracle), all tests should pass successfully. This demonstrates that your oracle and stablecoin programs are properly integrated and working together.

**If Other Tests Fail:** See the [Oracle Testing Troubleshooting](#6-oracle-testing-issues) section below for detailed solutions.

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. "AccountNotInitialized" Error During CCIP Transfer
**Solution:** Create pool token account
```bash
spl-token create-account $SOL_TOKEN_MINT \
  --owner $SOL_POOL_SIGNER_PDA \
  --fee-payer ~/.config/solana/id.json
```

#### 2. "owner does not match" Error During Transfer
**Solution:** Delegate token authority to CCIP
```bash
npm run svm:token:delegate -- --token-mint $SOL_TOKEN_MINT
```

#### 3. Oracle Price Feed Not Found
**Solution:** Update oracle with fresh data
```bash
cd ../oracle/client
cargo run -- update-oracle
```

#### 4. Multisig Minting Issues
**Solution:** Ensure you're using the correct multisig command
```bash
spl-token mint $SOL_TOKEN_MINT [amount] \
  --owner $SOL_MULTISIG_ADDRESS \
  --multisig-signer ~/.config/solana/id.json
```

#### 5. Cross-Chain Transfer Issues

**Problem A:** Transfer shows hardcoded fallback address instead of your intended receiver
**Solution:** Use `--receiver-address` instead of `--destination-address`
```bash
# ❌ Wrong - uses hardcoded fallback address
npm run svm:token-transfer -- --destination-address $ETH_RECEIVER_ADDRESS

# ✅ Correct - uses your specified address  
npm run svm:token-transfer -- --receiver-address $ETH_RECEIVER_ADDRESS
```

**Problem B:** Transfer uses default amount (10000000) instead of your specified amount
**Solution:** Use `--token-amount` instead of `--amount`
```bash
# ❌ Wrong - parameter ignored, uses default amount
npm run svm:token-transfer -- --amount 18000000

# ✅ Correct - uses your specified amount
npm run svm:token-transfer -- --token-amount 18000000
```

#### 6. Oracle Testing Issues

**Problem:** `anchor test` fails with deployment errors or environment variable issues
**Root Cause:** The oracle program is already deployed, but `anchor test` tries to redeploy it

**Solutions:**

**A. Environment Variable Loading Issues:**
```bash
# If you see "ANCHOR_PROVIDER_URL is not defined"
# This is usually fixed by the .env symlinks, but if needed:
cd ../cross-chain-stablecoin/stablecoin-program
```

```bash
# Verify .env symlinks exist
ls -la .env .env.example
```

```bash
# If missing, recreate symlinks
ln -sf ../../.env .env
```

```bash
ln -sf ../../.env.example .env.example
```

```bash
# Use the recommended test script instead of direct ts-mocha
./test-individual.sh oracle
```

**B. .env File Parsing Errors:**
```bash
# If you see "parse error near '&'" or similar
# Check for unquoted special characters in DATASTREAMS_CLIENT_SECRET
vim .env
# Find DATASTREAMS_CLIENT_SECRET= and make sure the value is quoted:
# DATASTREAMS_CLIENT_SECRET="your-secret-with-special&characters<here>"
```

**C. Oracle Program ID Mismatch:**
```bash
# If you see "AccountOwnedByWrongProgram" or "ConstraintAddress" errors
# This usually means Step 2.3 was skipped or failed
# Re-run the oracle program update step:
cd ../cross-chain-stablecoin/stablecoin-program
```

```bash
source .env
```

```bash
# Update stablecoin program source code
cd programs/stablecoin-program/src/
```

```bash
sed -i '' "s/pubkey!(\"[^\"]*\")/pubkey!(\"$ORACLE_PROGRAM_ID\")/" lib.rs
```

```bash
# Rebuild and redeploy
cd ../../..
```

```bash
anchor build && anchor deploy --provider.cluster devnet
```

**D. Recommended Testing Method:**
```bash
# Use the test-individual.sh script (recommended)
cd ../cross-chain-stablecoin/stablecoin-program
./test-individual.sh oracle      # Oracle integration tests
./test-individual.sh stablecoin  # Program logic tests  
./test-individual.sh integration # Complete CPI tests
./test-individual.sh all         # All tests together

# Alternative: Test oracle client directly (from stablecoin-program directory)
cd ../../oracle/client
cargo run -- update-oracle
```

**E. Deployment Account Issues:**
If you see `AccountNotFound` errors during testing, the oracle program is likely already deployed and working. Verify with:
```bash
source .env
solana program show $ORACLE_PROGRAM_ID
```

#### 7. TypeScript Execution Issues

**Problem:** `ts-node` fails with "Unknown file extension .ts" error
**Solution:** Use `tsx` as a modern alternative

```bash
# Install tsx
npm install -D tsx

# Replace ts-node commands with tsx:
npx tsx utils/derive-pdas.ts           # Instead of: npx ts-node utils/derive-pdas.ts
npx tsx create-token-for-ccip.ts       # Instead of: npx ts-node create-token-for-ccip.ts  
npx tsx mint-oracle-backed.ts          # Instead of: npx ts-node mint-oracle-backed.ts
```

#### 8. CLI Prompt Issues

**Stuck in vim:** Press `Esc`, type `:wq`, press Enter
**Key generation prompts:** Press Enter (no passphrase), type `y` (overwrite)

#### 9. Token Amount Confusion

**Problem:** Large token numbers (like 18,000,000) seem wrong
**Explanation:** Tokens use 6 decimals - divide by 1,000,000 for actual value
- 18,000,000 tokens = 18.0 actual tokens
- 1,000,000 tokens = 1.0 actual token

---

## ⚙️ Anchor Framework Best Practices & Workflow

This section outlines the proper Anchor development workflow to prevent common deployment issues and ensure consistent development experience.

### 🎯 Proper Anchor Deployment Workflow

**The Golden Rule:** Always sync your `Anchor.toml` with deployed program IDs

```bash
# 1. Build the program
anchor build

# 2. Deploy to devnet
anchor deploy --provider.cluster devnet

# 3. CRITICAL: Sync the program ID in Anchor.toml
anchor keys sync

# 4. Verify the sync worked
vim Anchor.toml
# Look for the [programs.devnet] section to verify program IDs are synced
```

### 🔧 Shared Retry Utility

All scripts and tests now use a shared retry utility to handle Solana network instability:

**Location:** `cross-chain-stablecoin/stablecoin-program/utils/retry-helper.ts`

**Features:**
- **Exponential backoff:** 2s, 4s, 8s delays
- **Automatic blockhash refresh** on each retry
- **Transaction confirmation** waiting
- **Detailed error logging**

**Usage in your scripts:**
```typescript
import { retryTransaction } from "./utils/retry-helper.ts"

// Wrap any transaction call
const signature = await retryTransaction(
  connection,
  async (blockhash) => {
    return await program.methods
      .yourMethod()
      .accounts({ /* accounts */ })
      .rpc({ skipPreflight: false })
  }
)
```

### 🚨 Common Issues & Root Cause Analysis

#### Issue #1: Program ID Mismatches
**Problem:** `Anchor.toml` shows different program ID than deployed program
**Root Cause:** Not running `anchor keys sync` after deployment
**Solution:** Always run `anchor keys sync` after `anchor deploy`

#### Issue #2: TypeScript Module Resolution Errors
**Problem:** `Cannot find module './target/types/program_name'`
**Root Cause:** Program not deployed yet, so IDL files don't exist
**Solution:** Deploy the program first, then run TypeScript scripts

#### Issue #3: "Blockhash not found" Errors
**Problem:** Intermittent transaction failures on Solana devnet
**Root Cause:** Network instability and stale blockhashes
**Solution:** Use the shared retry utility (automatically applied to all scripts)

### 🎯 Development Sequence

**For New Programs:**
1. `anchor build` (compile)
2. `anchor deploy` (deploy to devnet)
3. `anchor keys sync` (update Anchor.toml)
4. Run TypeScript scripts/tests

**For Existing Programs:**
1. Verify program is deployed: `solana program show <PROGRAM_ID>`
2. Run scripts directly (no need to redeploy)
3. Use retry utility for network stability

### 📋 Code Quality Standards

**All scripts include:**
- ✅ Shared retry utility for network stability
- ✅ Environment variable loading from `.env`
- ✅ Proper error handling and logging
- ✅ TypeScript with `.ts` imports
- ✅ No hardcoded values (except security constraints)

**All test files:**
- ✅ Import retry utility: `import { retryTransaction } from "../utils/retry-helper.ts"`
- ✅ Wrap transaction calls with retry logic
- ✅ Load mock/real data from environment variables
- ✅ Clean separation of unit vs integration tests

---

## 🎯 System Architecture

### Data Flow
1. **Chainlink Data Streams** → Oracle Program (price verification)
2. **Oracle Program** → Stablecoin Program (CPI for price data)
3. **Stablecoin Program** → Token Minting (based on collateral + price)
4. **CCIP Router** → Cross-chain transfer (burn on source, mint on destination)

### Authority Management
- **Phase 1:** Wallet authority (for CCIP setup)
- **Phase 2:** 1-of-3 Multisig authority (Pool Signer + Admin + Oracle PDA)
- **Result:** Both oracle minting and CCIP transfers work seamlessly

### Security Features
- **Real-time price verification** via Chainlink Data Streams
- **On-chain price storage** with timestamp validation
- **Multisig authority** for enhanced security
- **Cross-program invocation** for oracle-stablecoin integration
- **CCIP message verification** for cross-chain security

---

## 🚀 Production Considerations

### Security Enhancements
1. **Multi-signature wallets** for admin operations
2. **Time-locked upgrades** for program modifications
3. **Rate limiting** for large transfers
4. **Emergency pause** mechanisms

### Monitoring and Maintenance
1. **Oracle price feed updates** (automated via cron jobs)
2. **CCIP transfer monitoring** via explorer APIs
3. **Token supply tracking** across chains
4. **Gas fee optimization** for Ethereum operations

### Scaling Considerations
1. **Multiple oracle feeds** for price redundancy
2. **Additional chain support** via CCIP
3. **Liquidity management** across chains
4. **Fee optimization** strategies

---

## 📚 Additional Resources

### Documentation Links
- [Chainlink Data Streams](https://docs.chain.link/data-streams)
- [Chainlink CCIP](https://docs.chain.link/ccip)
- [Solana Program Development](https://docs.solana.com/developing/on-chain-programs/overview)
- [Anchor Framework](https://www.anchor-lang.com/)

### Explorer Links
- [Solana Explorer](https://explorer.solana.com/?cluster=devnet)
- [Ethereum Sepolia Explorer](https://sepolia.etherscan.io/)
- [CCIP Explorer](https://ccip.chain.link/)

### Support
- [Chainlink Discord](https://discord.gg/chainlink)
- [Solana Discord](https://discord.gg/solana)
- [GitHub Issues](https://github.com/smartcontractkit/solana-starter-kit/issues)

---

## ⚠️ Important: Custom Oracle Program Deployment

**If you deploy your own oracle program (different from the provided example), you MUST update the stablecoin program to reference your oracle program ID.**

### 🔧 Required Steps for Custom Oracle Deployment:

#### Step 1: Update Stablecoin Program Source Code
Navigate to the stablecoin program source file:
```bash
cd ../cross-chain-stablecoin/stablecoin-program/programs/stablecoin-program/src/
vim lib.rs
```

Find line 11 and update the `ORACLE_PROGRAM_ID` constant:
```rust
// Oracle program ID (static for workshop - matches deployed oracle)
const ORACLE_PROGRAM_ID: Pubkey = pubkey!("YOUR_ORACLE_PROGRAM_ID_HERE");
```

Replace `YOUR_ORACLE_PROGRAM_ID_HERE` with your actual deployed oracle program ID.

**📝 Note:** The oracle program ID is hardcoded in the stablecoin program for security and simplicity. This ensures the stablecoin can only interact with the verified oracle program.

#### Step 2: Update Environment Configuration
Update your `.env` file with your oracle program details:
```bash
# Your deployed oracle program
ORACLE_PROGRAM_ID=YOUR_ORACLE_PROGRAM_ID_HERE

# Your oracle price feed PDA (derived from your oracle program)
ORACLE_PRICE_FEED_PDA=YOUR_PRICE_FEED_PDA_HERE
```

**📍 To find your Price Feed PDA:**
```bash
cd ../oracle/client
cargo run -- update-oracle
# Look for: "📍 PriceFeed PDA: [your-actual-pda-address]"
```

#### Step 3: Rebuild and Redeploy Stablecoin Program
```bash
cd ../cross-chain-stablecoin/stablecoin-program
anchor build
anchor deploy --provider.cluster devnet
```

#### Step 4: Update INSTRUCTIONS.md (This File)
Update the program IDs throughout this file to match your deployments:
- Replace `ORACLE_PROGRAM_ID=9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1` with your oracle program ID
- Replace `STABLECOIN_PROGRAM_ID=7HebG1xx5GjmJw3yxCpRWBV2yCt7VspRUk4ponx35jpR` with your stablecoin program ID
- Replace `ORACLE_PRICE_FEED_PDA=[your-oracle-price-feed-pda]` with your price feed PDA

### 🚨 Why This Is Required

The stablecoin program has a **hardcoded constraint** that validates the oracle program ID for security. This prevents malicious actors from using fake oracle programs. When you deploy your own oracle, the stablecoin program must be updated to recognize your oracle as legitimate.

**Error you'll see if not updated:**
```
AnchorError caused by account: oracle_program. Error Code: ConstraintAddress.
Program log: Left:  YOUR_ORACLE_PROGRAM_ID
Program log: Right: OLD_ORACLE_PROGRAM_ID
```

### 🎯 Alternative: Use Provided Example Programs

If you want to skip this step, you can use the pre-deployed example programs:
- **Oracle Program:** `9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1`
- **Stablecoin Program:** `7HebG1xx5GjmJw3yxCpRWBV2yCt7VspRUk4ponx35jpR`

These are already configured to work together and are used throughout this tutorial.

---

## 🎉 Conclusion

You have successfully implemented a complete oracle-backed stablecoin system with cross-chain capabilities! This system demonstrates:

- **Real-world price integration** via Chainlink Data Streams
- **Secure cross-chain transfers** via Chainlink CCIP
- **Production-ready architecture** with proper authority management
- **Seamless user experience** across multiple blockchains

This implementation serves as a foundation for building sophisticated DeFi applications that leverage real-world data and cross-chain functionality.

**🎆 Congratulations on building the future of decentralized finance! 🎆**
