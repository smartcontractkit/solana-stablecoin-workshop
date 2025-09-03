#!/bin/bash

# 🧪 Individual Test Runner Script
# Usage: ./test-individual.sh [oracle|stablecoin|integration|all]

set -e

echo "🧪 Stablecoin Individual Test Runner"
echo "═══════════════════════════════════════"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to run tests with proper environment
run_test() {
    local test_name=$1
    local grep_pattern=$2
    
    echo -e "${BLUE}🚀 Running: $test_name${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Build and deploy first
    echo "📦 Building and deploying program..."
    anchor build > /dev/null 2>&1
    anchor deploy --provider.cluster devnet > /dev/null 2>&1
    
    # Run the specific test
    echo "🧪 Running tests..."
    yarn run ts-mocha -p ./tsconfig.json -t 1000000 --grep "$grep_pattern" 'tests/**/*.ts'
    
    echo -e "${GREEN}✅ $test_name completed successfully!${NC}"
    echo ""
}

# Function to run all tests
run_all_tests() {
    echo -e "${BLUE}🚀 Running: All Tests (Full Suite)${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    anchor test --skip-local-validator
    echo -e "${GREEN}✅ All tests completed successfully!${NC}"
}

# Set environment variables for Anchor
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export ANCHOR_WALLET="$HOME/.config/solana/id.json"

# Main script logic
case "${1:-help}" in
    "oracle")
        run_test "Oracle Unit Tests" "Oracle Unit Tests"
        ;;
    "stablecoin")
        run_test "Stablecoin Unit Tests" "Stablecoin Unit Tests"
        ;;
    "integration")
        run_test "Integration Tests" "Oracle-Stablecoin Integration"
        ;;
    "all")
        run_all_tests
        ;;
    "help"|*)
        echo -e "${YELLOW}Usage: ./test-individual.sh [option]${NC}"
        echo ""
        echo "Options:"
        echo "  oracle      - Run Oracle Unit Tests only"
        echo "  stablecoin  - Run Stablecoin Unit Tests only"  
        echo "  integration - Run Integration Tests only"
        echo "  all         - Run all tests (full suite)"
        echo "  help        - Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./test-individual.sh oracle"
        echo "  ./test-individual.sh stablecoin"
        echo "  ./test-individual.sh integration"
        echo "  ./test-individual.sh all"
        ;;
esac
