import express, { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const router: Router = express.Router();

const limitSchema = z.object({
  agentId: z.string().min(1),
  dailyLimit: z.string().min(1),
  perTxLimit: z.string().min(1),
  currency: z.string().optional(),
  effectiveFrom: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const limits = new Map<string, {
  agentId: string;
  dailyLimit: string;
  perTxLimit: string;
  currency?: string;
  effectiveFrom: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}>();

router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = limitSchema.parse(req.body);
    const now = new Date().toISOString();

    limits.set(parsed.agentId, {
      agentId: parsed.agentId,
      dailyLimit: parsed.dailyLimit,
      perTxLimit: parsed.perTxLimit,
      currency: parsed.currency,
      effectiveFrom: parsed.effectiveFrom || now,
      updatedAt: now,
      metadata: parsed.metadata,
    });

    logger.info('Spending limits set', {
      agentId: parsed.agentId,
      dailyLimit: parsed.dailyLimit,
      perTxLimit: parsed.perTxLimit,
    });

    res.status(201).json({
      success: true,
      agentId: parsed.agentId,
      dailyLimit: parsed.dailyLimit,
      perTxLimit: parsed.perTxLimit,
      currency: parsed.currency,
      metadata: parsed.metadata,
    });
  } catch (error) {
    logger.error('Failed to set spending limits', { error: String(error) });
    next(error);
  }
});

router.get('/:agentId', (req: Request, res: Response): void => {
  const { agentId } = req.params;
  const limit = limits.get(agentId);

  if (!limit) {
    res.status(404).json({
      success: false,
      error: 'Spending limits not found for agent',
    });
    return;
  }

  res.json({
    success: true,
    agentId: limit.agentId,
    dailyLimit: limit.dailyLimit,
    perTxLimit: limit.perTxLimit,
    currency: limit.currency,
    metadata: limit.metadata,
  });
});

export { router as limitsRoutes };

