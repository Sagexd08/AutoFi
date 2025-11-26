import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pino } from 'pino';
import { getOrchestrator, getAIEngine } from '../utils/orchestrator.js';
import { planQueue } from '@autofi/queue';

const logger = pino({ name: 'ai-routes' });
const router: Router = Router();


// ============================================================================
// SCHEMAS
// ============================================================================

const ProcessRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  chainId: z.number().optional(),
  balances: z.record(z.string()).optional(),
});

const CreatePlanRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  chainId: z.number().optional(),
  balances: z.record(z.string()).optional(),
  autoApprove: z.boolean().optional().default(false),
});

const ExecutePlanRequestSchema = z.object({
  plan: z.any(), // In a real app, validate against ExecutionPlan schema
  chainId: z.number().optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/ai/process
 * Parse natural language prompt into structured intent
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const validation = ProcessRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { prompt, chainId, balances } = validation.data;
    const userId = (req as any).user?.id || 'anonymous';
    const walletAddress = (req as any).user?.walletAddress || '0x0';

    logger.info({ userId, promptLength: prompt.length }, 'Processing AI request');

    const engine = getAIEngine();
    const result = await engine.process({
      prompt,
      userId,
      walletAddress,
      context: {
        chainId,
        availableBalances: balances,
      },
    });

    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.error,
        processingTimeMs: result.processingTimeMs,
      });
    }

    return res.json({
      success: true,
      intent: result.intent,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error) {
    logger.error({ error }, 'AI processing failed');
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/ai/plan
 * Generate full execution plan with risk assessment and simulation
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const validation = CreatePlanRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { prompt, chainId, balances } = validation.data;
    const userId = (req as any).user?.id || 'anonymous';
    const walletAddress = (req as any).user?.walletAddress || '0x0';

    logger.info({ userId, promptLength: prompt.length }, 'Generating execution plan');

    const orchestrator = getOrchestrator();
    const result = await orchestrator.runPipeline(prompt, {
      userId,
      walletAddress,
      chainId,
      balances,
    });

    if (result.error) {
      return res.status(422).json({
        success: false,
        error: result.error,
        data: result,
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Plan generation failed');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/ai/execute
 * Execute an approved plan
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const validation = ExecutePlanRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { plan } = validation.data;
    const userId = (req as any).user?.id || 'anonymous';
    // const walletAddress = (req as any).user?.walletAddress || '0x0';

    logger.info({ userId, planId: plan.id }, 'Queueing plan execution');

    // Submit to queue
    const job = await planQueue.add(`plan-${plan.id}`, {
      planId: plan.id,
      plan,
      userId,
    });

    return res.json({
      success: true,
      status: 'queued',
      jobId: job.id,
      planId: plan.id,
      message: 'Plan execution queued successfully'
    });
  } catch (error) {
    logger.error({ error }, 'Execution queueing failed');
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/ai/status/:planId
 * Get status of plan execution
 */
router.get('/status/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const userId = (req as any).user?.id;

    logger.info({ userId, planId }, 'Checking plan status');

    // TODO: Load plan from database
    // For now, we return a mock status since we don't have a DB connected for plans yet
    // In a real implementation, we would fetch the plan and its execution status from the DB
    
    // Mock response
    return res.json({
      success: true,
      planId,
      status: 'completed',
      steps: [
        { id: 'step-1', status: 'confirmed', txHash: '0x123...abc' }
      ],
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Status check failed');
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/ai/functions
 * List all available functions
 */
router.get('/functions', async (_req: Request, res: Response) => {
  try {
    const { FUNCTION_REGISTRY } = await import('@autofi/ai-engine');

    return res.json({
      success: true,
      functions: Object.entries(FUNCTION_REGISTRY).map(([name, def]) => ({
        name,
        description: def.description,
        category: def.category,
        supportedChains: def.supportedChains,
        riskLevel: def.riskLevel,
        examples: def.examples,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list functions');
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/ai/chains
 * List all supported chains
 */
router.get('/chains', async (_req: Request, res: Response) => {
  try {
    const { ChainIdMap } = await import('@autofi/ai-engine');

    return res.json({
      success: true,
      chains: Object.entries(ChainIdMap).map(([name, chainId]) => ({
        name,
        chainId,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list chains');
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export const aiRoutes = router;
export default router;
