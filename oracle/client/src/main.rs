use anyhow::Result;
use clap::{Parser, Subcommand};
use log::info;

mod chainlink;
mod oracle_client;
mod stablecoin_client;

#[derive(Parser)]
#[command(name = "chainlink-stablecoin-client")]
#[command(about = "A client for the Chainlink Oracle-Backed Stablecoin system")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Fetch price data from Chainlink and update oracle
    UpdateOracle {
        /// Feed ID to fetch (e.g., ETH/USD)
        #[arg(short, long)]
        feed_id: String,
    },
    /// Deposit collateral and mint stablecoins
    MintStablecoin {
        /// Amount of collateral to deposit (in lamports)
        #[arg(short, long)]
        amount: u64,
    },
    /// Run complete demo flow
    Demo {
        /// Feed ID for demo
        #[arg(short, long, default_value = "ETH/USD")]
        feed_id: String,
        /// Collateral amount for demo
        #[arg(short, long, default_value = "1000000000")]
        amount: u64,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();
    
    let cli = Cli::parse();
    
    match cli.command {
        Commands::UpdateOracle { feed_id } => {
            info!("🔮 Updating oracle with feed: {}", feed_id);
            // TODO: Implement oracle update
            println!("✅ Oracle update functionality coming in Phase 4!");
        }
        Commands::MintStablecoin { amount } => {
            info!("🪙 Minting stablecoin with collateral: {}", amount);
            // TODO: Implement stablecoin minting
            println!("✅ Stablecoin minting functionality coming in Phase 4!");
        }
        Commands::Demo { feed_id, amount } => {
            info!("🚀 Running complete demo flow");
            println!("📊 Feed: {}", feed_id);
            println!("💰 Collateral: {} lamports", amount);
            println!("✅ Complete demo functionality coming in Phase 4!");
        }
    }
    
    Ok(())
}
