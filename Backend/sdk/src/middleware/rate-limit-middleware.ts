import type { Middleware, MiddlewareContext } from './types';

/**
 * Rate limit configuration.
 */
export interface RateLimitConfig {
  /** Maximum number of requests */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key generator function */
  getKey: (context: MiddlewareContext) => string;
}

/**
 * Rate limit store entry.
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Rate limit middleware with cleanup capability.
 */
export interface RateLimitMiddleware extends Middleware {
  /** Cleanup method to clear the interval and release resources */
  cleanup: () => void;
  /** Interval ID for manual cleanup if needed */
  intervalId: NodeJS.Timeout;
}

/**
 * Creates a rate limiting middleware.
 * 
 * @param config - Rate limit configuration
 * @returns Rate limit middleware with cleanup capability
 */
export function createRateLimitMiddleware(config: RateLimitConfig): RateLimitMiddleware {
  const store = new Map<string, RateLimitEntry>();
  // Per-key locks to serialize access and prevent race conditions
  const locks = new Map<string, Promise<void>>();

  // Cleanup expired entries periodically
  const intervalId = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  }, config.windowMs);

  // Track if cleanup has been called to prevent double cleanup
  let isCleanedUp = false;

  // Register handlers for graceful shutdown
  // Store references so we can remove them if cleanup is called manually
  const handlers: Array<{ event: string; handler: () => void }> = [];

  /**
   * Cleanup function to clear the interval and release resources.
   * This should be called when the middleware is no longer needed.
   * Safe to call multiple times (idempotent).
   */
  function cleanup(): void {
    if (isCleanedUp) {
      return; // Already cleaned up
    }
    isCleanedUp = true;

    if (intervalId) {
      clearInterval(intervalId);
    }
    // Clear all references to prevent memory leaks
    store.clear();
    locks.clear();

    // Remove process handlers if they were registered
    // Note: process.once() wraps handlers, so removal may not work perfectly,
    // but cleanup is idempotent and handlers only fire once anyway
    if (typeof process !== 'undefined' && handlers.length > 0) {
      for (const { event, handler } of handlers) {
        try {
          process.removeListener(event, handler);
        } catch {
          // Ignore errors if handler was already removed or doesn't exist
        }
      }
    }
  }

  // Register process exit handlers as a safety net
  const exitHandler = () => {
    cleanup();
  };

  if (typeof process !== 'undefined') {
    const events = ['exit', 'SIGTERM', 'SIGINT'] as const;
    for (const event of events) {
      // Use 'once' to ensure handlers only fire once, but also store reference for potential removal
      process.once(event, exitHandler);
      handlers.push({ event, handler: exitHandler });
    }
  }

  /**
   * Acquires a lock for the given key, ensuring only one request
   * can modify the entry at a time. Uses a compare-and-swap loop
   * to handle race conditions.
   */
  async function acquireLock(key: string): Promise<() => void> {
    // Compare-and-swap loop: wait for existing lock, then atomically acquire new one
    while (true) {
      const existingLock = locks.get(key);
      if (existingLock) {
        // Wait for existing lock to be released
        await existingLock;
        // Loop again to check if we can now acquire the lock
        continue;
      }

      // Try to acquire lock atomically
      let releaseLock: () => void;
      const lockPromise = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });

      // Only set if no lock exists (compare-and-swap)
      if (!locks.has(key)) {
        locks.set(key, lockPromise);
        return () => {
          locks.delete(key);
          releaseLock!();
        };
      }

      // Another request acquired the lock between our check and set, loop again
    }
  }

  /**
   * Atomically gets or creates an entry for the given key.
   * This ensures that concurrent requests see the same entry object.
   */
  function getOrCreateEntry(key: string, now: number): RateLimitEntry {
    let entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      store.set(key, entry);
    }

    return entry;
  }

  const middleware: RateLimitMiddleware = {
    name: 'rateLimit',
    config: {
      enabled: true,
      order: 0, // Execute first
    },
    intervalId,
    cleanup,
    execute: async (context: MiddlewareContext, next: () => Promise<void>): Promise<void> => {
      const key = config.getKey(context);
      const now = Date.now();

      // Acquire lock for this key to serialize access
      const releaseLock = await acquireLock(key);
      let lockHeld = true;

      try {
        // Atomically get or create entry while holding the lock
        const entry = getOrCreateEntry(key, now);

        // Increment count atomically (we hold the lock, so this is safe)
        entry.count++;

        // Check limit after increment
        if (entry.count > config.maxRequests) {
          const error = new Error(
            `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs}ms.`
          );
          context.error = error;
          throw error;
        }

        // Store the entry reference for later use (after lock is released)
        const entrySnapshot = {
          count: entry.count,
          resetTime: entry.resetTime,
        };

        // Release lock before awaiting next middleware
        releaseLock();
        lockHeld = false;

        await next();

        // Update response metadata with the snapshot values
        if (context.response) {
          context.response.metadata = {
            ...context.response.metadata,
            rateLimit: {
              remaining: Math.max(0, config.maxRequests - entrySnapshot.count),
              resetTime: entrySnapshot.resetTime,
            },
          };
        }
      } catch (error) {
        // Release lock only if still held (prevents double-release)
        if (lockHeld) {
          releaseLock();
          lockHeld = false;
        }
        throw error;
      }
    },
  };

  return middleware;
}
