import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { retryTransaction } from "./utils/retry-helper.ts"
// import { StablecoinProgram } from "./target/types/stablecoin_program"

async function createTokenForCCIP() {
  // Setup
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.StablecoinProgram as Program<any>
  const payer = provider.wallet.publicKey

  console.log("🏗️ Creating token for CCIP setup...")
  console.log("👤 Payer:", payer.toString())
  console.log("🔑 Program ID:", program.programId.toString())

  // Generate new mint keypair
  const mintKeypair = Keypair.generate()
  const stablecoinMint = mintKeypair.publicKey

  console.log("🪙 New mint address:", stablecoinMint.toString())

  try {
    // Create token with wallet authority (for CCIP setup) - with retry mechanism
    const tx = await retryTransaction(
      provider.connection,
      async (blockhash) => {
        return await program.methods
          .initializeMint(6) // 6 decimals
          .accounts({
            mint: stablecoinMint,
            payer: payer,
          })
          .signers([mintKeypair])
          .rpc({
            commitment: "confirmed",
            skipPreflight: false,
          })
      },
      3 // maxRetries
    )

    console.log("✅ Token created successfully!")
    console.log("🔗 Transaction:", tx)
    console.log("")
    console.log("📋 CCIP Setup Variables:")
    console.log(`export SOL_TOKEN_MINT="${stablecoinMint.toString()}"`)
    console.log(`export SOL_ADMIN_WALLET=$(solana address)`)
    console.log(`export CCIP_POOL_PROGRAM="41FGToCmdaWa1dgZLKFAjvmx6e6AjVTX7SVRibvsMGVB"`)
    console.log("")
    console.log("🎯 Next steps:")
    console.log("1. Copy the export commands above")
    console.log("2. Run them in your terminal")
    console.log("3. Proceed with CCIP setup using these variables")

  } catch (error) {
    console.error("❌ Error creating token:", error)
  }
}

createTokenForCCIP().catch(console.error)
