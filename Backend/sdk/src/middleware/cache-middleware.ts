import type { Middleware, MiddlewareContext } from './types';
import type { CacheInterface } from '../cache/types';

/**
 * Cache middleware configuration.
 */
export interface CacheMiddlewareConfig {
  /** Cache instance */
  cache: CacheInterface;
  /** Cache key generator function */
  getCacheKey: (context: MiddlewareContext) => string;
  /** Cache TTL in milliseconds */
  ttl?: number;
  /** Whether to skip cache for errors */
  skipOnError?: boolean;
}

/**
 * Creates a caching middleware.
 * 
 * @param config - Cache middleware configuration
 * @returns Cache middleware
 */
export function createCacheMiddleware(config: CacheMiddlewareConfig): Middleware {
  return {
    name: 'cache',
    config: {
      enabled: true,
      order: 2,
    },
    execute: async (context: MiddlewareContext, next: () => Promise<void>): Promise<void> => {
      const cacheKey = config.getCacheKey(context);
      const cached = await config.cache.get<MiddlewareContext['response']>(cacheKey);

      if (cached !== undefined) {
        // Create shallow copies to avoid mutating the cached object
        context.response = {
          ...cached,
          metadata: {
            ...(cached.metadata || {}),
            cached: true,
          },
        };
        return;
      }

      await next();

      if (context.error && config.skipOnError) {
        return;
      }

      if (context.response) {
        await config.cache.set(cacheKey, context.response, config.ttl);
      }
    },
  };
}
