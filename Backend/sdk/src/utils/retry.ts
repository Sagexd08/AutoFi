import { SDKError } from '../errors';

import { ERROR_CODES } from '../constants/errors';

export interface RetryConfig {

  maxAttempts: number;

  initialDelay: number;

  maxDelay: number;

  backoffMultiplier: number;

  useJitter: boolean;

  shouldRetry?: (error: unknown) => boolean;

  onRetry?: (attempt: number, error: unknown) => void;

}

const DEFAULT_RETRY_CONFIG: RetryConfig = {

  maxAttempts: 3,

  initialDelay: 1000,

  maxDelay: 30000,

  backoffMultiplier: 2,

  useJitter: true,

};

enum CircuitState {

  CLOSED = 'closed',

  OPEN = 'open',

  HALF_OPEN = 'half-open',

}

export interface CircuitBreakerConfig {

  failureThreshold: number;

  recoveryTimeout: number;

  timeoutWindow: number;

}

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {

  failureThreshold: 5,

  recoveryTimeout: 60000,

  timeoutWindow: 60000,

};

export class CircuitBreaker {

  private state: CircuitState = CircuitState.CLOSED;

  private failures: number[] = [];

  private readonly config: CircuitBreakerConfig;

  private lastFailureTime?: number;

  private halfOpenInProgress: boolean = false;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {

    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };

  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {

    if (this.state === CircuitState.OPEN) {

      if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.config.recoveryTimeout) {


        if (this.halfOpenInProgress) {

          throw new SDKError(

            ERROR_CODES.NETWORK_ERROR,

            'Circuit breaker is open. Service is unavailable.',

            { recoverable: true }

          );

        }

        this.halfOpenInProgress = true;

        this.state = CircuitState.HALF_OPEN;

      } else {

        throw new SDKError(

          ERROR_CODES.NETWORK_ERROR,

          'Circuit breaker is open. Service is unavailable.',

          { recoverable: true }

        );

      }

    }

    try {

      const result = await fn();

      this.onSuccess();

      return result;

    } catch (error) {

      this.onFailure();

      throw error;

    } finally {


      if (this.state !== CircuitState.HALF_OPEN) {

        this.halfOpenInProgress = false;

      }

    }

  }

  private onSuccess(): void {

    if (this.state === CircuitState.HALF_OPEN) {

      this.state = CircuitState.CLOSED;

      this.failures = [];

      this.lastFailureTime = undefined;

      this.halfOpenInProgress = false;

    }

  }

  private onFailure(): void {

    const now = Date.now();

    this.lastFailureTime = now;

    this.failures.push(now);


    this.failures = this.failures.filter(

      (failureTime) => now - failureTime < this.config.timeoutWindow

    );

    if (this.failures.length >= this.config.failureThreshold) {

      const wasHalfOpen = this.state === CircuitState.HALF_OPEN;

      this.state = CircuitState.OPEN;

      if (wasHalfOpen) {

        this.halfOpenInProgress = false;

      }

    }

  }

  getState(): CircuitState {

    return this.state;

  }

  reset(): void {

    this.state = CircuitState.CLOSED;

    this.failures = [];

    this.lastFailureTime = undefined;

    this.halfOpenInProgress = false;

  }

}

function calculateDelay(attempt: number, config: RetryConfig): number {

  let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);

  if (delay > config.maxDelay) {

    delay = config.maxDelay;

  }

  if (config.useJitter) {


    const jitter = delay * 0.25 * Math.random();

    delay = delay + jitter;

  }

  return Math.floor(delay);

}

function defaultShouldRetry(error: unknown): boolean {

  if (error instanceof SDKError) {

    return error.recoverable && error.code !== ERROR_CODES.VALIDATION_ERROR;

  }


  if (error instanceof Error) {

    const message = error.message.toLowerCase();

    return (

      message.includes('network') ||

      message.includes('timeout') ||

      message.includes('econnreset') ||

      message.includes('etimedout')

    );

  }

  return false;

}

export async function retryWithBackoff<T>(

  fn: () => Promise<T>,

  config: Partial<RetryConfig> = {},

  circuitBreaker?: CircuitBreaker

): Promise<T> {

  const retryConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  const shouldRetry = retryConfig.shouldRetry ?? defaultShouldRetry;

  let lastError: unknown;

  for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {

    try {

      if (circuitBreaker) {

        return await circuitBreaker.execute(fn);

      }

      return await fn();

    } catch (error) {

      lastError = error;

      if (attempt === retryConfig.maxAttempts - 1 || !shouldRetry(error)) {

        throw error;

      }

      if (retryConfig.onRetry) {

        retryConfig.onRetry(attempt + 1, error);

      }

      const delay = calculateDelay(attempt, retryConfig);

      await new Promise((resolve) => setTimeout(resolve, delay));

    }

  }

  throw lastError;

}

export function createRetryFunction<T>(

  config: Partial<RetryConfig> = {},

  circuitBreaker?: CircuitBreaker

): (fn: () => Promise<T>) => Promise<T> {

  return (fn: () => Promise<T>) => retryWithBackoff(fn, config, circuitBreaker);

}

