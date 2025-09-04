import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StablecoinProgram } from "./target/types/stablecoin_program";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

// Test single authority oracle minting with fresh token
async function testSingleAuthorityMinting() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.StablecoinProgram as Program<StablecoinProgram>;

  // Fresh token from previous step
  const FRESH_MINT = new PublicKey("9R9tkAwimFhWCYJwq4WsLtAG6ebqM2mhwoHrkwMFwK6E");
  const ORACLE_PROGRAM = new PublicKey("9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1");
  const oraclePriceFeed = new PublicKey("C9wfvvoRntdnfFrPbeNtZ74ChXuKo6zJq7QGdyWZPBen");

  console.log("🧪 Testing SINGLE authority oracle minting");
  console.log("📍 Fresh Token:", FRESH_MINT.toString());
  console.log("👤 Current authority should be wallet:", provider.wallet.publicKey.toString());

  // Derive PDAs
  const [collateralVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("collateral_vault")],
    program.programId
  );

  // Get user's token account
  const userTokenAccount = await getAssociatedTokenAddress(
    FRESH_MINT,
    provider.wallet.publicKey
  );

  console.log("💰 Collateral Vault:", collateralVault.toString());
  console.log("👤 User Token Account:", userTokenAccount.toString());

  // Test deposit and mint with SINGLE authority
  const depositAmount = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL
  const feedId = Array.from(Buffer.from("SOL/USD".padEnd(32, '\0')));

  console.log("💸 Attempting to mint with deposit of 0.05 SOL using SINGLE instruction...");

  try {
    const tx = await program.methods
      .depositAndMintSingle(new anchor.BN(depositAmount), feedId)
      .accounts({
        mint: FRESH_MINT,
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

    console.log("✅ SUCCESS! Single authority oracle minting worked!");
    console.log("🔗 Transaction:", tx);
    console.log("🎯 This proves our program works during CCIP setup phase!");
    
  } catch (error) {
    console.log("❌ FAILED! Single authority oracle minting failed:");
    console.log("Error:", error.message);
    if (error.logs) {
      console.log("Logs:", error.logs);
    }
    
    // Check if it's the expected "owner does not match" error
    if (error.message.includes("owner does not match")) {
      console.log("🤔 This suggests the token authority is NOT the wallet as expected");
      console.log("🔍 Let's check the actual mint authority...");
    }
  }
}

testSingleAuthorityMinting().catch(console.error);
