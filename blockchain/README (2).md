# Celo AI Agent Library

A comprehensive TypeScript library for building AI-powered autonomous agents on the Celo blockchain. Provides secure transaction management, NFT operations, and intelligent agent capabilities for developers.

## 🚀 Features

- **AI-Powered Decision Making**: Uses OpenAI GPT-4 or Anthropic Claude for intelligent decision-making
- **Pre-built Agent Templates**: Treasury Manager, Donation Splitter, Yield Optimizer, NFT Minter, Governance Participant
- **Celo Blockchain Integration**: Full support for Celo mainnet and Alfajores testnet
- **Safety & Validation**: Built-in spending limits, whitelist/blacklist, and risk assessment
- **Developer-Friendly API**: Clean functional interface with TypeScript support
- **Event Monitoring**: Real-time blockchain event detection and processing
- **DeFi Protocol Support**: Integration with Moola, Ubeswap, and other Celo DeFi protocols

## 📊 Live Deployment Status

### ✅ Successfully Deployed Contracts on Celo Alfajores Testnet

Our smart contracts are live and functional on the Celo testnet:

**Contract Deployment Details:**
- **AgentRegistry**: `0x28d19bce67566423719B2E471f578b765F4375BA`
  - Transaction: `0xe0ea61d187d2626742554a58ce5ba1f3ac47b6c92ea673db678da0c03a4a2e13`
  - Block: 60447833
  - Gas Used: 1,793,298
  - Status: ✅ Success

- **AgentTreasury**: `0x52F3f3C2d1610454E6c3345b5E02DA767dC4f4D2`
  - Transaction: `0x1ee24ac3f85a71dc0f3c1e2b2dc827fc894f0cd8e7463a82510b4fee37c980bb`
  - Block: 60447840
  - Gas Used: 2,468,811
  - Status: ✅ Success

- **AttendanceNFT**: `0xeD42659476443dE01d113322E156913EA056332F`
  - Transaction: `0x0c622edcbb59a5d4f51624e2ed0d0ccda4476a76a01380743ec5dab79391774a`
  - Block: 60447847
  - Gas Used: 3,080,093
  - Status: ✅ Success

**View on Celo Explorer:**
- [AgentRegistry Contract](https://alfajores.celoscan.io/address/0x28d19bce67566423719B2E471f578b765F4375BA)
- [AgentTreasury Contract](https://alfajores.celoscan.io/address/0x52F3f3C2d1610454E6c3345b5E02DA767dC4f4D2)
- [AttendanceNFT Contract](https://alfajores.celoscan.io/address/0xeD42659476443dE01d113322E156913EA056332F)

**Transaction Verification:**
All contracts have been successfully deployed with confirmed transactions showing:
- ✅ Contract creation transactions confirmed
- ✅ Gas optimization achieved (smaller contract sizes)
- ✅ Modular architecture implemented
- ✅ Independent contract management enabled

## 📦 Architecture

```
/celo-ai-agents/
├── packages/
│   ├── contracts/          # Smart contracts (Solidity)
│   └── core/              # Main library package (TypeScript)
├── examples/              # Usage examples
├── docs/                  # Developer documentation
└── tests/                 # Integration tests
```

## 🛠️ Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Celo wallet with testnet tokens (for testing)
- Alchemy API key (for enhanced security features)

### Install the Package

```bash
npm install @celo-ai-agents/core
```

### Quick Start

```typescript
import { 
  createCeloAgent, 
  analyzeTransactionSecurity, 
  mintNFT 
} from '@celo-ai-agents/core';

// Initialize agent
const agent = createCeloAgent({
  privateKey: '0x...',
  network: 'alfajores',
  alchemyApiKey: 'your-api-key'
});

// Analyze transaction security
const security = await analyzeTransactionSecurity({
  to: '0x...',
  value: '1000000000000000000'
});

// Mint NFT
const nft = await mintNFT({
  contractAddress: '0x...',
  recipient: '0x...',
  metadata: { name: 'My NFT' }
});
```

## 🔨 Hardhat Integration

The library includes comprehensive Hardhat integration for smart contract development:

```typescript
import { 
  deployHardhatContract, 
  getContract, 
  callContractFunction,
  sendContractTransaction,
  verifyHardhatContract,
  getNetworkInfo
} from '@celo-ai-agents/core';

// Deploy a contract
const deployment = await deployHardhatContract({
  network: 'alfajores',
  privateKey: '0x...',
  rpcUrl: 'https://alfajores-forno.celo-testnet.org'
}, 'AgentRegistry', []);

// Interact with deployed contract
const contract = await getContract(config, 'AgentRegistry', deployment.contractAddress);
const result = await callContractFunction(config, 'AgentRegistry', address, 'getAgentCount');
```

**Hardhat Features:**
- ✅ Contract deployment and interaction
- ✅ Network configuration for Celo/Alfajores
- ✅ Contract verification on block explorers
- ✅ Gas optimization and reporting
- ✅ Testing integration
- ✅ TypeScript support

## 🌐 REST API

The project includes a comprehensive REST API for automated blockchain processes:

```bash
# Start the API server
npm run api:dev

# API Documentation: http://localhost:3000/api-docs
# Health Check: http://localhost:3000/health
```

**API Features:**
- ✅ Smart contract deployment and management
- ✅ AI agent creation and execution
- ✅ NFT minting and operations
- ✅ Transaction security analysis
- ✅ Batch operations support
- ✅ Comprehensive Swagger documentation
- ✅ Rate limiting and security
- ✅ Health monitoring

**Example API Usage:**
```typescript
// Deploy a contract via API
const response = await fetch('http://localhost:3000/api/v1/contracts/deploy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    network: 'alfajores',
    privateKey: '0x...',
    contractName: 'AgentRegistry',
    constructorArgs: []
  })
});

const result = await response.json();
console.log('Contract deployed:', result.data.contractAddress);
```

## 🤖 Available Agents

### 1. Treasury Manager Agent

**Purpose**: Manages organizational treasury with intelligent fund allocation

**Features**:
- Monitor multi-token balances (cUSD, cEUR, CELO)
- Detect imbalances based on target allocation
- Execute swaps via DeFi protocols to rebalance
- Generate treasury reports
- Alert on unusual activity

**Configuration**:
- Target allocation percentages
- Rebalancing threshold
- Spending limits
- Execution mode (auto/propose)

### 2. Donation Splitter Agent

**Purpose**: Automatically splits incoming donations to multiple recipients

**Features**:
- Monitor wallet for incoming transactions
- Identify donation transactions
- Calculate split amounts based on percentages
- Execute batch transfers
- Send thank-you notifications
- Generate donation reports

**Configuration**:
- Recipient addresses and percentages
- Minimum donation threshold
- Supported tokens
- Thank you message template

### 3. Yield Optimizer Agent

**Purpose**: Maximizes yield across Celo DeFi protocols

**Features**:
- Query APYs across DeFi protocols
- Analyze risk/reward profiles
- Execute deposits/withdrawals
- Claim and compound rewards
- Monitor for better opportunities
- Emergency exit on risk events

**Configuration**:
- Risk tolerance level
- Allowed protocols
- Rebalancing frequency
- Compounding settings

### 4. NFT Minter Agent

**Purpose**: Autonomously mints NFTs based on events or conditions

**Features**:
- Listen for trigger events
- Validate eligibility criteria
- Generate NFT metadata with AI
- Mint NFTs to recipients
- Track minting history
- Handle failures and retries

**Configuration**:
- Trigger conditions
- NFT contract address
- Metadata templates
- Eligibility rules

### 5. Governance Participation Agent

**Purpose**: Participates in Celo governance based on principles

**Features**:
- Monitor governance proposals
- Analyze proposal content and impact
- Vote according to principles
- Delegate voting power strategically
- Generate voting rationale reports

**Configuration**:
- Voting principles
- Research settings
- Delegation preferences
- Notification channels

## 🔧 Usage

### Basic Setup

1. **Configure Credentials**:
   - Celo Wallet: Private key, network, contract addresses
   - OpenAI: API key, model selection

2. **Create Agent Node**:
   - Drag the desired agent node into your workflow
   - Configure the agent parameters
   - Set execution mode (auto/propose)

3. **Connect to Workflow**:
   - Connect triggers (webhooks, schedules, etc.)
   - Add processing nodes
   - Set up notifications

### Example Workflow: Treasury Rebalancing

```
[Schedule Trigger: Daily 9am]
  → [Treasury Manager Agent]
  → [IF: Action Proposed]
    → [Send Slack Notification]
    → [Wait for Approval]
    → [Execute Transaction]
  → [Log to Google Sheets]
```

### Example Workflow: Donation Processing

```
[Webhook: Celo Transaction Monitor]
  → [Donation Splitter Agent]
  → [Split: Multiple Recipients]
  → [Send Thank You Email]
  → [Update Donor Database]
  → [Generate Receipt NFT]
```

## 🔐 Security Features

### Spending Limits
- Daily spending caps per agent
- Per-transaction limits
- Automatic limit enforcement

### Address Controls
- Whitelist approved recipients
- Blacklist blocked addresses
- Contract interaction validation

### Risk Assessment
- Pre-transaction validation
- LLM-based risk scoring
- Emergency pause functionality

### Audit Trail
- Complete action logging
- Transaction receipts
- Decision explanations
- Performance metrics

## 🧪 Testing

### Deploy Contracts

```bash
cd packages/contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy-all.ts --network alfajores
```

### Setup Demo Data

```bash
npx hardhat run scripts/setup-demo.ts --network alfajores
```

### Test Agents

```bash
cd packages/core
npm test
```

## 📊 Monitoring

### Agent Performance
- Success rate tracking
- Gas usage optimization
- Cost savings analysis
- Failure reason analysis

### Real-time Alerts
- Spending limit breaches
- Failed transactions
- Unusual activity patterns
- System health status

## 🔗 Integration

### Supported Platforms
- n8n (primary)
- Zapier (via webhooks)
- Make.com (via webhooks)
- Custom applications (via API)

### DeFi Protocols
- Moola (lending/borrowing)
- Ubeswap (DEX)
- Curve (stable swaps)
- Mento (stability protocol)

### External Services
- Telegram notifications
- Email alerts
- Slack integration
- Google Sheets logging
- Webhook endpoints

## 📚 Documentation

### Smart Contracts
- [Contract Architecture](./docs/contracts.md)
- [API Reference](./docs/api.md)
- [Security Considerations](./docs/security.md)

### Agent Development
- [Creating Custom Agents](./docs/custom-agents.md)
- [LLM Integration](./docs/llm-integration.md)
- [Testing Guide](./docs/testing.md)

### Deployment
- [Production Setup](./docs/deployment.md)
- [Monitoring Guide](./docs/monitoring.md)
- [Troubleshooting](./docs/troubleshooting.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🆘 Support

- Documentation: [docs.celo-ai-agents.com](https://docs.celo-ai-agents.com)
- Discord: [Celo AI Agents Community](https://discord.gg/celo-ai-agents)
- GitHub Issues: [Report bugs and feature requests](https://github.com/celo-ai-agents/issues)

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Core agent framework
- ✅ Basic agent templates
- ✅ n8n integration
- ✅ Celo blockchain support

### Phase 2 (Q2 2024)
- 🔄 Advanced DeFi integrations
- 🔄 Multi-chain support
- 🔄 Enhanced AI capabilities
- 🔄 Mobile app

### Phase 3 (Q3 2024)
- 📋 Cross-chain agents
- 📋 Institutional features
- 📋 Enterprise dashboard
- 📋 API marketplace

---

**Built with ❤️ for the Celo ecosystem**
