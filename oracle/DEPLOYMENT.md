# Deployment Guide

## Overview

This guide covers the complete deployment process for the Chainlink Oracle System, from development setup to production deployment on Solana.

## Deployment Architecture

```
Deployment Flow:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Development   │    │     Devnet      │    │    Mainnet      │
│                 │───▶│                 │───▶│                 │
│ • Local testing │    │ • Integration   │    │ • Production    │
│ • Unit tests    │    │ • End-to-end    │    │ • Live trading  │
│ • Mock data     │    │ • Real API      │    │ • Real funds    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

### System Requirements

```bash
# Required software versions
Solana CLI: >= 1.17.0
Anchor: 0.31.1
Node.js: >= 16.0.0
Rust: >= 1.70.0
Yarn: >= 1.22.0
```

### Installation

```bash
# 1. Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# 2. Install Anchor
npm install -g @coral-xyz/anchor-cli@0.31.1

# 3. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 4. Verify installations
solana --version
anchor --version
rustc --version
node --version
yarn --version
```

## Environment Setup

### 1. Solana Configuration

```bash
# Set cluster (devnet for testing, mainnet for production)
solana config set --url devnet

# Create or import keypair
solana-keygen new --outfile ~/.config/solana/id.json
# OR import existing: solana-keygen recover

# Fund account (devnet only)
solana airdrop 2

# Verify setup
solana config get
solana balance
```

### 2. Project Dependencies

```bash
# Clone and setup project
git clone <repository-url>
cd example_verify/oracle

# Install TypeScript dependencies
yarn install

# Install Rust client dependencies
cd client
cargo build
cd ..
```

### 3. Environment Variables

**Create client environment file:**
```bash
cd client
cp .env.example .env
```

**Configure `.env` file:**
```bash
# Chainlink Data Streams API Configuration
FEED_ID=0x0003d338ea2ac3be9e026033b1aa601673c37bab5e13851c59966f9f820754d6
DATASTREAMS_HOSTNAME=https://api.testnet-dataengine.chain.link
DATASTREAMS_WS_HOSTNAME=wss://api.testnet-dataengine.chain.link/ws
DATASTREAMS_CLIENT_ID=your_client_id_here
DATASTREAMS_CLIENT_SECRET=your_client_secret_here

# For mainnet, use:
# DATASTREAMS_HOSTNAME=https://api.dataengine.chain.link
# DATASTREAMS_WS_HOSTNAME=wss://api.dataengine.chain.link/ws
```

## Development Deployment

### 1. Local Testing

```bash
# Build programs
anchor build

# Run local validator (optional)
solana-test-validator

# Run tests
anchor test --skip-local-validator  # if using external validator
# OR
anchor test  # uses built-in validator
```

### 2. Devnet Deployment

**Configure for devnet:**
```bash
# Set devnet cluster
solana config set --url devnet

# Ensure sufficient balance
solana balance
solana airdrop 2  # if needed
```

**Deploy programs:**
```bash
# Build programs
anchor build

# Deploy to devnet
anchor deploy

# Verify deployment
solana program show 9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1 --url devnet
solana program show CtQ7Dim2Q623X6R4JuGnGXmCLLi3uAzrY2dSdqJyhCSD --url devnet
```

**Test deployment:**
```bash
# Run integration tests
anchor test --skip-build --skip-deploy

# Test client functionality
cd client
cargo run -- fetch-price
cargo run -- update-oracle
```

## Production Deployment

### 1. Mainnet Preparation

**Security Checklist:**
- [ ] Code audit completed
- [ ] All tests passing
- [ ] Security review of private keys
- [ ] Backup of all keypairs
- [ ] Monitoring systems ready
- [ ] Emergency procedures documented

**Mainnet Configuration:**
```bash
# Set mainnet cluster
solana config set --url mainnet-beta

# Use production keypair (SECURE THIS!)
solana config set --keypair /secure/path/to/mainnet-keypair.json

# Verify configuration
solana config get
solana balance  # Ensure sufficient SOL for deployment
```

### 2. Program Deployment

**Deploy oracle program:**
```bash
# Build for production
anchor build --verifiable

# Deploy oracle program
anchor deploy --program oracle --provider.cluster mainnet-beta

# Deploy stablecoin program
anchor deploy --program stablecoin --provider.cluster mainnet-beta
```

**Verify deployment:**
```bash
# Check program accounts
solana program show <ORACLE_PROGRAM_ID> --url mainnet-beta
solana program show <STABLECOIN_PROGRAM_ID> --url mainnet-beta

# Verify program data
solana account <PROGRAM_DATA_ADDRESS> --url mainnet-beta
```

### 3. Client Configuration

**Update client for mainnet:**
```bash
cd client

# Update .env for mainnet
DATASTREAMS_HOSTNAME=https://api.dataengine.chain.link
DATASTREAMS_WS_HOSTNAME=wss://api.dataengine.chain.link/ws
# Use production credentials
```

**Test mainnet client:**
```bash
# Test price fetching (no cost)
cargo run -- fetch-price

# Test oracle update (costs SOL)
cargo run -- update-oracle
```

## Configuration Management

### 1. Program IDs

**Current Program IDs (Devnet):**
```toml
# Anchor.toml
[programs.devnet]
oracle = "9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1"
stablecoin = "CtQ7Dim2Q623X6R4JuGnGXmCLLi3uAzrY2dSdqJyhCSD"
```

**For mainnet deployment:**
```toml
# Anchor.toml
[programs.mainnet]
oracle = "NEW_MAINNET_ORACLE_PROGRAM_ID"
stablecoin = "NEW_MAINNET_STABLECOIN_PROGRAM_ID"
```

### 2. Account Addresses

**Chainlink Verifier Addresses:**
```rust
// Devnet
const VERIFIER_PROGRAM_ID: &str = "Gt9S41PtjR58CbG9JhJ3J6vxesqrNAswbWYbLNTMZA3c";
const ACCESS_CONTROLLER: &str = "2k3DsgwBoqrnvXKVvd7jX7aptNxdcRBdcd5HkYsGgbrb";

// Mainnet (update these for production)
const VERIFIER_PROGRAM_ID: &str = "MAINNET_VERIFIER_PROGRAM_ID";
const ACCESS_CONTROLLER: &str = "MAINNET_ACCESS_CONTROLLER";
```

### 3. API Endpoints

**Chainlink Data Streams Endpoints:**
```bash
# Testnet
DATASTREAMS_HOSTNAME=https://api.testnet-dataengine.chain.link
DATASTREAMS_WS_HOSTNAME=wss://api.testnet-dataengine.chain.link/ws

# Mainnet
DATASTREAMS_HOSTNAME=https://api.dataengine.chain.link
DATASTREAMS_WS_HOSTNAME=wss://api.dataengine.chain.link/ws
```

## Monitoring and Maintenance

### 1. Health Checks

**Program Health:**
```bash
# Check program status
solana program show <PROGRAM_ID> --url <CLUSTER>

# Monitor account rent
solana account <ACCOUNT_ADDRESS> --url <CLUSTER>

# Check transaction history
solana transaction-history <SIGNATURE> --url <CLUSTER>
```

**Client Health:**
```bash
# Test API connectivity
cargo run -- fetch-price

# Verify oracle updates
cargo run -- update-oracle

# Monitor continuous operation
cargo run -- monitor
```

### 2. Logging and Monitoring

**Set up logging:**
```bash
# Enable debug logging
export RUST_LOG=debug

# Monitor Solana logs
solana logs --url <CLUSTER>

# Monitor specific program
solana logs <PROGRAM_ID> --url <CLUSTER>
```

**Monitoring script example:**
```bash
#!/bin/bash
# monitor.sh - Basic health monitoring

echo "=== Oracle System Health Check ==="
echo "Timestamp: $(date)"

# Check Solana connectivity
echo "Checking Solana connectivity..."
solana cluster-version --url mainnet-beta

# Check program status
echo "Checking oracle program..."
solana program show 9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1 --url mainnet-beta

# Test client functionality
echo "Testing client..."
cd client && cargo run -- fetch-price

echo "Health check complete."
```

### 3. Backup and Recovery

**Backup checklist:**
- [ ] Program keypairs backed up securely
- [ ] Upgrade authority keypairs backed up
- [ ] Client configuration files backed up
- [ ] Program source code tagged and archived
- [ ] Deployment documentation updated

**Recovery procedures:**
1. **Program recovery:** Redeploy from source with same keypair
2. **Data recovery:** Price feeds are derived accounts (no backup needed)
3. **Client recovery:** Restore configuration and rebuild
4. **Key recovery:** Use secure backup procedures

## Upgrade Procedures

### 1. Program Upgrades

**Prepare upgrade:**
```bash
# Build new version
anchor build --verifiable

# Test on devnet first
anchor deploy --program oracle --provider.cluster devnet
anchor test --skip-local-validator
```

**Deploy upgrade:**
```bash
# Upgrade mainnet program
anchor upgrade target/deploy/oracle.so --program-id <ORACLE_PROGRAM_ID> --provider.cluster mainnet-beta

# Verify upgrade
solana program show <ORACLE_PROGRAM_ID> --url mainnet-beta
```

### 2. Client Updates

**Update client:**
```bash
# Pull latest changes
git pull origin main

# Update dependencies
cd client && cargo update

# Test updates
cargo run -- fetch-price
cargo run -- update-oracle
```

## Security Considerations

### 1. Key Management

**Production key security:**
- Use hardware wallets for program upgrade authority
- Store keypairs in secure, encrypted storage
- Implement multi-signature for critical operations
- Regular key rotation procedures

### 2. Access Control

**Program permissions:**
- Limit upgrade authority to trusted parties
- Implement proper access controls in programs
- Regular security audits of program logic
- Monitor for unauthorized access attempts

### 3. API Security

**Chainlink API security:**
- Secure storage of API credentials
- Regular credential rotation
- Monitor API usage and limits
- Implement rate limiting and error handling

## Troubleshooting

### Common Deployment Issues

#### 1. Insufficient Funds
```bash
# Error: Insufficient funds for deployment
# Solution: Add more SOL to deployer account
solana airdrop 2  # devnet only
# For mainnet: transfer SOL from funded account
```

#### 2. Program Size Limits
```bash
# Error: Program too large
# Solution: Optimize program size
anchor build --verifiable
# Check program size: ls -la target/deploy/
```

#### 3. Network Issues
```bash
# Error: RPC connection failed
# Solution: Check network connectivity and RPC endpoint
solana config set --url https://api.devnet.solana.com
```

#### 4. Version Conflicts
```bash
# Error: Anchor version mismatch
# Solution: Use correct Anchor version
npm install -g @coral-xyz/anchor-cli@0.31.1
```

### Debug Commands

```bash
# Verbose deployment
anchor deploy --provider.cluster devnet --verbose

# Check program logs
solana logs --url devnet

# Validate program
anchor verify <PROGRAM_ID> --provider.cluster devnet

# Check account data
solana account <ACCOUNT_ADDRESS> --url devnet --output json
```

## Production Checklist

### Pre-deployment
- [ ] All tests passing on devnet
- [ ] Security audit completed
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Monitoring systems ready
- [ ] Backup procedures tested
- [ ] Emergency contacts notified

### Deployment
- [ ] Programs deployed successfully
- [ ] Program IDs updated in configuration
- [ ] Client tested with new programs
- [ ] Initial price feeds populated
- [ ] Monitoring systems activated

### Post-deployment
- [ ] System health verified
- [ ] Performance metrics baseline established
- [ ] User documentation updated
- [ ] Support team trained
- [ ] Incident response procedures activated

## Support and Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor system health
- Check price feed updates
- Review error logs
- Verify API connectivity

**Weekly:**
- Update dependencies
- Review security logs
- Test backup procedures
- Performance analysis

**Monthly:**
- Security audit
- Dependency updates
- Documentation review
- Disaster recovery testing

### Emergency Procedures

**System outage:**
1. Identify root cause
2. Implement temporary fix
3. Communicate with users
4. Deploy permanent solution
5. Post-mortem analysis

**Security incident:**
1. Isolate affected systems
2. Assess damage
3. Implement fixes
4. Notify stakeholders
5. Update security procedures

This deployment guide ensures a systematic and secure approach to deploying the Chainlink Oracle System across all environments.
