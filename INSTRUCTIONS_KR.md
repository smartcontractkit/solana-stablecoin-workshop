# 오라클 기반 스테이블코인과 CCIP 교차체인 통합

## 전체 단계별 구현 가이드

이 문서는 Chainlink Cross-Chain Interoperability Protocol (CCIP) 통합을 통해 Solana와 Ethereum 간의 원활한 교차체인 토큰 전송을 가능하게 하는, 오라클 기반 스테이블코인 시스템을 구축하기 위한 단계별 지침을 제공합니다.

## 🎯 시스템 개요

**우리가 구축할 것:**
- **오라클 기반 스테이블코인**: Chainlink Data Streams SDK(SOL/USD 가격 피드)를 사용
- **교차체인 토큰 전송**: Chainlink CCIP(Solana ↔ Ethereum)
- **프로덕션 수준 아키텍처**: 적절한 멀티시그 권한 관리
- **실시간 가격 검증** 및 온체인 저장

**핵심 구성요소:**
1. **오라클 프로그램** - Chainlink Data Streams SDK 리포트를 Solana에 검증/저장
2. **스테이블코인 프로그램** - 오라클 가격 데이터 기반으로 토큰 민팅(CPI)
3. **CCIP 통합** - Chainlink 인프라를 사용한 교차체인 전송
4. **멀티시그 권한** - 오라클 및 CCIP 운영을 위한 민트 권한 관리

---

## 📋 사전 준비물(Prerequisites)

### 필수 도구
```bash
# Solana CLI (v1.18.4+)
sh -c "$(curl -sSfL https://release.solana.com/v1.18.4/install)"

# Anchor Framework (v0.31.1+)
npm install -g @coral-xyz/anchor-cli

# Node.js (v16+) and npm
# Download from: https://nodejs.org/
# Or use package manager: brew install node (macOS) / apt install nodejs npm (Ubuntu)

# Git
# Install via your system package manager or https://git-scm.com/downloads
```

### 필수 계정 및 접근 권한
- **Solana 지갑**(devnet SOL 보유)
  - 명령어: `solana airdrop 5` (전체 배포 비용 약 ~2.3 SOL 커버)
  - 추가 SOL: [https://faucet.solana.com/](https://faucet.solana.com/)
- **Ethereum 지갑**(Sepolia ETH 보유)
  - **강의자에게 Sepolia ETH 요청**(권장 – 더 빠름)
  - 대체 파우셋: [https://faucets.chain.link/](https://faucets.chain.link/) 또는 [https://sepoliafaucet.com/](https://sepoliafaucet.com/)
- **Chainlink Data Streams SDK** 접근(워크숍에서 제공)


## 🔧 환경 설정(Phase 1 시작 전 필수)

### Step 0.1: 워크숍 레포지토리 클론
```bash
git clone https://github.com/smartcontractkit/solana-stablecoin-workshop
```

```bash
cd solana-stablecoin-workshop
```

```bash
# 모든 서브모듈 초기화/업데이트(CCIP 통합에 필요)
# ⚠️ WARNING: 환경에 따라 5분 이상 소요될 수 있습니다
git submodule update --init --recursive
```

**📦 서브모듈 초기화:**
레포지토리는 두 개의 핵심 서브모듈을 포함합니다:
- `smart-contract-examples/` - Chainlink CCIP Hardhat 컨트랙트
- `solana-starter-kit/` - Solana CCIP 통합 스크립트

**참고:** Git clone 시 기본적으로 서브모듈 디렉토리는 비어 있습니다. `git submodule update --init --recursive` 명령이 실제 서브모듈 콘텐츠를 다운로드합니다.

### Step 0.2: 환경 파일 설정
본 프로젝트는 디렉토리 간 일관성을 위해 중앙 `.env` 시스템을 사용하며, 심볼릭 링크가 이미 구성되어 있습니다.

```bash
# 예시 파일을 복사하여 프로젝트 루트에 .env 생성
cp .env.example .env
```

```bash
# 모든 디렉토리가 동일한 .env 파일을 사용하도록 심볼릭 링크 생성
ln -sf ../.env oracle/.env
ln -sf ../../.env cross-chain-stablecoin/stablecoin-program/.env
ln -sf ../../../../.env smart-contract-examples/ccip/cct/hardhat/.env
ln -sf ../.env solana-starter-kit/.env
```

**📁 사전 구성된 파일 구조:**
```
.env.example                   # 템플릿 파일(프로젝트 루트)
.env                          # 메인 환경 파일(.env.example에서 생성)
oracle/.env -> ../.env        # Oracle 하위 디렉토리는 루트 .env로 심링크
cross-chain-stablecoin/stablecoin-program/.env -> ../../.env
smart-contract-examples/ccip/cct/hardhat/.env -> ../../../../.env
```

**✨ 작동 방식:** 모든 하위 디렉토리의 `.env` 파일은 루트 `.env`를 가리킵니다. 예를 들어 `oracle/.env`를 수정하면 실제로 루트 `.env`를 편집하게 되며, 변경사항은 모든 디렉토리에 자동으로 반영됩니다.

### Step 0.3: .env 파일 구조 확인
```bash
# 현재 .env 파일 확인(프로젝트 루트, 전역 심링크됨)
vim .env
```

**📝 Vim:** `i` 로 편집 → `Esc` 후 `:wq` 저장

```bash
# 파일은 배포 단계(Phase)별로 구성되어 있습니다:
# - PHASE 1: Oracle Program Deployment (부분 사전 채움, 강의자 제공 DATASTREAMS 자격 필요)
# - PHASE 2: Stablecoin Program Deployment (진행 중 채움)
# - PHASE 3: CCIP Integration (Solana Side) (진행 중 채움)
# - PHASE 4: Ethereum Side Deployment (진행 중 채움)
# - PHASE 5: Complete Cross-Chain Configuration (진행 중 채움)
# - PHASE 6: Testing and Token Operations (진행 중 채움)
# - PHASE 7: Execute Cross-Chain Transfer (진행 중 채움)
```

### Step 0.4: 중요 .env 파일 노트

**🔑 Chainlink Data Streams 자격 증명:**
`DATASTREAMS_CLIENT_ID`, `DATASTREAMS_CLIENT_SECRET`는 강의자에게서 받아야 합니다. 이 자격 증명은 Phase 1에서 Chainlink Data Streams 접근에 필요합니다.

**⚠️ API 시크릿의 특수문자:**
`DATASTREAMS_CLIENT_SECRET`에 특수문자(`&`, `<`, `>`, `*` 등)가 포함되어 있다면 반드시 따옴표로 감싸세요:

```bash
# ✅ 올바름 - 따옴표로 감쌈
DATASTREAMS_CLIENT_SECRET="your-secret-with-special&characters<here>"

# ❌ 틀림 - 따옴표 없음(파싱 오류 발생)
DATASTREAMS_CLIENT_SECRET=your-secret-with-special&characters<here>
```

**📍 시작 전 채워야 할 값:**
- `SOL_ADMIN_WALLET`: 현재 Solana 지갑 주소 입력
- `FEED_ID`: Chainlink SOL/USD 피드 ID
- `DATASTREAMS_*`: Chainlink Data Streams 설정(강의자 자격 필요)
- `ETHEREUM_SEPOLIA_RPC_URL`: Ethereum 퍼블릭 테스트넷 엔드포인트
- `CCIP_POOL_PROGRAM`: 고정 CCIP 풀 프로그램 ID

**🔄 배포 중 채우게 될 값:**
- `ORACLE_PROGRAM_ID`, `ORACLE_PRICE_FEED_PDA`: Phase 1에서 생성
- `SOL_TOKEN_MINT`: Phase 2에서 생성
- `SOL_POOL_STATE_PDA`, `SOL_POOL_SIGNER_PDA`: Phase 3에서 생성
- `ETH_TOKEN_ADDRESS`, `ETH_TOKEN_POOL`: Phase 4에서 생성

### Step 0.5: 환경 로딩 확인
```bash
# 환경 변수가 올바르게 로드되는지 테스트
source .env
echo "FEED_ID: $FEED_ID"
```

**Note:** 파싱 에러가 보이면 `.env`의 특수문자 따옴표 여부를 확인하세요.

---

## 🏗️ Phase 1: 오라클 프로그램 배포

### Step 1.1: 오라클 프로그램 준비
```bash
cd oracle
```

### Step 1.2: 오라클 프로그램 빌드/배포
```bash
# 오라클 프로그램 빌드
anchor build
```

```bash
# devnet에 배포
anchor deploy --provider.cluster devnet
```

**Note:** 출력에서 배포된 프로그램 ID를 복사해 두세요. 이후에 필요합니다.
**예시:** `9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1`

### Step 1.3: 환경에 오라클 프로그램 ID 업데이트
```bash
# 배포한 Oracle Program ID를 .env에 추가
vim .env
# Or use nano if you prefer: nano .env
```

**📝 무엇을 업데이트하나요:**
`ORACLE_PROGRAM_ID=` 라인을 찾아 Step 1.2의 프로그램 ID로 채워 넣으세요:
```bash
# Before:
ORACLE_PROGRAM_ID=

# After (example):
ORACLE_PROGRAM_ID=9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1
```

**⚠️ 필수:** 오라클 클라이언트는 `.env`의 `ORACLE_PROGRAM_ID`가 필요합니다.

### Step 1.4: 오라클 가격 피드 초기화
```bash
source .env
```
```bash
cd client
cargo run -- update-oracle
```

**Expected Output:**
```
✅ Oracle updated successfully!
🔗 Transaction: [transaction-hash]
📊 Price: $205.26 (example)
📍 PriceFeed PDA: HqqVks96kxdktt3jUvmoeF9dsc9pWgXVfYG27ri8Xi6C
```

**저장해야 할 주요 주소:**

각 참가자는 고유한 주소를 받게 됩니다:

- **Oracle Program ID:** `[your-unique-oracle-program-id]` *(배포 시 생성)*
- **Price Feed PDA:** `[your-unique-price-feed-pda]` *(오라클 프로그램에서 유도)*

**⚠️ 중요:** 배포 출력에서 나온 본인 주소를 사용하세요(참가자마다 다릅니다).

**예시 주소(참고용):**
- Oracle Program ID: `9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1`
- Price Feed PDA: `HqqVks96kxdktt3jUvmoeF9dsc9pWgXVfYG27ri8Xi6C`

### Step 1.5: 환경에 오라클 Price Feed PDA 업데이트
```bash
# Step 1.4 출력의 오라클 Price Feed PDA를 .env에 추가
vim ../.env
```

**📝 무엇을 업데이트하나요:**
`ORACLE_PRICE_FEED_PDA=` 라인을 찾아 Step 1.4 출력에서 복사한 PDA로 채우세요:
```bash
# Before:
ORACLE_PRICE_FEED_PDA=

# After (use the PDA from Step 1.4 "📍 PriceFeed PDA: ..."):
ORACLE_PRICE_FEED_PDA=HqqVks96kxdktt3jUvmoeF9dsc9pWgXVfYG27ri8Xi6C
```

**📝 체크포인트:** 이제 `.env` 파일에는 본인의 Oracle Program ID와 Price Feed PDA가 포함되어야 합니다. 이 주소는 각 참가자마다 다릅니다.

---

## 🪙 Phase 2: 스테이블코인 프로그램 배포

### Step 2.1: 스테이블코인 프로그램 준비
```bash
# oracle 디렉토리에서 stablecoin program으로 이동
cd ../../cross-chain-stablecoin/stablecoin-program
```

### Step 2.2: CCIP 호환 프로그램 설정
스테이블코인 프로그램에는 두 가지 민팅 명령이 있습니다:
- `deposit_and_mint_single` - 지갑 권한용(CCIP 설정 단계)
- `deposit_and_mint_multisig` - 멀티시그 권한용(CCIP 이후 단계)

### Step 2.3: 본인 오라클을 인식하도록 스테이블코인 프로그램 업데이트(중요)
```bash
# .env에서 오라클 프로그램 ID 로드
source .env
```

```bash
# 스테이블코인 프로그램 소스 디렉토리로 이동
cd programs/stablecoin-program/src/
```

```bash
# 배포 전, 스테이블코인 프로그램이 본인 오라클을 인식하도록 업데이트
vim lib.rs

# 11번째 줄에서 다음과 유사한 라인을 찾으세요:
# const ORACLE_PROGRAM_ID: Pubkey = pubkey!("9YTvEFu2acfWURWixk16fm1mdgVbyBJY2EYdS1oKpkJ1");
# 
# 위 프로그램 ID를 .env의 본인 오라클 프로그램 ID로 교체하세요:
# const ORACLE_PROGRAM_ID: Pubkey = pubkey!("YOUR_ORACLE_PROGRAM_ID_HERE");
```

```bash
# 스테이블코인 프로그램 루트로 복귀
cd ../../..
```

**⚠️ 필수:** 스테이블코인 프로그램이 본인의 오라클 프로그램 ID를 인식해야 합니다.

### Step 2.4: 스테이블코인 프로그램 빌드/배포
```bash
# 오라클 프로그램 ID를 설정한 상태로 빌드
anchor build
```

```bash
# devnet에 배포
anchor deploy --provider.cluster devnet
```

**저장해야 할 주요 주소:**
- **Stablecoin Program ID:** `[your-stablecoin-program-id]` *(이 주소를 복사해 두세요)*

**⚠️ 중요 단계:** 배포된 프로그램 ID를 `.env`에 업데이트:
```bash
# .env에 stablecoin program ID 업데이트(PDA 유도에 필수)
vim .env
# STABLECOIN_PROGRAM_ID= 라인을 찾아 위 배포 출력의 프로그램 ID로 채우세요
# 예: STABLECOIN_PROGRAM_ID=GpBchCTBC6HbmX8j4AHfGDukuxTyvWR5BTqfosVK2SBU
```

```bash
# .env에서 stablecoin program ID 로드
source .env
```

**📝 Note:** PDA 유도는 정확한 `STABLECOIN_PROGRAM_ID`가 있어야 합니다.

### Step 2.5: 스테이블코인 민트 권한 PDA 유도
```bash
# PDA 유도 스크립트용 Node.js 의존성 설치
npm install
```

```bash
# 스테이블코인 프로그램의 민트 권한 PDA 유도(Phase 3 멀티시그에 필요)
npx ts-node utils/derive-pdas.ts
```

**💡 TypeScript 이슈?** `ts-node`가 실패하면 [TypeScript 실행 이슈](#7-typescript-execution-issues)의 `tsx` 대안을 참고하세요.

```bash
# 출력된 민트 권한 PDA를 .env에 업데이트
vim .env
# SOL_MINT_AUTHORITY_PDA= 라인을 찾아 위 출력의 PDA를 입력
```

**Expected Output:**
```
🔑 Deriving Stablecoin Program Mint Authority PDA...

📋 Stablecoin Program PDA:
   🏦 Mint Authority PDA: 9YourActualPDAAddressHere123456789

📋 Environment Variable to Update:
   SOL_MINT_AUTHORITY_PDA="9YourActualPDAAddressHere123456789"

✅ Use this PDA in your multisig creation command
```

**저장해야 할 주요 주소:**
- **Mint Authority PDA:** `9YourActualPDAAddressHere123456789` *(Phase 3 멀티시그에 필요)*

### Step 2.6: 초기 오라클 기반 스테이블코인 토큰 생성
```bash
# 환경 변수 로드
source .env
```

```bash
# 지갑 권한으로 토큰 생성(CCIP 설정에 필요)
ANCHOR_PROVIDER_URL="https://api.devnet.solana.com" \
ANCHOR_WALLET="/Users/$(whoami)/.config/solana/id.json" \
npx ts-node create-token-for-ccip.ts
```

**⚠️ 문제 해결:** "Blockhash not found" 오류는 일시적인 네트워크 이슈인 경우가 많습니다. 잠시 후 다시 시도하세요.

**Expected Output:**
```
✅ Token created successfully!
🪙 New mint address: [your-token-mint-address]
🔗 Transaction: [transaction-hash]
```

**💡 토큰 소수점(Decimals):** 이 스테이블코인은 6자리 소수(USDC와 동일)를 사용합니다. 즉 1,000,000 토큰 = 실제 1.0 토큰, 18,000,000 토큰 = 실제 18.0 토큰입니다.

**저장해야 할 주요 주소:**
- **Stablecoin Token Mint:** `[your-token-mint-address]` *(복사해 두세요)*

```bash
# 토큰 민트 및 기타 필요한 변수를 .env에 업데이트
vim .env
```

**📝 .env에서 업데이트할 항목:**
- `SOL_TOKEN_MINT=[위 토큰 민트 주소]`
- `SOL_ADMIN_WALLET=[본인 Solana 지갑 주소]`
- 없으면 추가: `CCIP_POOL_PROGRAM=41FGToCmdaWa1dgZLKFAjvmx6e6AjVTX7SVRibvsMGVB`

```bash
# 변경된 변수 로드
source .env
```

---

## 🌉 Phase 3: CCIP 통합(Solana 측)

### Step 3.1: Solana Starter Kit 설정
```bash
# stablecoin-program 디렉토리에서 기존 solana-starter-kit 서브모듈로 이동
cd ../../solana-starter-kit
```

```bash
# 의존성 설치
npm install
```

### Step 3.2: 환경 변수 로드
```bash
# 이전 단계에서 설정한 .env 로드
source .env
```

```bash
# 필수 변수 확인
echo "🪙 Token Mint: $SOL_TOKEN_MINT"
echo "🏊 Pool Program: $CCIP_POOL_PROGRAM"
```

### Step 3.3: CCIP 토큰 풀 초기화
```bash
npm run svm:pool:initialize -- \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM
```

**Expected Output:**
```
✅ POOL INITIALIZED SUCCESSFULLY
📍 Pool State PDA: [your-pool-state-pda]
📍 Pool Signer PDA: [your-pool-signer-pda]
🔗 Transaction: [transaction-hash]
```

**저장해야 할 주요 주소:**
- **Pool State PDA:** `[your-pool-state-pda]` *(복사)*
- **Pool Signer PDA:** `[your-pool-signer-pda]` *(복사)*

```bash
# 풀 주소를 .env에 업데이트
vim .env
```

**📝 .env에서 업데이트할 항목:**
- 추가: `SOL_POOL_STATE_PDA=[위 Pool State PDA]`
- 추가: `SOL_POOL_SIGNER_PDA=[위 Pool Signer PDA]`

```bash
# 변경된 변수 로드
source .env
```

### Step 3.4: CCIP 관리자 설정
```bash
# 관리자 제안
npm run svm:admin:propose-administrator -- \
  --token-mint $SOL_TOKEN_MINT \
  --administrator $SOL_ADMIN_WALLET
```

```bash
# 관리자 권한 수락
npm run svm:admin:accept-admin-role -- \
  --token-mint $SOL_TOKEN_MINT
```

### Step 3.5: SPL 토큰 멀티시그 생성(CCIP + 오라클 통합에 중요)

**⚠️ 사전 확인:** 멀티시그 생성 전에 모든 필수 주소가 설정되어 있어야 합니다:
```bash
# 환경 변수 로드
source .env

# 필수 주소 확인
echo "🔍 Verifying multisig prerequisites:"
echo "📍 Pool Signer PDA: $SOL_POOL_SIGNER_PDA"
echo "👤 Admin Wallet: $SOL_ADMIN_WALLET"
echo "🔑 Mint Authority PDA: $SOL_MINT_AUTHORITY_PDA"
```

**📝 값이 비어있다면:**
- `SOL_ADMIN_WALLET`: `solana address`로 확인 후 `.env` 업데이트
- `SOL_POOL_SIGNER_PDA`: Step 3.3(풀 초기화) 완료 필요
- `SOL_MINT_AUTHORITY_PDA`: Step 2.5(PDA 유도) 완료 필요

```bash
# 1-of-3 멀티시그 생성(Pool Signer PDA, Admin Wallet, Mint Authority PDA)
spl-token create-multisig 1 \
  $SOL_POOL_SIGNER_PDA \
  $SOL_ADMIN_WALLET \
  $SOL_MINT_AUTHORITY_PDA
```

**Expected Output:**
```
Creating 1/3 multisig [your-multisig-address] under program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA

Signature: [transaction-signature]
```

**저장해야 할 주요 주소:**
- **Multisig Address:** `[your-multisig-address]` *(다음 단계에 필요)*

### Step 3.6: 민트 권한을 멀티시그로 이전
```bash
# Step 3.5에서 나온 멀티시그 주소를 .env에 업데이트
vim .env
# 다음 라인을 실제 멀티시그 주소로 추가:
# SOL_MULTISIG_ADDRESS=[your-multisig-address-from-above]
```

```bash
# 변수 로드 후 권한 이전
source .env
spl-token authorize $SOL_TOKEN_MINT mint $SOL_MULTISIG_ADDRESS
```

### Step 3.7: Address Lookup Table (ALT) 생성
```bash
npm run svm:admin:create-alt -- \
  --token-mint $SOL_TOKEN_MINT \
  --pool-program $CCIP_POOL_PROGRAM \
  --additional-addresses $SOL_MULTISIG_ADDRESS
```

**Expected Output:**
```
✅ ALT created successfully!
ALT Address: [your-alt-address]
```

**저장해야 할 주요 주소:**
- **ALT Address:** `[your-alt-address]` *(다음 단계에 필요)*

### Step 3.8: CCIP 라우터에 풀 등록
```bash
# Step 3.7의 ALT 주소를 .env에 업데이트
vim .env
# 위 실제 ALT 주소로 추가:
# SOL_ALT_ADDRESS=[your-alt-address-from-above]
```

```bash
# 변경된 변수 로드
source .env
```

```bash
npm run svm:admin:set-pool -- \
  --token-mint $SOL_TOKEN_MINT \
  --lookup-table $SOL_ALT_ADDRESS \
  --writable-indices 3,4,7
```

---

## 🔗 Phase 4: Ethereum 측 배포

### Step 4.1: Ethereum 환경 및 자격 설정

**⚠️ 사전 준비:** 가스비용을 위한 Sepolia ETH 보유(~0.01 ETH 필요)
- **강의자에게 Sepolia ETH 요청**(권장 – 더 빠름)
- 대체: [https://faucet.chain.link/](https://faucet.chain.link/) → 지갑 연결 → Sepolia ETH 요청 → 확인 대기

```bash
# (solana-starter-kit 디렉토리에서) Hardhat 디렉토리로 이동
cd ../smart-contract-examples/ccip/cct/hardhat
```

```bash
# Hardhat용 환경 변수 로드/내보내기
set -a  # 모든 변수를 자동 export
```

```bash
source .env
```

```bash
set +a  # 자동 export 중지
```

```bash
# Ethereum 변수 확인
echo "🔗 Ethereum RPC: $ETHEREUM_SEPOLIA_RPC_URL"
```

```bash
echo "🔑 Private Key: ${PRIVATE_KEY:0:10}..." # 보안을 위해 앞 10자만 출력
```

```bash
echo "🔍 Etherscan API: ${ETHERSCAN_API_KEY:0:10}..."
```

**ℹ️ `set -a` 설명:** 이 명령은 모든 변수를 하위 프로세스(예: Hardhat)에 export하여 Node.js에서 사용 가능하도록 합니다.

**📝 자격이 비었나요?** `.env` 파일을 업데이트하세요:
```bash
# 루트에 심링크된 .env 직접 수정
vim .env
# 실제 자격 정보로 다음 라인 추가:
# PRIVATE_KEY=0x[your-64-character-private-key-here]
# ETHERSCAN_API_KEY=[your-etherscan-api-key-here]
```

```bash
# 편집 후 재로딩
source .env
```

### Step 4.2: 의존성 설치
```bash
# Node.js 의존성 설치
npm install
```

### Step 4.3: 컨트랙트 컴파일
```bash
npx hardhat compile
```

**Expected Output:**
```
Generating typings for: 57 artifacts in dir: typechain-types for target: ethers-v6
Successfully generated 172 typings!
Compiled 58 Solidity files successfully (evm target: paris).
```

### Step 4.4: 오라클 기반 스테이블코인용 ERC20 토큰 배포
```bash
npx hardhat deployToken \
  --network sepolia \
  --name "Oracle-Backed Stablecoin" \
  --symbol "OBSC" \
  --decimals 6 \
  --premint 0 \
  --maxsupply 1000000000000000
```

**Expected Output:**
```
Token deployed to: [your-ethereum-token-address]
```

**저장해야 할 주소:**
- **Ethereum Token:** `[your-ethereum-token-address]` *(복사)*

```bash
# 위 토큰 주소를 .env에 업데이트
vim .env
# ETH_TOKEN_ADDRESS= 라인을 찾아 배포 출력의 주소로 채우세요
```

```bash
# .env 업데이트 후 재로딩
source .env
```

### Step 4.5: TokenPool 배포
```bash
# 토큰 풀 배포
npx hardhat deployTokenPool \
  --network sepolia \
  --tokenaddress $ETH_TOKEN_ADDRESS \
  --pooltype burnMint \
  --localtokendecimals 6
```

**Expected Output:**
```
Token pool deployed to: [your-ethereum-token-pool-address]
```

**저장해야 할 주소:**
- **Ethereum TokenPool:** `[your-ethereum-token-pool-address]` *(복사)*

```bash
# 토큰 풀 주소를 .env에 업데이트
vim .env
# ETH_TOKEN_POOL= 라인을 찾아 배포 출력의 주소로 채우세요

# 변경사항 로드
source .env
```

### Step 4.6: Admin Role 획득 및 수락
```bash
# 어드민 권한 획득
npx hardhat claimAdmin \
  --network sepolia \
  --tokenaddress $ETH_TOKEN_ADDRESS
```

```bash
# 어드민 롤 수락
npx hardhat acceptAdminRole \
  --network sepolia \
  --tokenaddress $ETH_TOKEN_ADDRESS
```

### Step 4.7: TokenAdminRegistry에 풀 등록
```bash
npx hardhat setPool \
  --network sepolia \
  --tokenaddress $ETH_TOKEN_ADDRESS \
  --pooladdress $ETH_TOKEN_POOL
```

### Step 4.8: 교차체인 연결 구성(Ethereum → Solana)
```bash
npx hardhat applyChainUpdates \
  --network sepolia \
  --pooladdress $ETH_TOKEN_POOL \
  --remotechain solanaDevnet \
  --remotetokenaddress $SOL_TOKEN_MINT \
  --remotepooladdresses $SOL_POOL_STATE_PDA
```

---

## 🔄 Phase 5: 교차체인 구성 완료

### Step 5.1: Solana → Ethereum 연결 구성
```bash
# hardhat 디렉토리에서 solana-starter-kit로 이동
cd ../../../../solana-starter-kit
```

```bash
# 환경 변수 로드
source .env
```

```bash
# 원격 체인 구성 초기화
npm run svm:pool:init-chain-remote-config -- \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM \
  --remote-chain ethereum-sepolia \
  --token-address $ETH_TOKEN_ADDRESS \
  --decimals 6
```

**⚠️ 예상 동작:** 출력에 "Error: Chain config not found"가 보이는 것은 정상입니다(최초 생성 중). 스크립트는 계속 진행되어 구성을 성공적으로 생성합니다.

### Step 5.2: Ethereum 풀 주소 추가
```bash
npm run svm:pool:edit-chain-remote-config -- \
  --token-mint $SOL_TOKEN_MINT \
  --burn-mint-pool-program $CCIP_POOL_PROGRAM \
  --remote-chain ethereum-sepolia \
  --pool-addresses $ETH_TOKEN_POOL \
  --token-address $ETH_TOKEN_ADDRESS \
  --decimals 6
```

---

## 🚀 Phase 6: 테스트 및 토큰 작업

### Step 6.1: 최신 가격 데이터로 오라클 업데이트
```bash
# solana-starter-kit 디렉토리에서 oracle client로 이동
cd ../oracle/client
cargo run -- update-oracle
```

### Step 6.2: 오라클 기반 스테이블코인 토큰 민팅
```bash
# stablecoin program 디렉토리로 이동
cd ../../cross-chain-stablecoin/stablecoin-program
```

```bash
# 환경 변수 로드 및 기본 id.json 경로로 Anchor 지갑 설정
source .env
export ANCHOR_WALLET="/Users/$(whoami)/.config/solana/id.json"
```

**📝 `ANCHOR_WALLET` 설명:**
- **키페어 로딩**: Anchor에 서명용 지갑 파일 경로 지정
- **트랜잭션 권한**: 이 지갑이 트랜잭션 지불자/서명자
- **기본 위치**: Solana CLI 기본 지갑

```bash
# 토큰 계정 생성
spl-token create-account $SOL_TOKEN_MINT
```

```bash
# Chainlink Data Streams 기반 가격 데이터로 오라클 민팅 실행
npx ts-node mint-oracle-backed.ts
```

**Expected Output:**
```
🔮 Minting oracle-backed stablecoins...
💰 Collateral: 0.1 SOL (100,000,000 lamports)
📊 Using real SOL/USD price from Chainlink Data Streams SDK
✅ Oracle-backed minting successful!
🔗 Transaction: [transaction-hash]
💰 Tokens minted: ~[X.X] USD worth (based on current SOL price)
```

### Step 6.3: 풀 토큰 계정 생성(CCIP에 필요)
```bash
spl-token create-account $SOL_TOKEN_MINT \
  --owner $SOL_POOL_SIGNER_PDA \
  --fee-payer ~/.config/solana/id.json
```

**Expected Output:**
```
Creating account [your-pool-token-account-address]
```

**저장해야 할 주요 주소:**
- **Pool Token Account:** `[your-pool-token-account-address]` *(복사)*

```bash
# 풀 토큰 계정을 .env에 업데이트
vim .env
# 위 실제 풀 토큰 계정 주소로 추가:
# POOL_TOKEN_ACCOUNT=[your-pool-token-account-address-from-above]
```

### Step 6.4: CCIP에 토큰 권한 위임
```bash
# CCIP 작업을 위해 solana-starter-kit으로 이동
cd ../../solana-starter-kit
```

```bash
# 환경 변수 로드
source .env
```

```bash
# 토큰 권한 위임
npm run svm:token:delegate -- --token-mint $SOL_TOKEN_MINT
```

**Expected Output:**
```
✅ Token delegation successful!
Delegate: 2AjuzTy6z2webxEUu7eZ1DkAyLagZaqH2dgzhbBYjJiG (CCIP fee-billing PDA)
```

---

## 🌉 Phase 7: 교차체인 전송 실행

### Step 7.1: 교차체인 전송 실행(Solana → Ethereum)

**⚠️ 사전 확인:** 전송 실행 전, Ethereum 수신 주소가 설정되어 있어야 합니다:

```bash
# Ethereum 수신 주소 설정
vim .env
```

**📝 .env에 추가할 항목:**
- 추가: `ETH_RECEIVER_ADDRESS=[your-ethereum-wallet-address]`

**💡 중요:** 토큰 수신용 본인의 Ethereum 지갑 주소를 사용하세요.

```bash
# 변경된 변수 로드
source .env
```

```bash
# 현재 토큰 잔액 먼저 확인
spl-token balance $SOL_TOKEN_MINT
```

```bash
# 오라클로 민팅된 토큰 전송(위에서 확인한 실제 잔액으로 교체)
npm run svm:token-transfer -- \
  --token-mint $SOL_TOKEN_MINT \
  --token-amount [your-token-balance-from-above] \
  --destination-chain ethereum-sepolia \
  --receiver-address $ETH_RECEIVER_ADDRESS
```

**⚠️ 중요:** 
- 토큰 수량 지정에는 `--token-amount`를 사용하세요(`--amount` 아님)
- 수신자 지정에는 `--receiver-address`를 사용하세요(`--destination-address` 아님)

**Expected Output:**
```
✅ TOKEN TRANSFER SENT SUCCESSFULLY
EVM Receiver Address: [your-ethereum-wallet-address]
Transaction Signature: [transaction-signature]
CCIP Message ID: [ccip-message-id]
✅ Sent [your-specified-amount] tokens (preserves oracle-backed USD value)
```

**💡 매우 중요:** 정확한 USD 가치를 보존하려면 본인의 정확한 토큰 잔액을 `--token-amount`로 지정하세요. Solana에서 지정한 수량만큼 소각되고, Ethereum에서 동일 수량이 민팅됩니다.

### Step 7.3: 전송 진행 상황 모니터링
- **Solana Explorer:** https://explorer.solana.com/tx/[transaction-hash]?cluster=devnet
- **CCIP Explorer:** https://ccip.chain.link/msg/[message-id]

---

## 🧪 테스트(선택이지만 권장)

배포를 완료한 후, 모든 구성요소가 올바르게 동작하는지 확인하기 위한 포괄적인 테스트를 실행할 수 있습니다.

### 테스트 사전 준비
```bash
# oracle 디렉토리에서 stablecoin program 디렉토리로 이동
cd ../cross-chain-stablecoin/stablecoin-program
```

```bash
# 테스트 스크립트 실행 권한 부여
chmod +x test-individual.sh
```

### 테스트 카테고리

#### 오라클 통합 테스트(3개)
```bash
./test-individual.sh oracle
```
**Tests:** 실시간 Chainlink 데이터 통합 및 오라클 프로그램 기능

#### 스테이블코인 프로그램 로직 테스트(4개)
```bash
./test-individual.sh stablecoin
```
**Tests:** 프로그램 로직 검증 및 토큰 작업

#### 전체 통합 테스트(4개)
```bash
./test-individual.sh integration
```
**Tests:** 오라클 ↔ 스테이블코인 CPI 전체 동작

#### CCIP 멀티시그 권한 테스트(2개)
```bash
./test-individual.sh ccip
```
**Tests:** CCIP 작업에 대한 멀티시그 권한 검증

#### 전체 테스트 실행(총 13개)
```bash
./test-individual.sh all
```

### 예상 결과

#### ✅ **성공해야 하는 테스트 카테고리:**
- ✅ **Stablecoin Tests:** 4개 통과 - 프로그램 로직 검증  
- ✅ **CCIP Tests:** 2개 통과 - 멀티시그 권한 검증

#### ✅ **Oracle Tests (3/3 통과):**
- ✅ **Setup Test:** 멀티시그 권한 기반 민팅 생성
- ✅ **Data Structure Test:** 오라클 가격 피드 검증  
- ✅ **Integration Test:** 오라클 CPI 크로스 프로그램 호출

**모든 오라클 테스트는** Step 2.4(오라클을 인식하도록 스테이블코인 프로그램 업데이트) 완료 후 통과해야 합니다. 이는 다음을 입증합니다:

- ✅ **환경 변수 로딩 정상**(`.env`의 오라클 프로그램 ID가 올바르게 읽힘)
- ✅ **보안 제약 정상 작동**(허가된 오라클 프로그램만 허용)
- ✅ **크로스 프로그램 호출 성공**(CPI 호출 완료)

### 테스트 파라미터 및 구성

**📋 파라미터 소스:** 모든 테스트 파라미터는 `.env`에서 자동으로 로드됩니다:
- `ORACLE_PROGRAM_ID` - 배포한 오라클 프로그램
- `STABLECOIN_PROGRAM_ID` - 배포한 스테이블코인 프로그램  
- `ORACLE_PRICE_FEED_PDA` - 오라클 가격 피드 PDA
- `SOL_TOKEN_MINT` - 토큰 민트 주소
- `SOL_MULTISIG_ADDRESS` - 멀티시그 주소
- `DATASTREAMS_*` - Chainlink Data Streams 자격

**🔄 수동 구성 불필요:** 배포 시 설정한 동일한 환경 변수를 테스트에서도 사용하여 일관성을 보장합니다.

### 🎯 **모든 테스트는 통과해야 합니다**

Step 2.4(스테이블코인 프로그램이 본인 오라클을 인식하도록 업데이트)를 완료하면, 모든 테스트가 성공적으로 통과해야 합니다. 이는 오라클과 스테이블코인 프로그램이 올바르게 통합되어 동작함을 보여줍니다.

**다른 테스트가 실패한다면:** 아래 [오라클 테스트 문제 해결](#6-oracle-testing-issues) 섹션을 참고하세요.

---

## 🔧 문제 해결(Troubleshooting)

### 일반적인 이슈와 해결책

#### 1. CCIP 전송 중 "AccountNotInitialized" 오류
**해결:** 풀 토큰 계정 생성
```bash
spl-token create-account $SOL_TOKEN_MINT \
  --owner $SOL_POOL_SIGNER_PDA \
  --fee-payer ~/.config/solana/id.json
```

#### 2. 전송 중 "owner does not match" 오류
**해결:** CCIP에 토큰 권한 위임
```bash
npm run svm:token:delegate -- --token-mint $SOL_TOKEN_MINT
```

#### 3. 오라클 가격 피드를 찾을 수 없음
**해결:** 최신 데이터로 오라클 업데이트
```bash
cd ../oracle/client
cargo run -- update-oracle
```

#### 4. 멀티시그 민팅 이슈
**해결:** 올바른 멀티시그 명령을 사용했는지 확인
```bash
spl-token mint $SOL_TOKEN_MINT [amount] \
  --owner $SOL_MULTISIG_ADDRESS \
  --multisig-signer ~/.config/solana/id.json
```

#### 5. 교차체인 전송 이슈

**문제 A:** 전송이 의도한 수신자 대신 하드코딩된 기본 주소로 표시됨
**해결:** `--destination-address` 대신 `--receiver-address` 사용
```bash
# ❌ 잘못된 예 - 하드코딩 기본 주소 사용
npm run svm:token-transfer -- --destination-address $ETH_RECEIVER_ADDRESS

# ✅ 올바른 예 - 지정한 주소 사용  
npm run svm:token-transfer -- --receiver-address $ETH_RECEIVER_ADDRESS
```

**문제 B:** 지정한 수량 대신 기본 수량(10000000)이 사용됨
**해결:** `--amount` 대신 `--token-amount` 사용
```bash
# ❌ 잘못된 예 - 파라미터 무시, 기본값 사용
npm run svm:token-transfer -- --amount 18000000

# ✅ 올바른 예 - 지정한 수량 사용
npm run svm:token-transfer -- --token-amount 18000000
```

#### 6. 오라클 테스트 이슈

**문제:** `anchor test`가 배포 오류 또는 환경 변수 이슈로 실패
**원인:** 오라클 프로그램은 이미 배포되어 있는데, `anchor test`가 재배포를 시도

**해결책:**

**A. 환경 변수 로딩 이슈:**
```bash
# "ANCHOR_PROVIDER_URL is not defined"가 보인다면
# 보통 .env 심링크로 해결되지만, 필요 시:
cd ../cross-chain-stablecoin/stablecoin-program
```

```bash
# .env 심링크 존재 확인
ls -la .env .env.example
```

```bash
# 없으면 심링크 재생성
ln -sf ../../.env .env
```

```bash
ln -sf ../../.env.example .env.example
```

```bash
# 권장 테스트 스크립트 사용
yarn test # (문서의 권장 스크립트를 사용하세요)
./test-individual.sh oracle
```

**B. .env 파일 파싱 오류:**
```bash
# "parse error near '&'" 등의 메시지가 보이면
# DATASTREAMS_CLIENT_SECRET의 특수문자 따옴표 여부 확인
vim .env
# DATASTREAMS_CLIENT_SECRET= 값을 다음과 같이 따옴표로 감싸세요:
# DATASTREAMS_CLIENT_SECRET="your-secret-with-special&characters<here>"
```

**C. 오라클 프로그램 ID 불일치:**
```bash
# "AccountOwnedByWrongProgram" 또는 "ConstraintAddress" 오류가 보이면
# 보통 Step 2.3이 누락되었거나 실패한 경우입니다. 다음을 다시 실행:
cd ../cross-chain-stablecoin/stablecoin-program
```

```bash
source .env
```

```bash
# 스테이블코인 프로그램 소스 업데이트
cd programs/stablecoin-program/src/
```

```bash
sed -i '' "s/pubkey!(\"[^\"]*\")/pubkey!(\"$ORACLE_PROGRAM_ID\")/" lib.rs
```

```bash
# 재빌드 및 재배포
cd ../../..
```

```bash
anchor build && anchor deploy --provider.cluster devnet
```

**D. 권장 테스트 방법:**
```bash
# 권장: test-individual.sh 스크립트 사용
cd ../cross-chain-stablecoin/stablecoin-program
./test-individual.sh oracle      # Oracle integration tests
./test-individual.sh stablecoin  # Program logic tests  
./test-individual.sh integration # Complete CPI tests
./test-individual.sh all         # All tests together

# 대안: 오라클 클라이언트를 직접 테스트(stablecoin-program 디렉토리 기준)
cd ../../oracle/client
cargo run -- update-oracle
```

**E. 배포 계정 이슈:**
테스트 중 `AccountNotFound` 오류가 보인다면, 오라클 프로그램은 이미 배포되어 정상일 수 있습니다. 다음으로 확인:
```bash
source .env
solana program show $ORACLE_PROGRAM_ID
```

#### 7. TypeScript 실행 이슈

**문제:** `ts-node`가 "Unknown file extension .ts" 오류로 실패
**해결:** 최신 대안인 `tsx` 사용

```bash
# tsx 설치
npm install -D tsx

# ts-node 명령을 tsx로 대체:
npx tsx utils/derive-pdas.ts           # Instead of: npx ts-node utils/derive-pdas.ts
npx tsx create-token-for-ccip.ts       # Instead of: npx ts-node create-token-for-ccip.ts  
npx tsx mint-oracle-backed.ts          # Instead of: npx ts-node mint-oracle-backed.ts
```

#### 8. CLI 프롬프트 이슈

**vim에서 막힘:** `Esc` → `:wq` → Enter  
**키 생성 프롬프트:** Enter(빈 패스프레이즈), `y`(덮어쓰기)

#### 9. 토큰 수량 혼동

**문제:** 18,000,000 같은 큰 숫자가 이상해 보임
**설명:** 토큰은 6자리 소수(Decimals)를 사용합니다. 실제 값은 1,000,000으로 나누세요
- 18,000,000 토큰 = 실제 18.0 토큰
- 1,000,000 토큰 = 실제 1.0 토큰

---

