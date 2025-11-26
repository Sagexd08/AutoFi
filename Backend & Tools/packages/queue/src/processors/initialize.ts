import { Job } from 'bullmq';
import { createQueueManager } from '../queue-manager.js';
import { QUEUE_NAMES } from '../types.js';
import { workflowProcessor } from './workflow.processor.js';
import { transactionProcessor } from './transaction.processor.js';
import { simulationProcessor } from './simulation.processor.js';
import { notificationProcessor } from './notification.processor.js';
import type { WorkflowJobData, WorkflowJobResult } from '../queues/workflow.queue.js';
import type { TransactionJobData, TransactionJobResult } from '../queues/transaction.queue.js';
import type { SimulationJobData, SimulationJobResult } from '../queues/simulation.queue.js';
import type { NotificationJobData } from '../queues/notification.queue.js';

/**
 * Initialize all queue processors
 * Call this on application startup to begin processing jobs
 */
export function initializeAllProcessors(options?: {
  workflowConcurrency?: number;
  transactionConcurrency?: number;
  simulationConcurrency?: number;
  notificationConcurrency?: number;
}): void {
  const manager = createQueueManager();

  console.log('🚀 Initializing queue processors...');

  // Workflow processor
  manager.registerWorker<WorkflowJobData, WorkflowJobResult>(
    QUEUE_NAMES.WORKFLOW,
    (job: Job<WorkflowJobData>) => workflowProcessor.process(job),
    { concurrency: options?.workflowConcurrency ?? 3 }
  );

  // Transaction processor
  manager.registerWorker<TransactionJobData, TransactionJobResult>(
    QUEUE_NAMES.TRANSACTION,
    (job: Job<TransactionJobData>) => transactionProcessor.process(job),
    { concurrency: options?.transactionConcurrency ?? 5 }
  );

  // Simulation processor
  manager.registerWorker<SimulationJobData, SimulationJobResult>(
    QUEUE_NAMES.SIMULATION,
    (job: Job<SimulationJobData>) => simulationProcessor.process(job),
    { concurrency: options?.simulationConcurrency ?? 10 }
  );

  // Notification processor
  manager.registerWorker<NotificationJobData, { success: boolean; channels: string[] }>(
    QUEUE_NAMES.NOTIFICATION,
    (job: Job<NotificationJobData>) => notificationProcessor.process(job),
    { concurrency: options?.notificationConcurrency ?? 10 }
  );

  console.log('✅ All queue processors initialized');

  // Set up global event logging
  manager.onEvent((event) => {
    if (event.type === 'job:failed') {
      console.error(`[Queue] Job failed: ${event.queueName}/${event.jobId}`, event.error);
    } else if (event.type === 'job:completed') {
      console.log(`[Queue] Job completed: ${event.queueName}/${event.jobId}`);
    }
  });
}

/**
 * Start a standalone worker process
 * Use this for dedicated worker servers
 */
export async function startWorkerProcess(): Promise<void> {
  console.log('🏭 Starting Autofi worker process...');
  
  initializeAllProcessors();

  // Keep process alive
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    const manager = createQueueManager();
    await manager.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    const manager = createQueueManager();
    await manager.shutdown();
    process.exit(0);
  });

  console.log('✅ Worker process started. Waiting for jobs...');
}
