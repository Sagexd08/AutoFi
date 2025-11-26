import type { JobsOptions } from 'bullmq';

export interface QueueConfig {
  name: string;
  defaultJobOptions?: JobsOptions;
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

export interface JobProgress {
  percentage?: number;
  message?: string;
  step?: string;
  data?: Record<string, unknown>;
}

export interface RetryConfig {
  maxRetries: number;
  backoff: {
    type: 'exponential' | 'fixed';
    delay: number; // base delay in ms
  };
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s
  },
};

export const QUEUE_NAMES = {
  WORKFLOW: 'autofi:workflow',
  TRANSACTION: 'autofi:transaction',
  SIMULATION: 'autofi:simulation',
  NOTIFICATION: 'autofi:notification',
  SCHEDULED: 'autofi:scheduled',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

export interface BaseJobData {
  userId?: string;
  correlationId?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface BaseJobResult {
  success: boolean;
  message?: string;
  error?: string;
  duration?: number;
  data?: Record<string, unknown>;
}

// Job event types for real-time updates
export type JobEventType = 
  | 'job:queued'
  | 'job:active'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'job:stalled'
  | 'job:delayed';

export interface JobEvent {
  type: JobEventType;
  queueName: string;
  jobId: string;
  data?: unknown;
  progress?: JobProgress;
  result?: unknown;
  error?: string;
  timestamp: number;
}
