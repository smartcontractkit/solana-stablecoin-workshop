#!/usr/bin/env ts-node

import { PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
if (!process.env.STABLECOIN_PROGRAM_ID) {
  console.error("❌ ERROR: STABLECOIN_PROGRAM_ID not found in .env file!");
  console.error("📝 Please add your deployed stablecoin program ID to .env:");
  console.error("   STABLECOIN_PROGRAM_ID=<your-program-id-from-anchor-deploy>");
  process.exit(1);
}

if (!process.env.ORACLE_PROGRAM_ID) {
  console.error("❌ ERROR: ORACLE_PROGRAM_ID not found in .env file!");
  console.error("📝 Please add your deployed oracle program ID to .env:");
  console.error("   ORACLE_PROGRAM_ID=<your-oracle-program-id>");
  process.exit(1);
}

const STABLECOIN_PROGRAM_ID = new PublicKey(process.env.STABLECOIN_PROGRAM_ID);
const ORACLE_PROGRAM_ID = new PublicKey(process.env.ORACLE_PROGRAM_ID);

function main() {
  console.log("🔑 Deriving Stablecoin Program Mint Authority PDA...\n");

  // Derive Mint Authority PDA (needed for multisig)
  const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('mint_authority')],
    STABLECOIN_PROGRAM_ID
  );

  // Display results
  console.log("📋 Stablecoin Program PDA:");
  console.log(`   🏦 Mint Authority PDA: ${mintAuthorityPda.toString()}`);
  
  console.log("\n📋 Environment Variable to Update:");
  console.log(`   SOL_MINT_AUTHORITY_PDA="${mintAuthorityPda.toString()}"`);

  console.log("\n✅ Use this PDA in your multisig creation command");
  console.log("ℹ️  Note: Collateral Vault PDA is derived automatically by the program");
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { STABLECOIN_PROGRAM_ID, ORACLE_PROGRAM_ID };
