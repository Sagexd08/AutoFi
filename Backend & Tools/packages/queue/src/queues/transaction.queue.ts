import { Queue } from 'bullmq';
import { getRedisConnection } from '../redis.js';
import { QUEUE_NAMES, type BaseJobData, type BaseJobResult } from '../types.js';

export interface TransactionJobData extends BaseJobData {
  transactionId: string;
  chainId: number;
  from: string;
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  agentId?: string;
  executionId?: string;
  stepId?: string;
  simulation?: {
    required: boolean;
    completed: boolean;
    success?: boolean;
  };
}

export interface TransactionJobResult extends BaseJobResult {
  transactionId: string;
  hash?: string;
  blockNumber?: number;
  gasUsed?: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export const transactionQueue = new Queue<TransactionJobData, TransactionJobResult>(
  QUEUE_NAMES.TRANSACTION,
  {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 2000 },
      removeOnFail: { count: 5000 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000, // 3s, 6s, 12s
      },
    },
  }
);

// Helper functions
export async function queueTransaction(
  data: Omit<TransactionJobData, 'timestamp'>,
  options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }
): Promise<string> {
  const job = await transactionQueue.add(
    'broadcast-transaction',
    {
      ...data,
      timestamp: Date.now(),
    },
    {
      priority: options?.priority ?? (data.chainId === 1 ? 10 : 5), // Higher priority for mainnet
      delay: options?.delay,
      jobId: options?.jobId ?? data.transactionId,
    }
  );
  return job.id ?? '';
}

export async function queueBatchTransactions(
  transactions: Omit<TransactionJobData, 'timestamp'>[],
  options?: { priority?: number }
): Promise<string[]> {
  const jobs = await transactionQueue.addBulk(
    transactions.map((tx, index) => ({
      name: 'broadcast-transaction',
      data: { ...tx, timestamp: Date.now() },
      opts: {
        priority: options?.priority,
        delay: index * 500, // Stagger by 500ms
      },
    }))
  );
  return jobs.map((job) => job.id ?? '');
}

export async function getTransactionJob(jobId: string) {
  return transactionQueue.getJob(jobId);
}
