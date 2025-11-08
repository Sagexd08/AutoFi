# @celo-ai-agents/core

TypeScript library for building AI-powered autonomous agents on the Celo blockchain.

## Features

- 🤖 **AI-Powered Agents**: Intelligent decision-making with Google Gemini integration
- 🔒 **Transaction Security**: Alchemy-powered security analysis and risk assessment
- 🎨 **NFT Operations**: Secure NFT minting, metadata management, and transfers
- 🏦 **DeFi Integration**: Treasury management, donation splitting, yield optimization
- ⚡ **Functional API**: Clean, easy-to-use functional interface
- 🛡️ **Security First**: Built-in risk assessment and approval workflows

## Installation

```bash
npm install @celo-ai-agents/core
```

## Quick Start

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
  alchemyApiKey: 'your-api-key',
  network: 'alfajores'
}, '0x...', BigInt('1000000000000000000'));

// Mint NFT
const nft = await mintNFT(agent, {
  alchemyApiKey: 'your-api-key',
  network: 'alfajores'
}, {
  contractAddress: '0x...',
  recipient: '0x...',
  metadata: { name: 'My NFT' }
});
```

## API Reference

### Core Functions

- `createCeloAgent(config)` - Create agent instance
- `getTokenBalance(client, address, token)` - Get token balance
- `sendCELO(client, to, amount)` - Send CELO tokens
- `executeSecureTransaction(client, config, transaction)` - Execute with security

### Security Functions

- `analyzeTransactionSecurity(config, to, value, data?)` - Analyze security
- `validateTransaction(config, transaction)` - Validate transaction
- `isAddressSafe(config, address)` - Check address safety

### NFT Functions

- `mintNFT(client, config, params)` - Mint NFT
- `getNFTMetadata(config, contractAddress, tokenId)` - Get metadata
- `getOwnedNFTs(config, address, contractAddress?)` - Get owned NFTs

### Agent Functions

- `createTreasuryManagerAgent(...)` - Create treasury agent
- `createDonationSplitterAgent(...)` - Create donation agent
- `executeAgentWithSecurity(...)` - Execute agent with security

## Examples

See the [examples directory](../../examples/) for complete usage examples:

- [Basic Usage](../../examples/basic-usage.ts) - Simple operations
- [Advanced Agents](../../examples/advanced-agents.ts) - Complex agent workflows
- [Security Example](../../examples/security-example.ts) - Security best practices

## Documentation

- [Getting Started](../../docs/getting-started.md) - Quick start guide
- [API Reference](../../docs/api-reference.md) - Complete API documentation
- [Security Guide](../../docs/security.md) - Security best practices

## Requirements

- Node.js 18+
- Celo wallet with testnet tokens
- Alchemy API key (for enhanced security)

## License

MIT License - see [LICENSE](../../LICENSE) file for details.

## Support

- GitHub Issues: [Report bugs and feature requests](https://github.com/celo-ai-agents/core/issues)
- Documentation: [docs.celo-ai-agents.com](https://docs.celo-ai-agents.com)
- Discord: [Celo AI Agents Community](https://discord.gg/celo-ai-agents)
