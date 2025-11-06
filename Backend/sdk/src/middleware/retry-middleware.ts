/// <reference types="node" />

import type { Middleware, MiddlewareContext } from './types';

import { retryWithBackoff, type RetryConfig } from '../utils/retry';

import { SDKError } from '../errors';

export interface RetryMiddlewareConfig {

  retryConfig: Partial<RetryConfig>;

  shouldRetry?: (context: MiddlewareContext) => boolean;

}

export function createRetryMiddleware(config: RetryMiddlewareConfig): Middleware {

  return {

    name: 'retry',

    config: {

      enabled: true,

      order: 3,

    },

    execute: async (context: MiddlewareContext, next: () => Promise<void>): Promise<void> => {

      const shouldRetry = config.shouldRetry ?? (() => true);

      let shouldRetryResult: boolean;

      try {

        shouldRetryResult = shouldRetry(context);

      } catch (error) {

        console.error('[RetryMiddleware] Error in shouldRetry callback', {

          requestId: context.request.id,

          path: context.request.path,

          error: error instanceof Error ? error.message : String(error),

          errorType: context.error?.constructor?.name,

        });        // Default to true to allow retries on error (safe default)

        shouldRetryResult = true;

      }

      if (!shouldRetryResult) {

        await next();

        return;

      }

      try {

        await retryWithBackoff(

          async () => {

            await next();

          },

          {

            ...config.retryConfig,

            onRetry: (attempt, error) => {

              if (context.response) {

                context.response.metadata = {

                  ...context.response.metadata,

                  retryAttempt: attempt,

                  retryError: error instanceof Error ? error.message : String(error),

                };

              }

              config.retryConfig.onRetry?.(attempt, error);

            },

          }

        );

      } catch (error) {

        context.error = error;

        throw error;

      }

    },

  };

}

