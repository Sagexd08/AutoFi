/**
 * Analytics API Routes
 * Provides analytics and insights for automations
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

const router: Router = express.Router();

// In-memory analytics store (replace with proper DB/metrics later)
const analyticsData = {
  totalAutomations: 0,
  activeAutomations: 0,
  totalTransactions: 0,
  successfulTransactions: 0,
  failedTransactions: 0,
  totalGasUsed: '0',
  executionTimes: [] as number[],
  functionCalls: new Map<string, number>(),
};

/**
 * GET /api/analytics
 * Get overall analytics
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.query.sessionId as string | undefined;
    
    const successRate = analyticsData.totalTransactions > 0 
      ? (analyticsData.successfulTransactions / analyticsData.totalTransactions) * 100 
      : 100;
    
    const averageExecutionTime = analyticsData.executionTimes.length > 0
      ? analyticsData.executionTimes.reduce((a, b) => a + b, 0) / analyticsData.executionTimes.length
      : 0;
    
    const mostUsedFunctions = Array.from(analyticsData.functionCalls.entries())
      .map(([functionName, count]) => ({ functionName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    res.json({
      success: true,
      data: {
        totalAutomations: analyticsData.totalAutomations,
        activeAutomations: analyticsData.activeAutomations,
        totalTransactions: analyticsData.totalTransactions,
        successRate,
        averageExecutionTime,
        mostUsedFunctions,
        sessionId,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/automation/:id
 * Get analytics for a specific automation
 */
router.get('/automation/:id?', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const automationId = req.params.id;
    
    // TODO: Fetch actual automation analytics from database
    const analytics = {
      totalExecutions: Math.floor(Math.random() * 100),
      successRate: 85 + Math.random() * 15,
      averageExecutionTime: 1000 + Math.random() * 2000,
      lastExecution: {
        timestamp: new Date().toISOString(),
        status: 'success' as const,
        txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
      },
      gasUsed: (Math.random() * 1000000).toFixed(0),
      costAnalysis: {
        totalCost: (Math.random() * 10).toFixed(4) + ' CELO',
        averageCost: (Math.random() * 0.1).toFixed(4) + ' CELO',
        costPerExecution: (Math.random() * 0.01).toFixed(4) + ' CELO',
      },
    };
    
    res.json({
      success: true,
      data: automationId ? { ...analytics, automationId } : analytics,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/blockchain
 * Get blockchain analytics
 */
router.get('/blockchain', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const mostUsedFunctions = [
      { functionName: 'transfer', count: 150 },
      { functionName: 'swap', count: 89 },
      { functionName: 'approve', count: 67 },
      { functionName: 'deposit', count: 45 },
      { functionName: 'withdraw', count: 32 },
    ];
    
    res.json({
      success: true,
      data: {
        totalTransactions: analyticsData.totalTransactions || 384,
        successfulTransactions: analyticsData.successfulTransactions || 367,
        failedTransactions: analyticsData.failedTransactions || 17,
        totalGasUsed: analyticsData.totalGasUsed || '45678901234',
        averageGasPrice: '5000000000', // 5 Gwei
        mostUsedFunctions,
        networkStats: {
          blockHeight: 25000000 + Math.floor(Math.random() * 100000),
          networkHashRate: '1.2 TH/s',
          averageBlockTime: 5.0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/logs
 * Get automation execution logs
 */
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Generate mock logs
    const logs = [];
    const types = ['info', 'success', 'warning', 'error'];
    const actions = [
      'Automation started',
      'Transaction submitted',
      'Transaction confirmed',
      'Swap executed',
      'Price check completed',
      'Alert triggered',
      'Condition evaluated',
      'Automation completed',
    ];
    
    for (let i = 0; i < limit; i++) {
      logs.push({
        id: `log_${Date.now()}_${i}`,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        type: types[Math.floor(Math.random() * types.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        automationId: `auto_${Math.floor(Math.random() * 10)}`,
        details: {
          gasUsed: Math.floor(Math.random() * 100000),
          duration: Math.floor(Math.random() * 5000),
        },
      });
    }
    
    res.json({
      success: true,
      data: {
        logs,
        total: 1000,
        offset,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/analytics/track
 * Track an event (for internal use)
 */
router.post('/track', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event, data } = req.body;
    
    logger.info('Analytics event tracked', { event, data });
    
    // Update in-memory analytics
    switch (event) {
      case 'automation_created':
        analyticsData.totalAutomations++;
        analyticsData.activeAutomations++;
        break;
      case 'automation_completed':
        analyticsData.activeAutomations = Math.max(0, analyticsData.activeAutomations - 1);
        break;
      case 'transaction_sent':
        analyticsData.totalTransactions++;
        break;
      case 'transaction_success':
        analyticsData.successfulTransactions++;
        break;
      case 'transaction_failed':
        analyticsData.failedTransactions++;
        break;
      case 'function_called':
        if (data?.functionName) {
          const count = analyticsData.functionCalls.get(data.functionName) || 0;
          analyticsData.functionCalls.set(data.functionName, count + 1);
        }
        break;
    }
    
    res.json({
      success: true,
      message: 'Event tracked',
    });
  } catch (error) {
    next(error);
  }
});

export { router as analyticsRoutes };
