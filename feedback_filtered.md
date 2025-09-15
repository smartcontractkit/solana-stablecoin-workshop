# Consolidated Feedback for Solana Stablecoin Workshop

This document organizes and consolidates all feedback from the `feedbacks.md` file into actionable categories.

---

## 1. Documentation & Instructions

This category covers issues with the `README.md` and `INSTRUCTIONS.md` files, including structure, clarity, logical errors, and missing steps.

### 1.1. Structural & Redundancy Issues
- **Consolidate "Happy Path":** The instructions are split between `README.md` and `INSTRUCTIONS.md`. They should be merged into a single, top-to-bottom "happy path" in the main `README.md` so users can follow one file.
- **Move Prerequisites:** All prerequisites (Solana CLI, Anchor, Node.js, Rust, etc.) should be moved to the very top of the main `README.md` before any other steps.
- **Remove Redundant Commands:** Steps like `solana config get` are unnecessary, as `solana config set` already prints the updated configuration.
- **Merge Related Steps:** The Ethereum setup in Phase 4 is split. Step 4.4 (getting testnet ETH) should be merged into Step 4.1 as it's all part of the same environment setup.

### 1.2. Lack of Clarity & Beginner-Friendliness
- **Link to Install Guides:** Provide external links to official installation guides for all required tools (Solana, Rust, Node.js, etc.) for self-service.
- **Explain CLI Prompts:**
    - The `solana-keygen new` command prompts for a BIP39 passphrase. The instructions should explicitly tell users they can ignore this for the workshop.
    - It also fails if a key already exists. Advise users to either use `solana-keygen new --force` or simply proceed with their existing key.
- **Explain "Normal" but Confusing Output:**
    - The `anchor test` command outputs messages like `Found incorrect program id declaration...` when it syncs keys. The docs should explain that this is expected behavior.
    - The same command warns about `solana-program` as a dependency conflict. This should be noted.
- **Avoid "Magical" Commands:** The `sed` command is not beginner-friendly. Instead of providing a `sed` one-liner, instruct users to manually open the `.env` file and edit the line.
- **Disambiguate Dependencies:** Use clearer names for dependencies, such as "Chainlink Data Streams SDK" and "Streams Report Crate".

### 1.3. Logical Errors, Typos, and Missing Steps
- **Flawed Verification Step:** In Step 0.5, `echo "$ORACLE_PROGRAM_ID"` is used for verification, but the variable is empty at this stage. Use a variable that is already set, like `echo "$FEED_ID"`.
- **Missing `source .env` Command:** A critical `source .env` command is missing between Step 4.5 and 4.6. Without it, Hardhat fails with `Error HH308: Unrecognized positional argument burnMint`.
- **Incorrect File System Check:** An `ls -la ... .env` command is used, but it fails because the symlinked `.env` files do not exist at that point in the instructions.
- **Confusing `.env` Variable Placement:** In Step 6.3, the user gets a `POOL_TOKEN_ACCOUNT` variable but is told to add it to the "Phase 3" section of the `.env` file, which is confusing.
- **Typo:** A typo was found where instructions refer to a value "above" the code block when it is actually "below".
- **Formatting:** It was suggested to place expected command output *before* the code block that generates it, to set user expectations.

---

## 2. Setup & Dependencies

This category covers problems related to the initial environment setup, tooling, and dependency management.

- **Missing `npm install`:** The instructions are missing `npm install` commands in both the `/oracle` and `/cross-chain-stablecoin/stablecoin-program` directories. This leads to `error Command "ts-mocha" not found`.
- **Inconsistent Package Manager:** The workshop mixes `npm` and `yarn` commands. It should be standardized to one to avoid confusion.
- **Tooling Versions & Recommendations:**
    - The instructions should be verified against the latest Solana CLI version (e.g., `2.3.9`).
    - It was recommended to have users install and use `avm` (Anchor Version Manager).
- **Submodule Strategy:**
    - The use of git submodules was questioned. It was suggested to use a version-pinned NPM package (e.g., `@chainlink/contracts`) instead for more stable dependency management.
    - A warning should be added that `git submodule update --init --recursive` can take a very long time (20+ minutes).

---

## 3. Execution & Tooling Errors

This category covers errors that occur when running commands, often due to environment issues or tooling choices.

- **Insufficient Solana Funds (Major Issue):**
    - The initial `2 SOL` airdrop is insufficient. Users repeatedly run out of funds during `anchor test` (Phase 1), `anchor deploy` (Phase 2), and `mint-oracle-backed.ts` (Phase 6).
    - **Recommendation:** Increase the initial airdrop to 10 SOL or add explicit instructions to get more funds from a faucet at specific points.
    - **Clarify Error Message:** The error seen in Step 6.2 is a "simulation error," which doesn't clearly indicate an insufficient balance. This should be explained in the docs.
- **Node.js/TypeScript Execution Failure:**
    - `npx ts-node` fails for some users with a `TypeError: Unknown file extension ".ts"`. The provided workaround was to install and use `tsx` instead. The project should ensure its script execution method is robust.
- **Alternative Faucet Suggestion:**
    - For acquiring Sepolia ETH, it was suggested to use a general `testnet.faucet` as a potential alternative to the Chainlink-specific one.

---

## 4. Core Concepts & Workshop Logic

This category covers feedback on the fundamental concepts being taught and the logical flow of the workshop.

- **Stablecoin Value vs. Token Amount (Critical Conceptual Flaw):**
    - A user minted stablecoins worth `~$23.8` but received `1,000,000` tokens on Ethereum. This is extremely confusing and undermines the concept of a "stablecoin" from a user's perspective. The role of token decimals (e.g., 6 decimals) vs. actual value must be made much clearer.
- **Collateralization & Risk:**
    - The workshop does not address what happens if the collateral (SOL) price drops.
    - A suggestion was made to improve the logic by only allowing minting up to 50% of the collateral's value to introduce a safety margin.
- **Incremental Testing:**
    - The tests should not be saved for the end. They should be run incrementally after each major phase (Oracle deployment, Stablecoin deployment, etc.) to allow users to verify their progress and catch errors early.

---

## 5. Workshop Delivery for a Live Audience

This category contains suggestions for running this project as a live, instructor-led workshop.

- **Pre-Workshop Preparation:** All setup instructions and links for applying for credentials (Data Streams, faucets) should be sent to participants *before* the workshop.
- **Pacing and Time Allocation:** Instructors must allocate significant time for installations (Rust, Solana, Node, submodules), as this can vary widely.
- **Need for TA Support:** It is highly recommended to have Teaching Assistants (TAs). The variety of potential machine-specific issues means many participants will get stuck and need individual help to keep up.
