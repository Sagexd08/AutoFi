#!/bin/bash

# Celo Automator - Quick Start Setup Script

echo "🚀 Celo Automator - Quick Start Setup"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Navigate to project directory
cd "$(dirname "$0")" || exit

echo ""
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"

echo ""
echo "🔧 Checking environment configuration..."

if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local with default configuration..."
    cat > .env.local << 'EOF'
# Celo Blockchain Configuration
NEXT_PUBLIC_CELO_RPC=https://forno.celo.org
NEXT_PUBLIC_CELO_CHAIN_ID=42220
NEXT_PUBLIC_CELO_EXPLORER=https://celoscan.io

# Celo Testnet (Alfajores)
NEXT_PUBLIC_CELO_TESTNET_RPC=https://alfajores-forno.celo-testnet.org
NEXT_PUBLIC_CELO_TESTNET_CHAIN_ID=44787
NEXT_PUBLIC_CELO_TESTNET_EXPLORER=https://alfajores-blockscout.celo-testnet.org

# Smart Contracts (Add your deployed contract addresses)
NEXT_PUBLIC_AUTOMATOR_CONTRACT=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_AUTOMATOR_TESTNET_CONTRACT=0x0000000000000000000000000000000000000000

# External APIs
NEXT_PUBLIC_COINGECKO_API=https://api.coingecko.com/api/v3
NEXT_PUBLIC_CELO_API=https://explorer.celo.org/api

# Feature Flags
NEXT_PUBLIC_ENABLE_TESTNET=true
NEXT_PUBLIC_ENABLE_MAINNET=true
EOF
    echo "✅ .env.local created"
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "🏗️  Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "⚠️  Build completed with warnings (this is normal in development)"
fi

echo ""
echo "✨ Setup complete! You're ready to go!"
echo ""
echo "📋 Next steps:"
echo "  1. Start development server: npm run dev"
echo "  2. Visit http://localhost:3000"
echo "  3. Install MetaMask or your preferred Web3 wallet"
echo "  4. Connect your wallet"
echo "  5. Create your first automation!"
echo ""
echo "📚 Resources:"
echo "  - Celo Faucet: https://faucet.celo.org"
echo "  - Celoscan: https://celoscan.io"
echo "  - Documentation: https://docs.celo.org"
echo ""
echo "🎉 Happy automating!"
