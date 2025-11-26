
export interface RetryConfig {

  maxAttempts?: number;

  initialDelayMs?: number;

  maxDelayMs?: number;

  multiplier?: number;

  jitter?: number;

  shouldRetry?: (error: unknown, attempt: number) => boolean;

  calculateDelay?: (attempt: number, config: RetryConfig) => number;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
  jitter: 0.1,
  shouldRetry: () => true,
  calculateDelay: (attempt, config) => {
    const initialDelay = config.initialDelayMs ?? DEFAULT_RETRY_CONFIG.initialDelayMs;
    const multiplier = config.multiplier ?? DEFAULT_RETRY_CONFIG.multiplier;
    const jitter = config.jitter ?? DEFAULT_RETRY_CONFIG.jitter;
    const maxDelay = config.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs;
    const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
    const jitterAmount = exponentialDelay * jitter * (Math.random() * 2 - 1);
    return Math.min(exponentialDelay + jitterAmount, maxDelay);
  },
};

export function isRetryableStatus(status: number): boolean {

  return status >= 500 || status === 408 || status === 429;
}

export function shouldRetryError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    if (status !== undefined) {
      return isRetryableStatus(status);
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
    );
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const shouldRetry = typeof config.shouldRetry === 'function'
    ? config.shouldRetry
    : shouldRetryError;

  let lastError: unknown;
  let attempt = 0;

  while (attempt < finalConfig.maxAttempts) {
    attempt++;

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const shouldRetryResult = await Promise.resolve(shouldRetry(error, attempt));
      if (attempt >= finalConfig.maxAttempts || !shouldRetryResult) {
        throw error;
      }

      const delay = finalConfig.calculateDelay(attempt, finalConfig);
      await sleep(Math.max(0, delay));
    }
  }

  throw lastError;
}

export const RetryStrategies = {

  exponential: (config?: Partial<RetryConfig>): RetryConfig => ({
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  }),

  linear: (delayMs: number = 1000, config?: Partial<RetryConfig>): RetryConfig => ({
    ...DEFAULT_RETRY_CONFIG,
    ...config,
    calculateDelay: () => delayMs,
  }),

  fixed: (delayMs: number = 1000, config?: Partial<RetryConfig>): RetryConfig => ({
    ...DEFAULT_RETRY_CONFIG,
    ...config,
    calculateDelay: () => delayMs,
  }),

  aggressive: (config?: Partial<RetryConfig>): RetryConfig => ({
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 5,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    ...config,
  }),

  conservative: (config?: Partial<RetryConfig>): RetryConfig => ({
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 2,
    initialDelayMs: 2000,
    maxDelayMs: 60000,
    ...config,
  }),
};

