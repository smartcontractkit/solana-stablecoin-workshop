import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StablecoinProgram } from "./target/types/stablecoin_program";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

// Test oracle minting with CCIP-integrated token and multisig
async function testCCIPOracleIntegration() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.StablecoinProgram as Program<StablecoinProgram>;

  // CCIP-integrated token with multisig authority
  const CCIP_TOKEN = new PublicKey("9R9tkAwimFhWCYJwq4WsLtAG6ebqM2mhwoHrkwMFwK6E");
  const MULTISIG_ADDRESS = new PublicKey("AcgLUap6o23NzGPueacBqH9SnTRtjLJL2zDqFPeeZeKF");
  const ORACLE_PROGRAM = new PublicKey("9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1");
  const oraclePriceFeed = new PublicKey("C9wfvvoRntdnfFrPbeNtZ74ChXuKo6zJq7QGdyWZPBen");

  console.log("🎯 Testing CCIP + Oracle Integration");
  console.log("📍 CCIP Token:", CCIP_TOKEN.toString());
  console.log("🔐 Multisig Authority:", MULTISIG_ADDRESS.toString());

  // Derive PDAs
  const [mintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority")],
    program.programId
  );
  
  const [collateralVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("collateral_vault")],
    program.programId
  );

  // Get user's token account
  const userTokenAccount = await getAssociatedTokenAddress(
    CCIP_TOKEN,
    provider.wallet.publicKey
  );

  console.log("🏦 Oracle PDA (Multisig Signer):", mintAuthority.toString());
  console.log("💰 Collateral Vault:", collateralVault.toString());
  console.log("👤 User Token Account:", userTokenAccount.toString());

  // Test oracle minting with MULTISIG authority
  const depositAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
  const feedId = Array.from(Buffer.from("SOL/USD".padEnd(32, '\0')));

  console.log("💸 Testing oracle-backed minting with CCIP-integrated token...");

  try {
    const tx = await program.methods
      .depositAndMintMultisig(new anchor.BN(depositAmount), feedId)
      .accounts({
        mint: CCIP_TOKEN,
        multisig: MULTISIG_ADDRESS,           // 1-of-3 multisig as authority
        mintAuthority: mintAuthority,         // Our Oracle PDA as signer
        userTokenAccount: userTokenAccount,
        user: provider.wallet.publicKey,
        collateralVault: collateralVault,
        oracleProgram: ORACLE_PROGRAM,
        oraclePriceFeed: oraclePriceFeed,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({
        commitment: "confirmed",
      });

    console.log("🎉 SUCCESS! CCIP + Oracle integration works perfectly!");
    console.log("🔗 Transaction:", tx);
    console.log("✅ Proved: Oracle-backed stablecoin works with CCIP multisig setup");
    
    // Check token balance
    console.log("\n📊 Checking minted token balance...");
    const balance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    console.log("💰 Token Balance:", balance.value.uiAmount, "stablecoins");
    
  } catch (error) {
    console.log("❌ FAILED! CCIP + Oracle integration failed:");
    console.log("Error:", error.message);
    if (error.logs) {
      console.log("Logs:", error.logs);
    }
  }
}

testCCIPOracleIntegration().catch(console.error);
