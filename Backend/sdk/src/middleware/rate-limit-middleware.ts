import type { Middleware, MiddlewareContext } from './types';

export interface RateLimitConfig {

  maxRequests: number;

  windowMs: number;

  getKey: (context: MiddlewareContext) => string;

}

interface RateLimitEntry {

  count: number;

  resetTime: number;

}

export interface RateLimitMiddleware extends Middleware {

  cleanup: () => void;

  intervalId: ReturnType<typeof setInterval>;

}

export function createRateLimitMiddleware(config: RateLimitConfig): RateLimitMiddleware {

  const store = new Map<string, RateLimitEntry>();


  const locks = new Map<string, Promise<void>>();


  const intervalId = setInterval(() => {

    const now = Date.now();

    for (const [key, entry] of store.entries()) {

      if (now > entry.resetTime) {

        store.delete(key);

      }

    }

  }, config.windowMs);


  let isCleanedUp = false;



  const handlers: Array<{ event: string; handler: () => void }> = [];

  function cleanup(): void {

    if (isCleanedUp) {

      return; // Already cleaned up

    }

    isCleanedUp = true;

    if (intervalId) {

      clearInterval(intervalId);

    }


    store.clear();

    locks.clear();




    if (typeof process !== 'undefined' && handlers.length > 0) {

      for (const { event, handler } of handlers) {

        try {

          (process as NodeJS.Process).removeListener(event, handler);

        } catch {


        }

      }

    }

  }


  const exitHandler = () => {

    cleanup();

  };

  if (typeof process !== 'undefined') {

    const events = ['exit', 'SIGTERM', 'SIGINT'] as const;

    for (const event of events) {


      process.once(event, exitHandler);

      handlers.push({ event, handler: exitHandler });

    }

  }

  async function acquireLock(key: string): Promise<() => void> {


    while (true) {

      const existingLock = locks.get(key);

      if (existingLock) {


        await existingLock;


        continue;

      }


      let releaseLock: () => void;

      const lockPromise = new Promise<void>((resolve) => {

        releaseLock = resolve;

      });


      if (!locks.has(key)) {

        locks.set(key, lockPromise);

        return () => {

          locks.delete(key);

          releaseLock!();

        };

      }


    }

  }

  function getOrCreateEntry(key: string, now: number): RateLimitEntry {

    let entry = store.get(key);

    if (!entry || now > entry.resetTime) {


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


      const releaseLock = await acquireLock(key);

      let lockHeld = true;

      try {


        const entry = getOrCreateEntry(key, now);


        entry.count++;


        if (entry.count > config.maxRequests) {

          const error = new Error(

            `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs}ms.`

          );

          context.error = error;

          throw error;

        }


        const entrySnapshot = {

          count: entry.count,

          resetTime: entry.resetTime,

        };


        releaseLock();

        lockHeld = false;

        await next();


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

