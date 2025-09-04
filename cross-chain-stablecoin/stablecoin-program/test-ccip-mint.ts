import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StablecoinProgram } from "./target/types/stablecoin_program";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

async function main() {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.StablecoinProgram as Program<StablecoinProgram>;
  const provider = anchor.getProvider();

  console.log("🚀 Testing Oracle-Backed Stablecoin Minting for CCIP");
  console.log("=".repeat(60));

  // Our oracle-backed stablecoin token mint
  const mint = new PublicKey("8vg7CL4WByjVp2xR9gwai4WpsKRJUkF2okjg7ScoiYfn");
  const multisig = new PublicKey("2dGyhXZ1Pp64XTCNuLZkUzYK86bet26suFYfkAeVLXDz");
  
  // Oracle price feed (real one)
  const oraclePriceFeed = new PublicKey("C9wfvvoRntdnfFrPbeNtZ74ChXuKo6zJq7QGdyWZPBen");
  
  // User (payer)
  const user = provider.wallet.publicKey;
  console.log("👤 User:", user.toString());
  console.log("🪙 Token Mint:", mint.toString());
  console.log("🔐 Multisig:", multisig.toString());
  
  // Get user's token account
  const userTokenAccount = await getAssociatedTokenAddress(mint, user);
  console.log("💰 User Token Account:", userTokenAccount.toString());

  // Derive mint authority PDA
  const [mintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority")],
    program.programId
  );
  console.log("🔑 Mint Authority PDA:", mintAuthority.toString());

  // Check if user token account exists, create if not
  try {
    const accountInfo = await provider.connection.getAccountInfo(userTokenAccount);
    if (!accountInfo) {
      console.log("🏗️ Creating user token account...");
      const createATAIx = createAssociatedTokenAccountInstruction(
        user,
        userTokenAccount,
        user,
        mint
      );
      
      const tx = new anchor.web3.Transaction().add(createATAIx);
      await provider.sendAndConfirm(tx);
      console.log("✅ User token account created");
    }
  } catch (error) {
    console.log("⚠️ Error checking/creating token account:", error);
  }

  // Test minting with multisig
  console.log("\n🔄 Testing multisig minting...");
  
  const depositAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
  console.log(`💵 Depositing: ${depositAmount / LAMPORTS_PER_SOL} SOL`);

  // SOL/USD feed ID from Chainlink
  const feedId = Array.from(Buffer.from("0003d338ea2ac3be9e026033b1aa601673c37bab5e13851c59966f9f820754d6", "hex"));

  try {
    const tx = await program.methods
      .depositAndMintMultisig(new anchor.BN(depositAmount), feedId)
      .accounts({
        user: user,
        mint: mint,
        multisig: multisig,
        userTokenAccount: userTokenAccount,
        oraclePriceFeed: oraclePriceFeed,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Multisig minting successful!");
    console.log("🔗 Transaction:", tx);

    // Check token balance
    const tokenBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    console.log(`💰 Token Balance: ${tokenBalance.value.uiAmount} OBSC`);

  } catch (error) {
    console.log("❌ Multisig minting failed:", error);
  }

  console.log("\n🎉 Oracle-backed stablecoin minting test complete!");
  console.log("🚀 Ready for CCIP cross-chain transfer!");
}

main().catch(console.error);
