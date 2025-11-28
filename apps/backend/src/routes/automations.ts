import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { getDatabaseService } from '../services/supabase-db.js';
import { executionEngine } from '../services/execution-engine.js';
import { logger } from '../utils/logger.js';

const router: Router = Router();
const db = getDatabaseService();

const createAutomationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  workflow_config: z.object({
    type: z.enum(['transfer', 'swap', 'contract_call']),
    to: z.string().optional(),
    value: z.string().optional(),
    tokenIn: z.string().optional(),
    tokenOut: z.string().optional(),
    contractAddress: z.string().optional(),
    functionName: z.string().optional(),
    params: z.record(z.any()).optional(),
  }),
  enabled: z.boolean().default(true),
  requires_approval: z.boolean().default(false),
  max_risk_score: z.number().min(0).max(100).default(60),
});

const updateAutomationSchema = createAutomationSchema.partial();

const executeAutomationSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  params: z.record(z.any()).optional(),
});

router.post(
  '/',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const data = createAutomationSchema.parse(req.body);

      const automation = await db.createAutomation({
        user_id: req.user.id,
        name: data.name,
        description: data.description,
        workflow_config: data.workflow_config,
        enabled: data.enabled,
        requires_approval: data.requires_approval,
        risk_score: 0,
        max_risk_score: data.max_risk_score,
      });

      logger.info('Automation created', {
        automationId: automation.id,
        userId: req.user.id,
      });

      res.status(201).json({
        success: true,
        data: automation,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('Failed to create automation', { error: String(error) });
      res.status(500).json({
        success: false,
        error: 'Failed to create automation',
      });
    }
  }
);

router.get(
  '/',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await db.listAutomations(req.user.id, { skip: offset, take: limit });

      res.json({
        success: true,
        data: result.automations,
        pagination: {
          limit,
          offset,
          total: result.total,
          hasMore: result.automations.length === limit,
        },
      });
    } catch (error) {
      logger.error('Failed to list automations', { error: String(error) });
      res.status(500).json({
        success: false,
        error: 'Failed to list automations',
      });
    }
  }
);

router.get(
  '/:id',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const automation = await db.getAutomation(req.params.id, req.user.id);

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
      logger.error('Failed to get automation', { error: String(error) });
      res.status(500).json({
        success: false,
        error: 'Failed to get automation',
      });
    }
  }
);

router.put(
  '/:id',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const updates = updateAutomationSchema.parse(req.body);

      const automation = await db.updateAutomation(
        req.params.id,
        req.user.id,
        updates as any
      );

      if (!automation) {
        res.status(404).json({
          success: false,
          error: 'Automation not found',
        });
        return;
      }

      logger.info('Automation updated', {
        automationId: req.params.id,
        userId: req.user.id,
      });

      res.json({
        success: true,
        data: automation,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('Failed to update automation', { error: String(error) });
      res.status(500).json({
        success: false,
        error: 'Failed to update automation',
      });
    }
  }
);

router.delete(
  '/:id',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      await db.deleteAutomation(req.params.id, req.user.id);

      logger.info('Automation deleted', {
        automationId: req.params.id,
        userId: req.user.id,
      });

      res.json({
        success: true,
        message: 'Automation deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete automation', { error: String(error) });
      res.status(500).json({
        success: false,
        error: 'Failed to delete automation',
      });
    }
  }
);

router.post(
  '/:id/execute',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { dryRun, params } = executeAutomationSchema.parse(req.body);

      const automation = await db.getAutomation(req.params.id, req.user.id);

      if (!automation) {
        res.status(404).json({
          success: false,
          error: 'Automation not found',
        });
        return;
      }

      if (dryRun) {
        res.json({
          success: true,
          data: {
            dryRun: true,
            message: 'Dry run completed - no execution performed',
            automation: automation,
          },
        });
        return;
      }

      const result = await executionEngine.execute({
        automationId: automation.id,
        userId: req.user.id,
        workflowConfig: automation.workflow_config,
        parameters: params,
      });

      logger.info('Automation executed', {
        automationId: req.params.id,
        userId: req.user.id,
        dryRun,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('Failed to execute automation', { error: String(error) });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Automation execution failed',
      });
    }
  }
);

router.get(
  '/:id/executions',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const executions = await db.getExecutionHistory(
        req.params.id,
        req.user.id,
        limit
      );

      res.json({
        success: true,
        data: executions,
      });
    } catch (error) {
      logger.error('Failed to get execution history', { error: String(error) });
      res.status(500).json({
        success: false,
        error: 'Failed to get execution history',
      });
    }
  }
);

router.get(
  '/:id/risk-assessment',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const automation = await db.getAutomation(req.params.id, req.user.id);

      if (!automation) {
        res.status(404).json({
          success: false,
          error: 'Automation not found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          automationId: automation.id,
          riskScore: automation.risk_score,
          maxRiskScore: automation.max_risk_score,
          requiresApproval: automation.requires_approval,
        },
      });
    } catch (error) {
      logger.error('Failed to assess risk', { error: String(error) });
      res.status(500).json({
        success: false,
        error: 'Failed to assess risk',
      });
    }
  }
);

export default router;
