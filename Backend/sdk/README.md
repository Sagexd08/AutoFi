# Celo AI SDK

A comprehensive TypeScript SDK for multi-chain blockchain automation with AI agents, dynamic smart contracts, and advanced testing capabilities.

## Features

- 🌐 **Multi-Chain Support**: Ethereum, Polygon, BSC, Arbitrum, Optimism, Celo, Base, Avalanche, and more
- 🤖 **AI Agents**: Intelligent automation with Gemini AI integration
- 📝 **Dynamic Contracts**: Deploy and manage smart contracts dynamically
- ⚖️ **Load Balancing**: Intelligent transaction routing and failover
- 🧪 **API Testing**: Postman protocol integration for comprehensive testing
- 🔒 **Security**: Built-in validation, error handling, and risk assessment
- 📊 **Monitoring**: Health checks, metrics, and performance tracking

## Installation

```bash
npm install @celo-ai/sdk
```

## Quick Start

### Using CeloAISDK

```typescript
import { CeloAISDK } from '@celo-ai/sdk';

// Initialize the SDK
const sdk = new CeloAISDK({
  apiKey: 'your-api-key',
  privateKey: 'your-private-key',
  network: 'ethereum',
  enableMultiChain: true,
  enableTesting: true,
});

// Initialize the SDK
await sdk.initialize();

// Create an AI agent
const agentId = await sdk.createAgent({
  type: 'treasury',
  name: 'Treasury Manager',
  description: 'Manages portfolio allocation and risk',
  capabilities: ['analyze_portfolio', 'rebalance', 'risk_assessment'],
});

// Process with agent
const response = await sdk.processWithAgent(agentId, 'Analyze my portfolio');

// Deploy a smart contract
const deployment = await sdk.deployContract({
  name: 'MyContract',
  version: '1.0.0',
  source: 'contract MyContract { ... }',
  abi: [...],
  bytecode: '0x...',
});

// Send a transaction
const txResponse = await sdk.sendTransaction({
  to: '0x...',
  value: '1000000000000000000', // 1 ETH
  gasLimit: '21000',
});
```

### Using AutoFi SDK

The AutoFi SDK is a branded wrapper around CeloAISDK that provides the same functionality with AutoFi branding:

```typescript
import { AutoFiSDK } from '@celo-ai/sdk/autofi';

// Initialize AutoFi SDK
const autofiSDK = new AutoFiSDK({
  apiKey: 'your-api-key',
  privateKey: 'your-private-key',
  network: 'ethereum',
  enableMultiChain: true,
});

// All CeloAISDK methods are available
await autofiSDK.initialize();
const agentId = await autofiSDK.createAgent({ /* ... */ });

// Note: initialize() and initializeChains() are interchangeable methods
```

Or use the main export:

```typescript
import AutoFiSDK from '@celo-ai/sdk/autofi';
```

## Multi-Chain Support

The SDK supports multiple blockchain networks with intelligent routing:

```typescript
// Get supported chains
const chains = await sdk.getSupportedChains();

// Check chain health
const isHealthy = await sdk.getChainHealth('ethereum');

// Send transaction on specific chain
const txResponse = await sdk.sendTransaction(
  { to: '0x...', value: '1000000000000000000' },
  'polygon' // Specify chain
);

// Get token balance on specific chain
const balance = await sdk.getTokenBalance(
  '0x...',
  '0x...',
  'bsc' // Binance Smart Chain
);
```

## AI Agents

Create and manage intelligent AI agents:

```typescript
// Available agent types
const agentTypes = [
  'treasury',    // Portfolio management
  'defi',        // DeFi optimization
  'nft',         // NFT operations
  'governance',  // DAO governance
  'security',    // Security auditing
  'analytics',   // Data analysis
];

// Create agent with custom context
const agentId = await sdk.createAgent({
  type: 'defi',
  name: 'DeFi Optimizer',
  description: 'Optimizes DeFi strategies',
  capabilities: ['find_yield', 'execute_swaps', 'liquidity_management'],
  context: {
    maxSlippage: 0.5,
    preferredDEX: 'uniswap',
  },
});

// Process complex requests
const response = await sdk.processWithAgent(
  agentId,
  'Find the best yield farming opportunities on Ethereum',
  { maxRisk: 0.3, minAPY: 0.05 }
);
```

## Dynamic Smart Contracts

Deploy and manage smart contracts dynamically:

```typescript
// Deploy a contract
const deployment = await sdk.deployContract({
  name: 'TokenContract',
  version: '1.0.0',
  source: `
    pragma solidity ^0.8.0;
    contract TokenContract {
      mapping(address => uint256) public balances;
      
      function transfer(address to, uint256 amount) public {
        balances[msg.sender] -= amount;
        balances[to] += amount;
      }
    }
  `,
  abi: [...], // Generated ABI
  bytecode: '0x...', // Compiled bytecode
  constructorArgs: ['TokenName', 'TKN', 18],
  gasLimit: '2000000',
});

// Get deployed contract
const contract = await sdk.getContract(
  deployment.contractAddress,
  deployment.abi
);
```

## API Testing with Postman

Comprehensive testing capabilities with Postman integration:

```typescript
// Create test collection
const collectionId = await sdk.createTestCollection(
  'API Tests',
  'Comprehensive API test suite'
);

// Run tests
const testResults = await sdk.runTests();

// Test results include:
// - Request/response details
// - Assertion results
// - Performance metrics
// - Error details
```

## Load Balancing & Proxy

Intelligent load balancing and proxy server:

```typescript
// Start proxy server
await sdk.startProxyServer();

// The SDK automatically:
// - Routes requests to healthiest chains
// - Implements circuit breaker patterns
// - Provides failover mechanisms
// - Monitors performance metrics
```

## Configuration

```typescript
interface SDKConfig {
  apiKey?: string;
  privateKey?: string;
  network?: string;
  rpcUrl?: string;
  enableRealTransactions?: boolean;
  maxRiskScore?: number;
  requireApproval?: boolean;
  enableSimulation?: boolean;
  enableGasOptimization?: boolean;
  enableMultiChain?: boolean;
  enableProxy?: boolean;
  enableTesting?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}
```

## Error Handling

Comprehensive error handling with detailed error information:

```typescript
try {
  const response = await sdk.sendTransaction(request);
} catch (error) {
  console.error('Transaction failed:', error.message);
  console.error('Error code:', error.code);
  console.error('Error details:', error.details);
}
```

## Event System

Listen to SDK events:

```typescript
sdk.on('transactionSent', (data) => {
  console.log('Transaction sent:', data.txHash);
});

sdk.on('agentResponse', (data) => {
  console.log('Agent response:', data.response);
});

sdk.on('contractDeployed', (data) => {
  console.log('Contract deployed:', data.contractAddress);
});

sdk.on('testCompleted', (data) => {
  console.log('Test completed:', data.testName);
});
```

## Health Monitoring

Monitor SDK health and performance:

```typescript
// Check overall health
const health = await sdk.healthCheck();
console.log('SDK Health:', health.healthy);
console.log('Services:', health.services);

// Get chain health
const chainHealth = await sdk.getAllChainHealth();
console.log('Chain Health:', chainHealth);
```

## Development

### Prerequisites

- Node.js 18+
- TypeScript 5+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/celo-ai/sdk.git
cd sdk

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

### Scripts

- `npm run build` - Build the project
- `npm run dev` - Development mode with watch
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run docs` - Generate documentation
- `npm run clean` - Clean build artifacts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Documentation: [https://docs.celo-ai.com](https://docs.celo-ai.com)
- Issues: [GitHub Issues](https://github.com/celo-ai/sdk/issues)
- Discord: [Celo AI Community](https://discord.gg/celo-ai)

## Changelog

### v1.0.0
- Initial release
- Multi-chain support
- AI agent system
- Dynamic contract deployment
- Postman protocol integration
- Load balancing and proxy server
- Comprehensive testing suite
