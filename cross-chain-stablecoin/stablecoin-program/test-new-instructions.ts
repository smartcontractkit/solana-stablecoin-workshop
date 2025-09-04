import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StablecoinProgram } from "./target/types/stablecoin_program";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

describe("Test New Instructions", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.StablecoinProgram as Program<StablecoinProgram>;

  // Our deployed token and multisig from CCIP setup
  const DEPLOYED_MINT = new PublicKey("BndGEmSDSQLLakwKityxx9trx12hmHhKHkdhD2eaF22h");
  const MULTISIG_ADDRESS = new PublicKey("3oa3ZDw72kLUQm2En5N5ezz1RBAEV9eVTo1GFgohinLB");
  
  // Oracle program ID (deployed separately)
  const ORACLE_PROGRAM = new PublicKey("9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1");

  it("🧪 Test multisig instruction with current setup", async () => {
    console.log("🧪 Testing deposit_and_mint_multisig instruction");
    console.log("📍 Token:", DEPLOYED_MINT.toString());
    console.log("🔐 Multisig:", MULTISIG_ADDRESS.toString());
    
    // Derive PDAs
    const [mintAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_authority")],
      program.programId
    );
    
    const [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("collateral_vault")],
      program.programId
    );
    
    // Use the real oracle price feed account (from our oracle tests)
    const oraclePriceFeed = new PublicKey("C9wfvvoRntdnfFrPbeNtZ74ChXuKo6zJq7QGdyWZPBen");
    
    console.log("🏦 Mint Authority PDA:", mintAuthority.toString());
    console.log("💰 Collateral Vault:", collateralVault.toString());
    console.log("📊 Oracle Price Feed:", oraclePriceFeed.toString());
    
    // Get user's token account
    const userTokenAccount = await getAssociatedTokenAddress(
      DEPLOYED_MINT,
      provider.wallet.publicKey
    );
    
    console.log("👤 User Token Account:", userTokenAccount.toString());
    
    // Test deposit and mint with multisig setup
    const depositAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
    const feedId = Array.from(Buffer.from("SOL/USD".padEnd(32, '\0')));
    
    console.log("💸 Attempting to mint with deposit of 0.1 SOL using MULTISIG instruction...");
    
    try {
      const tx = await program.methods
        .depositAndMintMultisig(new anchor.BN(depositAmount), feedId)
        .accounts({
          mint: DEPLOYED_MINT,
          multisig: MULTISIG_ADDRESS,           // Multisig as authority
          mintAuthority: mintAuthority,         // Our PDA as signer
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
      
      console.log("✅ SUCCESS! Multisig oracle minting worked!");
      console.log("🔗 Transaction:", tx);
      
    } catch (error) {
      console.log("❌ FAILED! Multisig oracle minting failed:");
      console.log("Error:", error.message);
      console.log("Logs:", error.logs);
    }
  });

  it("🧪 Test single instruction (should fail with current multisig setup)", async () => {
    console.log("🧪 Testing deposit_and_mint_single instruction (should fail)");
    
    // Derive PDAs
    const [mintAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_authority")],
      program.programId
    );
    
    const [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("collateral_vault")],
      program.programId
    );
    
    // Use the real oracle price feed account (from our oracle tests)
    const oraclePriceFeed = new PublicKey("C9wfvvoRntdnfFrPbeNtZ74ChXuKo6zJq7QGdyWZPBen");
    
    // Get user's token account
    const userTokenAccount = await getAssociatedTokenAddress(
      DEPLOYED_MINT,
      provider.wallet.publicKey
    );
    
    // Test deposit and mint with single authority (should fail)
    const depositAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
    const feedId = Array.from(Buffer.from("SOL/USD".padEnd(32, '\0')));
    
    console.log("💸 Attempting to mint using SINGLE instruction (should fail)...");
    
    try {
      const tx = await program.methods
        .depositAndMintSingle(new anchor.BN(depositAmount), feedId)
        .accounts({
          mint: DEPLOYED_MINT,
          mintAuthority: mintAuthority,         // Our PDA as authority (wrong!)
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
      
      console.log("❌ UNEXPECTED SUCCESS! Single instruction should have failed");
      console.log("🔗 Transaction:", tx);
      
    } catch (error) {
      console.log("✅ EXPECTED FAILURE! Single instruction correctly failed:");
      console.log("Error:", error.message);
      
      if (error.message.includes("owner does not match")) {
        console.log("🎯 CORRECT: 'owner does not match' error as expected");
      }
    }
  });
});
