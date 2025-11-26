# @celo-ai/sdk

TypeScript SDK for the Celo AI agentic automation backend. The SDK provides a developer-friendly interface for creating and managing agents, deploying smart contracts, sending secure transactions, and monitoring system health from JavaScript and TypeScript applications.

## Installation

```bash
pnpm add @celo-ai/sdk
# or
npm install @celo-ai/sdk
# or
yarn add @celo-ai/sdk
```

## Quick Start

```typescript
import { CeloAISDK } from '@celo-ai/sdk';

const sdk = new CeloAISDK({
  apiBaseUrl: 'https://api.celo-ai.dev',
  apiKey: process.env.CELO_AI_API_KEY,
  defaultAgentId: 'agent_treasury_01',
});

await sdk.initialize();

const agent = await sdk.createAgent({
  type: 'treasury',
  name: 'Treasury Manager',
  capabilities: ['rebalance', 'risk_assessment'],
});

const response = await sdk.processPrompt({
  agentId: agent.agent.id,
  prompt: 'Rebalance the CELO/cUSD treasury to 60/40 allocation.',
});

console.log(response.output);
```

## API

### `new CeloAISDK(config)`

| option | type | description |
| --- | --- | --- |
| `apiBaseUrl` | `string` | Base URL of the deployed backend REST API |
| `apiKey` | `string?` | Optional API key sent as `Authorization: Bearer <key>` |
| `defaultAgentId` | `string?` | Default agent identifier for `processPrompt` |
| `timeoutMs` | `number?` | Default request timeout (ms) |
| `defaultHeaders` | `Record<string, string>?` | Extra headers appended to every HTTP request |

### `initialize()`
Performs a health check and returns service status.

### `createAgent(request)`
Creates a new autonomous agent. Returns the created agent metadata.

### `processPrompt(params)`
Sends a natural language instruction to the specified agent and returns the reasoning, workflow, and any transaction metadata.

### `deployContract(request)`
Deploys a smart contract using the backend deployment service.

### `sendTransaction(request)`
Submits an on-chain transaction through the secure transaction manager with risk scoring and guardrails.

### `estimateGas(request)`
Estimates gas usage for a transaction before execution.

### `getHealth(options?)`
Returns system and chain health data. When `options.chainId` is provided, retrieves the health for a specific chain.

### `setLimits(config)` / `getLimits(agentId)`
Manages agent spending caps.

## Error Handling

All methods throw `SDKError` on failure. The error contains a machine-readable `code`, optional HTTP `status`, `requestId`, and structured `details` for logging or debugging.

```typescript
try {
  await sdk.sendTransaction({
    agentId: 'agent_treasury_01',
    to: '0x1234...',
    value: '1000000000000000000', // 1 CELO
  });
} catch (error) {
  if (error instanceof SDKError) {
    console.error('Request failed', {
      code: error.code,
      status: error.status,
      requestId: error.requestId,
      details: error.details,
    });
  }
}
```

## TypeScript Support

The SDK ships with full TypeScript definitions and is authored as a tree-shakeable ES module. You can import the class and helper types directly:

```typescript
import type { AgentCreateRequest, TransactionRequest } from '@celo-ai/sdk';
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT © Celo AI Agents Team
# @celo-ai/sdk

TypeScript SDK for interacting with the Celo AI Agentic Backend. The SDK provides a developer-friendly interface for managing agents, deploying smart contracts, and executing blockchain transactions powered by LangChain automation.

## Installation

```bash
pnpm add @celo-ai/sdk
# or
npm install @celo-ai/sdk
```

## Usage

```typescript
import { CeloAISDK } from '@celo-ai/sdk';

const sdk = new CeloAISDK({
  apiUrl: 'https://api.your-domain.com',
  apiKey: process.env.CELO_AI_API_KEY!,
});

await sdk.initialize();

const agent = await sdk.createAgent({
  type: 'treasury',
  name: 'Treasury Manager',
  description: 'Manages portfolio allocation',
});

const result = await sdk.processPrompt(agent.id, 'Rebalance treasury to 60/40 CELO/cUSD');

console.log(result);
```

## Features

- Natural language processing to agent workflows
- Contract deployment utilities
- Transaction execution with risk guardrails
- Health monitoring endpoints
- Spending limit management

## Configuration

```typescript
const sdk = new CeloAISDK({
  apiUrl: 'http://localhost:3000/api',
  apiKey: 'your-api-key',
  defaultHeaders: {
    'X-Org-Id': 'your-org',
  },
});
```

## Documentation

Visit the main repository documentation for full API reference, CLI usage, and architecture details.

