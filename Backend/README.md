# Celo AI Automation Engine - Backend Services

Backend services package for the Celo AI Automation Engine, including:

- **Automation System**: Main AI-powered automation engine
- **Environment Manager**: Central hub for tool integrations and SDK access
- **Code Generator**: Smart contract code generation service
- **Rebalancer System**: Portfolio rebalancing system

## Installation

```bash
npm install @celo-ai/automation-engine
```

## Usage

### Import the main automation system

```javascript
import { CombinedAutomationSystem } from '@celo-ai/automation-engine';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const automation = new CombinedAutomationSystem({
  geminiApiKey: process.env.GEMINI_API_KEY,
  privateKey: process.env.PRIVATE_KEY,
  network: 'alfajores',
  rpcUrl: 'https://alfajores-forno.celo-testnet.org',
  port: 3001
});

automation.start();
```

**Security:** Store credentials in environment variables, never commit them to version control.

### Import individual services

```javascript
// Environment Manager
import EnvironmentManager from '@celo-ai/automation-engine/environment';

// Code Generator
import CodeGenerator from '@celo-ai/automation-engine/code-generator';

// Rebalancer System
import RebalancerSystem from '@celo-ai/automation-engine/rebalancer';
```

## API Routes

The automation system exposes REST API endpoints:

- `POST /api/ai/process` - Process natural language requests
- `POST /api/code-generator/generate` - Generate smart contract code
- `POST /api/rebalancer/analyze` - Analyze portfolio
- `POST /api/rebalancer/rebalance` - Rebalance portfolio
- `GET /api/environment/tools` - List available tools
- `POST /api/environment/route` - Route requests through environment

## Configuration

See the main project README for full configuration options.

## License

MIT

