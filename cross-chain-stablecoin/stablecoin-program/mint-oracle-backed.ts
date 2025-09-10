import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { BN } from 'bn.js';
import { retryTransaction } from './utils/retry-helper.ts';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Function to get current SOL price (approximate for display purposes)
async function getCurrentSolPrice(): Promise<number> {
  try {
    // Using a simple price API for demonstration
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    return data.solana.usd;
  } catch (error) {
    // Fallback to approximate price if API fails
    console.log('⚠️  Using fallback SOL price estimate');
    return 140; // Approximate fallback price
  }
}

async function oracleBackedMint() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.StablecoinProgram as Program<any>;
  
  // Use 0.1 SOL as collateral for oracle-backed minting
  const collateralAmount = 100000000; // 0.1 SOL in lamports
  const feedId = [0, 3, 211, 56, 234, 42, 195, 190, 158, 2, 96, 51, 177, 170, 96, 22, 115, 195, 123, 171, 94, 19, 133, 28, 89, 150, 111, 159, 130, 7, 84, 214];
  
  console.log('🔮 Minting oracle-backed stablecoins...');
  console.log('💰 Collateral: 0.1 SOL (100,000,000 lamports)');
  console.log('📊 Using real SOL/USD price from Chainlink Data Streams');
  
  // Derive required accounts
  const [mintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('mint_authority')],
    program.programId
  );
  
  const [collateralVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('collateral_vault')],
    program.programId
  );
  
  // Check if required environment variables are set
  if (!process.env.SOL_TOKEN_MINT) {
    throw new Error('❌ SOL_TOKEN_MINT not set in environment variables');
  }
  if (!process.env.SOL_MULTISIG_ADDRESS) {
    throw new Error('❌ SOL_MULTISIG_ADDRESS not set in environment variables');
  }
  if (!process.env.ORACLE_PROGRAM_ID) {
    throw new Error('❌ ORACLE_PROGRAM_ID not set in environment variables');
  }
  if (!process.env.ORACLE_PRICE_FEED_PDA) {
    throw new Error('❌ ORACLE_PRICE_FEED_PDA not set in environment variables');
  }
  
  const signature = await retryTransaction(
    provider.connection,
    async () => {
      return await program.methods
        .depositAndMintMultisig(new BN(collateralAmount), feedId)
        .accounts({
          mint: new PublicKey(process.env.SOL_TOKEN_MINT!),
          multisig: new PublicKey(process.env.SOL_MULTISIG_ADDRESS!),
          mintAuthority: mintAuthority,
          userTokenAccount: null, // Will be derived automatically
          collateralVault: collateralVault,
          user: provider.wallet.publicKey,
          oracleProgram: new PublicKey(process.env.ORACLE_PROGRAM_ID!),
          oraclePriceFeed: new PublicKey(process.env.ORACLE_PRICE_FEED_PDA!),
        })
        .signers([]) // Admin wallet is already the default signer
        .rpc();
    }
  );
  
  console.log('✅ Oracle-backed minting successful!');
  console.log('🔗 Transaction:', signature);
  
  // Calculate and display USD value of minted tokens
  const solPrice = await getCurrentSolPrice();
  const collateralInSol = collateralAmount / 1000000000; // Convert lamports to SOL
  const usdValue = collateralInSol * solPrice;
  console.log(`💰 Tokens minted: ~${usdValue.toFixed(1)} USD worth (based on current SOL price)`);
}

oracleBackedMint().catch(console.error);
