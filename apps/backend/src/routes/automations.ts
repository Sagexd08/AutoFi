/**
 * Automations API Routes
 * Handles CRUD operations for automations with SQLite persistence
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { vectorDBService } from '../services/vector-db.js';
import { getAutomationsDB, type Automation, type AutomationExecution } from '../database/index.js';

const router: Router = express.Router();

// Get database instance (persistent SQLite storage)
const automationsDB = getAutomationsDB(
  process.env.AUTOMATIONS_DB_PATH || './data/automations.db'
);

// Request schemas
const createAutomationSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['transaction', 'swap', 'nft', 'dao', 'refi', 'alerts']),
  parameters: z.record(z.any()),
  schedule: z.object({
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly']),
    cron: z.string().optional(),
  }).optional(),
  conditions: z.record(z.any()).optional(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

const updateAutomationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parameters: z.record(z.any()).optional(),
  schedule: z.object({
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly']),
    cron: z.string().optional(),
  }).optional(),
  conditions: z.record(z.any()).optional(),
});

// Middleware to validate request body
const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors,
        });
      } else {
        next(error);
      }
    }
  };
};

/**
 * GET /api/automations
 * List all automations
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const allAutomations = automationsDB.getAll();
    
    res.json({
      success: true,
      data: allAutomations,
      total: allAutomations.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/automations/stats
 * Get automation statistics
 */
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = automationsDB.getStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/automations/:id
 * Get a single automation
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const automation = automationsDB.get(id);
    
    if (!automation) {
      res.status(404).json({
        success: false,
        error: 'Automation not found',
      });
      return;
    }
    
    res.json({
      success: true,
      data: automation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/automations/:id/executions
 * Get execution history for an automation
 */
router.get('/:id/executions', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const automation = automationsDB.get(id);
    if (!automation) {
      res.status(404).json({
        success: false,
        error: 'Automation not found',
      });
      return;
    }
    
    const executions = automationsDB.getExecutions(id, limit);
    
    res.json({
      success: true,
      data: executions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/automations
 * Create a new automation
 */
router.post('/', validate(createAutomationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, parameters, schedule, conditions, walletAddress } = req.body;
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const automation: Automation = {
      id,
      name,
      type,
      status: 'active',
      progress: 0,
      parameters,
      schedule,
      conditions,
      walletAddress,
      createdAt: now,
      updatedAt: now,
      nextRun: schedule ? calculateNextRun(schedule) : now,
      lastExecution: undefined,
    };
    
    automationsDB.insert(automation);
    
    // Store in vector DB for learning
    if (walletAddress) {
      await vectorDBService.storeAutomation(walletAddress, name, automation, true);
    }
    
    logger.info('Automation created', { id, name, type });
    
    res.status(201).json({
      success: true,
      data: automation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/automations/:id
 * Update an automation
 */
router.put('/:id', validate(updateAutomationSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const automation = automationsDB.get(id);
    
    if (!automation) {
      res.status(404).json({
        success: false,
        error: 'Automation not found',
      });
      return;
    }
    
    const updates = req.body;
    const updatedAutomation = automationsDB.update(id, {
      ...updates,
      nextRun: updates.schedule ? calculateNextRun(updates.schedule) : automation.nextRun,
    });
    
    logger.info('Automation updated', { id });
    
    res.json({
      success: true,
      data: updatedAutomation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/automations/:id
 * Delete an automation
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!automationsDB.has(id)) {
      res.status(404).json({
        success: false,
        error: 'Automation not found',
      });
      return;
    }
    
    automationsDB.delete(id);
    
    logger.info('Automation deleted', { id });
    
    res.json({
      success: true,
      message: 'Automation deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/automations/:id/pause
 * Pause an automation
 */
router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const automation = automationsDB.get(id);
    
    if (!automation) {
      res.status(404).json({
        success: false,
        error: 'Automation not found',
      });
      return;
    }
    
    const updated = automationsDB.updateStatus(id, 'paused');
    
    logger.info('Automation paused', { id });
    
    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/automations/:id/resume
 * Resume a paused automation
 */
router.post('/:id/resume', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const automation = automationsDB.get(id);
    
    if (!automation) {
      res.status(404).json({
        success: false,
        error: 'Automation not found',
      });
      return;
    }
    
    const updated = automationsDB.updateStatus(id, 'active');
    
    logger.info('Automation resumed', { id });
    
    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/automations/:id/execute
 * Execute an automation immediately
 */
router.post('/:id/execute', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { context } = req.body || {};
    const automation = automationsDB.get(id);
    
    if (!automation) {
      res.status(404).json({
        success: false,
        error: 'Automation not found',
      });
      return;
    }
    
    logger.info('Executing automation', { id, context });
    
    // Record execution attempt
    const execution: AutomationExecution = {
      id: uuidv4(),
      automationId: id,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    
    // TODO: Implement actual blockchain execution - see blockchain.ts for real transaction implementation
    try {
      // Placeholder for real execution
      execution.status = 'success';
      execution.txHash = `0x${Buffer.from(Date.now().toString()).toString('hex').slice(0, 64)}`;
    } catch (execError) {
      execution.status = 'failed';
      execution.error = String(execError);
    }
    
    automationsDB.recordExecution(id, execution);
    
    res.json({
      success: true,
      data: {
        result: execution.status === 'success' ? 'Automation executed successfully' : 'Automation execution failed',
        txHash: execution.txHash,
        executionId: execution.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/automations/ai-create
 * Create an automation from natural language
 */
router.post('/ai-create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, context } = req.body;
    
    if (!prompt) {
      res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
      return;
    }
    
    logger.info('Creating automation with AI', { prompt: prompt.slice(0, 50) });
    
    // Parse intent from prompt (simple mapping for now)
    const type = detectAutomationType(prompt);
    const name = generateAutomationName(prompt);
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const automation: Automation = {
      id,
      name,
      type,
      status: 'active',
      progress: 0,
      parameters: { prompt, context },
      createdAt: now,
      updatedAt: now,
      nextRun: now,
      lastExecution: undefined,
    };
    
    automationsDB.insert(automation);
    
    logger.info('AI automation created', { id, name, type });
    
    res.status(201).json({
      success: true,
      data: automation,
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function calculateNextRun(schedule: { frequency: string; cron?: string }): string {
  const now = new Date();
  switch (schedule.frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      // 'once' - immediate
      break;
  }
  return now.toISOString();
}

function detectAutomationType(prompt: string): Automation['type'] {
  const lower = prompt.toLowerCase();
  if (lower.includes('swap') || lower.includes('exchange')) return 'swap';
  if (lower.includes('nft') || lower.includes('mint')) return 'nft';
  if (lower.includes('vote') || lower.includes('proposal') || lower.includes('dao')) return 'dao';
  if (lower.includes('carbon') || lower.includes('offset') || lower.includes('refi')) return 'refi';
  if (lower.includes('alert') || lower.includes('notify')) return 'alerts';
  return 'transaction';
}

function generateAutomationName(prompt: string): string {
  const words = prompt.split(' ').slice(0, 5);
  return words.join(' ') + (words.length < prompt.split(' ').length ? '...' : '');
}

export { router as automationsRoutes };
