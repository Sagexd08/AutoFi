// Queue client and management
export { QueueManager, createQueueManager } from './queue-manager.js';

// Individual queues
export { workflowQueue } from './queues/workflow.queue.js';
export type { WorkflowJobData, WorkflowJobResult } from './queues/workflow.queue.js';

export { transactionQueue } from './queues/transaction.queue.js';
export type { TransactionJobData, TransactionJobResult } from './queues/transaction.queue.js';

export { simulationQueue } from './queues/simulation.queue.js';
export type { SimulationJobData, SimulationJobResult } from './queues/simulation.queue.js';

export { notificationQueue } from './queues/notification.queue.js';
export type { NotificationJobData } from './queues/notification.queue.js';

// Processors
export * from './processors/index.js';

// Types
export * from './types.js';

// Redis connection
export { redisConnection, createRedisConnection, closeRedisConnection } from './redis.js';
