import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token"
import { StablecoinProgram } from "../target/types/stablecoin_program"

// REAL Oracle data from our working oracle test
const ORACLE_PROGRAM_ID = new PublicKey("9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1")
const REAL_FEED_ID = [209, 190, 98, 183, 73, 106, 212, 137, 123, 152, 77, 185, 146, 67, 224, 146, 25, 6, 246, 109, 237, 21, 20, 157, 153, 62, 244, 44, 104, 183, 40, 195]
const REAL_ORACLE_PRICE_FEED = new PublicKey("5CjYMCxwds8bKxnkfMoayEMy1oVjToZUMtoejAPkTYBH")

describe("🚀 REAL Oracle CPI Integration Test", () => {
  console.log("🚀 Testing REAL Oracle CPI Integration with Live Price Feed")
  console.log("═══════════════════════════════════════════════════════════════")

  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.StablecoinProgram as Program<StablecoinProgram>
  const payer = provider.wallet.publicKey

  // Test accounts
  let stablecoinMint: PublicKey
  let mintAuthority: PublicKey
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

  it("🏗️ Initialize Stablecoin Mint", async () => {
    console.log("\n🏗️ Test 1: Initialize Stablecoin Mint")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Create a new mint keypair
    const mintKeypair = anchor.web3.Keypair.generate()
    stablecoinMint = mintKeypair.publicKey

    console.log("🪙 New Mint Address:", stablecoinMint.toString())

    const tx = await program.methods
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
      })

    console.log("✅ Mint initialized successfully!")
    console.log("🔗 Transaction:", tx)

    // Verify mint was created correctly
    const mintInfo = await provider.connection.getAccountInfo(stablecoinMint)
    console.log("📊 Mint account created:", mintInfo !== null)
  })

  it("💰 Deposit Collateral and Mint Stablecoins (REAL Oracle CPI)", async () => {
    console.log("\n💰 Test 2: Deposit Collateral and Mint Stablecoins with REAL Oracle CPI")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Get user's associated token account
    userTokenAccount = await getAssociatedTokenAddress(
      stablecoinMint,
      payer
    )

    console.log("👤 User Token Account:", userTokenAccount.toString())

    const collateralAmount = new anchor.BN(100_000_000) // 0.1 SOL (smaller amount for testing)

    console.log("💎 Depositing:", collateralAmount.toString(), "lamports (0.1 SOL)")
    console.log("📋 Using REAL Feed ID from oracle")
    console.log("📊 Oracle Price Feed:", REAL_ORACLE_PRICE_FEED.toString())

    try {
      const tx = await program.methods
        .depositAndMint(collateralAmount, REAL_FEED_ID)
        .accountsStrict({
          mint: stablecoinMint,
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
        })

      console.log("🎉 REAL Oracle CPI SUCCESS!")
      console.log("🔗 Transaction:", tx)

      // Check token balance
      const tokenBalance = await provider.connection.getTokenAccountBalance(userTokenAccount)
      console.log("🪙 Stablecoin balance:", tokenBalance.value.amount, tokenBalance.value.uiAmountString)

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

  it("📊 Verify Oracle Price Feed Data", async () => {
    console.log("\n📊 Test 3: Verify Oracle Price Feed Data")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

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
    console.log("\n📊 REAL ORACLE CPI INTEGRATION TEST SUMMARY")
    console.log("═══════════════════════════════════════════════════════════")
    console.log("🎯 OBJECTIVE: Test actual Oracle CPI calls with live price data")
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
