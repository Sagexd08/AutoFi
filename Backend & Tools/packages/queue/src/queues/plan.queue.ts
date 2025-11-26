import { Queue } from 'bullmq';
import { getRedisConnection } from '../redis.js';
import { QUEUE_NAMES, type BaseJobData, type BaseJobResult } from '../types.js';

export interface PlanJobData extends BaseJobData {
  planId: string;
  plan: any; // ExecutionPlan
  userId: string;
}

export interface PlanJobResult extends BaseJobResult {
  executionId: string;
  transactionHashes: string[];
  stepsCompleted: number;
  stepsFailed: number;
  transactionIds?: string[];
}

export const planQueue = new Queue<PlanJobData, PlanJobResult>(
  QUEUE_NAMES.PLAN_EXECUTION,
  {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
      attempts: 1, // Orchestrator handles retries internally
    },
  }
);
