import { SDKError } from '../errors';
import { ERROR_CODES } from '../constants/errors';

/**
 * Retry configuration options.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Whether to add jitter to delays */
  useJitter: boolean;
  /** Function to determine if an error should trigger a retry */
  shouldRetry?: (error: unknown) => boolean;
  /** Function called before each retry attempt */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Default retry configuration.
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  useJitter: true,
};

/**
 * Circuit breaker state.
 */
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

/**
 * Circuit breaker configuration.
 */
export interface CircuitBreakerConfig {
  /** Failure threshold before opening circuit */
  failureThreshold: number;
  /** Time in milliseconds to wait before attempting to close circuit */
  recoveryTimeout: number;
  /** Time window in milliseconds for tracking failures */
  timeoutWindow: number;
}

/**
 * Default circuit breaker configuration.
 */
const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 60000,
  timeoutWindow: 60000,
};

/**
 * Circuit breaker implementation for preventing cascading failures.
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number[] = [];
  private readonly config: CircuitBreakerConfig;
  private lastFailureTime?: number;
  private halfOpenInProgress: boolean = false;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  /**
   * Executes a function with circuit breaker protection.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.config.recoveryTimeout) {
        // Atomic check-and-set: only one concurrent request can transition to HALF_OPEN
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
      // Clear the flag in all outcomes to allow subsequent probes
      if (this.state !== CircuitState.HALF_OPEN) {
        this.halfOpenInProgress = false;
      }
    }
  }

  /**
   * Handles successful execution.
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failures = [];
      this.lastFailureTime = undefined;
      this.halfOpenInProgress = false;
    }
  }

  /**
   * Handles failed execution.
   */
  private onFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failures.push(now);

    // Remove failures outside the timeout window
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

  /**
   * Gets the current circuit state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Resets the circuit breaker.
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.lastFailureTime = undefined;
    this.halfOpenInProgress = false;
  }
}

/**
 * Calculates delay with exponential backoff and optional jitter.
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);

  if (delay > config.maxDelay) {
    delay = config.maxDelay;
  }

  if (config.useJitter) {
    // Add random jitter up to 25% of the delay
    const jitter = delay * 0.25 * Math.random();
    delay = delay + jitter;
  }

  return Math.floor(delay);
}

/**
 * Default function to determine if an error should be retried.
 */
function defaultShouldRetry(error: unknown): boolean {
  if (error instanceof SDKError) {
    return error.recoverable && error.code !== ERROR_CODES.VALIDATION_ERROR;
  }

  // Retry network errors and timeouts
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

/**
 * Retries a function with exponential backoff and circuit breaker support.
 * 
 * @param fn - Function to retry
 * @param config - Retry configuration
 * @param circuitBreaker - Optional circuit breaker instance
 * @returns Result of the function
 * @throws The last error if all retries fail
 */
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
