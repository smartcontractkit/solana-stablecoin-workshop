#!/usr/bin/env ts-node

import { PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const STABLECOIN_PROGRAM_ID = new PublicKey(
  process.env.STABLECOIN_PROGRAM_ID || "7HebG1xx5GjmJw3yxCpRWBV2yCt7VspRUk4ponx35jpR"
);

const ORACLE_PROGRAM_ID = new PublicKey(
  process.env.ORACLE_PROGRAM_ID || "9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1"
);

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
