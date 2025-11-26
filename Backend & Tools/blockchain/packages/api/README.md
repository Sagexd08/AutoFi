# Celo AI Agents API

A comprehensive REST API for automated blockchain processes on the Celo network. This API provides endpoints for smart contract deployment, AI agent management, NFT operations, security analysis, and more.

## 🚀 Features

- **Smart Contract Management**: Deploy, verify, and interact with contracts
- **AI Agent Operations**: Create, execute, and manage autonomous agents
- **NFT Operations**: Mint, transfer, and manage NFTs
- **Security Analysis**: Transaction security assessment and risk analysis
- **Batch Operations**: Deploy multiple contracts and execute batch transactions
- **Network Integration**: Support for Celo mainnet and Alfajores testnet
- **Alchemy Integration**: Enhanced security and NFT capabilities

## 📋 API Endpoints

### Contracts
- `POST /api/v1/contracts/deploy` - Deploy a smart contract
- `POST /api/v1/contracts/call` - Call a contract function (read)
- `POST /api/v1/contracts/transaction` - Send a transaction to a contract
- `POST /api/v1/contracts/verify` - Verify a contract on block explorer
- `POST /api/v1/contracts/compile` - Compile smart contracts
- `GET /api/v1/contracts/network-info` - Get network information
- `GET /api/v1/contracts/balance` - Get account balance

### Agents
- `POST /api/v1/agents/create` - Create a new AI agent
- `POST /api/v1/agents/execute` - Execute an agent
- `GET /api/v1/agents/{agentId}` - Get agent information
- `PUT /api/v1/agents/update` - Update agent configuration
- `DELETE /api/v1/agents/{agentId}` - Delete an agent
- `GET /api/v1/agents/list` - List all agents

### Security
- `POST /api/v1/security/analyze` - Analyze transaction security
- `POST /api/v1/security/execute` - Execute a secure transaction
- `GET /api/v1/security/health` - Check security service health

### NFT
- `POST /api/v1/nft/mint` - Mint a new NFT
- `POST /api/v1/nft/batch-mint` - Batch mint multiple NFTs
- `GET /api/v1/nft/metadata` - Get NFT metadata
- `GET /api/v1/nft/owned` - Get owned NFTs
- `GET /api/v1/nft/transfers` - Get NFT transfers
- `GET /api/v1/nft/collection` - Get NFT collection information

### Deployment
- `POST /api/v1/deployment/deploy` - Deploy a smart contract
- `POST /api/v1/deployment/verify` - Verify a deployed contract
- `GET /api/v1/deployment/status` - Get deployment status
- `POST /api/v1/deployment/batch-deploy` - Deploy multiple contracts

## 🛠️ Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Edit .env with your configuration
nano .env
```

## 🚀 Quick Start

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start

# The API will be available at http://localhost:3000
```

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Celo Network Configuration
CELO_NETWORK=alfajores
CELO_RPC_URL=https://alfajores-forno.celo-testnet.org

# Alchemy Configuration
ALCHEMY_API_KEY=your_alchemy_api_key_here
ALCHEMY_POLICY_ID=your_alchemy_policy_id_here

# Security Configuration
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX_REQUESTS=100
```

## 📖 Usage Examples

### Deploy a Smart Contract

```typescript
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

### Create an AI Agent

```typescript
const response = await fetch('http://localhost:3000/api/v1/agents/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    goal: 'Manage treasury and optimize fund allocation',
    constraints: ['Max 10% risk per transaction'],
    tools: ['treasury_analysis', 'defi_swaps'],
    network: 'alfajores',
    privateKey: '0x...',
    alchemyApiKey: 'your_api_key'
  })
});

const result = await response.json();
console.log('Agent created:', result.data.agentId);
```

### Mint an NFT

```typescript
const response = await fetch('http://localhost:3000/api/v1/nft/mint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contractAddress: '0x...',
    recipient: '0x...',
    metadata: {
      name: 'Celo AI Agent NFT',
      description: 'A unique NFT representing an AI agent',
      image: 'https://example.com/nft.png'
    },
    network: 'alfajores',
    privateKey: '0x...',
    alchemyApiKey: 'your_api_key'
  })
});

const result = await response.json();
console.log('NFT minted:', result.data.tokenId);
```

## 🔒 Security Features

- **Rate Limiting**: Prevents API abuse
- **Input Validation**: Joi schema validation for all inputs
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet Security**: Security headers and protection
- **Transaction Security**: Alchemy-powered security analysis
- **Private Key Protection**: Secure handling of sensitive data

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📊 Monitoring

The API includes built-in monitoring and health checks:

- **Health Endpoint**: `/health`
- **Security Health**: `/api/v1/security/health`
- **Request Logging**: Morgan middleware for request logging
- **Error Tracking**: Comprehensive error handling and logging

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Setup

1. Set up your environment variables
2. Configure your Celo network settings
3. Add your Alchemy API keys
4. Set up your private keys securely

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- **Documentation**: http://localhost:3000/api-docs
- **Issues**: GitHub Issues
- **Email**: support@celo-ai-agents.com

## 🔗 Related Projects

- [Celo AI Agents Core](../core) - Core library functionality
- [Celo AI Agents Contracts](../contracts) - Smart contracts
- [Examples](../examples) - Usage examples and tutorials
