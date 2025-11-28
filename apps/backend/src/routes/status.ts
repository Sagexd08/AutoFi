/**
 * System Status API Routes
 * Provides system health and status information
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { vectorDBService } from '../services/vector-db.js';

const router: Router = express.Router();

const startTime = Date.now();

/**
 * GET /api/status
 * Get detailed system status
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    
    // Check various services
    let vectorDbConnected = false;
    try {
      await vectorDBService.getStats();
      vectorDbConnected = true;
    } catch {
      vectorDbConnected = false;
    }
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        version: '2.0.0',
        uptime,
        blockchainConnected: true, // TODO: Actually check
        aiConnected: true, // TODO: Actually check
        databaseConnected: vectorDbConnected,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/system/status
 * Get extended system status with more details
 */
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        version: '2.0.0',
        uptime,
        blockchainConnected: true,
        aiConnected: true,
        databaseConnected: true,
        activeAutomations: 0,
        totalTransactions: 0,
        successRate: 100,
        lastUpdate: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as statusRoutes };
