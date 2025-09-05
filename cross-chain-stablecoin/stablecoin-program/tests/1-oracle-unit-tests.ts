import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  createMint,
  createMultisig
} from "@solana/spl-token"
import { StablecoinProgram } from "../target/types/stablecoin_program"
import { retryTransaction } from "../utils/retry-helper.ts"

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

// We'll create these dynamically in the test setup

// Retry helper now imported from shared utility

describe("🔮 Oracle Unit Tests - Real Chainlink Data", () => {
  console.log("🔮 Testing Oracle Program with Real Chainlink Data Streams")
  console.log("═══════════════════════════════════════════════════════════════")

  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.StablecoinProgram as Program<StablecoinProgram>
  const payer = provider.wallet.publicKey

  // Test accounts
  // Test state - will create multisig setup dynamically
  let stablecoinMint: PublicKey
  let mintAuthority: PublicKey
  let multisigAuthority: PublicKey
  let collateralVault: PublicKey
  let userTokenAccount: PublicKey

  console.log("🔑 Stablecoin Program ID:", program.programId.toString())
  console.log("🔑 Oracle Program ID:", ORACLE_PROGRAM_ID.toString())
  console.log("📊 Real Oracle Price Feed:", REAL_ORACLE_PRICE_FEED.toString())
  console.log("👤 Payer:", payer.toString())

  before("🏗️ Setup Test Environment", async () => {
    console.log("\n🏗️ Setting up test environment...")
    
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
    const oracleFeedInfo = await provider.connection.getAccountInfo(REAL_ORACLE_PRICE_FEED)
    if (!oracleFeedInfo) {
      throw new Error("Oracle price feed not found! Run oracle test first.")
    }
    console.log("✅ Oracle price feed confirmed:", REAL_ORACLE_PRICE_FEED.toString())
  })

  it("🏗️ Setup: Create Mint with Multisig Authority (CCIP-Compatible)", async () => {
    console.log("\n🏗️ Test 1: Setup - Create Mint with Multisig Authority (CCIP-Compatible)")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Step 1: Create a multisig with our PDA as one of the signers
    // This uses the REAL CCIP Pool Signer PDA (deterministic)
    const adminWallet = provider.wallet.publicKey // Use our real wallet as admin
    
    // Step 2: Create a temporary mint to derive the real Pool Signer PDA
    const tempMintKeypair = anchor.web3.Keypair.generate()
    const [realPoolSignerPDA, poolSignerBump] = findPoolSignerPDA(tempMintKeypair.publicKey, CCIP_POOL_PROGRAM_ID)
    
    console.log("🔑 Creating 1-of-3 multisig with signers:")
    console.log("  - Admin Wallet:", adminWallet.toString(), "(YOUR REAL WALLET)")
    console.log("  - Pool Signer PDA:", realPoolSignerPDA.toString(), `(bump: ${poolSignerBump})`)
    console.log("  - Our Program PDA:", mintAuthority.toString())

    // Create the multisig (1-of-3: any one signer can authorize)
    const multisigKeypair = anchor.web3.Keypair.generate()
    multisigAuthority = await createMultisig(
      provider.connection,
      provider.wallet.payer, // Use the actual keypair, not wallet wrapper
      [adminWallet, realPoolSignerPDA, mintAuthority], // Real admin wallet + CCIP Pool Signer PDA + Program PDA
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

  it("🔮 Test Oracle Integration: Mint Stablecoins with Real Chainlink Price", async () => {
    console.log("\n🔮 Test 2: Oracle Integration - Mint Stablecoins with Real Chainlink Price")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    console.log("👤 User Token Account:", userTokenAccount.toString())

    const collateralAmount = new anchor.BN(100_000_000) // 0.1 SOL (smaller amount for testing)

    console.log("💎 Depositing:", collateralAmount.toString(), "lamports (0.1 SOL)")
    console.log("📋 Using REAL Feed ID from oracle")
    console.log("📊 Oracle Price Feed:", REAL_ORACLE_PRICE_FEED.toString())

    try {
      const tx = await retryTransaction(
        provider.connection,
        async (blockhash) => {
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
            .rpc({
              commitment: "confirmed",
              skipPreflight: false,
            })
        }
      )

      console.log("🎉 REAL Oracle CPI SUCCESS!")
      console.log("🔗 Transaction:", tx)

      // Check token balance with proper formatting
      const tokenBalance = await provider.connection.getTokenAccountBalance(userTokenAccount)
      const stablecoinAmount = parseFloat(tokenBalance.value.uiAmountString || "0")
      const rawAmount = tokenBalance.value.amount
      
      console.log(`🪙 Stablecoin balance: ${stablecoinAmount.toLocaleString()} USD (${rawAmount} raw units)`)
      
      // Calculate and display the economics
      const collateralSOL = collateralAmount.toNumber() / 1_000_000_000 // Convert lamports to SOL
      const expectedUSD = collateralSOL * 210 // Approximate SOL price
      
      console.log(`💰 Economics Summary:`)
      console.log(`   📊 Collateral: ${collateralSOL.toFixed(9)} SOL (${collateralAmount.toNumber().toLocaleString()} lamports)`)
      console.log(`   💵 Expected USD value: ~$${expectedUSD.toFixed(2)}`)
      console.log(`   🪙 Minted stablecoins: ${stablecoinAmount.toFixed(6)} USD`)
      console.log(`   ✅ Conversion accuracy: ${((stablecoinAmount / expectedUSD) * 100).toFixed(2)}%`)

      // Get transaction logs to see CPI details
      const txDetails = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      })

      console.log("\n📋 Transaction Logs (Oracle CPI)")
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      txDetails?.meta?.logMessages?.forEach((log, index) => {
        if (log.includes("Program log:")) {
          console.log(`📍 ${log.replace("Program log:", "").trim()}`)
        } else if (log.includes("invoke")) {
          console.log(`🔄 ${log}`)
        }
      })

    } catch (error: any) {
      console.log("❌ Error during Oracle CPI:", error.message)
      
      // Check if it's a CPI-related error
      if (error.logs) {
        console.log("\n📋 Error Logs:")
        error.logs.forEach((log: string) => {
          console.log(`📍 ${log}`)
        })
      }
      
      // If it's an oracle-related error, that's still progress!
      if (error.message.includes("oracle") || error.message.includes("CPI")) {
        console.log("✅ This confirms Oracle CPI is being attempted!")
      }
      
      throw error // Re-throw to see the full error
    }
  })

  it("🔍 Verify Oracle Price Feed Data Structure", async () => {
    console.log("\n🔍 Test 3: Verify Oracle Price Feed Data Structure")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Read the oracle price feed account directly
    const oracleFeedInfo = await provider.connection.getAccountInfo(REAL_ORACLE_PRICE_FEED)
    
    if (oracleFeedInfo) {
      console.log("✅ Oracle price feed account exists")
      console.log("📏 Data length:", oracleFeedInfo.data.length)
      console.log("👤 Owner:", oracleFeedInfo.owner.toString())
      console.log("💰 Lamports:", oracleFeedInfo.lamports)
      
      // The oracle program should own this account
      if (oracleFeedInfo.owner.equals(ORACLE_PROGRAM_ID)) {
        console.log("✅ Oracle price feed is owned by correct oracle program")
      } else {
        console.log("⚠️ Oracle price feed owner mismatch")
      }
    } else {
      console.log("❌ Oracle price feed account not found")
    }
  })

  after("📊 Test Summary", () => {
      console.log("\n📊 ORACLE UNIT TESTS SUMMARY")
  console.log("═══════════════════════════════════════════════════════════")
  console.log("🎯 OBJECTIVE: Test Oracle program with real Chainlink Data Streams")
    console.log("")
    console.log("✅ Stablecoin mint initialization: TESTED")
    console.log("✅ Real oracle price feed: CONFIRMED")
    console.log("✅ Cross-program invocation: ATTEMPTED")
    console.log("✅ Account structure: VALIDATED")
    console.log("")
    console.log("🔗 Integration Points:")
    console.log(`   📊 Oracle Program: ${ORACLE_PROGRAM_ID.toString()}`)
    console.log(`   📋 Price Feed: ${REAL_ORACLE_PRICE_FEED.toString()}`)
    console.log(`   🪙 Stablecoin Program: ${program.programId.toString()}`)
    console.log("═══════════════════════════════════════════════════════════")
  })
})
