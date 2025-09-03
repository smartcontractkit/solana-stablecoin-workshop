# 🔧 **CCIP Multisig Integration: Complete Implementation Plan**

## 🎯 **Overview**
Transform our oracle-backed stablecoin to work with CCIP using SPL Token Multisig approach, preserving oracle functionality while enabling cross-chain transfers.

---

## 📋 **PHASE 1: Stablecoin Program Modifications**

### **1.1 Update Program Dependencies**
**File**: `programs/stablecoin-program/Cargo.toml`

```toml
[dependencies]
anchor-lang = { version = "0.31.1", features = ["init-if-needed"] }
anchor-spl = "0.31.1"
# Add multisig support (already included in anchor-spl)
```

### **1.2 Add Multisig Imports**
**File**: `programs/stablecoin-program/src/lib.rs`

```rust
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, MintTo, Burn, Multisig}, // Add Multisig
};
```

### **1.3 Update Account Structures**

#### **A. Modify InitializeMint Context**
```rust
#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        payer = payer,
        mint::decimals = decimals,
        mint::authority = mint_authority, // Will be transferred to multisig later
    )]
    pub mint: Account<'info, Mint>,
    
    /// CHECK: This PDA will become one of the multisig signers
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
```

#### **B. Update DepositAndMint Context**
```rust
#[derive(Accounts)]
pub struct DepositAndMint<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    /// Multisig mint authority (replaces simple PDA)
    pub multisig_mint_authority: Account<'info, Multisig>,
    
    /// Our admin PDA - one of the multisig signers
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// Collateral vault PDA
    #[account(
        mut,
        seeds = [b"collateral_vault"],
        bump,
    )]
    pub collateral_vault: SystemAccount<'info>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// Oracle program for price feed
    /// CHECK: This is the oracle program ID
    #[account(constraint = oracle_program.key() == ORACLE_PROGRAM_ID)]
    pub oracle_program: UncheckedAccount<'info>,
    
    /// Oracle price feed account
    /// CHECK: This account is validated by the oracle program
    pub oracle_price_feed: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

#### **C. Update BurnAndWithdraw Context**
```rust
#[derive(Accounts)]
pub struct BurnAndWithdraw<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    /// Multisig mint authority (for burn operations)
    pub multisig_mint_authority: Account<'info, Multisig>,
    
    /// Our admin PDA - one of the multisig signers
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// Collateral vault PDA
    #[account(
        mut,
        seeds = [b"collateral_vault"],
        bump,
    )]
    pub collateral_vault: SystemAccount<'info>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// Oracle program for price feed
    /// CHECK: This is the oracle program ID
    #[account(constraint = oracle_program.key() == ORACLE_PROGRAM_ID)]
    pub oracle_program: UncheckedAccount<'info>,
    
    /// Oracle price feed account
    /// CHECK: This account is validated by the oracle program
    pub oracle_price_feed: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
```

### **1.4 Update Instruction Logic**

#### **A. Update deposit_and_mint Function**
```rust
pub fn deposit_and_mint(
    ctx: Context<DepositAndMint>,
    collateral_amount: u64,
    feed_id: [u8; 32],
) -> Result<()> {
    let collateral_sol = collateral_amount as f64 / 1_000_000_000.0;
    msg!("Depositing {} lamports ({:.9} SOL) as collateral", collateral_amount, collateral_sol);

    // Step 1: Transfer SOL from user to collateral vault
    let transfer_instruction = anchor_lang::system_program::Transfer {
        from: ctx.accounts.user.to_account_info(),
        to: ctx.accounts.collateral_vault.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        transfer_instruction,
    );
    anchor_lang::system_program::transfer(cpi_ctx, collateral_amount)?;

    // Step 2: Get price from oracle via CPI
    let cpi_program = ctx.accounts.oracle_program.to_account_info();
    let cpi_accounts = oracle::cpi::accounts::GetPrice {
        price_feed: ctx.accounts.oracle_price_feed.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    let result = oracle::cpi::get_price(cpi_ctx, feed_id)?;
    
    let oracle_price = result.get();
    let oracle_timestamp = Clock::get()?.unix_timestamp as u64;
    
    let oracle_price_usd = oracle_price as f64 / 100_000_000.0;
    msg!("Oracle price: {} raw (${:.8} USD per SOL), timestamp: {}", oracle_price, oracle_price_usd, oracle_timestamp);

    // Step 3: Calculate USD value and mint amount
    let lamports_per_sol = 1_000_000_000u128;
    let oracle_decimals = 100_000_000u128; // 8 decimals
    
    let collateral_value_usd = ((collateral_amount as u128) * (oracle_price as u128)) / (lamports_per_sol * oracle_decimals);
    let collateral_value_usd = collateral_value_usd as u64;
    
    let mint_decimals = 10u64.pow(ctx.accounts.mint.decimals as u32);
    let mint_amount = collateral_value_usd * mint_decimals;
    
    let stablecoin_amount = mint_amount as f64 / mint_decimals as f64;
    msg!("Collateral value: ${} USD, Minting: {} raw units ({:.6} USD stablecoins)", collateral_value_usd, mint_amount, stablecoin_amount);

    // Step 4: Mint tokens using multisig authority
    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.multisig_mint_authority.to_account_info(),
    };
    
    // Create signer seeds for our admin PDA (multisig signer)
    let seeds = &[b"mint_authority".as_ref(), &[ctx.bumps.mint_authority]];
    let signer_seeds = &[&seeds[..]];
    
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    
    token::mint_to(cpi_ctx, mint_amount)?;
    
    msg!("Successfully minted {} raw units ({:.6} USD stablecoins)", mint_amount, stablecoin_amount);
    Ok(())
}
```

#### **B. Update burn_and_withdraw Function**
```rust
pub fn burn_and_withdraw(
    ctx: Context<BurnAndWithdraw>,
    burn_amount: u64,
    feed_id: [u8; 32],
) -> Result<()> {
    let stablecoin_usd_amount = burn_amount as f64 / 10u64.pow(ctx.accounts.mint.decimals as u32) as f64;
    msg!("Burning {} raw units ({:.6} USD stablecoins) and withdrawing collateral", burn_amount, stablecoin_usd_amount);

    // Step 1: Get current price from oracle
    let cpi_program = ctx.accounts.oracle_program.to_account_info();
    let cpi_accounts = oracle::cpi::accounts::GetPrice {
        price_feed: ctx.accounts.oracle_price_feed.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    let result = oracle::cpi::get_price(cpi_ctx, feed_id)?;
    
    let oracle_price = result.get();
    let oracle_price_usd_burn = oracle_price as f64 / 100_000_000.0;
    msg!("Oracle price for burn: {} raw (${:.8} USD per SOL), timestamp: {}", oracle_price, oracle_price_usd_burn, Clock::get()?.unix_timestamp);

    // Step 2: Calculate collateral to return
    let mint_decimals = 10u64.pow(ctx.accounts.mint.decimals as u32);
    let usd_value = burn_amount / mint_decimals;
    
    let lamports_per_sol = 1_000_000_000u128;
    let oracle_decimals = 100_000_000u128;
    
    let collateral_amount = ((usd_value as u128) * lamports_per_sol * oracle_decimals) / (oracle_price as u128);
    let collateral_amount = collateral_amount as u64;

    // Step 3: Burn tokens using multisig authority
    let cpi_accounts = Burn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
    );
    token::burn(cpi_ctx, burn_amount)?;

    // Step 4: Return collateral using PDA signing
    let vault_seeds = &[
        b"collateral_vault".as_ref(),
        &[ctx.bumps.collateral_vault],
    ];
    let signer_seeds = &[&vault_seeds[..]];

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
```

---

## 📋 **PHASE 2: Update Test Files**

### **2.1 Update Test Imports and Setup**

#### **A. Update 1-oracle-unit-tests.ts**
```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StablecoinProgram } from "../target/types/stablecoin_program";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  createMint,
  createMultisig, // Add multisig support
  getMultisig,
  getMint,
  getAccount as getTokenAccount,
} from "@solana/spl-token";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import { BN } from "bn.js";
import { expect } from "chai";

// Test setup with multisig
describe("🔮 Oracle Unit Tests - Real Chainlink Data", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.StablecoinProgram as Program<StablecoinProgram>;
  const payer = provider.wallet.publicKey;
  
  // Multisig variables
  let multisigMintAuthority: PublicKey;
  let poolSignerPDA: PublicKey; // Will be set during CCIP setup
  
  // ... rest of test setup
});
```

#### **B. Add Multisig Test Helper Functions**
```typescript
// Helper function to create multisig for testing
async function createTestMultisig(
  connection: anchor.web3.Connection,
  payer: Keypair,
  signers: PublicKey[],
  threshold: number = 1
): Promise<PublicKey> {
  const multisig = await createMultisig(
    connection,
    payer,
    signers,
    threshold,
    TOKEN_PROGRAM_ID
  );
  return multisig;
}

// Helper function to mint with multisig
async function mintWithMultisig(
  connection: anchor.web3.Connection,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  multisigAuthority: PublicKey,
  signers: Keypair[],
  amount: number
) {
  // Implementation for multisig minting in tests
  // This will be used for manual testing of multisig functionality
}
```

### **2.2 Update Test Cases**

#### **A. Modify Initialize Mint Test**
```typescript
it("🏗️ Setup: Initialize Stablecoin Mint for Oracle Testing", async () => {
  console.log("🪙 New Mint Address:", stablecoinMint.toString());
  
  const tx = await retryTransaction(
    provider.connection,
    async (blockhash) => {
      return await program.methods
        .initializeMint(6) // 6 decimals for stablecoin
        .accountsStrict({
          mint: stablecoinMint,
          mintAuthority: mintAuthority,
          payer: payer,
          rent: SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([mintKeypair])
        .rpc({
          commitment: "confirmed",
          skipPreflight: false,
        });
    }
  );
  
  console.log("✅ Mint initialized successfully!");
  console.log("🔗 Transaction:", tx);
  
  // Verify mint was created
  const mintInfo = await getMint(provider.connection, stablecoinMint);
  console.log("📊 Mint account created:", !!mintInfo);
  console.log("👤 Current mint authority:", mintInfo.mintAuthority?.toString());
  
  // Note: Multisig will be created during CCIP setup phase
});
```

#### **B. Update Deposit and Mint Test for Multisig**
```typescript
it("🔮 Test Oracle Integration: Mint Stablecoins with Real Chainlink Price", async () => {
  console.log("👤 User Token Account:", userTokenAccount.toString());
  console.log("💎 Depositing: 100000000 lamports (0.1 SOL)");
  console.log("📋 Using REAL Feed ID from oracle");
  console.log("📊 Oracle Price Feed:", REAL_ORACLE_PRICE_FEED.toString());
  
  // Note: This test will need to be updated after multisig setup
  // For now, it will use the original mint authority
  const tx = await retryTransaction(
    provider.connection,
    async (blockhash) => {
      return await program.methods
        .depositAndMint(collateralAmount, REAL_FEED_ID)
        .accountsStrict({
          mint: stablecoinMint,
          multisigMintAuthority: mintAuthority, // Will be updated to actual multisig
          mintAuthority: mintAuthority,
          userTokenAccount: userTokenAccount,
          collateralVault: collateralVault,
          user: payer,
          oracleProgram: ORACLE_PROGRAM_ID,
          oraclePriceFeed: REAL_ORACLE_PRICE_FEED,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({
          commitment: "confirmed",
          skipPreflight: false,
        });
    }
  );
  
  // ... rest of test logic
});
```

---

## 📋 **PHASE 3: CCIP Integration Following Multisig Tutorial**

### **3.1 Ethereum Setup (Terminal 2)**
Follow the multisig tutorial exactly:

```bash
# Clone and setup Ethereum contracts
git clone https://github.com/smartcontractkit/smart-contract-examples.git
cd smart-contract-examples/ccip/cct/hardhat
npm install && npm run compile

# Setup environment variables
npx env-enc set-pw
npx env-enc set
# Required: ETHEREUM_SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY

# Deploy ERC20 token
npx hardhat deployToken \
  --name "Oracle Stablecoin" \
  --symbol "OUSD" \
  --decimals 6 \
  --verifycontract true \
  --network sepolia

export ETH_TOKEN_ADDRESS="<YOUR_TOKEN_ADDRESS>"

# Deploy BurnMint pool
npx hardhat deployTokenPool \
  --tokenaddress $ETH_TOKEN_ADDRESS \
  --localtokendecimals 6 \
  --pooltype burnMint \
  --verifycontract true \
  --network sepolia

export ETH_POOL_ADDRESS="<YOUR_POOL_ADDRESS>"

# Mint initial tokens
npx hardhat mintTokens \
  --tokenaddress $ETH_TOKEN_ADDRESS \
  --amount 1000000000 \
  --network sepolia

# Register as admin
npx hardhat claimAdmin --tokenaddress $ETH_TOKEN_ADDRESS --network sepolia
npx hardhat acceptAdminRole --tokenaddress $ETH_TOKEN_ADDRESS --network sepolia
```

### **3.2 Solana Setup (Terminal 1) - Modified for Our Stablecoin**

```bash
cd /Users/woogieboogie/github/example_verify/solana-starter-kit

# Load Ethereum variables
source ~/.phase1_vars

# Use our existing stablecoin mint (from anchor keys list)
export SOL_TOKEN_MINT="7HebG1xx5GjmJw3yxCpRWBV2yCt7VspRUk4ponx35jpR" # Our stablecoin program ID
# Actually, we need the MINT address, not program ID. Get it from our tests:
export SOL_TOKEN_MINT="<OUR_ACTUAL_MINT_ADDRESS_FROM_TESTS>"

export SOL_ADMIN_WALLET=$(solana address)
export CCIP_POOL_PROGRAM="41FGToCmdaWa1dgZLKFAjvmx6e6AjVTX7SVRibvsMGVB"

# Initialize CCIP pool for our existing mint
yarn svm:pool:initialize \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM

# Get pool info and save PDAs
yarn svm:pool:get-info \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM

export SOL_POOL_SIGNER_PDA="<FROM_OUTPUT>"
export SOL_POOL_CONFIG_PDA="<FROM_OUTPUT>"

# Create pool token account
yarn svm:pool:create-token-account \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM

# Register as CCIP admin (MUST be done before authority transfer)
yarn svm:admin:propose-administrator --token-mint $SOL_TOKEN_MINT
yarn svm:admin:accept-admin-role --token-mint $SOL_TOKEN_MINT

# Create SPL Token Multisig (1-of-2: Pool Signer PDA + Admin Wallet)
spl-token create-multisig 1 $SOL_POOL_SIGNER_PDA $SOL_ADMIN_WALLET
export SOL_MULTISIG_ADDRESS="<FROM_OUTPUT>"

# Transfer mint authority to multisig
spl-token authorize $SOL_TOKEN_MINT mint $SOL_MULTISIG_ADDRESS

# Verify multisig setup
spl-token display $SOL_TOKEN_MINT
spl-token display $SOL_MULTISIG_ADDRESS
```

---

## 📋 **PHASE 4: Update Our Program for Multisig**

### **4.1 Rebuild and Redeploy Program**
```bash
cd /Users/woogieboogie/github/example_verify/cross-chain-stablecoin/stablecoin-program

# Build with new multisig support
anchor build

# Deploy updated program
anchor deploy
```

### **4.2 Update Test Configuration**
Create a new test file for multisig testing:

**File**: `tests/4-ccip-multisig-tests.ts`
```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StablecoinProgram } from "../target/types/stablecoin_program";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMultisig,
  getMint,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "bn.js";

describe("🌉 CCIP Multisig Integration Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.StablecoinProgram as Program<StablecoinProgram>;
  
  // CCIP configuration (set these from your CCIP setup)
  const SOL_TOKEN_MINT = new PublicKey("YOUR_MINT_ADDRESS");
  const SOL_MULTISIG_ADDRESS = new PublicKey("YOUR_MULTISIG_ADDRESS");
  const SOL_POOL_SIGNER_PDA = new PublicKey("YOUR_POOL_SIGNER_PDA");
  
  // Oracle configuration
  const ORACLE_PROGRAM_ID = new PublicKey("9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1");
  const REAL_ORACLE_PRICE_FEED = new PublicKey("5CjYMCxwds8bKxnkfMoayEMy1oVjToZUMtoejAPkTYBH");
  const REAL_FEED_ID = Array.from(Buffer.from("d1be62b7c7d3d7d0d7d0d7d0d7d0d7d0d7d0d7d0d7d0d7d0d7d0d7d0d7d0d7d0", "hex"));
  
  // PDAs
  const [mintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority")],
    program.programId
  );
  
  const [collateralVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("collateral_vault")],
    program.programId
  );

  it("🔍 Verify Multisig Configuration", async () => {
    console.log("🔧 Verifying CCIP multisig setup...");
    
    // Check mint authority is multisig
    const mintInfo = await getMint(provider.connection, SOL_TOKEN_MINT);
    console.log("👤 Current mint authority:", mintInfo.mintAuthority?.toString());
    console.log("🎯 Expected multisig:", SOL_MULTISIG_ADDRESS.toString());
    
    expect(mintInfo.mintAuthority?.toString()).to.equal(SOL_MULTISIG_ADDRESS.toString());
    
    // Check multisig configuration
    const multisigInfo = await getMultisig(provider.connection, SOL_MULTISIG_ADDRESS);
    console.log("📊 Multisig threshold:", multisigInfo.m);
    console.log("👥 Multisig signers:", multisigInfo.signers.length);
    console.log("🔑 Signer 1 (Pool Signer PDA):", multisigInfo.signers[0].toString());
    console.log("🔑 Signer 2 (Admin Wallet):", multisigInfo.signers[1].toString());
    
    expect(multisigInfo.m).to.equal(1); // 1-of-2 multisig
    expect(multisigInfo.signers.length).to.equal(2);
  });

  it("🔮 Test Oracle Minting with Multisig Authority", async () => {
    console.log("🧪 Testing oracle-backed minting with multisig...");
    
    const userTokenAccount = anchor.utils.token.associatedAddress({
      mint: SOL_TOKEN_MINT,
      owner: provider.wallet.publicKey,
    });
    
    const collateralAmount = new BN(100_000_000); // 0.1 SOL
    
    try {
      const tx = await program.methods
        .depositAndMint(collateralAmount, REAL_FEED_ID)
        .accountsStrict({
          mint: SOL_TOKEN_MINT,
          multisigMintAuthority: SOL_MULTISIG_ADDRESS,
          mintAuthority: mintAuthority,
          userTokenAccount: userTokenAccount,
          collateralVault: collateralVault,
          user: provider.wallet.publicKey,
          oracleProgram: ORACLE_PROGRAM_ID,
          oraclePriceFeed: REAL_ORACLE_PRICE_FEED,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({
          commitment: "confirmed",
          skipPreflight: false,
        });
      
      console.log("✅ Oracle minting with multisig successful!");
      console.log("🔗 Transaction:", tx);
      
      // Check token balance
      const tokenBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
      console.log("🪙 Minted tokens:", tokenBalance.value.uiAmountString);
      
    } catch (error) {
      console.error("❌ Oracle minting failed:", error);
      throw error;
    }
  });
  
  it("🔥 Test Burn and Withdraw with Multisig", async () => {
    // Similar test for burn functionality
    console.log("🧪 Testing burn and withdraw...");
    
    // Implementation similar to deposit_and_mint but for burning
  });
});
```

### **4.3 Update test-individual.sh**
```bash
# Add CCIP test option to test-individual.sh
case "$1" in
  "oracle")
    run_tests "Oracle Unit Tests" "Oracle Unit Tests"
    ;;
  "stablecoin")
    run_tests "Stablecoin Unit Tests" "Stablecoin Unit Tests"
    ;;
  "integration")
    run_tests "Oracle-Stablecoin Integration" "Integration Tests"
    ;;
  "ccip")
    run_tests "CCIP Multisig Integration" "CCIP Tests"
    ;;
  "all")
    run_tests "" "All Tests"
    ;;
  # ... rest unchanged
esac
```

---

## 📋 **PHASE 5: Cross-Chain Configuration & Testing**

### **5.1 Complete Cross-Chain Setup**
Follow the multisig tutorial phases 3-5 exactly:

```bash
# Configure Solana -> Ethereum
yarn svm:pool:init-chain-remote-config \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM \
  --remote-chain ethereum-sepolia \
  --token-address $ETH_TOKEN_ADDRESS \
  --decimals 6

yarn svm:pool:edit-chain-remote-config \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM \
  --remote-chain ethereum-sepolia \
  --pool-addresses $ETH_POOL_ADDRESS \
  --token-address $ETH_TOKEN_ADDRESS \
  --decimals 6

# Configure Ethereum -> Solana (Terminal 2)
npx hardhat applyChainUpdates \
  --pooladdress $ETH_POOL_ADDRESS \
  --remotechain solanaDevnet \
  --remotepooladdresses $SOL_POOL_CONFIG_PDA \
  --remotetokenaddress $SOL_TOKEN_MINT \
  --network sepolia

# Register pools
npx hardhat setPool \
  --tokenaddress $ETH_TOKEN_ADDRESS \
  --pooladdress $ETH_POOL_ADDRESS \
  --network sepolia

# Create ALT and register Solana pool
yarn svm:admin:create-alt \
  --token-mint $SOL_TOKEN_MINT \
  --pool-program $CCIP_POOL_PROGRAM \
  --additional-addresses $SOL_MULTISIG_ADDRESS

export SOL_ALT_ADDRESS="<FROM_OUTPUT>"

yarn svm:admin:set-pool \
  --token-mint $SOL_TOKEN_MINT \
  --lookup-table $SOL_ALT_ADDRESS \
  --writable-indices 3,4,7
```

### **5.2 Test Cross-Chain Transfers**
```bash
# Delegate tokens for CCIP
yarn svm:token:delegate --token-mint $SOL_TOKEN_MINT

# Test Solana -> Ethereum
yarn svm:token-transfer \
  --token-mint $SOL_TOKEN_MINT \
  --token-amount 1000000 \
  --receiver <YOUR_ETHEREUM_ADDRESS>

# Test Ethereum -> Solana
yarn evm:transfer \
  --token $ETH_TOKEN_ADDRESS \
  --amount 1000000 \
  --token-receiver $SOL_ADMIN_WALLET
```

---

## 📋 **PHASE 6: Verification & Testing**

### **6.1 Complete Test Suite**
```bash
# Test all functionality
cd /Users/woogieboogie/github/example_verify/cross-chain-stablecoin/stablecoin-program

# Test oracle functionality (should work with multisig)
./test-individual.sh oracle

# Test CCIP integration
./test-individual.sh ccip

# Test everything together
./test-individual.sh all
```

### **6.2 Manual Verification**
```bash
# Verify multisig can mint manually (proves admin control)
spl-token mint $SOL_TOKEN_MINT 1 \
  --owner $SOL_MULTISIG_ADDRESS \
  --multisig-signer $HOME/.config/solana/id.json

# Verify oracle minting still works
# Run oracle unit tests

# Verify CCIP transfers work
# Test cross-chain transfers
```

---

## 🎯 **SUCCESS CRITERIA**

### **✅ Oracle Functionality Preserved:**
- ✅ Users can deposit SOL and mint stablecoins
- ✅ Oracle price feeds work correctly
- ✅ Burn and withdraw functionality works
- ✅ All existing tests pass

### **✅ CCIP Functionality Added:**
- ✅ Cross-chain transfers Solana ↔ Ethereum work
- ✅ Pool Signer PDA can mint/burn autonomously
- ✅ Multisig authority enables both oracle and CCIP operations
- ✅ Admin retains control through multisig membership

### **✅ Integration Verified:**
- ✅ Users can: Deposit SOL → Mint stablecoins → Transfer cross-chain
- ✅ Users can: Receive cross-chain → Burn stablecoins → Withdraw SOL
- ✅ Both oracle-backed and cross-chain minting work simultaneously

---

## 🚨 **CRITICAL NOTES**

### **⚠️ Mint Address vs Program ID:**
- Our stablecoin **program ID**: `7HebG1xx5GjmJw3yxCpRWBV2yCt7VspRUk4ponx35jpR`
- We need the actual **mint address** from our tests (different for each test run)
- Get the mint address from successful test runs or create a persistent mint

### **⚠️ Testing Sequence:**
1. **First**: Update program code with multisig support
2. **Second**: Deploy updated program
3. **Third**: Run CCIP setup with existing mint OR create new mint
4. **Fourth**: Update tests to use multisig accounts
5. **Fifth**: Test complete integration

### **⚠️ Environment Variables:**
Save all configuration in environment files for easy switching between terminals and test runs.

This comprehensive plan ensures our oracle-backed stablecoin works seamlessly with CCIP while preserving all existing functionality!
