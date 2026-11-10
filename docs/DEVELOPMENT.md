# Development Guide

## Local Extension & Backend Setup

### Prerequisites
- Node.js >= 20
- pnpm >= 10

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run Extension Development Build
```bash
pnpm run dev
```

### 3. Run Backend API Server Locally
```bash
# Terminal 2
DATABASE_URL="postgresql://localhost:5432/secureauth_db" pnpm run server:dev
```

### 4. Running Verification Checks
```bash
pnpm run typecheck    # TypeScript verification
pnpm run test         # Vitest test suite (Unit, Crypto, Backend, Security)
pnpm run build        # Build extension package
pnpm audit            # Security audit
```

