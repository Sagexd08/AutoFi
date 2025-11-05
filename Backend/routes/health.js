import express from 'express';
import { logger } from '../utils/logger.js';

/**
 * Create health check routes with actual service verification
 * @param {Object} automationSystem - The automation system instance
 * @returns {express.Router} Express router with health endpoints
 */
export function createHealthRoutes(automationSystem = null) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  router.get('/detailed', async (req, res) => {
    const health = {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {},
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        nodeVersion: process.version,
      },
    };

    // Database health check
    const dbStartTime = Date.now();
    try {
      if (automationSystem?.db) {
        // Execute a simple query to verify database connection
        const stmt = automationSystem.db.prepare('SELECT 1 as health_check');
        stmt.get();
        const responseTime = Date.now() - dbStartTime;
        
        health.services.database = {
          status: 'healthy',
          responseTime,
          type: 'sqlite',
        };
      } else {
        health.services.database = {
          status: 'not_configured',
          message: 'Database is disabled or not initialized',
        };
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.database = {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - dbStartTime,
      };
      health.status = 'degraded';
    }

    // Blockchain health check
    const blockchainStartTime = Date.now();
    try {
      if (automationSystem?.publicClient) {
        // Make a simple RPC call to verify blockchain connection
        await automationSystem.publicClient.getBlockNumber();
        const responseTime = Date.now() - blockchainStartTime;
        
        health.services.blockchain = {
          status: 'healthy',
          responseTime,
          network: automationSystem.config?.network || 'unknown',
          rpcUrl: automationSystem.config?.rpcUrl || 'unknown',
        };
      } else {
        health.services.blockchain = {
          status: 'not_configured',
          message: 'Blockchain client is not initialized',
        };
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.blockchain = {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - blockchainStartTime,
      };
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  router.get('/ready', async (req, res) => {
    const readiness = {
      success: true,
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {},
    };

    let isReady = true;

    // Check database readiness
    try {
      if (automationSystem?.db) {
        const stmt = automationSystem.db.prepare('SELECT 1');
        stmt.get();
        readiness.checks.database = { status: 'ready' };
      } else {
        readiness.checks.database = { status: 'not_required' };
      }
    } catch (error) {
      readiness.checks.database = { status: 'not_ready', error: error.message };
      isReady = false;
    }

    // Check blockchain readiness
    try {
      if (automationSystem?.publicClient) {
        await automationSystem.publicClient.getBlockNumber();
        readiness.checks.blockchain = { status: 'ready' };
      } else {
        readiness.checks.blockchain = { status: 'not_required' };
      }
    } catch (error) {
      readiness.checks.blockchain = { status: 'not_ready', error: error.message };
      isReady = false;
    }

    if (!isReady) {
      readiness.status = 'not_ready';
      readiness.success = false;
    }

    const statusCode = isReady ? 200 : 503;
    res.status(statusCode).json(readiness);
  });

  router.get('/live', (req, res) => {
    res.json({
      success: true,
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

// Default export for backward compatibility
const router = express.Router();
router.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    note: 'Use createHealthRoutes() for detailed health checks',
  });
});
router.get('/detailed', async (req, res) => {
  res.status(503).json({
    success: false,
    status: 'not_configured',
    message: 'Detailed health checks require automation system instance. Use createHealthRoutes(automationSystem).',
  });
});
router.get('/ready', (req, res) => {
  res.status(503).json({
    success: false,
    status: 'not_configured',
    message: 'Readiness checks require automation system instance. Use createHealthRoutes(automationSystem).',
  });
});
router.get('/live', (req, res) => {
  res.json({
    success: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

export default router;
