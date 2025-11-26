# Autofi Queue Package

BullMQ-based worker queue system for background job processing.

## Features

- **Workflow Execution**: Process multi-step blockchain workflows
- **Transaction Broadcasting**: Queue and broadcast transactions with retry logic
- **Simulation**: Dry-run transactions before execution
- **Notifications**: Multi-channel notification delivery

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure Redis connection:
```bash
# Environment variables
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# Or use a connection URL (Upstash, Railway, etc.)
REDIS_URL=redis://user:password@host:port
```

## Usage

### In your application

```typescript
import { 
  createQueueManager, 
  initializeAllProcessors,
  queueWorkflowExecution,
  queueTransaction,
} from '@autofi/queue';

// Initialize processors (call once on startup)
initializeAllProcessors();

// Queue a workflow execution
const jobId = await queueWorkflowExecution('workflow_123', {
  userId: 'user_456',
  trigger: { type: 'manual' },
});

// Queue a transaction
const txJobId = await queueTransaction({
  transactionId: 'tx_789',
  chainId: 1,
  from: '0x...',
  to: '0x...',
  value: '1000000000000000000',
});

// Get queue stats
const manager = createQueueManager();
const stats = await manager.getAllQueueStats();
console.log(stats);
```

### As a standalone worker

```bash
# Build the package
pnpm run build

# Start the worker
pnpm run start
# or
node dist/worker.js
```

## Queues

| Queue | Purpose |
|-------|---------|
| `autofi:workflow` | Workflow execution jobs |
| `autofi:transaction` | Transaction broadcasting |
| `autofi:simulation` | Transaction simulation |
| `autofi:notification` | Notification delivery |

## Job Options

All jobs support:
- **Priority**: Higher priority jobs are processed first
- **Delay**: Schedule jobs for future execution
- **Attempts**: Number of retry attempts (default: 3)
- **Backoff**: Exponential backoff between retries

## Monitoring

```typescript
const manager = createQueueManager();

// Subscribe to job events
manager.onEvent((event) => {
  console.log(event.type, event.queueName, event.jobId);
});

// Get queue stats
const stats = await manager.getQueueStats('autofi:workflow');
console.log(stats);
// { waiting: 5, active: 2, completed: 100, failed: 3, delayed: 1, paused: 0 }
```
