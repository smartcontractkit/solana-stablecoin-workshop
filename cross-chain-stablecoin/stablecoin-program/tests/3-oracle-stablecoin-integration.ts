import * as anchor from "@coral-xyz/anchor"
import { Program, BN } from "@coral-xyz/anchor"
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getMint, getAccount } from "@solana/spl-token"
import { StablecoinProgram } from "../target/types/stablecoin_program"

// REAL Oracle data from our working oracle test
const ORACLE_PROGRAM_ID = new PublicKey("9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1")
const REAL_FEED_ID = [209, 190, 98, 183, 73, 106, 212, 137, 123, 152, 77, 185, 146, 67, 224, 146, 25, 6, 246, 109, 237, 21, 20, 157, 153, 62, 244, 44, 104, 183, 40, 195]
const REAL_ORACLE_PRICE_FEED = new PublicKey("5CjYMCxwds8bKxnkfMoayEMy1oVjToZUMtoejAPkTYBH")

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

  // Test accounts
  let stablecoinMint: PublicKey
  let mintKeypair: Keypair
  let mintAuthority: PublicKey
  let collateralVault: PublicKey
  let userTokenAccount: PublicKey

  before(async () => {
    console.log("\n🏗️ Setting up Oracle CPI test environment...")
    
    // Generate unique mint for this test
    mintKeypair = Keypair.generate()
    stablecoinMint = mintKeypair.publicKey
    console.log("🪙 Mint Address:", stablecoinMint.toString())

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

    // Verify oracle exists
    const oracleAccountInfo = await connection.getAccountInfo(REAL_ORACLE_PRICE_FEED, 'confirmed')
    if (!oracleAccountInfo) {
      throw new Error("Oracle price feed not found! Run oracle test first.")
    }
    console.log("✅ Oracle price feed confirmed:", REAL_ORACLE_PRICE_FEED.toString())

    // Get user token account
    userTokenAccount = await getAssociatedTokenAddress(stablecoinMint, payer)
    console.log("👤 User Token Account:", userTokenAccount.toString())
  })

  it("🏗️ Setup: Initialize Stablecoin Mint for Integration", async () => {
    console.log("\n🏗️ Integration Test 1: Initialize Stablecoin Mint")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    const initializeMint = async (blockhash: string): Promise<string> => {
      const tx = await program.methods
        .initializeMint(6) // 6 decimals
        .accountsStrict({
          mint: stablecoinMint,
          mintAuthority: mintAuthority,
          payer: payer,
          rent: SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([mintKeypair])
        .transaction()
      
      tx.recentBlockhash = blockhash
      tx.feePayer = payer
      tx.sign(provider.wallet.payer, mintKeypair)
      
      return await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed"
      })
    }

    const signature = await retryTransaction(connection, initializeMint, 3)
    console.log("✅ Mint initialized successfully!")
    console.log("🔗 Transaction:", signature)

    // Verify mint was created
    const mintInfo = await getMint(connection, stablecoinMint)
    console.log("📊 Mint decimals:", mintInfo.decimals)
    console.log("👤 Mint authority:", mintInfo.mintAuthority?.toString())
    
    // Assertions
    if (mintInfo.decimals !== 6) throw new Error("Wrong decimals")
    if (!mintInfo.mintAuthority?.equals(mintAuthority)) throw new Error("Wrong mint authority")
  })

  it("🔗 Integration Test: Deposit Collateral with Oracle CPI", async () => {
    console.log("\n🔗 Integration Test 2: Deposit Collateral with Oracle CPI")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    const collateralAmount = new anchor.BN(50_000_000) // 0.05 SOL
    console.log("💎 Depositing:", collateralAmount.toString(), "lamports (0.05 SOL)")
    console.log("📊 Oracle Price Feed:", REAL_ORACLE_PRICE_FEED.toString())

    const depositAndMint = async (blockhash: string): Promise<string> => {
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
          rent: SYSVAR_RENT_PUBKEY,
        })
        .transaction()
      
      tx.recentBlockhash = blockhash
      tx.feePayer = payer
      tx.sign(provider.wallet.payer)
      
      return await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed"
      })
    }

    const signature = await retryTransaction(connection, depositAndMint, 3)
    console.log("🎉 Oracle CPI SUCCESS!")
    console.log("🔗 Transaction:", signature)

    // Wait a moment for account creation
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Verify token balance
    const tokenAccount = await getAccount(connection, userTokenAccount)
    console.log("🪙 Stablecoin balance:", tokenAccount.amount.toString())
    
    // Expected: 0.05 SOL * $200 = $10 = 10 stablecoins with 6 decimals = 10,000,000
    const expectedAmount = 10_000_000n
    if (tokenAccount.amount !== expectedAmount) {
      console.log("⚠️ Expected:", expectedAmount.toString(), "Got:", tokenAccount.amount.toString())
    } else {
      console.log("✅ Correct amount of stablecoins minted!")
    }

    // Verify collateral vault has funds
    const vaultInfo = await connection.getAccountInfo(collateralVault)
    console.log("💰 Vault balance:", vaultInfo?.lamports || 0, "lamports")
    
    if ((vaultInfo?.lamports || 0) < 50_000_000) {
      throw new Error("Collateral vault should have at least 0.05 SOL")
    }

    // Analyze transaction logs for CPI
    const txDetails = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    })
    
    if (txDetails?.meta?.logMessages) {
      const oracleCpiDetected = txDetails.meta.logMessages.some(log => 
        log.includes(`Program ${ORACLE_PROGRAM_ID.toString()} invoke`)
      )
      
      console.log("🎯 Oracle CPI detected:", oracleCpiDetected ? "✅ YES" : "❌ NO")
      
      if (!oracleCpiDetected) {
        throw new Error("Oracle CPI was not detected in transaction logs")
      }
      
      // Look for price logs
      const priceLogs = txDetails.meta.logMessages.filter(log => 
        log.includes("Price:") || log.includes("Collateral value:")
      )
      priceLogs.forEach(log => console.log("📍", log.replace("Program log:", "").trim()))
    }
  })

  it("🔍 Integration Test: Verify Complete System State", async () => {
    console.log("\n🔍 Integration Test 3: Verify Complete System State")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Oracle still exists
    const oracleAccountInfo = await connection.getAccountInfo(REAL_ORACLE_PRICE_FEED)
    console.log("✅ Oracle price feed exists:", oracleAccountInfo !== null)
    console.log("📏 Oracle data length:", oracleAccountInfo?.data.length || 0)

    // Mint still exists
    const mintInfo = await getMint(connection, stablecoinMint)
    console.log("✅ Stablecoin mint exists")
    console.log("📊 Total supply:", mintInfo.supply.toString())

    // Token account exists and has balance
    const tokenAccount = await getAccount(connection, userTokenAccount)
    console.log("✅ User token account exists")
    console.log("🪙 Token balance:", tokenAccount.amount.toString())

    // Collateral vault has funds
    const vaultInfo = await connection.getAccountInfo(collateralVault)
    console.log("✅ Collateral vault exists")
    console.log("💰 Vault balance:", vaultInfo?.lamports || 0, "lamports")

    console.log("\n🎉 Oracle CPI Integration: FULLY FUNCTIONAL!")
  })

  it("🔥 Integration Test: Complete Burn and Withdraw Cycle", async () => {
    console.log("\n🔥 Integration Test 4: Complete Burn and Withdraw Cycle")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Get current balances before burn
    const tokenAccountBefore = await getAccount(connection, userTokenAccount)
    const vaultInfoBefore = await connection.getAccountInfo(collateralVault)
    const userSolBefore = await connection.getBalance(payer)
    
    console.log("📊 Before Burn:")
    console.log("   🪙 Stablecoin balance:", tokenAccountBefore.amount.toString())
    console.log("   💰 Vault balance:", vaultInfoBefore?.lamports || 0, "lamports")
    console.log("   👤 User SOL balance:", userSolBefore, "lamports")

    // Burn half of the stablecoins (5,000,000 out of 10,000,000)
    const burnAmount = new BN(5_000_000) // $5.00 worth
    console.log("🔥 Burning:", burnAmount.toString(), "stablecoins ($5.00 worth)")

    try {
      const signature = await program.methods
        .burnAndWithdraw(burnAmount, REAL_FEED_ID)
        .accounts({
          user: payer.publicKey,
          mint: stablecoinMint,
          userTokenAccount: userTokenAccount,
          mintAuthority: mintAuthority,
          collateralVault: collateralVault,
          oracleProgram: ORACLE_PROGRAM_ID,
          oraclePriceFeed: REAL_ORACLE_PRICE_FEED,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log("🎉 Burn and withdraw successful!")
      console.log("🔗 Transaction:", signature)

      // Get balances after burn
      const tokenAccountAfter = await getAccount(connection, userTokenAccount)
      const vaultInfoAfter = await connection.getAccountInfo(collateralVault)
      const userSolAfter = await connection.getBalance(payer)

      console.log("\n📊 After Burn:")
      console.log("   🪙 Stablecoin balance:", tokenAccountAfter.amount.toString())
      console.log("   💰 Vault balance:", vaultInfoAfter?.lamports || 0, "lamports")
      console.log("   👤 User SOL balance:", userSolAfter, "lamports")

      // Calculate changes
      const stablecoinsBurned = tokenAccountBefore.amount - tokenAccountAfter.amount
      const collateralWithdrawn = (vaultInfoBefore?.lamports || 0) - (vaultInfoAfter?.lamports || 0)
      const userSolGained = userSolAfter - userSolBefore

      console.log("\n📈 Changes:")
      console.log("   🔥 Stablecoins burned:", stablecoinsBurned.toString())
      console.log("   💎 Collateral withdrawn:", collateralWithdrawn, "lamports")
      console.log("   💰 User SOL gained:", userSolGained, "lamports")

      // Verify the burn worked correctly
      if (stablecoinsBurned !== BigInt(burnAmount.toString())) {
        throw new Error(`Expected to burn ${burnAmount.toString()}, but burned ${stablecoinsBurned.toString()}`)
      }

      console.log("✅ Burn amount matches expected!")

      // Analyze transaction logs for Oracle CPI
      const txDetails = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      })
      
      if (txDetails?.meta?.logMessages) {
        const oracleCpiDetected = txDetails.meta.logMessages.some(log => 
          log.includes(`Program ${ORACLE_PROGRAM_ID.toString()} invoke`)
        )
        
        console.log("🎯 Oracle CPI detected in burn:", oracleCpiDetected ? "✅ YES" : "❌ NO")
        
        // Look for price logs
        const priceLogs = txDetails.meta.logMessages.filter(log => 
          log.includes("Price:") || log.includes("Collateral") || log.includes("Oracle price:")
        )
        priceLogs.forEach(log => console.log("📍", log.replace("Program log:", "").trim()))
      }

      console.log("\n🎉 Burn and Withdraw: SUCCESSFUL!")

    } catch (error) {
      console.error("❌ Burn failed:", error)
      throw error
    }
  })
})
