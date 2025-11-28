# AutoFi Architecture Guide

## System Overview

AutoFi is an **AI-powered Web3 automation engine** running on the **Celo blockchain**. It enables users to create, manage, and execute complex automation workflows with real-time risk assessment and AI decision-making.

### Core Design Principles

1. **Modularity**: Separation of concerns via monorepo (22 packages)
2. **Type Safety**: 100% TypeScript with Zod validation
3. **Real Integration**: Blockchain transactions via Viem, AI via custom ML engine
4. **Scalability**: Turborepo for fast builds, Prisma for database abstraction
5. **Security**: Risk scoring, contract verification, audit trails

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 16)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Dashboard │ Create │ Templates │ Analytics │ Wallet Sync │  │
│  └──────────────────────────────────────────────────────────┘  │
│  State: Zustand | Styling: Tailwind | Web3: Wagmi + Rainbowkit │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Express.js)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Automations API │ Blockchain Routes │ Risk Assessment   │  │
│  │ Analytics │ WebSocket Events │ Auth (JWT)               │  │
│  └──────────────────────────────────────────────────────────┘  │
│  Database: SQLite (dev) / PostgreSQL (prod) via Prisma         │
│  Logging: Pino | Monitoring: Prometheus                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┬─────────────────────┐
        ↓                     ↓                     ↓
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   AI Engine  │      │    Blockchain│      │   Security   │
│ (Custom ML)  │      │   (Celo/viem)│      │   Scanner    │
│              │      │              │      │              │
│ • Pattern    │      │ • Transactions       │ • GoPlus API │
│   Matching   │      │ • Contract calls     │ • Etherscan  │
│ • Heuristics │      │ • Gas estimation
│ • Contextual │      │ • Event listening
│   Memory     │      │              │
│ • Workflows  │      │              │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
```

---

## Package Structure

### `/packages` (Core Packages)

| Package | Purpose | Key Features |
|---------|---------|--------------|
| **types** | Shared type definitions | Workflow, Risk, Automation types |
| **core** | Core utilities | Validators, errors, templates |
| **celo-functions** | Blockchain layer | sendCELO, sendToken, getBalance |
| **langchain-agent** | Custom ML orchestration | Heuristic-based workflow interpreter |
| **risk-engine** | Risk scoring | RiskEngine class, rule system |
| **security-scanner** | Contract auditing | GoPlus API, bytecode analysis |
| **agents** | AI agents framework | Agent patterns, orchestration |
| **sdk** | Public SDK | Client library for integration |
| **vector-db** | Memory storage | Chroma + vector embeddings |
| **contextual-memory** | AI memory | Conversation history, context |

### `/apps`

| App | Purpose | Stack |
|-----|---------|-------|
| **backend** | REST API server | Express, Prisma, WebSocket |
| **cli** | Command-line tool | TypeScript, yargs |
| **Frontend** | Web interface | Next.js 16, React 19, Tailwind |

### Special Directories

- **blockchain/**: Smart contracts for Celo
- **data/**: Shared data (seeded data, migrations)

---

## Data Flow Diagrams

### Creating an Automation

```
User (Frontend)
    ↓
    │ POST /api/automations
    ↓
Backend - Route Handler
    ↓
    ├─→ Validate input (Zod)
    ├─→ Risk assessment (@celo-automator/risk-engine)
    ├─→ Store in DB (Prisma)
    ├─→ Log to audit trail
    ↓
Response with Automation ID
    ↓
Frontend - Store in state (Zustand)
```

### Executing an Automation

```
User / Scheduler
    ↓
    │ POST /api/automations/:id/execute
    ↓
Backend - Execution Engine
    ├─→ Load automation from DB
    ├─→ Risk assessment (re-check)
    ├─→ Require approval if needed
    ├─→ Parse workflow
    ├─→ Execute actions sequentially
    │
    ├─→ For each action:
    │   ├─→ Type = "transfer"?
    │   │   └─→ CeloFunctions.sendCELO()
    │   │       ↓
    │   │       Viem → Celo RPC → Blockchain
    │   │
    │   ├─→ Type = "contract_call"?
    │   │   └─→ CeloFunctions.callContract()
    │   │
    │   ├─→ Type = "ai_decision"?
    │   │   └─→ CustomMLAgent.decide()
    │   │       ↓
    │   │       Custom ML + Context → Decision
    │
    ├─→ Store execution history
    ├─→ Emit WebSocket event
    ↓
Response + Real-time updates to Frontend
```

### Risk Assessment Pipeline

```
Automation / Transaction
    ↓
RiskEngine.scoreTransaction()
    ├─→ Register rules (if needed)
    ├─→ Execute all rules in parallel
    │   ├─→ Rule 1: Bytecode analysis
    │   ├─→ Rule 2: Contract verification
    │   ├─→ Rule 3: GoPlus security check
    │   ├─→ Rule 4: Value threshold
    │   └─→ Rule 5: Address reputation
    │
    ├─→ Calculate weighted average
    ├─→ Classify: low/medium/high/critical
    ├─→ Determine: requiresApproval, blockExecution
    ↓
RiskAssessment {
  normalizedRisk: 0.35,
  classification: "low",
  requiresApproval: false,
  blockExecution: false,
  rules: [...],
  recommendations: [...]
}
```

---

## Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19.2, Radix UI, Tailwind CSS 4.1
- **State**: Zustand
- **Web3**: Wagmi 2.x, Viem 2.40, RainbowKit
- **Forms**: React Hook Form + Zod
- **API**: Axios + custom hooks

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5.1
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **ORM**: Prisma 5.17 (abstracts DB layer)
- **Logging**: Pino 10.1
- **Auth**: JWT (middleware)
- **Real-time**: WebSocket (ws)
- **Blockchain**: Viem 2.40 (type-safe)
- **AI**: Custom ML engine with heuristic-based decision making

### Development
- **Language**: TypeScript 5.9
- **Build**: Turborepo 2.6
- **Testing**: Vitest 4.0
- **Linting**: ESLint 9.39
- **Package Manager**: pnpm 10.11

---

## Key Modules Deep Dive

### 1. RiskEngine (@celo-automator/risk-engine)

**Responsibility**: Score transactions/automations for risk.

**Architecture**:
```typescript
class RiskEngine {
  private rules: RiskRule[] = [];
  
  registerRule(rule: RiskRule) { }
  
  async scoreTransaction(input: RiskEvaluationInput): Promise<Assessment> {
    // Execute all rules in parallel (if enabled)
    // Calculate weighted average
    // Apply overrides (forceAllow, forceBlock, maxNormalizedRisk)
    // Return assessment
  }
}

interface RiskRule {
  id: string;
  label: string;
  weight: number;
  evaluate: (input) => Promise<RuleResult>;
}
```

**Usage**:
```typescript
const engine = new RiskEngine({
  approvalThreshold: 0.6,
  blockThreshold: 0.85,
});

engine.registerRule(customRule);
const assessment = await engine.scoreTransaction(input);
```

### 2. SecurityScanner (@autofi/security-scanner)

**Responsibility**: Audit contracts for security issues.

**Features**:
- Bytecode analysis (checks for malicious patterns)
- Contract verification (via Etherscan V2)
- GoPlus API integration (token security)
- Honeypot detection
- Exploit history tracking

**Architecture**:
```typescript
const scanner = new SecurityScanner();
const result = await scanner.scanContract(address, chainId);
// Returns: { riskLevel, riskScore, checks[], recommendations[] }
```

### 3. CustomMLAgent (@celo-automator/langchain-agent)

**Responsibility**: AI decision-making for automations using custom ML.

**Flow**:
1. User provides natural language prompt
2. Custom ML engine parses using pattern matching and heuristics
3. Converts to function calls with contextual analysis
4. Executes blockchain functions
5. Returns results to user

**Features**:
- Pattern-based intent recognition
- Contextual memory from vector-db
- Heuristic-based risk scoring
- Custom tools for blockchain (sendCELO, swap, etc.)
- No external LLM dependencies (OpenAI, Gemini, etc.)

### 4. Prisma ORM (Backend)

**Responsibility**: Database abstraction layer.

**Benefits**:
- **Type Safety**: Auto-generated types from schema
- **Migration Path**: Easy SQL Server → PostgreSQL migration
- **Query Building**: Type-safe query API
- **Audit Trail**: Built-in timestamps (createdAt, updatedAt)

**Schema Models**:
- `Automation`: Workflow configurations
- `ExecutionHistory`: Execution logs
- `ContractScan`: Security scan cache
- `AuditLog`: Change tracking
- `PendingTransaction`: TX monitoring
- `UserPreferences`: Settings
- `DailyStats`: Analytics

---

## API Contract (OpenAPI 3.0)

### Automations Endpoints

```yaml
POST /api/automations
  Request: { name, description, workflowConfig, maxRiskScore, requiresApproval }
  Response: 201 { id, userId, enabled, createdAt, ... }

GET /api/automations
  Query: { skip?, take?, enabled? }
  Response: 200 { automations[], total }

GET /api/automations/:id
  Response: 200 { automation }

PATCH /api/automations/:id
  Request: Partial<Automation>
  Response: 200 { automation }

DELETE /api/automations/:id
  Response: 204

POST /api/automations/:id/execute
  Response: 202 { execution }

GET /api/automations/:id/executions
  Response: 200 { executions[] }

GET /api/automations/:id/risk-assessment
  Response: 200 { riskScore, level, recommendations[] }
```

### Blockchain Endpoints

```yaml
POST /api/blockchain/send-transaction
  Request: { to, value, tokenAddress?, data? }
  Response: 200 { txHash, blockNumber, gasUsed }

GET /api/blockchain/balance/:address
  Response: 200 { balance, decimals, symbol }

GET /api/blockchain/transactions/:address
  Query: { limit? }
  Response: 200 { transactions[] }
```

---

## Database Schema (Prisma)

### Key Tables

**Automation**
- `id`, `userId`, `name`, `description`
- `workflowConfig` (JSON), `enabled`, `riskScore`, `maxRiskScore`
- `requiresApproval`, `createdAt`, `updatedAt`, `deletedAt`

**ExecutionHistory**
- `id`, `automationId`, `status` (pending|running|success|failed)
- `transactionHash`, `blockNumber`, `gasUsed`, `totalCost`
- `error`, `triggeredAt`, `executedAt`, `completedAt`

**AuditLog**
- `id`, `automationId`, `action` (create|update|delete|execute)
- `actor`, `changes` (JSON diff), `ipAddress`, `createdAt`

**ContractScan**
- `id`, `contractAddress`, `chainId`, `riskLevel`, `riskScore`
- `isVerified`, `scanResult` (JSON), `expiresAt`

---

## Deployment Architecture

### Development
- Single SQLite database at `data/dev.db`
- Express server on `localhost:3001`
- Frontend on `localhost:3000` (dev server)
- HMR enabled for fast iteration

### Production (Recommended)
```
                                                
┌─────────────────────────┐
│   Cloudflare CDN        │ (Frontend static assets)
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  Load Balancer (AWS)    │
└────────────┬────────────┘
             ↓
    ┌────────┴────────┐
    ↓                 ↓
┌─────────┐       ┌─────────┐
│Backend 1│       │Backend 2│ (Auto-scaling)
└────┬────┘       └────┬────┘
     └────────┬────────┘
              ↓
    ┌─────────────────────┐
    │  PostgreSQL (RDS)   │ (Multi-AZ)
    └─────────────────────┘
    
    ┌─────────────────────┐
    │  Redis (ElastiCache)│ (Caching, Sessions)
    └─────────────────────┘
```

---

## Security Considerations

### Authentication
- JWT tokens with 24-hour expiry
- Refresh token rotation
- User validation on every request

### Smart Contracts
- Run verification before execution
- Risk assessment mandatory
- High-risk automations require approval

### Database
- Encrypted at rest (AWS KMS)
- SSL/TLS for connections
- Regular backups (daily)
- Soft deletes for audit trails

### API
- Rate limiting (express-rate-limit)
- CORS configured for allowed origins
- Helmet.js for security headers
- Input validation with Zod

---

## Monitoring & Observability

### Logging (Pino)
- All API requests logged
- Execution events tracked
- Errors with stack traces

### Metrics (Prometheus)
- Request count / latency
- Database query performance
- Blockchain transaction success rate
- Risk engine execution time

### Alerts
- Failed executions (Slack webhook)
- High error rates (> 5% in 5 min)
- Database connection issues
- API response time (> 1s)

---

## Future Roadmap

### Short Term (2-4 weeks)
1. ✅ Prisma ORM integration
2. ✅ Integration tests
3. ✅ API documentation (Swagger)
4. ⏳ Automated deployment pipeline (CI/CD)

### Medium Term (1-2 months)
- [ ] Scheduled automation triggers (cron)
- [ ] Webhook triggers
- [ ] Multi-chain support (Polygon, Arbitrum)
- [ ] Advanced AI agent orchestration
- [ ] User analytics dashboard

### Long Term (3-6 months)
- [ ] DAO governance
- [ ] Plugin marketplace
- [ ] Audit by security firm
- [ ] Public mainnet deployment
- [ ] Mobile app

---

## Getting Started for Developers

### Setup

```bash
# Clone and install
git clone https://github.com/sagexd08/autofi.git
cd autofi
pnpm install

# Database setup
cd apps/backend
pnpm exec prisma generate
pnpm exec prisma migrate deploy

# Start development servers
pnpm run dev
```

### Understanding the Codebase

1. **Start with**: `/Frontend/app/layout.tsx` (entry point)
2. **Explore**: `/packages/types/src` (data models)
3. **Learn**: `/apps/backend/src/routes` (API endpoints)
4. **Deep dive**: `/packages/risk-engine/src` (risk scoring logic)

### Adding a New Feature

1. Define types in `packages/types`
2. Add database model to `apps/backend/prisma/schema.prisma`
3. Create backend route in `apps/backend/src/routes`
4. Create frontend component in `Frontend/app`
5. Write integration test in `apps/backend/src/tests`

---

## Contributing

See `CONTRIBUTING.md` for guidelines on:
- Code style (Prettier + ESLint)
- Commit messages (Conventional Commits)
- Pull request process
- Testing requirements

---

**Last Updated**: November 28, 2025
**Maintainer**: AutoFi Team
