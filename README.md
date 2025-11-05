# Celo Automator Backend API

Express-based REST API for Celo blockchain automation.

## Environment Variables

```env
CELO_PRIVATE_KEY=your_private_key
CELO_NETWORK=alfajores
CELO_RPC_URL=https://alfajores-forno.celo-testnet.org
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
PORT=3000
```

## API Endpoints

### Workflows

#### Interpret Natural Language
```http
POST /api/workflows/interpret
Content-Type: application/json

{
  "input": "Send 10 CELO every 6 hours to 0x...",
  "context": {}
}
```

#### Create Workflow
```http
POST /api/workflows
Content-Type: application/json

{
  "name": "My Workflow",
  "trigger": {...},
  "actions": [...]
}
```

#### List Workflows
```http
GET /api/workflows
```

#### Execute Workflow
```http
POST /api/workflows/:id/execute
```

#### Get Execution Status
```http
GET /api/workflows/executions/:executionId
```

### Wallet

#### Get Balance
```http
GET /api/wallet/balance/:address?tokenAddress=0x...
```

### Health

```http
GET /api/health
```
