


import logger from './logger.js';

let shutdownPromise = null;

export function setupGracefulShutdown({ onShutdown, timeout = 30000, server }) {
  const shutdown = async (signal) => {
    if (shutdownPromise) {
      logger.info(`Shutdown already in progress, waiting for existing shutdown (triggered by ${signal})...`);
      try {
        await shutdownPromise;
      } catch (error) {
      }
      return;
    }

    shutdownPromise = (async () => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      
      if (server) {
        try {
          await Promise.race([
            new Promise((resolve, reject) => {
              server.close((err) => {
                if (err) reject(err);
                else {
                  logger.info('HTTP server closed');
                  resolve();
                }
              });
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Server close timeout')), timeout)
            ),
          ]);
        } catch (error) {
          logger.error('Error closing server', { error: error.message, stack: error.stack });
        }
      }
      
      if (onShutdown) {
        try {
          await Promise.race([
            onShutdown(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Shutdown timeout')), timeout)
            ),
          ]);
          logger.info('Shutdown completed successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error: error.message, stack: error.stack });
          process.exit(1);
        }
      } else {
        process.exit(0);
      }
    })();

    try {
      await shutdownPromise;
    } catch (error) {
      logger.error('Error in shutdown promise', { error: error.message, stack: error.stack });
    }
  };

  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    shutdown('uncaughtException');
  });

  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { promise: promise.toString(), reason: reason?.toString() || reason });
    shutdown('unhandledRejection');
  });
}
