
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {

  failureThreshold?: number;

  windowMs?: number;

  timeoutMs?: number;

  shouldFail?: (error: unknown) => boolean;
}

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  windowMs: 60000,
  timeoutMs: 30000,
  shouldFail: () => true,
};

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number[] = [];
  private lastFailureTime?: number;
  private config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {

      if (this.shouldAttemptHalfOpen()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {

      this.state = 'closed';
      this.failures = [];
      this.lastFailureTime = undefined;
    } else if (this.state === 'closed') {

      this.cleanupFailures();
    }
  }

  private onFailure(error: unknown): void {
    if (!this.config.shouldFail(error)) {
      return;
    }

    const now = Date.now();
    this.failures.push(now);
    this.lastFailureTime = now;

    this.cleanupFailures();

    if (this.state === 'half-open') {

      this.state = 'open';
    } else if (this.state === 'closed') {

      if (this.failures.length >= this.config.failureThreshold) {
        this.state = 'open';
      }
    }
  }

  private shouldAttemptHalfOpen(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }

    return Date.now() - this.lastFailureTime >= this.config.timeoutMs;
  }

  private cleanupFailures(): void {
    const now = Date.now();
    this.failures = this.failures.filter(
      (time) => now - time < this.config.windowMs
    );
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    this.cleanupFailures();
    return this.failures.length;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = [];
    this.lastFailureTime = undefined;
  }

  open(): void {
    this.state = 'open';
    this.lastFailureTime = Date.now();
  }
}

