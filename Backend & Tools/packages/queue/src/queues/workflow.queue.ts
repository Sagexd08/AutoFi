import { Queue } from 'bullmq';
import { getRedisConnection } from '../redis.js';
import { QUEUE_NAMES, type BaseJobData, type BaseJobResult } from '../types.js';

export interface WorkflowJobData extends BaseJobData {
  workflowId: string;
  executionId?: string;
  trigger?: {
    type: 'manual' | 'scheduled' | 'event' | 'condition';
    data?: Record<string, unknown>;
  };
}

export interface WorkflowJobResult extends BaseJobResult {
  executionId: string;
  transactionHashes?: string[];
  stepsCompleted?: number;
  stepsFailed?: number;
}

export const workflowQueue = new Queue<WorkflowJobData, WorkflowJobResult>(
  QUEUE_NAMES.WORKFLOW,
  {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 10s, 20s
      },
    },
  }
);

// Helper functions for common workflow operations
export async function queueWorkflowExecution(
  workflowId: string,
  options?: {
    userId?: string;
    priority?: number;
    delay?: number;
    trigger?: WorkflowJobData['trigger'];
  }
): Promise<string> {
  const job = await workflowQueue.add(
    'execute-workflow',
    {
      workflowId,
      userId: options?.userId,
      trigger: options?.trigger ?? { type: 'manual' },
      timestamp: Date.now(),
    },
    {
      priority: options?.priority,
      delay: options?.delay,
    }
  );
  return job.id ?? '';
}

export async function scheduleWorkflow(
  workflowId: string,
  cronPattern: string,
  options?: { userId?: string }
): Promise<void> {
  await workflowQueue.upsertJobScheduler(
    `scheduled:${workflowId}`,
    { pattern: cronPattern },
    {
      name: 'scheduled-workflow',
      data: {
        workflowId,
        userId: options?.userId,
        trigger: { type: 'scheduled' },
        timestamp: Date.now(),
      },
    }
  );
}

export async function removeScheduledWorkflow(workflowId: string): Promise<boolean> {
  return workflowQueue.removeJobScheduler(`scheduled:${workflowId}`);
}
