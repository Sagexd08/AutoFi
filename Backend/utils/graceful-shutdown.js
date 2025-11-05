


import logger from './logger.js';

export function setupGracefulShutdown({ onShutdown, timeout = 30000, server }) {
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    
    if (server) {
      server.close(() => {
        logger.info('HTTP server closed');
      });
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
