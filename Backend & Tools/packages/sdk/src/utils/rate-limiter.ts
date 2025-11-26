
export interface RateLimiterConfig {

  maxRequests: number;

  windowMs: number;

  strategy?: 'throw' | 'wait' | 'queue';
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, RateLimitEntry>();
  private config: Required<RateLimiterConfig>;
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    key: string;
  }> = [];
  private processingQueue = false;

  constructor(config: RateLimiterConfig) {
    this.config = {
      strategy: 'throw',
      ...config,
    };
  }

  async check(key: string = 'default'): Promise<void> {
    const now = Date.now();
    let entry = this.buckets.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + this.config.windowMs,
      };
      this.buckets.set(key, entry);
    }

    if (entry.count >= this.config.maxRequests) {
      switch (this.config.strategy) {
        case 'throw':
          throw new Error(
            `Rate limit exceeded: ${this.config.maxRequests} requests per ${this.config.windowMs}ms`
          );
        case 'wait':
          await this.waitForReset(key, entry.resetAt);
          return this.check(key);
        case 'queue':
          return this.queueRequest(key);
        default:
          throw new Error(`Unknown rate limit strategy: ${this.config.strategy}`);
      }
    }

    entry.count++;
  }

  private async waitForReset(key: string, resetAt: number): Promise<void> {
    const waitTime = resetAt - Date.now();
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      this.buckets.delete(key);
    }
  }

  private async queueRequest(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, key });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.queue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      try {
        await this.check(item.key);
        this.queue.shift();
        item.resolve();
      } catch (error) {

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.processingQueue = false;
  }

  reset(key: string = 'default'): void {
    this.buckets.delete(key);
  }

  resetAll(): void {
    this.buckets.clear();
  }

  getStatus(key: string = 'default'): {
    remaining: number;
    resetAt: number;
    queued: number;
  } {
    const entry = this.buckets.get(key);
    const remaining = entry
      ? Math.max(0, this.config.maxRequests - entry.count)
      : this.config.maxRequests;

    return {
      remaining,
      resetAt: entry?.resetAt ?? Date.now() + this.config.windowMs,
      queued: this.queue.filter((item) => item.key === key).length,
    };
  }
}

