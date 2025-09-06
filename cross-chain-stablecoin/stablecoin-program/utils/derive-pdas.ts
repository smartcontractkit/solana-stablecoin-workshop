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
  console.log("🔑 Deriving Program PDAs...\n");

  // Derive Stablecoin Program PDAs
  const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('mint_authority')],
    STABLECOIN_PROGRAM_ID
  );

  const [collateralVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('collateral_vault')],
    STABLECOIN_PROGRAM_ID
  );

  // Display results
  console.log("📋 Stablecoin Program PDAs:");
  console.log(`   🏦 Mint Authority PDA: ${mintAuthorityPda.toString()}`);
  console.log(`   🏛️ Collateral Vault PDA: ${collateralVaultPda.toString()}`);
  
  console.log("\n📋 Environment Variables to Update:");
  console.log(`   SOL_MINT_AUTHORITY_PDA="${mintAuthorityPda.toString()}"`);
  console.log(`   SOL_COLLATERAL_VAULT_PDA="${collateralVaultPda.toString()}"`);

  console.log("\n✅ Use the Mint Authority PDA in your multisig creation command");
}

if (require.main === module) {
  main();
}

export { STABLECOIN_PROGRAM_ID, ORACLE_PROGRAM_ID };
