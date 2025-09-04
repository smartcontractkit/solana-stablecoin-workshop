import * as anchor from "@coral-xyz/anchor"
import { Program, BN } from "@coral-xyz/anchor"
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } from "@solana/web3.js"
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  getMint, 
  getAccount,
  createMint,
  createMultisig
} from "@solana/spl-token"
import { StablecoinProgram } from "../target/types/stablecoin_program"

// Load environment variables
import dotenv from 'dotenv'
dotenv.config()

// REAL Oracle data from deployed program (from .env)
const ORACLE_PROGRAM_ID = new PublicKey(process.env.ORACLE_PROGRAM_ID || "9w1TEJRgUafEcVDVWH4ejGVkETvvd1C77WE8gVcHfUfU")
// Official SOL/USD Feed ID from Chainlink Data Streams docs
const REAL_FEED_ID = [0, 3, 211, 56, 234, 42, 195, 190, 158, 2, 96, 51, 177, 170, 96, 22, 115, 195, 123, 171, 94, 19, 133, 28, 89, 150, 111, 159, 130, 7, 84, 214]
const REAL_ORACLE_PRICE_FEED = new PublicKey(process.env.REAL_ORACLE_PRICE_FEED || "C9wfvvoRntdnfFrPbeNtZ74ChXuKo6zJq7QGdyWZPBen")

// CCIP Pool Program ID (Chainlink's self-service BurnMint pool program)
const CCIP_POOL_PROGRAM_ID = new PublicKey("41FGToCmdaWa1dgZLKFAjvmx6e6AjVTX7SVRibvsMGVB")

// Function to derive Pool Signer PDA deterministically
function findPoolSignerPDA(tokenMint: PublicKey, poolProgramId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ccip_tokenpool_signer"), tokenMint.toBuffer()],
    poolProgramId
  )
}

// Enhanced retry helper
async function retryTransaction(
  connection: anchor.web3.Connection,
  fn: (blockhash: string) => Promise<string>, 
  maxRetries = 3
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { blockhash } = await connection.getLatestBlockhash('confirmed')
      const signature = await fn(blockhash)
      
      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash('confirmed')
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed')
      
      return signature
    } catch (error: any) {
      console.log(`⚠️ Attempt ${i + 1} failed: ${error.message}`)
      if (i === maxRetries - 1) throw error
      
      const delay = Math.pow(2, i) * 2000 // 2s, 4s, 8s
      console.log(`⏳ Waiting ${delay/1000}s before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error("Max retries exceeded")
}

describe("🔗 Oracle-Stablecoin Integration Tests", () => {
  console.log("🔗 Testing Complete Oracle ↔ Stablecoin Integration")
  console.log("═══════════════════════════════════════════════════════════════")

  const provider = anchor.AnchorProvider.env()
  provider.opts.commitment = 'confirmed'
  provider.opts.preflightCommitment = 'confirmed'
  provider.opts.skipPreflight = false
  anchor.setProvider(provider)
  
  const connection = provider.connection
  const program = anchor.workspace.StablecoinProgram as Program<StablecoinProgram>
  const payer = provider.wallet.publicKey

  // Test accounts - will create multisig setup dynamically
  let stablecoinMint: PublicKey
  let mintAuthority: PublicKey
  let multisigAuthority: PublicKey
  let collateralVault: PublicKey
  let userTokenAccount: PublicKey

  before(async () => {
    console.log("\n🏗️ Setting up Oracle CPI test environment...")
    
    // Derive PDAs
    const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_authority")],
      program.programId
    )
    mintAuthority = mintAuthorityPda

    const [collateralVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("collateral_vault")],
      program.programId
    )
    collateralVault = collateralVaultPda

    console.log("🏦 Mint Authority PDA:", mintAuthority.toString())
    console.log("🏛️ Collateral Vault PDA:", collateralVault.toString())

    // Verify oracle price feed exists
    const oracleFeedInfo = await connection.getAccountInfo(REAL_ORACLE_PRICE_FEED)
    if (!oracleFeedInfo) {
      throw new Error("Oracle price feed not found! Run oracle client first: cd ../oracle/client && cargo run -- update-oracle")
    }
    console.log("✅ Oracle price feed confirmed:", REAL_ORACLE_PRICE_FEED.toString())
  })

  it("🏗️ Setup: Create Mint with Multisig Authority (CCIP-Compatible)", async () => {
    console.log("\n🏗️ Integration Test 1: Create Mint with Multisig Authority (CCIP-Compatible)")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Step 1: Create a multisig with our PDA as one of the signers
    // This uses the REAL CCIP Pool Signer PDA (deterministic)
    const adminKeypair = anchor.web3.Keypair.generate() // Simulate admin wallet
    
    // Step 2: Create a temporary mint to derive the real Pool Signer PDA
    const tempMintKeypair = anchor.web3.Keypair.generate()
    const [realPoolSignerPDA, poolSignerBump] = findPoolSignerPDA(tempMintKeypair.publicKey, CCIP_POOL_PROGRAM_ID)
    
    console.log("🔑 Creating 1-of-3 multisig with signers:")
    console.log("  - Admin Wallet:", adminKeypair.publicKey.toString())
    console.log("  - Pool Signer PDA:", realPoolSignerPDA.toString(), `(bump: ${poolSignerBump})`)
    console.log("  - Our Program PDA:", mintAuthority.toString())

    // Create the multisig (1-of-3: any one signer can authorize)
    const multisigKeypair = anchor.web3.Keypair.generate()
    multisigAuthority = await createMultisig(
      provider.connection,
      provider.wallet.payer, // Use the actual keypair, not wallet wrapper
      [adminKeypair.publicKey, realPoolSignerPDA, mintAuthority], // Real CCIP Pool Signer PDA
      1, // M = 1 (1-of-3)
      multisigKeypair, // Provide the keypair
      { commitment: "confirmed" }
    )
    
    console.log("🔐 Multisig created:", multisigAuthority.toString())

    // Step 2: Create mint with multisig as authority
    const mintKeypair = anchor.web3.Keypair.generate()
    stablecoinMint = await createMint(
      provider.connection,
      provider.wallet.payer, // Use the actual keypair
      multisigAuthority, // Mint authority (multisig)
      null, // Freeze authority (none)
      6, // Decimals
      mintKeypair, // Provide the keypair
      { commitment: "confirmed" }
    )

    console.log("🪙 Mint created with multisig authority:", stablecoinMint.toString())
    console.log("🔐 Mint authority (multisig):", multisigAuthority.toString())

    // Verify setup
    const mintInfo = await provider.connection.getAccountInfo(stablecoinMint)
    console.log("✅ Mint account created:", mintInfo !== null)
    
    // Get user's token account (now that mint is created)
    userTokenAccount = await getAssociatedTokenAddress(stablecoinMint, payer)
    console.log("👤 User token account:", userTokenAccount.toString())
  })

  it("🔗 Integration Test: Deposit Collateral with Oracle CPI", async () => {
    console.log("\n🔗 Integration Test 2: Deposit Collateral with Oracle CPI")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    const collateralAmount = new BN(50_000_000) // 0.05 SOL
    console.log("💎 Depositing:", collateralAmount.toString(), "lamports (0.05 SOL)")
    console.log("📊 Oracle Price Feed:", REAL_ORACLE_PRICE_FEED.toString())

    const depositAndMint = async (blockhash: string): Promise<string> => {
              return await program.methods
          .depositAndMintMultisig(collateralAmount, REAL_FEED_ID)
        .accounts({
          mint: stablecoinMint,
          multisig: multisigAuthority, // The multisig authority
          mintAuthority: mintAuthority, // Our PDA will sign for the multisig
          userTokenAccount: userTokenAccount,
          collateralVault: collateralVault,
          user: payer,
          oracleProgram: ORACLE_PROGRAM_ID,
          oraclePriceFeed: REAL_ORACLE_PRICE_FEED,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' })
    }

    const signature = await retryTransaction(connection, depositAndMint, 3)
    console.log("🎉 REAL Oracle CPI SUCCESS!")
    console.log("🔗 Transaction:", signature)

    // Check user's stablecoin balance
    const userAccount = await getAccount(connection, userTokenAccount)
    const balance = Number(userAccount.amount)
    console.log("🪙 Stablecoin balance:", balance / 1_000_000, "USD (" + balance + " raw units)")

    // Verify we got some stablecoins
    if (balance === 0) {
      throw new Error("No stablecoins were minted!")
    }

    console.log("✅ Integration test successful - Oracle CPI working with multisig!")
  })

  it("🔍 Integration Test: Verify Complete System State", async () => {
    console.log("\n🔍 Integration Test 3: Verify Complete System State")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    // Verify oracle price feed exists and has data
    const oracleAccountInfo = await connection.getAccountInfo(REAL_ORACLE_PRICE_FEED)
    console.log("✅ Oracle price feed exists:", oracleAccountInfo !== null)
    if (oracleAccountInfo) {
      console.log("📏 Oracle data length:", oracleAccountInfo.data.length)
    }

    // Verify stablecoin mint state
    const mintInfo = await getMint(connection, stablecoinMint)
    console.log("✅ Stablecoin mint exists")
    console.log("📊 Total supply:", Number(mintInfo.supply))
    console.log("🔐 Mint authority:", mintInfo.mintAuthority?.toString())
    console.log("🔐 Expected multisig:", multisigAuthority.toString())

    // Verify mint authority is the multisig
    if (!mintInfo.mintAuthority?.equals(multisigAuthority)) {
      throw new Error("Mint authority is not the multisig!")
    }

    // Verify user has stablecoins
    const userAccount = await getAccount(connection, userTokenAccount)
    const balance = Number(userAccount.amount)
    console.log("🪙 User stablecoin balance:", balance / 1_000_000, "USD")

    if (balance === 0) {
      throw new Error("User should have stablecoins!")
    }

    console.log("✅ Complete system state verified!")
  })

  it("🔥 Integration Test: Complete Burn and Withdraw Cycle", async () => {
    console.log("\n🔥 Integration Test 4: Complete Burn and Withdraw Cycle")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    // Get current balance
    const userAccountBefore = await getAccount(connection, userTokenAccount)
    const balanceBefore = Number(userAccountBefore.amount)
    console.log("💰 Current stablecoin balance:", balanceBefore / 1_000_000, "USD")

    if (balanceBefore === 0) {
      console.log("⚠️ No stablecoins to burn - skipping burn test")
      return
    }

    // Burn half of the stablecoins
    const burnAmount = new BN(Math.floor(balanceBefore / 2))
    console.log("🔥 Burning:", Number(burnAmount) / 1_000_000, "USD stablecoins")

    const burnAndWithdraw = async (blockhash: string): Promise<string> => {
      return await program.methods
        .burnAndWithdraw(burnAmount, REAL_FEED_ID)
        .accounts({
          mint: stablecoinMint,
          mintAuthority: mintAuthority, // Our PDA will sign for the multisig
          multisigMintAuthority: multisigAuthority, // The actual mint authority
          userTokenAccount: userTokenAccount,
          collateralVault: collateralVault,
          user: payer,
          oracleProgram: ORACLE_PROGRAM_ID,
          oraclePriceFeed: REAL_ORACLE_PRICE_FEED,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' })
    }

    const signature = await retryTransaction(connection, burnAndWithdraw, 3)
    console.log("🎉 BURN AND WITHDRAW SUCCESS!")
    console.log("🔗 Transaction:", signature)

    // Check final balance
    const userAccountAfter = await getAccount(connection, userTokenAccount)
    const balanceAfter = Number(userAccountAfter.amount)
    console.log("💰 Final stablecoin balance:", balanceAfter / 1_000_000, "USD")

    // Verify burn worked
    const expectedBalance = balanceBefore - Number(burnAmount)
    if (Math.abs(balanceAfter - expectedBalance) > 1) { // Allow for small rounding
      throw new Error(`Burn failed! Expected ${expectedBalance}, got ${balanceAfter}`)
    }

    console.log("✅ Complete burn and withdraw cycle successful!")
  })

  after("📊 Integration Test Summary", () => {
    console.log("\n📊 INTEGRATION TEST SUMMARY")
    console.log("═══════════════════════════════════════════════════════════")
    console.log("🎯 OBJECTIVE: Test complete Oracle ↔ Stablecoin integration with multisig")
    console.log("")
    console.log("✅ Multisig mint creation: TESTED")
    console.log("✅ Oracle CPI with real data: TESTED")
    console.log("✅ Stablecoin minting: TESTED")
    console.log("✅ System state verification: TESTED")
    console.log("✅ Burn and withdraw cycle: TESTED")
    console.log("")
    console.log("🔗 Integration Points:")
    console.log(`   📊 Oracle Program: ${ORACLE_PROGRAM_ID.toString()}`)
    console.log(`   📋 Price Feed: ${REAL_ORACLE_PRICE_FEED.toString()}`)
    console.log(`   🪙 Stablecoin Program: ${program.programId.toString()}`)
    console.log(`   🔐 Multisig Authority: ${multisigAuthority?.toString() || 'N/A'}`)
    console.log(`   🪙 Stablecoin Mint: ${stablecoinMint?.toString() || 'N/A'}`)
    console.log("═══════════════════════════════════════════════════════════")
  })
})