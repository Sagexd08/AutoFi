#!/bin/bash

# AutoFi Quick Start Script
# Sets up and runs the complete end-to-end system

set -e

echo "🚀 AutoFi Quick Start"
echo "===================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo "${BLUE}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# Check pnpm
echo ""
echo "${BLUE}Checking pnpm...${NC}"
if ! command -v pnpm &> /dev/null; then
  echo "❌ pnpm is not installed. Install with: npm install -g pnpm"
  exit 1
fi
echo "✅ pnpm $(pnpm -v)"

# Install dependencies
echo ""
echo "${BLUE}Installing dependencies...${NC}"
pnpm install

# Check environment files
echo ""
echo "${BLUE}Checking environment configuration...${NC}"

if [ ! -f "env.unified" ]; then
  echo "${YELLOW}⚠️  env.unified not found. Creating template...${NC}"
  cat > env.unified << 'EOF'
# Shared Environment Variables

# Server Configuration
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug

# Celo Network (alfajores testnet / mainnet)
CELO_NETWORK=alfajores
CELO_RPC_URL=https://alfajores-forno.celo-testnet.org
CELO_PRIVATE_KEY=0x... (REPLACE WITH YOUR PRIVATE KEY)
CELO_CHAIN_ID=44787

# Database
DATABASE_URL=file:./data/dev.db

# Security
JWT_SECRET=your-secret-key-min-32-characters-long
CORS_ORIGIN=http://localhost:3000

# Features
ENABLE_SIMULATION=true
ENABLE_REAL_EXECUTION=false
ENABLE_GAS_OPTIMIZATION=true
EOF
  echo "${YELLOW}⚠️  Please update env.unified with your configuration!${NC}"
fi

if [ ! -f "apps/backend/.env" ]; then
  cp env.unified apps/backend/.env
  echo "✅ Created backend .env file"
fi

if [ ! -f "Frontend/.env.local" ]; then
  cat > Frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
EOF
  echo "✅ Created frontend .env.local file"
fi

# Setup database
echo ""
echo "${BLUE}Setting up database...${NC}"
cd apps/backend
pnpm db:generate
pnpm db:migrate || echo "⚠️  Migration may already be applied"
pnpm db:init
cd ../..
echo "✅ Database initialized"

# Type checking
echo ""
echo "${BLUE}Running type checks...${NC}"
pnpm type-check
echo "✅ Type checks passed"

# Display next steps
echo ""
echo "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "${BLUE}To start the development servers:${NC}"
echo ""
echo "  ${YELLOW}Terminal 1 - Backend:${NC}"
echo "    cd apps/backend && pnpm dev"
echo ""
echo "  ${YELLOW}Terminal 2 - Frontend:${NC}"
echo "    cd Frontend && pnpm dev"
echo ""
echo "${BLUE}URLs:${NC}"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001"
echo "  API Docs: http://localhost:3001/api/health"
echo ""
echo "${BLUE}Quick Links:${NC}"
echo "  📖 Setup Guide: BACKEND_SETUP.md"
echo "  🏗️  Architecture: ARCHITECTURE.md"
echo "  📝 README: README.md"
echo ""
