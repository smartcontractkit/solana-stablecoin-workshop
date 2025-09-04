# Oracle-Backed Stablecoin with CCIP Cross-Chain Integration

## Complete Step-by-Step Implementation Guide

This document provides comprehensive instructions for building a fully functional oracle-backed stablecoin system with Chainlink Cross-Chain Interoperability Protocol (CCIP) integration, enabling seamless cross-chain token transfers between Solana and Ethereum.

## 🎯 System Overview

**What We're Building:**
- **Oracle-backed stablecoin** using real Chainlink Data Streams (SOL/USD price feeds)
- **Cross-chain token transfers** via Chainlink CCIP (Solana ↔ Ethereum)
- **Production-ready architecture** with proper multisig authority management
- **Real-time price verification** and on-chain storage

**Key Components:**
1. **Oracle Program** - Verifies and stores Chainlink Data Streams on Solana
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

# Node.js and Yarn
npm install -g yarn

# Git
# Install via your system package manager
```

### Required Accounts
- **Solana Wallet** with devnet SOL
- **Ethereum Wallet** with Sepolia ETH
- **Chainlink Data Streams API** access (for production)

### Environment Setup
```bash
# Configure Solana CLI for devnet
solana config set --url https://api.devnet.solana.com
solana config set --keypair ~/.config/solana/id.json

# Verify configuration
solana config get
```

---

## 🏗️ Phase 1: Oracle Program Deployment

### Step 1.1: Clone and Setup Oracle Repository
```bash
cd ~/github
git clone <oracle-repository-url>
cd oracle
```

### Step 1.2: Build and Deploy Oracle Program
```bash
# Build the oracle program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Note the deployed program ID - you'll need this later
# Example: 9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1
```

### Step 1.3: Initialize Oracle Price Feed
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
- **Oracle Program ID:** `9w1TEJRgUafEcVDVWH4ejGVkETvvd1C77WE8gVcHfUfU`
- **Price Feed PDA:** `HqqVks96kxdktt3jUvmoeF9dsc9pWgXVfYG27ri8Xi6C` *(derived from your oracle program)*

**⚠️ Important:** The Price Feed PDA is derived from YOUR deployed oracle program ID. The address above is specific to program ID `9w1TEJRgUafEcVDVWH4ejGVkETvvd1C77WE8gVcHfUfU`. If you deploy a different oracle program, you'll get a different PDA address from the `update-oracle` command output.

---

## 🪙 Phase 2: Stablecoin Program Deployment

### Step 2.1: Setup Stablecoin Program
```bash
cd ~/github/example_verify/cross-chain-stablecoin/stablecoin-program
```

### Step 2.2: Configure Program for CCIP Compatibility
The stablecoin program includes two minting instructions:
- `deposit_and_mint_single` - For wallet authority (CCIP setup phase)
- `deposit_and_mint_multisig` - For multisig authority (post-CCIP phase)

### Step 2.3: Build and Deploy Stablecoin Program
```bash
anchor build
anchor deploy --provider.cluster devnet
```

**Key Address to Save:**
- **Stablecoin Program ID:** `7HebG1xx5GjmJw3yxCpRWBV2yCt7VspRUk4ponx35jpR`

### Step 2.4: Create Initial Oracle-Backed Stablecoin Token
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
🪙 New mint address: 81kUD5Tf7AhxDvLxaVfRxCpDvtXooTHFEPhVfpku26r6
🔗 Transaction: 2EMYvp7Wfdcdk4tGAKMMrkceyrVp5ooTWvZwdbRi2aXzjXmvF1vTG33AmavxPKRZ9VAwqTw1PihudW1yVv3y5oz6

📋 CCIP Setup Variables:
export SOL_TOKEN_MINT="81kUD5Tf7AhxDvLxaVfRxCpDvtXooTHFEPhVfpku26r6"
export SOL_ADMIN_WALLET=$(solana address)
export CCIP_POOL_PROGRAM="41FGToCmdaWa1dgZLKFAjvmx6e6AjVTX7SVRibvsMGVB"
```

**Key Address to Save:**
- **Stablecoin Token Mint:** `81kUD5Tf7AhxDvLxaVfRxCpDvtXooTHFEPhVfpku26r6` *(example - use your actual generated address)*

---

## 🌉 Phase 3: CCIP Integration (Solana Side)

### Step 3.1: Setup Solana Starter Kit
```bash
cd ~/github
git clone https://github.com/smartcontractkit/solana-starter-kit.git
cd solana-starter-kit
yarn install
```

### Step 3.2: Set Environment Variables
```bash
export SOL_TOKEN_MINT="8vg7CL4WByjVp2xR9gwai4WpsKRJUkF2okjg7ScoiYfn"
export CCIP_POOL_PROGRAM="41FGToCmdaWa1dgZLKFAjvmx6e6AjVTX7SVRibvsMGVB"
```

### Step 3.3: Initialize CCIP Token Pool
```bash
yarn svm:pool:initialize \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM
```

**Expected Output:**
```
✅ POOL INITIALIZED SUCCESSFULLY
📍 Pool State PDA: 7ThMdCYGARo2kF8ZoAcMqNLpJSSfTW3Uu2q2JCwHFg27
📍 Pool Signer PDA: 91nQ1VwEWdZ8jnr1WwDLWdHH4sy2tGzfZgAzbyzRgPy4
🔗 Transaction: nKhgg6NdMCs7LGLF5SX7ty3SpmaCy7yEpeWzxomxZaovt4nAnSxzZasVJ63FtaVi2N2VAZD4iBhiHZ3kxTjLReu
```

**Key Addresses to Save:**
- **Pool Config PDA:** `7ThMdCYGARo2kF8ZoAcMqNLpJSSfTW3Uu2q2JCwHFg27` *(your actual address will be different)*
- **Pool Signer PDA:** `91nQ1VwEWdZ8jnr1WwDLWdHH4sy2tGzfZgAzbyzRgPy4` *(your actual address will be different)*

### Step 3.4: Set Up CCIP Administration
```bash
# Propose administrator
yarn svm:admin:propose-administrator \
  --token-mint $SOL_TOKEN_MINT \
  --administrator [your-wallet-address]

# Accept admin role
yarn svm:admin:accept-admin-role \
  --token-mint $SOL_TOKEN_MINT
```

### Step 3.5: Create SPL Token Multisig (Critical for CCIP + Oracle Integration)
```bash
# Create 1-of-3 multisig with Pool Signer PDA, Admin Wallet, and Oracle PDA
spl-token create-multisig 1 \
  F5KLpcP7eJvkJnyvoZNUYB26oYDq5EATAWRSPj8oVVtH \
  [your-wallet-address] \
  [oracle-mint-authority-pda]
```

**Expected Output:**
```
Creating 1-of-3 multisig
Multisig Address: 2dGyhXZ1Pp64XTCNuLZkUzYK86bet26suFYfkAeVLXDz
```

**Key Address to Save:**
- **Multisig Address:** `2dGyhXZ1Pp64XTCNuLZkUzYK86bet26suFYfkAeVLXDz`

### Step 3.6: Transfer Mint Authority to Multisig
```bash
export SOL_MULTISIG_ADDRESS="2dGyhXZ1Pp64XTCNuLZkUzYK86bet26suFYfkAeVLXDz"

spl-token authorize $SOL_TOKEN_MINT mint $SOL_MULTISIG_ADDRESS
```

### Step 3.7: Create Address Lookup Table (ALT)
```bash
yarn svm:admin:create-alt \
  --token-mint $SOL_TOKEN_MINT \
  --pool-program $CCIP_POOL_PROGRAM \
  --additional-addresses $SOL_MULTISIG_ADDRESS
```

**Expected Output:**
```
✅ ALT created successfully!
ALT Address: Fhv8v1LaLwZmpXJrdijDmr8J4CGCiYrmtTP2zjPJEpgM
```

**Key Address to Save:**
- **ALT Address:** `Fhv8v1LaLwZmpXJrdijDmr8J4CGCiYrmtTP2zjPJEpgM`

### Step 3.8: Register Pool with CCIP Router
```bash
export SOL_ALT_ADDRESS="Fhv8v1LaLwZmpXJrdijDmr8J4CGCiYrmtTP2zjPJEpgM"

yarn svm:admin:set-pool \
  --token-mint $SOL_TOKEN_MINT \
  --lookup-table $SOL_ALT_ADDRESS \
  --writable-indices 3,4,7
```

---

## 🔗 Phase 4: Ethereum Side Deployment

### Step 4.1: Setup Ethereum Environment
```bash
cd ~/github/example_verify/smart-contract-examples/ccip/cct/hardhat

# Create .env file
cat > .env << EOF
ETHEREUM_SEPOLIA_RPC_URL=https://1rpc.io/sepolia
PRIVATE_KEY=0x[your-private-key]
ETHERSCAN_API_KEY=[your-etherscan-api-key]
EOF
```

### Step 4.2: Deploy ERC20 Token for Oracle-Backed Stablecoin
```bash
npx hardhat deployToken \
  --network sepolia \
  --name "Oracle-Backed Stablecoin" \
  --symbol "OBSC" \
  --decimals 6 \
  --premint 1000000000000 \
  --maxsupply 1000000000000000
```

**Expected Output:**
```
Token deployed to: 0xF1a6916111Ad79459b643ec561537E485Bf5CE46
```

**Key Address to Save:**
- **Ethereum Token:** `0xF1a6916111Ad79459b643ec561537E485Bf5CE46` *(example - your address will be different)*

### Step 4.3: Deploy TokenPool
```bash
npx hardhat deployTokenPool \
  --network sepolia \
  --tokenaddress 0xA7A69221BaE843E129c72d49b730e3b23152a605 \
  --pooltype burnMint \
  --localtokendecimals 6
```

**Expected Output:**
```
Token pool deployed to: 0x238522396b383092C1B49d88797Ead39266a0515
```

**Key Address to Save:**
- **Ethereum TokenPool:** `0x238522396b383092C1B49d88797Ead39266a0515` *(example - your address will be different)*

### Step 4.4: Claim and Accept Admin Role
```bash
# Claim admin
npx hardhat claimAdmin \
  --network sepolia \
  --tokenaddress 0xA7A69221BaE843E129c72d49b730e3b23152a605

# Accept admin role
npx hardhat acceptAdminRole \
  --network sepolia \
  --tokenaddress 0xA7A69221BaE843E129c72d49b730e3b23152a605
```

### Step 4.5: Register Pool with TokenAdminRegistry
```bash
npx hardhat setPool \
  --network sepolia \
  --tokenaddress 0xA7A69221BaE843E129c72d49b730e3b23152a605 \
  --pooladdress 0x66D8997EF281D76c7c60f7e7f283A90D15C60839
```

### Step 4.6: Configure Cross-Chain Connectivity (Ethereum → Solana)
```bash
npx hardhat applyChainUpdates \
  --network sepolia \
  --pooladdress 0x66D8997EF281D76c7c60f7e7f283A90D15C60839 \
  --remotechain solanaDevnet \
  --remotetokenaddress 8vg7CL4WByjVp2xR9gwai4WpsKRJUkF2okjg7ScoiYfn \
  --remotepooladdresses HtFNeEoKEsgy5VXQe6oj4VnRxdK3iUNkpvKWGPGG1RRN
```

---

## 🔄 Phase 5: Complete Cross-Chain Configuration

### Step 5.1: Configure Solana → Ethereum Connectivity
```bash
cd ~/github/solana-starter-kit

# Initialize chain remote config
yarn svm:pool:init-chain-remote-config \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM \
  --remote-chain ethereum-sepolia \
  --token-address "0xF1a6916111Ad79459b643ec561537E485Bf5CE46" \
  --decimals 6
```

**⚠️ Expected Behavior:** You will see "Error: Chain config not found" in the output - this is expected behavior since we are creating the configuration for the first time. The script will continue and successfully create the new configuration.

### Step 5.2: Add Ethereum Pool Address
```bash
yarn svm:pool:edit-chain-remote-config \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM \
  --remote-chain ethereum-sepolia \
  --pool-addresses "0x238522396b383092C1B49d88797Ead39266a0515" \
  --token-address "0xF1a6916111Ad79459b643ec561537E485Bf5CE46" \
  --decimals 6
```

---

## 🚀 Phase 6: Testing and Token Operations

### Step 6.1: Update Oracle with Fresh Price Data
```bash
cd ~/github/example_verify/oracle/client
cargo run -- update-oracle
```

### Step 6.2: Mint Oracle-Backed Stablecoin Tokens
```bash
# Create token account
spl-token create-account $SOL_TOKEN_MINT

# Mint tokens using multisig (1-of-3, our wallet is a signer)
spl-token mint $SOL_TOKEN_MINT 10000000 \
  --owner $SOL_MULTISIG_ADDRESS \
  --multisig-signer ~/.config/solana/id.json
```

**Expected Output:**
```
Minting 10000000 tokens (10 tokens with 6 decimals)
Signature: [transaction-hash]
```

### Step 6.3: Create Pool Token Account (Required for CCIP)
```bash
export SOL_POOL_SIGNER_PDA="91nQ1VwEWdZ8jnr1WwDLWdHH4sy2tGzfZgAzbyzRgPy4"

spl-token create-account $SOL_TOKEN_MINT \
  --owner $SOL_POOL_SIGNER_PDA \
  --fee-payer ~/.config/solana/id.json
```

**Expected Output:**
```
Creating account 5gu6sECivkuEK457rbuJXc5rVXtfkpjoyyQirsr3MLag
```

**Key Address to Save:**
- **Pool Token Account:** `5gu6sECivkuEK457rbuJXc5rVXtfkpjoyyQirsr3MLag` *(example - your address will be different)*

### Step 6.4: Delegate Token Authority to CCIP
```bash
yarn svm:token:delegate --token-mint $SOL_TOKEN_MINT
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
```bash
yarn svm:token-transfer \
  --token-mint $SOL_TOKEN_MINT \
  --amount 1000000 \
  --destination-chain ethereum-sepolia \
  --receiver-address 0x4fed0A5B65eac383D36E65733786386709B86be8
```

**⚠️ Important:** Use `--receiver-address` (not `--destination-address`) to specify the Ethereum recipient address.

**Expected Output:**
```
✅ TOKEN TRANSFER SENT SUCCESSFULLY
EVM Receiver Address: 0x4fed0A5B65eac383D36E65733786386709B86be8
Transaction Signature: 61gA2Xky5NGpaJ7kCJuqu97MttpWEQC8GEJ5k5iAmavJoJ9RtwEzqQyAFW53JDAakFWdn93EYMyRTsikDVV1JjJa
CCIP Message ID: 0xe90dbe206ed5df7b05daacffee132166297e18bda1cbf80d6a1ca38dccf05a0b
✅ Sent 1000000 tokens (1 token with 6 decimals)
```

### Step 7.3: Monitor Transfer Progress
- **Solana Explorer:** https://explorer.solana.com/tx/[transaction-hash]?cluster=devnet
- **CCIP Explorer:** https://ccip.chain.link/msg/[message-id]

---

## 📊 Key Addresses Summary

### Solana Addresses
```bash
# Programs
ORACLE_PROGRAM_ID="9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1"
STABLECOIN_PROGRAM_ID="7HebG1xx5GjmJw3yxCpRWBV2yCt7VspRUk4ponx35jpR"
CCIP_POOL_PROGRAM="41FGToCmdaWa1dgZLKFAjvmx6e6AjVTX7SVRibvsMGVB"

# Token and Accounts
SOL_TOKEN_MINT="8vg7CL4WByjVp2xR9gwai4WpsKRJUkF2okjg7ScoiYfn"
SOL_MULTISIG_ADDRESS="2dGyhXZ1Pp64XTCNuLZkUzYK86bet26suFYfkAeVLXDz"
SOL_POOL_CONFIG_PDA="HtFNeEoKEsgy5VXQe6oj4VnRxdK3iUNkpvKWGPGG1RRN"
SOL_POOL_SIGNER_PDA="F5KLpcP7eJvkJnyvoZNUYB26oYDq5EATAWRSPj8oVVtH"
SOL_ALT_ADDRESS="Fhv8v1LaLwZmpXJrdijDmr8J4CGCiYrmtTP2zjPJEpgM"
POOL_TOKEN_ACCOUNT="FJfZNAdMBHncZ6bZkL6PEnq8awApudVYM1fXYgSJdeAq"

# Oracle
ORACLE_PRICE_FEED="C9wfvvoRntdnfFrPbeNtZ74ChXuKo6zJq7QGdyWZPBen"
```

### Ethereum Addresses
```bash
# Contracts
ETH_TOKEN_ADDRESS="0xA7A69221BaE843E129c72d49b730e3b23152a605"
ETH_TOKEN_POOL="0x66D8997EF281D76c7c60f7e7f283A90D15C60839"
```

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
yarn svm:token:delegate --token-mint $SOL_TOKEN_MINT
```

#### 3. Oracle Price Feed Not Found
**Solution:** Update oracle with fresh data
```bash
cd ~/github/example_verify/oracle/client
cargo run -- update-oracle
```

#### 4. Multisig Minting Issues
**Solution:** Ensure you're using the correct multisig command
```bash
spl-token mint $SOL_TOKEN_MINT [amount] \
  --owner $SOL_MULTISIG_ADDRESS \
  --multisig-signer ~/.config/solana/id.json
```

#### 5. Cross-Chain Transfer Goes to Wrong Address
**Problem:** Transfer shows hardcoded address `0x9d087fC03ae39b088326b67fA3C788236645b717` instead of your address
**Solution:** Use `--receiver-address` instead of `--destination-address`
```bash
# ❌ Wrong - uses hardcoded fallback address
yarn svm:token-transfer --destination-address 0x[your-address]

# ✅ Correct - uses your specified address  
yarn svm:token-transfer --receiver-address 0x[your-address]
```

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

## 🎉 Conclusion

You have successfully implemented a complete oracle-backed stablecoin system with cross-chain capabilities! This system demonstrates:

- **Real-world price integration** via Chainlink Data Streams
- **Secure cross-chain transfers** via Chainlink CCIP
- **Production-ready architecture** with proper authority management
- **Seamless user experience** across multiple blockchains

This implementation serves as a foundation for building sophisticated DeFi applications that leverage real-world data and cross-chain functionality.

**🎆 Congratulations on building the future of decentralized finance! 🎆**
