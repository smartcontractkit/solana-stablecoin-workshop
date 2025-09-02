import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { PublicKey } from "@solana/web3.js"
import { Oracle } from "../target/types/oracle"
import * as snappy from "snappy"

// Data Streams Verifier Program ID on Devnet
const VERIFIER_PROGRAM_ID = new PublicKey("Gt9S41PtjR58CbG9JhJ3J6vxesqrNAswbWYbLNTMZA3c")

async function main() {
  // Setup connection and provider
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  // Initialize your program using the workspace
  const program = anchor.workspace.Oracle as Program<Oracle>

  // Convert the hex string to a Uint8Array
  // This is an example report payload for a crypto stream
  const hexString =
    "0x00064f2cd1be62b7496ad4897b984db99243e0921906f66ded15149d993ef42c000000000000000000000000000000000000000000000000000000000103c90c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000002200000000000000000000000000000000000000000000000000000000000000280000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001200003684ea93c43ed7bd00ab3bb189bb62f880436589f1ca58b599cd97d6007fb0000000000000000000000000000000000000000000000000000000067570fa40000000000000000000000000000000000000000000000000000000067570fa400000000000000000000000000000000000000000000000000004c6ac85bf854000000000000000000000000000000000000000000000000002e1bf13b772a9c0000000000000000000000000000000000000000000000000000000067586124000000000000000000000000000000000000000000000000002bb4cf7662949c000000000000000000000000000000000000000000000000002bae04e2661000000000000000000000000000000000000000000000000000002bb6a26c3fbeb80000000000000000000000000000000000000000000000000000000000000002af5e1b45dd8c84b12b4b58651ff4173ad7ca3f5d7f5374f077f71cce020fca787124749ce727634833d6ca67724fd912535c5da0f42fa525f46942492458f2c2000000000000000000000000000000000000000000000000000000000000000204e0bfa6e82373ae7dff01a305b72f1debe0b1f942a3af01bad18e0dc78a599f10bc40c2474b4059d43a591b75bdfdd80aafeffddfd66d0395cca2fdeba1673d"

  // Remove the '0x' prefix if present
  const cleanHexString = hexString.startsWith("0x") ? hexString.slice(2) : hexString

  // Validate hex string format
  if (!/^[0-9a-fA-F]+$/.test(cleanHexString)) {
    throw new Error("Invalid hex string format")
  }

  // Convert hex to Uint8Array
  const signedReport = new Uint8Array(cleanHexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))

  // Compress the report using Snappy
  const compressedReport = await snappy.compress(Buffer.from(signedReport))

  // Derive necessary PDAs using the SDK's helper functions
  const verifierAccount = await PublicKey.findProgramAddressSync([Buffer.from("verifier")], VERIFIER_PROGRAM_ID)

  const configAccount = await PublicKey.findProgramAddressSync([signedReport.slice(0, 32)], VERIFIER_PROGRAM_ID)

  // The Data Streams access controller on devnet
  const accessController = new PublicKey("2k3DsgwBoqrnvXKVvd7jX7aptNxdcRBdcd5HkYsGgbrb")

  try {
    console.log("\n📝 Transaction Details")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("🔑 Signer:", provider.wallet.publicKey.toString())

    const tx = await program.methods
      .verify(compressedReport)
      .accountsStrict({
        verifierAccount: verifierAccount[0],
        accessController: accessController,
        user: provider.wallet.publicKey,
        configAccount: configAccount[0],
        verifierProgramId: VERIFIER_PROGRAM_ID,
      })
      .rpc({ 
        commitment: "confirmed",
        skipPreflight: false,
        preflightCommitment: "confirmed"
      })

    console.log("✅ Transaction successful!")
    console.log("🔗 Signature:", tx)

    // Fetch and display logs
    const txDetails = await provider.connection.getTransaction(tx, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    })

    console.log("\n📋 Program Logs")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    let indentLevel = 0
    let currentProgramId = ""
    txDetails.meta.logMessages.forEach((log) => {
      // Handle indentation for inner program calls
      if (log.includes("Program invoke")) {
        const programIdMatch = log.match(/Program (.*?) invoke/)
        if (programIdMatch) {
          currentProgramId = programIdMatch[1]
          // Remove "Unknown Program" prefix if present
          currentProgramId = currentProgramId.replace("Unknown Program ", "")
          // Remove parentheses if present
          currentProgramId = currentProgramId.replace(/[()]/g, "")
        }
        console.log("  ".repeat(indentLevel) + "🔄", log.trim())
        indentLevel++
        return
      }
      if (log.includes("Program return") || log.includes("Program consumed")) {
        indentLevel = Math.max(0, indentLevel - 1)
      }

      // Add indentation to all logs
      const indent = "  ".repeat(indentLevel)

      if (log.includes("Program log:")) {
        const logMessage = log.replace("Program log:", "").trim()
        if (log.includes("Program log:")) {
          console.log(indent + "📍", logMessage)
        } else if (log.includes("Program data:")) {
          console.log(indent + "📊", log.replace("Program data:", "").trim())
        }
      }
    })
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
  } catch (error: any) {
    console.log("\n❌ Transaction Failed")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.error("Error:", error.message || error)
    
    // Try to get more detailed error information
    if (error.getLogs) {
      try {
        const logs = await error.getLogs()
        console.log("Transaction Logs:", logs)
      } catch (logError) {
        console.log("Could not retrieve transaction logs")
      }
    }
    
    if (error.transactionLogs) {
      console.log("Transaction Logs:", error.transactionLogs)
    }
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
  }
}

main()
