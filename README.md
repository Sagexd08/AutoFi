# Celo Automator Monorepo

Advanced AI-powered blockchain automation system for Celo, built with TypeScript, LangChain, and Turborepo.

## 🏗️ Architecture

```
celo-automator/
├── apps/
│   ├── backend/          # Express API backend
│   └── cli/              # Interactive CLI tool
├── packages/
│   ├── types/            # Shared TypeScript types
│   ├── core/             # Shared utilities
│   ├── langchain-agent/  # AI workflow orchestrator
│   └── celo-functions/   # Celo blockchain functions
└── turbo.json            # Turborepo configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run development servers
pnpm dev
```

### Environment Setup

Create `.env` files in `apps/backend`:

```env
CELO_PRIVATE_KEY=your_private_key
CELO_NETWORK=alfajores
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key  # Optional
PORT=3000
```

## 📦 Packages

### `@celo-automator/types`
Shared TypeScript interfaces and types for workflows, blockchain operations, and agents.

### `@celo-automator/core`
Core utilities including validators, error handling, and helper functions.

### `@celo-automator/celo-functions`
Modular Celo blockchain function library wrapping viem for:
- Balance queries
- Token transfers
- Smart contract calls
- Event listening

### `@celo-automator/langchain-agent`
Advanced AI workflow orchestrator using LangChain:
- Natural language → workflow conversion
- Workflow execution
- Tool integration
- Memory management

## 🖥️ Backend API

### Start Server

```bash
cd apps/backend
pnpm dev
```

### Endpoints

- `POST /api/workflows/interpret` - Convert natural language to workflow
- `POST /api/workflows` - Create workflow
- `GET /api/workflows` - List workflows
- `POST /api/workflows/:id/execute` - Execute workflow
- `GET /api/workflows/executions/:id` - Get execution status
- `GET /api/wallet/balance/:address` - Get wallet balance
- `GET /api/health` - Health check

## 💻 CLI Tool

### Installation

```bash
cd apps/cli
pnpm build
pnpm link --global
```

### Commands

```bash
# Initialize configuration
celo-auto init

# Create workflow from natural language
celo-auto workflow --create

# List workflows
celo-auto workflow --list

# Execute workflow
celo-auto workflow --execute <workflow-id>

# Explain natural language request
celo-auto explain "Send 10 CELO every 6 hours to 0x..."

# Watch blockchain events
celo-auto watch --contract 0x... --event Transfer
```

## 🤖 AI Workflow Examples

### Example 1: Natural Language → Workflow

```bash
celo-auto explain "Whenever a DAO receives 100 cUSD, send 10% to treasury and notify Telegram"
```

The AI will generate a structured workflow JSON with:
- Event trigger (listening to Transfer events)
- Conditional logic (check amount >= 100 cUSD)
- Action (transfer 10% to treasury)
- Notification (send Telegram message)

### Example 2: Recurring Payment

```bash
celo-auto workflow --create
# Enter: "Send 10 CELO every 6 hours to 0x123..."
```

### Example 3: Balance Alert

```bash
celo-auto explain "Alert me when my wallet balance exceeds 1000 CELO"
```

## 🧪 Development

### Build

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @celo-automator/types build
```

### Test

```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @celo-automator/core test
```

### Lint

```bash
pnpm lint
```

## 📚 Workflow Templates

Pre-built workflow templates are available in `packages/core/src/workflow-templates.ts`:

- **DAO Treasury Split** - Automatically split DAO funds
- **Recurring Payment** - Send fixed amount on schedule
- **Balance Alert** - Notify when balance threshold exceeded

## 🔧 Configuration

### Backend Configuration

Environment variables:
- `CELO_PRIVATE_KEY` - Private key for signing transactions
- `CELO_NETWORK` - Network (alfajores/mainnet)
- `CELO_RPC_URL` - Custom RPC URL (optional)
- `GEMINI_API_KEY` - Gemini API key for AI features
- `OPENAI_API_KEY` - OpenAI API key (optional alternative)

### CLI Configuration

Run `celo-auto init` to set up configuration file at `~/.celoauto.json`.

## 🚀 Deployment

### Build for Production

```bash
pnpm build
```

### Deploy Backend

```bash
cd apps/backend
pnpm start
```

### Deploy CLI

```bash
cd apps/cli
pnpm build
# Package and publish to npm
```

## 📖 API Documentation

Full API documentation available at `/api/health` when backend is running.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT

## 🙏 Acknowledgments

Built with:
- [LangChain](https://langchain.com/) - AI orchestration
- [viem](https://viem.sh/) - Ethereum/Celo interaction
- [Turborepo](https://turbo.build/) - Monorepo build system
- [Express](https://expressjs.com/) - Web framework