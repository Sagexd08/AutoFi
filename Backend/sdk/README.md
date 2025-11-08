# Celo AI SDK

A comprehensive TypeScript SDK for multi-chain blockchain automation with AI agents, dynamic smart contracts, and advanced testing capabilities.

## Features

- 🌐 **Multi-Chain Support**: Ethereum, Polygon, BSC, Arbitrum, Optimism, Celo, Base, Avalanche, and more
- 🤖 **AI Agents**: Intelligent automation with Gemini AI integration
- 📝 **Dynamic Contracts**: Deploy and manage smart contracts dynamically
- ⚖️ **Load Balancing**: Intelligent transaction routing and failover
- 🧪 **API Testing**: Postman protocol integration for comprehensive testing
- 🔒 **Security**: Built-in validation, error handling, and risk assessment
- 🛡️ **Data Masking**: Automatic sanitization of sensitive data in logs and errors
- 🔐 **Encryption**: Secure encryption utilities for sensitive data
- 📊 **Monitoring**: Health checks, metrics, and performance tracking
- 🌳 **Modular**: Tree-shakeable exports for optimal bundle size
- 🔄 **CI/CD**: Automated testing and deployment pipelines

## Installation

```bash
npm install @celo-ai/sdk
```

## Quick Start

### Modular Imports

The SDK supports modular imports for tree-shaking and smaller bundle sizes:

```typescript
// Import only what you need
import { CeloAISDK } from '@celo-ai/sdk';
import { DataMasker, EncryptionUtil } from '@celo-ai/sdk/security';
import { StructuredLogger } from '@celo-ai/sdk/modules';

// Or use the main export for everything
import { CeloAISDK, masker, security } from '@celo-ai/sdk';
```

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

## Advanced Features

### Error Handling

The SDK provides comprehensive error handling with custom error classes:

```typescript
import { SDKError, ChainError, ValidationError } from '@celo-ai/sdk';

try {
  await sdk.sendTransaction(request);
} catch (error) {
  if (error instanceof ChainError) {
    console.error('Chain error:', error.chainId, error.message);
    if (error.recoverable) {
      // Retry logic
    }
  } else if (error instanceof ValidationError) {
    console.error('Validation error:', error.field, error.reason);
  }
}
```

### Retry Mechanism

Automatic retry with exponential backoff:

```typescript
import { retryWithBackoff, CircuitBreaker } from '@celo-ai/sdk';

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 60000,
});

await retryWithBackoff(
  async () => {
    return await sdk.sendTransaction(request);
  },
  {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
  },
  circuitBreaker
);
```

### Caching

Built-in caching support:

```typescript
import { MemoryCache, LRUCache } from '@celo-ai/sdk';

const cache = new MemoryCache(60000); // 60 second TTL
await cache.set('key', data);
const cached = await cache.get('key');
```

### Middleware System

Extensible middleware for request/response handling:

```typescript
import { MiddlewareChain, createLoggingMiddleware } from '@celo-ai/sdk';

const middlewareChain = new MiddlewareChain();
middlewareChain.add(createLoggingMiddleware(sdkConfig));
// Add custom middleware
```

### Plugin System

Extend SDK functionality with plugins:

```typescript
import { DefaultPluginRegistry } from '@celo-ai/sdk';

const registry = new DefaultPluginRegistry();
registry.register({
  metadata: {
    name: 'my-plugin',
    version: '1.0.0',
    dependencies: { requires: ['core-plugin'] },
  },
  onInit: async (config) => {
    // Initialize plugin
  },
});
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

## CLI Tool

The SDK includes a comprehensive CLI tool for command-line operations.

### Installation

```bash
npm install -g @celo-ai/sdk
```

### Available Commands

```bash
# Configuration
celo-ai init                    # Initialize SDK config

# Chain Management
celo-ai chain list              # List supported chains
celo-ai chain health [chainId]  # Check chain health

# Agent Management
celo-ai agent create            # Create new agent
celo-ai agent list              # List all agents
celo-ai agent query <id> <q>    # Query an agent

# Transactions
celo-ai tx send                 # Send transaction

# Contracts
celo-ai contract deploy         # Deploy contract

# Health
celo-ai health                  # Check SDK health
```

### CLI Examples

```bash
# Initialize SDK
celo-ai init --api-key YOUR_KEY --network ethereum

# Create and query an agent
celo-ai agent create \
  --type defi \
  --name "DeFi Optimizer" \
  --capabilities "find_yield,execute_swaps"

celo-ai agent query agent_123 "Find best yield opportunities"

# Deploy a contract
celo-ai contract deploy \
  --name MyContract \
  --source ./contracts/MyContract.sol \
  --chain ethereum
```

See [CLI.md](./CLI.md) for detailed CLI documentation.

## Security & Data Masking

### Data Masking

The SDK automatically masks sensitive data in logs and error messages:

```typescript
import { DataMasker } from '@celo-ai/sdk';
const masker = new DataMasker({
  strategy: 'partial', // 'full', 'partial', or 'hash'
  maskFields: ['privateKey', 'apiKey', 'password'],
  visibleChars: 4,
  maskChar: '*',
});

// Mask sensitive values
const masked = masker.maskValue('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
// Result: '0x12**********************************************cdef'

// Mask objects recursively
const maskedObj = masker.maskObject({
  privateKey: '0x123...',
  apiKey: 'sk_live_12345',
  publicData: 'safe to show',
});
// Result: { privateKey: '0x12***', apiKey: 'sk_l***e', publicData: 'safe to show' }

// Sanitize error messages
const sanitizedError = masker.sanitizeError(error);
```

### Environment-Based Masking

Configure masking based on environment:

```typescript
import { envConfig, getEnvironmentConfig } from '@celo-ai/sdk/utils/environment-config';

// Get current environment config
const config = getEnvironmentConfig();
// Returns: { enableMasking: true, maskingStrategy: 'full', ... }

// Configure logger with environment-based masking
import { StructuredLogger } from '@celo-ai/sdk';
const logger = new StructuredLogger({
  enableMasking: true,
  maskingConfig: envConfig.getMaskingConfig(),
  useWinston: true, // Optional: Use Winston for advanced logging
});
```

### Encryption Utilities

Secure encryption for sensitive data:

```typescript
import { EncryptionUtil, security } from '@celo-ai/sdk';

// Encrypt data
const encrypted = security.encrypt('sensitive data', 'password');
const decrypted = security.decrypt(encrypted, 'password');

// Generate secure tokens
const token = security.generateToken(32);
const uuid = security.generateUUID();

// Hash data
const hash = security.hash('data to hash');
```

### Token Management

Secure token storage and validation:

```typescript
import { TokenManager } from '@celo-ai/sdk';

const tokenManager = new TokenManager();

// Create token with expiration
const token = tokenManager.createToken(
  { userId: '123', role: 'admin' },
  3600000 // 1 hour
);

// Validate token
const payload = await tokenManager.validateToken(token);

// Revoke token
tokenManager.revokeToken(token);
```

### GDPR Compliance

Built-in GDPR compliance utilities:

```typescript
import { GDPRCompliance } from '@celo-ai/sdk';

// Check if data contains PII
const hasPII = GDPRCompliance.containsPII(userData);

// Remove PII from data
const cleaned = GDPRCompliance.removePII(userData);

// Anonymize data
const anonymized = GDPRCompliance.anonymize(userData);
```

### Secure Storage

Encrypted storage for sensitive data:

```typescript
import { SecureStorage } from '@celo-ai/sdk';

const storage = new SecureStorage();

// Store encrypted data
storage.set('apiKey', 'secret-key', 'password');

// Retrieve and decrypt
const apiKey = await storage.get('apiKey', 'password');
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
  // Security options
  enableMasking?: boolean;
  maskingConfig?: MaskingConfig;
  useWinston?: boolean;
  usePino?: boolean;
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

**Build Scripts:**
- `npm run build` - Build the project with TypeScript
- `npm run build:webpack` - Build optimized bundles with Webpack
- `npm run build:all` - Build both TypeScript and Webpack bundles

**Development:**
- `npm run dev` - Development mode with watch
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

**Testing:**
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run test:security` - Run security audit checks

**Security:**
- `npm run audit` - Run npm audit
- `npm run audit:fix` - Fix npm audit issues
- `npm run audit:production` - Audit production dependencies only
- `npm run security:check` - Check for high-severity vulnerabilities

**Versioning:**
- `npm run version:patch` - Increment patch version (1.0.0 -> 1.0.1)
- `npm run version:minor` - Increment minor version (1.0.0 -> 1.1.0)
- `npm run version:major` - Increment major version (1.0.0 -> 2.0.0)

**Other:**
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

## CI/CD

The SDK includes GitHub Actions workflows for automated testing and deployment:

- **Automated Testing**: Runs on push and pull requests
- **Security Audits**: Checks for vulnerabilities before publishing
- **Multi-Node Testing**: Tests on Node.js 18.x and 20.x
- **Code Coverage**: Uploads coverage reports to Codecov
- **Automated Publishing**: Publishes to NPM on version tags

## Changelog

### v1.1.0
- ✨ **Data Masking**: Automatic sanitization of sensitive data in logs and errors
- 🔐 **Encryption Utilities**: Secure encryption, hashing, and token management
- 🌳 **Modular Exports**: Tree-shakeable exports for optimal bundle size
- 🔄 **CI/CD Integration**: GitHub Actions workflows for automated testing and deployment
- 🛡️ **GDPR Compliance**: Built-in utilities for data privacy compliance
- 📦 **Webpack/Babel**: Optimized bundle builds with Webpack and Babel
- 🔍 **Security Audits**: Automated security vulnerability scanning
- ⚙️ **Environment Config**: Environment-based masking and security configuration
- 📝 **Winston/Pino Support**: Optional integration with advanced logging libraries

### v1.0.0
- Initial release
- Multi-chain support
- AI agent system
- Dynamic contract deployment
- Postman protocol integration
- Load balancing and proxy server
- Comprehensive testing suite
