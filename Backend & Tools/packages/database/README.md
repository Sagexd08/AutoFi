# Autofi Database Package

PostgreSQL database layer using Prisma ORM for the Autofi platform.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
# In .env file
DATABASE_URL="postgresql://user:password@localhost:5432/autofi?schema=public"
```

3. Generate Prisma client:
```bash
pnpm run generate
```

4. Run migrations:
```bash
pnpm run migrate
```

5. Seed the database:
```bash
pnpm run seed
```

## Schema Overview

### Core Tables

- **User** - User accounts with wallet addresses
- **Session** - User authentication sessions
- **Agent** - AI agents with configurations
- **Workflow** - Automation workflow definitions
- **WorkflowExecution** - Workflow execution records
- **WorkflowStep** - Individual steps in workflow executions
- **Transaction** - Blockchain transaction records
- **Approval** - Transaction approval queue
- **AuditLog** - System audit trail
- **Chain** - Supported blockchain configurations
- **QueueJob** - Background job tracking
- **Notification** - User notifications

## Usage

```typescript
import { db, userRepository, workflowRepository } from '@autofi/database';

// Using repository classes
const user = await userRepository.findByWallet('0x...');
const { workflows } = await workflowRepository.listByUser(user.id);

// Using Prisma client directly
const agents = await db.agent.findMany({
  where: { userId: user.id, isActive: true },
});
```

## Repositories

Each table has a corresponding repository class with common operations:

- `UserRepository` - User CRUD, API key management
- `AgentRepository` - Agent CRUD, spending limits, whitelist/blacklist
- `WorkflowRepository` - Workflow CRUD, execution management
- `TransactionRepository` - Transaction tracking, status updates
- `ApprovalRepository` - Approval queue management
- `AuditRepository` - Audit logging, search, cleanup
- `ChainRepository` - Chain configuration, health tracking
- `QueueRepository` - Background job management

## Scripts

- `pnpm run generate` - Generate Prisma client
- `pnpm run migrate` - Create/run migrations
- `pnpm run migrate:deploy` - Deploy migrations (production)
- `pnpm run push` - Push schema changes (dev only)
- `pnpm run studio` - Open Prisma Studio
- `pnpm run seed` - Seed database with defaults
