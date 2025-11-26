/**
 * Queue Workers Entry Point
 * 
 * Initializes BullMQ workers for processing async jobs:
 * - Workflow execution
 * - Transaction processing
 * - Simulation requests
 * - Notifications
 */

import { 
  initializeAllProcessors, 
  createQueueManager,
  workflowQueue,
  transactionQueue,
  simulationQueue,
  notificationQueue,
} from '@autofi/queue';
import { getChainRegistry } from '@autofi/chain-adapter';
import { 
  transactionRepository, 
} from '@autofi/database';
import { logger } from '../utils/logger.js';
import { wsService } from '../services/websocket.js';
import { notificationService } from '../services/notification.js';

// ============================================================================
// Worker Configuration
// ============================================================================

interface WorkerConfig {
  workflowConcurrency: number;
  transactionConcurrency: number;
  simulationConcurrency: number;
  notificationConcurrency: number;
}

const defaultConfig: WorkerConfig = {
  workflowConcurrency: parseInt(process.env.WORKFLOW_CONCURRENCY || '3'),
  transactionConcurrency: parseInt(process.env.TRANSACTION_CONCURRENCY || '5'),
  simulationConcurrency: parseInt(process.env.SIMULATION_CONCURRENCY || '10'),
  notificationConcurrency: parseInt(process.env.NOTIFICATION_CONCURRENCY || '10'),
};

// ============================================================================
// Chain Registry Setup
// ============================================================================

import type { ChainAdapterRegistry } from '@autofi/chain-adapter';

let chainRegistry: ChainAdapterRegistry | null = null;

function initializeChainRegistry(): ChainAdapterRegistry {
  if (chainRegistry) return chainRegistry;

  // Build RPC overrides from environment
  const rpcOverrides: Record<number, string> = {};
  
  if (process.env.CELO_RPC_URL) {
    rpcOverrides[42220] = process.env.CELO_RPC_URL;
  }
  if (process.env.CELO_ALFAJORES_RPC_URL) {
    rpcOverrides[44787] = process.env.CELO_ALFAJORES_RPC_URL;
  }
  if (process.env.ETH_RPC_URL) {
    rpcOverrides[1] = process.env.ETH_RPC_URL;
  }
  if (process.env.ETH_SEPOLIA_RPC_URL) {
    rpcOverrides[11155111] = process.env.ETH_SEPOLIA_RPC_URL;
  }
  if (process.env.POLYGON_RPC_URL) {
    rpcOverrides[137] = process.env.POLYGON_RPC_URL;
  }
  if (process.env.ARBITRUM_RPC_URL) {
    rpcOverrides[42161] = process.env.ARBITRUM_RPC_URL;
  }
  if (process.env.BASE_RPC_URL) {
    rpcOverrides[8453] = process.env.BASE_RPC_URL;
  }

  chainRegistry = getChainRegistry({
    privateKey: process.env.PRIVATE_KEY,
    rpcOverrides,
  });

  logger.info({ chains: Object.keys(rpcOverrides).map(Number) }, 'Chain registry initialized');

  return chainRegistry;
}

// ============================================================================
// Job Event Handlers
// ============================================================================

async function setupJobEventHandlers(): Promise<void> {
  const manager = createQueueManager();

  manager.onEvent(async (event) => {
    if (event.type === 'job:completed') {
      await handleJobCompleted(event.queueName, event.jobId, event.result);
    } else if (event.type === 'job:failed') {
      await handleJobFailed(event.queueName, event.jobId, event.error || 'Unknown error');
    } else if (event.type === 'job:progress') {
      await handleJobProgress(event.queueName, event.jobId, event.progress || { percentage: 0 });
    }
  });

  logger.info('Job event handlers initialized');
}

async function handleJobCompleted(
  queueName: string, 
  jobId: string, 
  result: unknown
): Promise<void> {
  logger.info({ queueName, jobId }, 'Job completed');

  // Broadcast via WebSocket - use system:alert for job events
  wsService.broadcast({
    type: 'system:alert',
    timestamp: new Date().toISOString(),
    data: {
      event: 'job_completed',
      queue: queueName,
      jobId,
      result,
    },
  });

  // Update database based on job type
  try {
    if (queueName === 'autofi:transaction') {
      // Transaction job completed - update transaction status
      const txResult = result as { txHash?: string; transactionId?: string };
      if (txResult.transactionId) {
        await transactionRepository.update(txResult.transactionId, {
          status: 'CONFIRMED',
          hash: txResult.txHash,
        });
      }
    } else if (queueName === 'autofi:workflow') {
      // Workflow job completed
      logger.info({ jobId, result }, 'Workflow job completed');
    }
  } catch (error) {
    logger.error({ error, queueName, jobId }, 'Failed to update database on job completion');
  }
}

async function handleJobFailed(
  queueName: string, 
  jobId: string, 
  error: string
): Promise<void> {
  logger.error({ queueName, jobId, error }, 'Job failed');

  // Broadcast via WebSocket
  wsService.broadcast({
    type: 'system:alert',
    timestamp: new Date().toISOString(),
    data: {
      event: 'job_failed',
      queue: queueName,
      jobId,
      error,
    },
  });

  // Send notification for critical failures
  if (queueName === 'autofi:transaction') {
    await notificationService.notify({
      type: 'transaction:failed',
      title: 'Transaction Job Failed',
      message: `Job ${jobId} failed: ${error}`,
      severity: 'error',
      data: {
        jobId,
        error,
      },
    });
  }
}

async function handleJobProgress(
  queueName: string, 
  jobId: string, 
  progress: object
): Promise<void> {
  // Broadcast progress via WebSocket
  wsService.broadcast({
    type: 'system:alert',
    timestamp: new Date().toISOString(),
    data: {
      event: 'job_progress',
      queue: queueName,
      jobId,
      progress,
    },
  });
}

// ============================================================================
// Worker Lifecycle Management
// ============================================================================

let isWorkerRunning = false;

/**
 * Initialize and start all queue workers
 */
export async function startWorkers(config: Partial<WorkerConfig> = {}): Promise<void> {
  if (isWorkerRunning) {
    logger.warn('Workers already running, skipping initialization');
    return;
  }

  const finalConfig = { ...defaultConfig, ...config };

  logger.info({ config: finalConfig }, 'Starting queue workers...');

  // Initialize chain registry for transaction processing
  initializeChainRegistry();

  // Initialize all processors
  initializeAllProcessors({
    workflowConcurrency: finalConfig.workflowConcurrency,
    transactionConcurrency: finalConfig.transactionConcurrency,
    simulationConcurrency: finalConfig.simulationConcurrency,
    notificationConcurrency: finalConfig.notificationConcurrency,
  });

  // Set up job event handlers
  await setupJobEventHandlers();

  isWorkerRunning = true;
  logger.info('Queue workers started successfully');
}

/**
 * Stop all queue workers gracefully
 */
export async function stopWorkers(): Promise<void> {
  if (!isWorkerRunning) {
    logger.warn('Workers not running, skipping shutdown');
    return;
  }

  logger.info('Stopping queue workers...');

  const manager = createQueueManager();
  await manager.shutdown();

  isWorkerRunning = false;
  logger.info('Queue workers stopped');
}

/**
 * Get current worker status
 */
export function getWorkerStatus(): {
  running: boolean;
  queues: Record<string, { pending: number; active: number; completed: number; failed: number }>;
} {
  return {
    running: isWorkerRunning,
    queues: {
      workflow: { pending: 0, active: 0, completed: 0, failed: 0 },
      transaction: { pending: 0, active: 0, completed: 0, failed: 0 },
      simulation: { pending: 0, active: 0, completed: 0, failed: 0 },
      notification: { pending: 0, active: 0, completed: 0, failed: 0 },
    },
  };
}

/**
 * Get detailed queue metrics
 */
export async function getQueueMetrics(): Promise<{
  queues: Record<string, {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }>;
  redis: {
    connected: boolean;
  };
}> {
  try {
    const [
      workflowWaiting,
      workflowActive,
      workflowCompleted,
      workflowFailed,
      workflowDelayed,
    ] = await Promise.all([
      workflowQueue.getWaitingCount(),
      workflowQueue.getActiveCount(),
      workflowQueue.getCompletedCount(),
      workflowQueue.getFailedCount(),
      workflowQueue.getDelayedCount(),
    ]);

    const [
      txWaiting,
      txActive,
      txCompleted,
      txFailed,
      txDelayed,
    ] = await Promise.all([
      transactionQueue.getWaitingCount(),
      transactionQueue.getActiveCount(),
      transactionQueue.getCompletedCount(),
      transactionQueue.getFailedCount(),
      transactionQueue.getDelayedCount(),
    ]);

    const [
      simWaiting,
      simActive,
      simCompleted,
      simFailed,
      simDelayed,
    ] = await Promise.all([
      simulationQueue.getWaitingCount(),
      simulationQueue.getActiveCount(),
      simulationQueue.getCompletedCount(),
      simulationQueue.getFailedCount(),
      simulationQueue.getDelayedCount(),
    ]);

    const [
      notifWaiting,
      notifActive,
      notifCompleted,
      notifFailed,
      notifDelayed,
    ] = await Promise.all([
      notificationQueue.getWaitingCount(),
      notificationQueue.getActiveCount(),
      notificationQueue.getCompletedCount(),
      notificationQueue.getFailedCount(),
      notificationQueue.getDelayedCount(),
    ]);

    return {
      queues: {
        workflow: {
          waiting: workflowWaiting,
          active: workflowActive,
          completed: workflowCompleted,
          failed: workflowFailed,
          delayed: workflowDelayed,
        },
        transaction: {
          waiting: txWaiting,
          active: txActive,
          completed: txCompleted,
          failed: txFailed,
          delayed: txDelayed,
        },
        simulation: {
          waiting: simWaiting,
          active: simActive,
          completed: simCompleted,
          failed: simFailed,
          delayed: simDelayed,
        },
        notification: {
          waiting: notifWaiting,
          active: notifActive,
          completed: notifCompleted,
          failed: notifFailed,
          delayed: notifDelayed,
        },
      },
      redis: {
        connected: true, // Would need to check actual connection status
      },
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get queue metrics');
    throw error;
  }
}

// ============================================================================
// Job Submission Helpers
// ============================================================================

import type { WorkflowJobData } from '@autofi/queue';

/**
 * Submit a workflow execution job
 */
export async function submitWorkflowJob(data: {
  workflowId: string;
  trigger?: {
    type: 'manual' | 'scheduled' | 'event' | 'condition';
    data?: Record<string, unknown>;
  };
  userId?: string;
}): Promise<string> {
  const jobData: WorkflowJobData = {
    workflowId: data.workflowId,
    trigger: data.trigger,
    userId: data.userId,
  };

  const job = await workflowQueue.add('execute', jobData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });

  logger.info({ jobId: job.id, workflowId: data.workflowId }, 'Workflow job submitted');
  return job.id!;
}

/**
 * Submit a transaction processing job
 */
export async function submitTransactionJob(data: {
  transactionId: string;
  chainId: number;
  from: string;
  to: string;
  value?: string;
  data?: string;
  privateKey: string;
}): Promise<string> {
  const job = await transactionQueue.add('process', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });

  logger.info({ jobId: job.id, transactionId: data.transactionId }, 'Transaction job submitted');
  return job.id!;
}

/**
 * Submit a simulation request job
 */
export async function submitSimulationJob(data: {
  chainId: number;
  from: string;
  to: string;
  value?: string;
  data?: string;
}): Promise<string> {
  const job = await simulationQueue.add('simulate', data, {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 500,
    },
  });

  logger.info({ jobId: job.id }, 'Simulation job submitted');
  return job.id!;
}

/**
 * Submit a notification job
 */
export async function submitNotificationJob(data: {
  type: 'info' | 'success' | 'warning' | 'error' | 'approval_request' | 'transaction_update' | 'workflow_update';
  title: string;
  message: string;
  channels: ('email' | 'webhook' | 'push' | 'in_app')[];
  userId?: string;
}): Promise<string> {
  const job = await notificationQueue.add('send', {
    type: data.type,
    title: data.title,
    message: data.message,
    channels: data.channels,
    userId: data.userId,
    timestamp: Date.now(),
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });

  logger.info({ jobId: job.id, type: data.type }, 'Notification job submitted');
  return job.id!;
}

// ============================================================================
// Exports
// ============================================================================

export {
  chainRegistry,
  initializeChainRegistry,
};

export default {
  startWorkers,
  stopWorkers,
  getWorkerStatus,
  getQueueMetrics,
  submitWorkflowJob,
  submitTransactionJob,
  submitSimulationJob,
  submitNotificationJob,
};
