# Celo AI Automator

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)

**Advanced AI-powered Celo blockchain automation monorepo with LangChain orchestration**

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## 🌟 Overview

Celo AI Automator is a comprehensive, production-ready platform for building AI-powered autonomous agents on the Celo blockchain. It provides a complete toolkit for blockchain automation, including multi-chain support, intelligent AI agents, dynamic smart contract deployment, and advanced testing capabilities.

## ✨ Features

### 🤖 AI-Powered Automation
- **LangChain Integration**: Advanced AI orchestration with LangChain
- **Multi-Agent System**: Treasury Manager, Donation Splitter, Yield Optimizer, NFT Minter, Governance Participant
- **Natural Language Processing**: Convert natural language instructions into blockchain transactions
- **Intelligent Decision Making**: AI-powered risk assessment and transaction validation

### 🌐 Multi-Chain Support
- **Supported Chains**: Ethereum, Polygon, BSC, Arbitrum, Optimism, Celo, Base, Avalanche, and more
- **Intelligent Routing**: Automatic failover and load balancing
- **Chain Health Monitoring**: Real-time chain status and performance tracking
- **Cross-Chain Operations**: Seamless multi-chain transaction management

### 📝 Smart Contract Management
- **Dynamic Deployment**: Deploy and manage smart contracts on-the-fly
- **Contract Factory**: Automated contract compilation and deployment
- **ABI Management**: Automatic ABI generation and management
- **Gas Optimization**: Built-in gas estimation and optimization

### 🔒 Security & Compliance
- **Data Masking**: Automatic sanitization of sensitive data in logs and errors
- **Encryption Utilities**: Secure encryption, hashing, and token management
- **GDPR Compliance**: Built-in utilities for data privacy compliance
- **Risk Assessment**: Pre-transaction validation and risk scoring
- **Spending Limits**: Configurable daily and per-transaction limits

### 🧪 Testing & Development
- **Postman Integration**: Comprehensive API testing with Postman protocol
- **Test Automation**: Automated test suite with coverage reporting
- **CI/CD Pipeline**: GitHub Actions for automated testing and deployment
- **Type Safety**: Full TypeScript support with strict type checking

### 📊 Monitoring & Observability
- **Health Checks**: Comprehensive health monitoring for all services
- **Performance Metrics**: Real-time performance tracking and analytics
- **Error Tracking**: Detailed error logging with context preservation
- **Structured Logging**: Optional Winston/Pino integration

### 🛠️ Developer Experience
- **Modular Architecture**: Tree-shakeable exports for optimal bundle size
- **CLI Tools**: Comprehensive command-line interface
- **REST API**: Full-featured REST API with Swagger documentation
- **TypeScript First**: Complete TypeScript support with type definitions

## 🏗️ Architecture

```
celo-automator/
├── Backend/
│   ├── sdk/                 # Core SDK package (@celo-ai/sdk)
│   ├── agents/             # AI agent implementations
│   ├── services/           # Backend services
│   ├── middleware/         # Express middleware
│   └── routes/             # API routes
├── blockchain/
│   ├── packages/
│   │   ├── contracts/     # Smart contracts (Solidity)
│   │   ├── core/          # Core library package
│   │   └── api/           # REST API package
├── apps/
│   ├── backend/           # Backend API application
│   └── cli/               # CLI application
└── packages/
    ├── celo-functions/    # Celo-specific functions
    ├── langchain-agent/   # LangChain agent integration
    ├── core/              # Core utilities
    └── types/             # Shared TypeScript types
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **pnpm** 8.0.0 or higher (recommended) or npm/yarn
- **TypeScript** 5.3.0 or higher
- **Celo Wallet** with testnet tokens (for testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/celo-ai-agents/celo-automator.git
cd celo-automator

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# Celo Configuration
CELO_PRIVATE_KEY=your_private_key
CELO_NETWORK=alfajores
CELO_RPC_URL=https://alfajores-forno.celo-testnet.org

# AI Configuration
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key

# Server Configuration
PORT=3000
NODE_ENV=development

# Optional: Advanced Features
ALCHEMY_API_KEY=your_alchemy_key
ENABLE_MULTI_CHAIN=true
ENABLE_TESTING=true
```

### Basic Usage

#### Using the SDK

```typescript
import { CeloAISDK } from '@celo-ai/sdk';

// Initialize the SDK
const sdk = new CeloAISDK({
  apiKey: 'your-api-key',
  privateKey: 'your-private-key',
  network: 'alfajores',
  enableMultiChain: true,
});

await sdk.initialize();

// Create an AI agent
const agentId = await sdk.createAgent({
  type: 'treasury',
  name: 'Treasury Manager',
  description: 'Manages portfolio allocation and risk',
  capabilities: ['analyze_portfolio', 'rebalance', 'risk_assessment'],
});

// Process with agent
const response = await sdk.processWithAgent(
  agentId,
  'Analyze my portfolio and suggest rebalancing'
);
```

#### Using the REST API

```bash
# Start the backend server
cd apps/backend
pnpm dev

# API will be available at http://localhost:3000
# Swagger docs at http://localhost:3000/api-docs
```

#### Using the CLI

```bash
# Install CLI globally
npm install -g @celo-ai/sdk

# Initialize SDK
celo-ai init --api-key YOUR_KEY --network alfajores

# Create an agent
celo-ai agent create --type defi --name "DeFi Optimizer"

# Query an agent
celo-ai agent query agent_123 "Find best yield opportunities"
```

## 📚 Documentation

### Core Packages

- **[SDK Documentation](./Backend/sdk/README.md)**: Complete SDK reference
- **[Blockchain Library](./blockchain/README.md)**: Smart contracts and core library
- **[CLI Documentation](./apps/cli/README.md)**: Command-line interface guide
- **[API Documentation](./blockchain/packages/api/README.md)**: REST API reference

### Key Features

- **[AI Agents](./docs/agents.md)**: Guide to creating and using AI agents
- **[Multi-Chain Support](./docs/multi-chain.md)**: Working with multiple blockchains
- **[Security](./docs/security.md)**: Security best practices and features
- **[Testing](./docs/testing.md)**: Testing guide and examples

## 🎯 Use Cases

### 1. Treasury Management
Automatically manage organizational treasuries with intelligent fund allocation, rebalancing, and risk assessment.

### 2. DeFi Automation
Optimize yield farming, liquidity provision, and DeFi strategy execution across multiple protocols.

### 3. NFT Operations
Automate NFT minting, distribution, and management based on events or conditions.

### 4. Governance Participation
Participate in DAO governance with AI-powered proposal analysis and voting.

### 5. Donation Processing
Automatically split and process donations to multiple recipients with thank-you notifications.

## 🔧 Development

### Scripts

```bash
# Development
pnpm dev              # Start all services in development mode
pnpm build            # Build all packages
pnpm lint             # Run linting across all packages
pnpm format           # Format code with Prettier

# Testing
pnpm test             # Run all tests
pnpm test:coverage    # Run tests with coverage
pnpm test:watch       # Run tests in watch mode

# Type Checking
pnpm type-check       # Type check all TypeScript files

# Cleanup
pnpm clean            # Clean all build artifacts
```

### Project Structure

- **Monorepo**: Managed with Turborepo for efficient builds
- **Package Manager**: pnpm for fast, disk-efficient package management
- **TypeScript**: Strict type checking enabled across all packages
- **Linting**: ESLint with Prettier for code quality

### Adding a New Package

1. Create package directory in appropriate location
2. Add `package.json` with proper configuration
3. Update `pnpm-workspace.yaml` if needed
4. Add to `turbo.json` for build pipeline
5. Update root `package.json` scripts if needed

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`pnpm test`)
6. Run linting (`pnpm lint`)
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier with consistent configuration
- **Testing**: Jest for unit tests, comprehensive coverage expected
- **Documentation**: JSDoc comments for all public APIs

## 📊 Project Status

### ✅ Completed Features

- [x] Core SDK with multi-chain support
- [x] AI agent system with LangChain integration
- [x] Dynamic smart contract deployment
- [x] REST API with Swagger documentation
- [x] CLI tools for development
- [x] Comprehensive testing suite
- [x] Security features (data masking, encryption)
- [x] CI/CD pipeline with GitHub Actions
- [x] TypeScript support across all packages

### 🚧 In Progress

- [ ] Enhanced DeFi protocol integrations
- [ ] Mobile SDK
- [ ] Advanced analytics dashboard
- [ ] Cross-chain bridge support

### 📋 Planned

- [ ] Institutional features
- [ ] Enterprise dashboard
- [ ] API marketplace
- [ ] Multi-signature wallet support

## 🔐 Security

### Security Features

- **Data Masking**: Automatic redaction of sensitive data
- **Encryption**: Secure encryption utilities for sensitive data
- **Risk Assessment**: Pre-transaction validation
- **Spending Limits**: Configurable transaction limits
- **Audit Trail**: Complete action logging

### Reporting Security Issues

Please report security vulnerabilities to [security@celo-ai.com](mailto:security@celo-ai.com). See our [Security Policy](./SECURITY.md) for more details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the Celo ecosystem
- Powered by LangChain for AI orchestration
- Uses Viem for blockchain interactions
- TypeScript for type safety

## 📞 Support

- **Documentation**: [docs.celo-ai.com](https://docs.celo-ai.com)
- **GitHub Issues**: [Report bugs and feature requests](https://github.com/celo-ai-agents/celo-automator/issues)
- **Discord**: [Join our community](https://discord.gg/celo-ai)
- **Email**: [dev@celo-ai.com](mailto:dev@celo-ai.com)

## 🌟 Star History

If you find this project useful, please consider giving it a star ⭐!

---

<div align="center">

**Built with ❤️ for the Celo ecosystem**

[Website](https://celo-ai.com) • [Documentation](https://docs.celo-ai.com) • [Discord](https://discord.gg/celo-ai) • [Twitter](https://twitter.com/celo_ai)

</div>
