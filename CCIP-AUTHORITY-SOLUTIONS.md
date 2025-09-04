# 🔑 **CCIP Authority Management Solutions**

## 🚨 **The Problem**
After transferring mint authority to Pool Signer PDA for CCIP, our stablecoin program can no longer mint tokens for oracle-backed collateral deposits.

## 🔧 **Solution Options**

### **Option 1: Dual Authority System (RECOMMENDED)**
**Approach**: Use Solana's multisig or modify our program to work with Pool Signer PDA

#### **1A: Multisig Mint Authority (Production Ready)**
```bash
# Instead of direct authority transfer, use a multisig
# Both our program PDA and Pool Signer PDA are signers
solana-keygen new --outfile multisig-authority.json
spl-token create-multisig 2 \
  $OUR_MINT_AUTHORITY_PDA \
  $SOL_POOL_SIGNER_PDA \
  --multisig-signer multisig-authority.json

# Transfer mint authority to multisig
spl-token authorize $SOL_TOKEN_MINT mint $MULTISIG_ADDRESS
```

**Pros**: 
- ✅ Both oracle minting and CCIP work
- ✅ Production-ready security model
- ✅ No program modifications needed

**Cons**: 
- ❌ More complex setup
- ❌ Requires multisig transaction signing

#### **1B: CPI to Pool Signer PDA (Custom Solution)**
Modify our stablecoin program to make CPI calls to the Pool Signer PDA for minting:

```rust
// Modified deposit_and_mint function
pub fn deposit_and_mint(ctx: Context<DepositAndMint>, collateral_amount: u64, feed_id: [u8; 32]) -> Result<()> {
    // ... existing oracle logic ...
    
    // Instead of direct minting, make CPI to CCIP pool
    let cpi_program = ctx.accounts.ccip_pool_program.to_account_info();
    let cpi_accounts = ccip_pool::cpi::accounts::Mint {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        pool_signer: ctx.accounts.pool_signer_pda.to_account_info(),
        // ... other CCIP accounts
    };
    ccip_pool::cpi::mint(cpi_ctx, mint_amount)?;
}
```

**Pros**: 
- ✅ Single authority model
- ✅ Direct integration

**Cons**: 
- ❌ Requires program modifications (breaks "no changes" principle)
- ❌ Dependency on CCIP pool program
- ❌ More complex account management

### **Option 2: Pre-Mint Strategy (SIMPLEST)**
**Approach**: Mint a large supply before authority transfer, manage via token accounts

#### **Implementation**:
```bash
# Before authority transfer, mint a large supply to a treasury account
spl-token mint $SOL_TOKEN_MINT 1000000000000 $TREASURY_TOKEN_ACCOUNT

# Transfer authority to Pool Signer PDA
spl-token authorize $SOL_TOKEN_MINT mint $SOL_POOL_SIGNER_PDA

# Modify program to transfer from treasury instead of minting
```

```rust
// Modified deposit_and_mint - transfer instead of mint
pub fn deposit_and_mint(ctx: Context<DepositAndMint>, collateral_amount: u64, feed_id: [u8; 32]) -> Result<()> {
    // ... existing oracle logic ...
    
    // Transfer from treasury instead of minting
    let cpi_accounts = Transfer {
        from: ctx.accounts.treasury_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.treasury_authority.to_account_info(),
    };
    token::transfer(cpi_ctx, mint_amount)?;
}
```

**Pros**: 
- ✅ Simple implementation
- ✅ No dependency on CCIP pool program
- ✅ Minimal program changes

**Cons**: 
- ❌ Fixed supply model
- ❌ Treasury management complexity
- ❌ Not truly "minting" new tokens

### **Option 3: Hybrid Approach (FLEXIBLE)**
**Approach**: Keep oracle minting separate from CCIP operations

#### **Implementation**:
```bash
# Create TWO tokens:
# 1. Oracle Stablecoin (our existing program controls)
# 2. CCIP Stablecoin (Pool Signer PDA controls)

# Bridge between them via a conversion program
```

**Pros**: 
- ✅ Complete separation of concerns
- ✅ No authority conflicts
- ✅ Maximum flexibility

**Cons**: 
- ❌ Two separate tokens
- ❌ Conversion complexity
- ❌ User experience friction

## 🎯 **RECOMMENDED SOLUTION: Option 1A (Multisig)**

### **Why Multisig is Best:**
1. **Production Ready**: Standard Solana pattern for shared authority
2. **No Program Changes**: Our stablecoin program stays exactly as-is
3. **Security**: Both parties must approve minting operations
4. **CCIP Compatible**: Pool Signer PDA can still mint for cross-chain operations

### **Implementation Steps:**

#### **Step 1: Create Multisig Authority**
```bash
# Create multisig with 2 required signatures
spl-token create-multisig 2 \
  $OUR_MINT_AUTHORITY_PDA \
  $SOL_POOL_SIGNER_PDA

# Save the multisig address
export MULTISIG_MINT_AUTHORITY="<multisig_address>"
```

#### **Step 2: Transfer Authority to Multisig**
```bash
# Transfer mint authority to multisig (not directly to Pool Signer PDA)
spl-token authorize $SOL_TOKEN_MINT mint $MULTISIG_MINT_AUTHORITY
```

#### **Step 3: Modify Our Program's Mint Context**
```rust
// Update our DepositAndMint context to use multisig
#[derive(Accounts)]
pub struct DepositAndMint<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    /// Multisig mint authority (instead of simple PDA)
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    
    /// Multisig account
    pub multisig_mint_authority: Account<'info, Multisig>,
    
    // ... rest unchanged
}
```

#### **Step 4: Update Minting Logic**
```rust
pub fn deposit_and_mint(ctx: Context<DepositAndMint>, collateral_amount: u64, feed_id: [u8; 32]) -> Result<()> {
    // ... existing oracle logic unchanged ...
    
    // Mint using multisig authority
    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.multisig_mint_authority.to_account_info(),
    };
    
    let seeds = &[b"mint_authority".as_ref(), &[ctx.bumps.mint_authority]];
    let signer_seeds = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    
    // This will require both our PDA and Pool Signer PDA to sign
    token::mint_to(cpi_ctx, mint_amount)?;
}
```

### **How It Works:**
1. **Oracle Minting**: Our program creates a multisig transaction, Pool Signer PDA auto-approves
2. **CCIP Operations**: Pool Signer PDA creates multisig transactions for cross-chain minting
3. **Security**: Both parties must approve all minting operations

## 🚀 **ALTERNATIVE: Simplified Approach**

If multisig is too complex for the hackathon, we can use **Option 2 (Pre-Mint)**:

### **Simplified Implementation:**
```bash
# 1. Before CCIP setup, mint 1 billion tokens to treasury
spl-token create-account $SOL_TOKEN_MINT --owner $TREASURY_AUTHORITY
spl-token mint $SOL_TOKEN_MINT 1000000000000000 $TREASURY_TOKEN_ACCOUNT

# 2. Transfer mint authority to Pool Signer PDA
spl-token authorize $SOL_TOKEN_MINT mint $SOL_POOL_SIGNER_PDA

# 3. Modify program to transfer from treasury instead of minting
```

**Result**: 
- ✅ Oracle deposits work (transfer from treasury)
- ✅ CCIP works (Pool Signer PDA can mint)
- ✅ Simple implementation
- ❌ Fixed supply model (but 1 billion tokens should be enough for testing)

## 🎯 **RECOMMENDATION**

For the hackathon/workshop, I recommend **Option 2 (Pre-Mint)** because:
1. **Simplest to implement** - minimal program changes
2. **Works immediately** - no complex multisig setup
3. **Demonstrates the concept** - shows both oracle and CCIP functionality
4. **Can upgrade later** - can move to multisig for production

Should we proceed with the pre-mint approach?

