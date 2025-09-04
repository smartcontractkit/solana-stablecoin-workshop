# 🧪 Stablecoin Testing Guide

## 📋 **Testing Structure Overview**

Our testing suite is organized in a logical flow that mirrors the development and integration process:

```
📁 tests/
├── 0-program-initialization.ts     # Basic program setup verification
├── 1-oracle-unit-tests.ts         # Oracle program with real Chainlink data
├── 2-stablecoin-unit-tests.ts     # Stablecoin program logic (independent)
├── 3-oracle-stablecoin-integration.ts # Complete CPI integration tests
└── *.old files                    # Archived test files
```

## 🎯 **Test Flow Logic**

### **Phase 1: Oracle Unit Tests** 🔮
- Tests oracle program with **real Chainlink Data Streams**
- Verifies price feed data structure and CPI functionality
- Ensures oracle can mint stablecoins with accurate pricing

### **Phase 2: Stablecoin Unit Tests** 🪙  
- Tests stablecoin program logic **independently**
- Verifies mint initialization and program structure
- Tests expected failures with mock oracle (validation)

### **Phase 3: Integration Tests** 🔗
- Tests **complete Oracle ↔ Stablecoin integration**
- Full mint/burn cycle with real oracle CPI calls
- End-to-end system validation

---

## 🚀 **Running Tests**

### **All Tests (Recommended for CI/Production)**
```bash
anchor test --skip-local-validator
```

### **Individual Test Suites**

#### **1. Oracle Unit Tests Only**
```bash
anchor test --skip-local-validator -- --grep "Oracle Unit Tests"
```
**What it tests:**
- ✅ Real Chainlink Data Streams integration
- ✅ Oracle price feed data structure  
- ✅ Stablecoin minting with real price data
- ✅ Perfect decimal precision (18→8→6 decimals)

#### **2. Stablecoin Unit Tests Only**
```bash
anchor test --skip-local-validator -- --grep "Stablecoin Unit Tests"
```
**What it tests:**
- ✅ Stablecoin mint initialization
- ✅ Program instruction availability
- ✅ Expected failures with mock oracle
- ✅ Account structure validation

#### **3. Integration Tests Only**
```bash
anchor test --skip-local-validator -- --grep "Oracle-Stablecoin Integration"
```
**What it tests:**
- ✅ Complete mint/burn cycle
- ✅ Oracle CPI calls in production
- ✅ Collateral management
- ✅ System state validation

### **Individual Test Cases**

#### **Specific Oracle Tests**
```bash
# Oracle setup and minting
anchor test --skip-local-validator -- --grep "Initialize Stablecoin Mint for Oracle Testing"
anchor test --skip-local-validator -- --grep "Mint Stablecoins with Real Chainlink Price"
anchor test --skip-local-validator -- --grep "Verify Oracle Price Feed Data Structure"
```

#### **Specific Stablecoin Tests**
```bash
# Stablecoin program logic
anchor test --skip-local-validator -- --grep "Initialize Stablecoin Mint"
anchor test --skip-local-validator -- --grep "Deposit and Mint Logic"
anchor test --skip-local-validator -- --grep "Program Instructions Availability"
```

#### **Specific Integration Tests**
```bash
# Full integration flow
anchor test --skip-local-validator -- --grep "Initialize Stablecoin Mint for Integration"
anchor test --skip-local-validator -- --grep "Deposit Collateral with Oracle CPI"
anchor test --skip-local-validator -- --grep "Complete Burn and Withdraw Cycle"
```

---

## 📊 **Expected Test Results**

### **✅ Success Indicators**

#### **Oracle Tests:**
```
🔮 Oracle Unit Tests - Real Chainlink Data
✅ Setup: Initialize Stablecoin Mint for Oracle Testing (2076ms)
✅ Test Oracle Integration: Mint Stablecoins with Real Chainlink Price (2700ms)
✅ Verify Oracle Price Feed Data Structure (253ms)

💰 Economics Summary:
   📊 Collateral: 0.100000000 SOL (100,000,000 lamports)
   💵 Expected USD value: ~$21.00
   🪙 Minted stablecoins: 21.000000 USD
   ✅ Conversion accuracy: 100.00%
```

#### **Stablecoin Tests:**
```
🪙 Stablecoin Unit Tests - Program Logic
✅ Initialize Stablecoin Mint (2792ms)
✅ Test Deposit and Mint Logic (Mock Oracle) (750ms) - Expected failure
✅ Verify Program State After Tests (1021ms)
✅ Test Program Instructions Availability (312ms)
```

#### **Integration Tests:**
```
🔗 Oracle-Stablecoin Integration Tests
✅ Setup: Initialize Stablecoin Mint for Integration (1916ms)
✅ Integration Test: Deposit Collateral with Oracle CPI (4793ms)
✅ Integration Test: Verify Complete System State (1393ms)
✅ Integration Test: Complete Burn and Withdraw Cycle (3599ms)

📈 Changes:
   🔥 Stablecoins burned: 5000000
   💎 Collateral withdrawn: 23796039 lamports
   💰 User SOL gained: 23791039 lamports
```

### **🎯 Key Metrics to Verify**

1. **Decimal Precision:**
   - Oracle: `21011900000 raw ($210.11900000 USD per SOL)`
   - Stablecoin: `21000000 raw units (21.000000 USD stablecoins)`
   - Accuracy: `100.00%`

2. **Transaction Success:**
   - All transactions should have valid signatures
   - No "Blockhash not found" errors (retry logic working)
   - CPI calls successful with proper logs

3. **Economic Accuracy:**
   - 0.1 SOL @ $210/SOL = $21 USD = 21 stablecoins
   - Burn/withdraw returns correct collateral amounts
   - Vault balances update correctly

---

## 🛠️ **Development Workflow**

### **For Feature Development:**
```bash
# 1. Test Oracle functionality first
anchor test --skip-local-validator -- --grep "Oracle Unit Tests"

# 2. Test Stablecoin logic independently  
anchor test --skip-local-validator -- --grep "Stablecoin Unit Tests"

# 3. Test full integration
anchor test --skip-local-validator -- --grep "Oracle-Stablecoin Integration"
```

### **For Debugging:**
```bash
# Test specific failing component
anchor test --skip-local-validator -- --grep "specific test name"

# Example: Debug CPI issues
anchor test --skip-local-validator -- --grep "Deposit Collateral with Oracle CPI"
```

### **For CI/Production:**
```bash
# Run everything with full validation
anchor test --skip-local-validator
```

---

## 🔧 **Troubleshooting**

### **Common Issues:**

#### **"Blockhash not found" Errors**
- **Solution**: Tests include retry logic with exponential backoff
- **Expected**: Some retries on devnet (network instability)
- **Failure point**: If all retries fail after 3 attempts

#### **"Account not initialized" Errors**  
- **Solution**: Tests run in sequence (Oracle → Stablecoin → Integration)
- **Check**: Ensure oracle program is deployed and price feed exists

#### **CPI Failures**
- **Check**: Oracle program ID matches in both programs
- **Verify**: Price feed account exists and has valid data
- **Debug**: Look for "Program log:" entries in transaction logs

### **Environment Setup:**
```bash
# Ensure Solana CLI is configured
solana config get

# Should show:
# RPC URL: https://api.devnet.solana.com
# WebSocket URL: wss://api.devnet.solana.com/
# Keypair Path: ~/.config/solana/id.json
```

---

## 📈 **Test Performance Benchmarks**

### **Expected Timing (Devnet):**
- **Oracle Tests**: ~5-8 seconds (3 tests)
- **Stablecoin Tests**: ~4-6 seconds (4 tests)  
- **Integration Tests**: ~8-12 seconds (4 tests)
- **Full Suite**: ~17-25 seconds (12 tests total)

### **Performance Factors:**
- **Devnet latency**: Variable (2-8 seconds per transaction)
- **Retry logic**: Adds 2-8 seconds for failed attempts
- **Program deployment**: ~3-5 seconds (only when code changes)

---

## 🎉 **Success Criteria**

### **All Tests Must:**
✅ **Pass without errors** (12/12 passing)  
✅ **Show correct decimal handling** (100% accuracy)  
✅ **Display human-readable logs** (SOL amounts, USD values)  
✅ **Complete within reasonable time** (<30 seconds total)  
✅ **Demonstrate real Chainlink integration** (live price data)  

### **System Validation:**
✅ **Oracle stores real Chainlink prices** ($210+ per SOL)  
✅ **Stablecoin mints correct amounts** (1:1 USD backing)  
✅ **Burn/withdraw returns proper collateral**  
✅ **CPI calls work flawlessly** (cross-program invocation)  
✅ **Retry logic handles network issues** (devnet stability)  

---

## 📝 **Documentation Updates**

When adding new tests:

1. **Update this file** with new test descriptions
2. **Add to appropriate phase** (Oracle/Stablecoin/Integration)  
3. **Document expected results** and success criteria
4. **Include troubleshooting** for common issues
5. **Update performance benchmarks** if timing changes

---

## 🔗 **Related Documentation**

- `README.md` - Project overview and setup
- `Anchor.toml` - Test configuration  
- `programs/stablecoin-program/src/lib.rs` - Program logic
- `tests/` - Individual test files with inline documentation

---

*Last updated: $(date)*
*Test suite version: v1.0*
*Total tests: 12 (Oracle: 3, Stablecoin: 4, Integration: 4, Setup: 1)*

