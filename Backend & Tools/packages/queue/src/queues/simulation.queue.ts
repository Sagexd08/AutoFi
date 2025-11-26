import { Queue } from 'bullmq';
import { getRedisConnection } from '../redis.js';
import { QUEUE_NAMES, type BaseJobData, type BaseJobResult } from '../types.js';

export interface SimulationJobData extends BaseJobData {
  transactionId?: string;
  chainId: number;
  from: string;
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  blockNumber?: number;
  stateOverrides?: Record<string, unknown>;
}

export interface SimulationJobResult extends BaseJobResult {
  transactionId?: string;
  simulationId: string;
  gasUsed: string;
  gasLimit: string;
  wouldSucceed: boolean;
  returnValue?: string;
  revertReason?: string;
  logs?: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
  stateChanges?: Array<{
    address: string;
    key: string;
    before: string;
    after: string;
  }>;
  balanceChanges?: Array<{
    address: string;
    token?: string;
    before: string;
    after: string;
    change: string;
  }>;
  warnings?: string[];
}

export const simulationQueue = new Queue<SimulationJobData, SimulationJobResult>(
  QUEUE_NAMES.SIMULATION,
  {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 500 },
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 1000,
      },
    },
  }
);

// Helper functions
export async function queueSimulation(
  data: Omit<SimulationJobData, 'timestamp'>,
  options?: {
    priority?: number;
    jobId?: string;
  }
): Promise<string> {
  const job = await simulationQueue.add(
    'simulate-transaction',
    {
      ...data,
      timestamp: Date.now(),
    },
    {
      priority: options?.priority ?? 10, // High priority for simulations
      jobId: options?.jobId,
    }
  );
  return job.id ?? '';
}

export async function queueBatchSimulations(
  simulations: Omit<SimulationJobData, 'timestamp'>[]
): Promise<string[]> {
  const jobs = await simulationQueue.addBulk(
    simulations.map((sim) => ({
      name: 'simulate-transaction',
      data: { ...sim, timestamp: Date.now() },
      opts: { priority: 10 },
    }))
  );
  return jobs.map((job) => job.id ?? '');
}

export async function getSimulationResult(jobId: string): Promise<SimulationJobResult | undefined> {
  const job = await simulationQueue.getJob(jobId);
  if (!job) return undefined;
  
  const state = await job.getState();
  if (state === 'completed') {
    return job.returnvalue;
  }
  return undefined;
}
