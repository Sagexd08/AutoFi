import type { Middleware, MiddlewareContext } from './types';
import type { SDKConfig } from '../types/config';

/**
 * Creates a logging middleware.
 * 
 * @param config - SDK configuration for log level
 * @returns Logging middleware
 */
export function createLoggingMiddleware(config: SDKConfig): Middleware {
  const logLevels = ['debug', 'info', 'warn', 'error'];
  const rawLogLevel = config.logLevel ?? 'info';
  
  // Validate logLevel against allowed values
  const logLevel = logLevels.includes(rawLogLevel) ? rawLogLevel : 'info';
  
  // Warn if invalid log level was provided
  if (rawLogLevel !== logLevel) {
    console.warn(`[LoggingMiddleware] Invalid log level "${rawLogLevel}". Defaulting to "info". Valid levels are: ${logLevels.join(', ')}`);
  }
  
  const currentLevelIndex = logLevels.indexOf(logLevel);

  const shouldLog = (level: string): boolean => {
    const levelIndex = logLevels.indexOf(level);
    return levelIndex >= currentLevelIndex;
  };

  return {
    name: 'logging',
    config: {
      enabled: true,
      order: 1,
    },
    execute: async (context: MiddlewareContext, next: () => Promise<void>): Promise<void> => {
      const startTime = Date.now();

      if (shouldLog('debug')) {
        console.debug(`[Middleware] ${context.request.id} - Starting request`, {
          path: context.request.path,
          metadata: context.request.metadata,
        });
      }

      try {
        await next();

        const duration = Date.now() - startTime;
        const timestamp = Date.now();
        
        // Create or reuse context.response, preserving existing properties
        if (!context.response) {
          context.response = {
            timestamp,
            duration,
          };
        } else {
          // Preserve all existing properties and set/overwrite only timestamp and duration
          const existingMetadata = context.response.metadata;
          
          // Merge metadata: shallow-merge existing metadata with any new metadata
          // Create new metadata object to avoid mutating nested metadata unexpectedly
          const mergedMetadata = existingMetadata ? { ...existingMetadata } : undefined;
          
          context.response = {
            ...context.response,
            timestamp,
            duration,
            metadata: mergedMetadata,
          };
        }

        if (shouldLog('info')) {
          console.info(`[Middleware] ${context.request.id} - Request completed`, {
            duration: `${duration}ms`,
            path: context.request.path,
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        context.error = error;

        if (shouldLog('error')) {
          console.error(`[Middleware] ${context.request.id} - Request failed`, {
            duration: `${duration}ms`,
            path: context.request.path,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        throw error;
      }
    },
  };
}
