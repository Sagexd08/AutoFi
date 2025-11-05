import { Address } from 'viem';

/**
 * Validate Ethereum/Celo address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate and normalize address
 */
export function normalizeAddress(address: string): Address {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid address format: ${address}`);
  }
  return address.toLowerCase() as Address;
}

/**
 * Format amount from wei to readable format
 */
export function formatAmount(amount: bigint | string, decimals: number = 18): string {
  const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const whole = amountBigInt / divisor;
  const fraction = amountBigInt % divisor;
  
  if (fraction === BigInt(0)) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0');
  const trimmed = fractionStr.replace(/0+$/, '');
  
  return `${whole}.${trimmed}`;
}

/**
 * Parse amount from readable format to wei
 */
export function parseAmount(amount: string, decimals: number = 18): bigint {
  const [whole, fraction = ''] = amount.split('.');
  const fractionPadded = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fractionPadded);
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (i === maxRetries) {
        throw lastError;
      }

      await sleep(delay);
      delay = Math.min(delay * factor, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Generate a unique ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  const result = { ...target };

  for (const source of sources) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}
