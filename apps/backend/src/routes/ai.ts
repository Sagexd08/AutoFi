
import express, { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { aiService } from '../services/ai.js';
import { vectorDBService } from '../services/vector-db.js';
import { logger } from '../utils/logger.js';

const router: Router = express.Router();

// Request schemas
const parseIntentSchema = z.object({
  prompt: z.string().min(1).max(1000),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const generatePlanSchema = z.object({
  prompt: z.string().min(1).max(1000),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const executePlanSchema = z.object({
  plan: z.object({
    id: z.string(),
    intent: z.any(),
    steps: z.array(z.any()),
  }),
  chainId: z.number().optional(),
});

const searchMemorySchema = z.object({
  query: z.string().min(1).max(500),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  type: z.enum(['automation', 'transaction', 'prompt', 'context', 'feedback']).optional(),
  limit: z.number().min(1).max(100).optional(),
});

const storeFeedbackSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  automationId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().max(500).optional(),
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
 * POST /api/ai/parse
 * Parse user prompt to extract intent
 */
router.post('/parse', validate(parseIntentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, walletAddress } = req.body;
    
    logger.info('Parsing intent', { prompt: prompt.slice(0, 50), walletAddress });
    
    const intent = await aiService.parseIntent(prompt, walletAddress);
    
    res.json({
      success: true,
      data: intent,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/plan
 * Generate execution plan from prompt
 */
router.post('/plan', validate(generatePlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, walletAddress } = req.body;
    
    logger.info('Generating plan', { prompt: prompt.slice(0, 50), walletAddress });
    
    // Parse intent first
    const intent = await aiService.parseIntent(prompt, walletAddress);
    
    // Generate plan
    const plan = await aiService.generatePlan(intent, walletAddress);
    
    res.json({
      success: true,
      data: {
        intent,
        plan,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/execute
 * Queue plan for execution
 */
router.post('/execute', validate(executePlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan, chainId } = req.body;
    
    logger.info('Queueing plan execution', { planId: plan.id, chainId });
    
    const jobId = `job_${Date.now()}`;
    
    res.json({
      success: true,
      data: {
        jobId,
        status: 'queued',
        estimatedTime: '30s',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/search
 * Semantic search in user memory
 */
router.post('/search', validate(searchMemorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, walletAddress, type, limit } = req.body;
    
    logger.info('Searching memory', { query: query.slice(0, 50), walletAddress });
    
    const results = await vectorDBService.searchMemory(query, {
      walletAddress,
      type,
      limit: limit || 10,
    });
    
    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/feedback
 * Store user feedback
 */
router.post('/feedback', validate(storeFeedbackSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress, automationId, rating, comment } = req.body;
    
    logger.info('Storing feedback', { walletAddress, automationId, rating });
    
    const id = await vectorDBService.storeFeedback(walletAddress, automationId, rating, comment);
    
    res.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/recommendations/:walletAddress
 * Get personalized recommendations
 */
router.get('/recommendations/:walletAddress', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { walletAddress } = req.params;
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      res.status(400).json({
        success: false,
        error: 'Invalid wallet address',
      });
      return;
    }
    
    const recommendations = await aiService.getRecommendations(walletAddress);
    
    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/history/:walletAddress
 * Get user automation history
 */
router.get('/history/:walletAddress', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { walletAddress } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      res.status(400).json({
        success: false,
        error: 'Invalid wallet address',
      });
      return;
    }
    
    const history = await vectorDBService.searchMemory('', {
      walletAddress,
      type: 'automation',
      limit,
    });
    
    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/stats
 * Get vector database stats
 */
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await vectorDBService.getStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/similarity
 * Calculate similarity between two texts
 */
router.post('/similarity', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { text1, text2 } = req.body;
    
    if (!text1 || !text2) {
      res.status(400).json({
        success: false,
        error: 'Both text1 and text2 are required',
      });
      return;
    }
    
    const similarity = await vectorDBService.calculateSimilarity(text1, text2);
    
    res.json({
      success: true,
      data: { similarity },
    });
  } catch (error) {
    next(error);
  }
});

export { router as aiRoutes };
