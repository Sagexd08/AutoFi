import type { Middleware, MiddlewareContext } from './types';

import type { CacheInterface } from '../cache/types';

export interface CacheMiddlewareConfig {

  cache: CacheInterface;

  getCacheKey: (context: MiddlewareContext) => string;

  ttl?: number;

  skipOnError?: boolean;

}

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

