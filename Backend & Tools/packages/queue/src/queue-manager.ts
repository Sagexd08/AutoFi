import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { getRedisConnection, closeRedisConnection } from './redis.js';
import { QUEUE_NAMES, type QueueName, type JobEvent } from './types.js';

export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private eventHandlers: Map<string, Set<(event: JobEvent) => void>> = new Map();

  constructor() {
    // Initialize Redis connection
    getRedisConnection();
  }

  /**
   * Get or create a queue
   */
  getQueue<T = unknown>(name: QueueName): Queue<T> {
    if (!this.queues.has(name)) {
      const queue = new Queue<T>(name, {
        connection: getRedisConnection(),
        defaultJobOptions: {
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name) as Queue<T>;
  }

  /**
   * Register a worker for a queue
   */
  registerWorker<T = unknown, R = unknown>(
    name: QueueName,
    processor: (job: Job<T>) => Promise<R>,
    options?: { concurrency?: number }
  ): Worker<T, R> {
    if (this.workers.has(name)) {
      return this.workers.get(name) as Worker<T, R>;
    }

    const worker = new Worker<T, R>(name, processor, {
      connection: getRedisConnection(),
      concurrency: options?.concurrency ?? 5,
    });

    // Set up event handling
    worker.on('completed', (job) => {
      this.emitEvent({
        type: 'job:completed',
        queueName: name,
        jobId: job?.id ?? '',
        result: undefined,
        timestamp: Date.now(),
      });
    });

    worker.on('failed', (job, error) => {
      this.emitEvent({
        type: 'job:failed',
        queueName: name,
        jobId: job?.id ?? '',
        error: error?.message ?? 'Unknown error',
        timestamp: Date.now(),
      });
    });

    worker.on('progress', (job, progress) => {
      this.emitEvent({
        type: 'job:progress',
        queueName: name,
        jobId: job?.id ?? '',
        progress: typeof progress === 'number' ? { percentage: progress } : progress as object,
        timestamp: Date.now(),
      });
    });

    worker.on('stalled', (jobId) => {
      this.emitEvent({
        type: 'job:stalled',
        queueName: name,
        jobId: jobId ?? '',
        timestamp: Date.now(),
      });
    });

    this.workers.set(name, worker);
    console.log(`✅ Worker registered for queue: ${name}`);
    return worker;
  }

  /**
   * Get queue events for a queue
   */
  getQueueEvents(name: QueueName): QueueEvents {
    if (!this.queueEvents.has(name)) {
      const events = new QueueEvents(name, {
        connection: getRedisConnection(),
      });
      this.queueEvents.set(name, events);
    }
    return this.queueEvents.get(name)!;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
      backoff?: { type: 'exponential' | 'fixed'; delay: number };
      jobId?: string;
    }
  ): Promise<Job<T>> {
    // Use any to avoid BullMQ's complex generic constraints
    const queue = this.getQueue(queueName) as unknown as Queue;
    const job = await queue.add(jobName, data as object, {
      ...options,
    });

    this.emitEvent({
      type: 'job:queued',
      queueName,
      jobId: job.id ?? '',
      data,
      timestamp: Date.now(),
    });

    return job as unknown as Job<T>;
  }

  /**
   * Add a delayed/scheduled job
   */
  async scheduleJob<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    runAt: Date
  ): Promise<Job<T>> {
    const delay = Math.max(0, runAt.getTime() - Date.now());
    return this.addJob(queueName, jobName, data, { delay });
  }

  /**
   * Add a recurring job (cron-like)
   */
  async addRecurringJob<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    pattern: string, // cron pattern
    options?: { jobId?: string }
  ): Promise<void> {
    // Use any to avoid BullMQ's complex generic constraints
    const queue = this.getQueue(queueName) as unknown as Queue;
    await queue.upsertJobScheduler(
      options?.jobId ?? `recurring:${jobName}`,
      { pattern },
      { name: jobName, data: data as object }
    );
  }

  /**
   * Get job by ID
   */
  async getJob<T>(queueName: QueueName, jobId: string): Promise<Job<T> | undefined> {
    const queue = this.getQueue(queueName) as unknown as Queue;
    const job = await queue.getJob(jobId);
    return job as unknown as Job<T> | undefined;
  }

  /**
   * Get queue stats
   */
  async getQueueStats(queueName: QueueName): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    // Check if queue is paused
    const isPaused = await queue.isPaused();
    return { waiting, active, completed, failed, delayed, paused: isPaused ? 1 : 0 };
  }

  /**
   * Get all queue stats
   */
  async getAllQueueStats(): Promise<Record<string, Awaited<ReturnType<typeof this.getQueueStats>>>> {
    const stats: Record<string, Awaited<ReturnType<typeof this.getQueueStats>>> = {};
    for (const name of Object.values(QUEUE_NAMES)) {
      stats[name] = await this.getQueueStats(name);
    }
    return stats;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    console.log(`Queue paused: ${queueName}`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    console.log(`Queue resumed: ${queueName}`);
  }

  /**
   * Clean old jobs from a queue
   */
  async cleanQueue(
    queueName: QueueName,
    grace: number = 24 * 60 * 60 * 1000, // 24 hours default
    status: 'completed' | 'failed' = 'completed'
  ): Promise<string[]> {
    const queue = this.getQueue(queueName);
    return queue.clean(grace, 1000, status);
  }

  /**
   * Register event handler
   */
  onEvent(handler: (event: JobEvent) => void, queueName?: QueueName): () => void {
    const key = queueName ?? '*';
    if (!this.eventHandlers.has(key)) {
      this.eventHandlers.set(key, new Set());
    }
    this.eventHandlers.get(key)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(key)?.delete(handler);
    };
  }

  /**
   * Emit event to handlers
   */
  private emitEvent(event: JobEvent): void {
    // Emit to specific queue handlers
    this.eventHandlers.get(event.queueName)?.forEach((handler) => handler(event));
    // Emit to global handlers
    this.eventHandlers.get('*')?.forEach((handler) => handler(event));
  }

  /**
   * Gracefully shutdown all queues and workers
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down queue manager...');

    // Close workers first
    for (const [name, worker] of this.workers) {
      console.log(`Closing worker: ${name}`);
      await worker.close();
    }
    this.workers.clear();

    // Close queue events
    for (const [name, events] of this.queueEvents) {
      console.log(`Closing queue events: ${name}`);
      await events.close();
    }
    this.queueEvents.clear();

    // Close queues
    for (const [name, queue] of this.queues) {
      console.log(`Closing queue: ${name}`);
      await queue.close();
    }
    this.queues.clear();

    // Close Redis connection
    await closeRedisConnection();

    console.log('✅ Queue manager shutdown complete');
  }
}

// Singleton instance
let queueManager: QueueManager | null = null;

export function createQueueManager(): QueueManager {
  if (!queueManager) {
    queueManager = new QueueManager();
  }
  return queueManager;
}

export function getQueueManager(): QueueManager {
  if (!queueManager) {
    return createQueueManager();
  }
  return queueManager;
}
