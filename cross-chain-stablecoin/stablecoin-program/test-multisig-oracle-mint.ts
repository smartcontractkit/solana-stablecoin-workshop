import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StablecoinProgram } from "../target/types/stablecoin_program";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

describe("Test Oracle Minting with Multisig", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.StablecoinProgram as Program<StablecoinProgram>;

  // Our deployed token and multisig from CCIP setup
  const DEPLOYED_MINT = new PublicKey("BndGEmSDSQLLakwKityxx9trx12hmHhKHkdhD2eaF22h");
  const MULTISIG_ADDRESS = new PublicKey("3oa3ZDw72kLUQm2En5N5ezz1RBAEV9eVTo1GFgohinLB");
  const ORACLE_PROGRAM_ID = new PublicKey("7HebG1xx5GjmJw3yxCpRWBV2yCt7VspRUk4ponx35jpR");
  
  // Oracle program ID (deployed separately)
  const ORACLE_PROGRAM = new PublicKey("J6f9s455N4mEeQjzQX8hsKCvTmTbsxZNgGKH7p4xKK9L");

  it("Test oracle minting with current program setup", async () => {
    console.log("🧪 Testing Oracle Minting with Multisig Setup");
    console.log("📍 Deployed Mint:", DEPLOYED_MINT.toString());
    console.log("🔐 Multisig Address:", MULTISIG_ADDRESS.toString());
    
    // Derive PDAs
    const [mintAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_authority")],
      program.programId
    );
    
    const [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("collateral_vault")],
      program.programId
    );
    
    const [oraclePriceFeed] = PublicKey.findProgramAddressSync(
      [Buffer.from("SOL/USD")],
      ORACLE_PROGRAM
    );
    
    console.log("🏦 Mint Authority PDA:", mintAuthority.toString());
    console.log("💰 Collateral Vault:", collateralVault.toString());
    console.log("📊 Oracle Price Feed:", oraclePriceFeed.toString());
    
    // Get user's token account
    const userTokenAccount = await getAssociatedTokenAddress(
      DEPLOYED_MINT,
      provider.wallet.publicKey
    );
    
    console.log("👤 User Token Account:", userTokenAccount.toString());
    
    // Check current mint authority
    const mintInfo = await provider.connection.getAccountInfo(DEPLOYED_MINT);
    console.log("🔍 Checking mint authority...");
    
    // Test deposit and mint with current setup
    const depositAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
    const feedId = Array.from(Buffer.from("SOL/USD".padEnd(32, '\0')));
    
    console.log("💸 Attempting to mint with deposit of 0.1 SOL...");
    
    try {
      const tx = await program.methods
        .depositAndMint(new anchor.BN(depositAmount), feedId)
        .accounts({
          mint: DEPLOYED_MINT,
          mintAuthority: mintAuthority, // ❓ This is our PDA, but mint authority is now multisig
          userTokenAccount: userTokenAccount,
          user: provider.wallet.publicKey,
          collateralVault: collateralVault,
          oracleProgram: ORACLE_PROGRAM,
          oraclePriceFeed: oraclePriceFeed,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc({
          commitment: "confirmed",
        });
      
      console.log("✅ SUCCESS! Oracle minting worked with multisig!");
      console.log("🔗 Transaction:", tx);
      
    } catch (error) {
      console.log("❌ FAILED! Oracle minting failed with multisig:");
      console.log("Error:", error.message);
      
      // Check if it's an authority mismatch error
      if (error.message.includes("owner does not match") || 
          error.message.includes("unauthorized") ||
          error.message.includes("authority")) {
        console.log("🔧 DIAGNOSIS: Program needs to use multisig as authority, not PDA");
        console.log("💡 SOLUTION: Update program to pass multisig address as authority");
      }
    }
  });
});

