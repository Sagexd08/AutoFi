import express, { Router } from 'express';
import { z } from 'zod';
import {
  approvalRepository,
  transactionRepository,
  auditRepository,
  type ApprovalStatus,
  type ApprovalPriority,
  type RiskLevel,
} from '@autofi/database';
import { logger } from '../utils/logger.js';
import { notificationService } from '../services/notification.js';

const router: Router = express.Router();

// Schemas
const createApprovalSchema = z.object({
  transactionId: z.string().min(1),
  agentId: z.string().optional(),
  riskScore: z.number().min(0).max(1),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  requestReason: z.string().optional(),
  expiresInMinutes: z.number().min(1).max(1440).default(60),
  metadata: z.record(z.unknown()).optional(),
});

const resolveApprovalSchema = z.object({
  resolution: z.string().optional(),
});

function getUserId(req: express.Request): string {
  return (req as any).userId || 'system';
}

function getRiskLevel(riskScore: number): RiskLevel {
  if (riskScore >= 0.85) return 'CRITICAL';
  if (riskScore >= 0.7) return 'HIGH';
  if (riskScore >= 0.5) return 'MEDIUM';
  return 'LOW';
}

// ApprovalPriority: LOW, NORMAL, HIGH, URGENT
function getPriorityFromRisk(riskLevel: RiskLevel): ApprovalPriority {
  switch (riskLevel) {
    case 'CRITICAL': return 'URGENT';
    case 'HIGH': return 'HIGH';
    case 'MEDIUM': return 'NORMAL';
    default: return 'LOW';
  }
}

// Create approval request
router.post('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const parsed = createApprovalSchema.parse(req.body);

    const riskLevel = parsed.riskLevel || getRiskLevel(parsed.riskScore);
    const priority = getPriorityFromRisk(riskLevel);
    const expiresAt = new Date(Date.now() + parsed.expiresInMinutes * 60 * 1000);

    const approval = await approvalRepository.create({
      transaction: { connect: { id: parsed.transactionId } },
      user: { connect: { id: userId } },
      ...(parsed.agentId && { agent: { connect: { id: parsed.agentId } } }),
      riskScore: parsed.riskScore,
      riskLevel,
      priority,
      expiresAt,
      requestedBy: userId,
      requestReason: parsed.requestReason || `Risk score: ${parsed.riskScore.toFixed(2)}`,
      metadata: parsed.metadata as object | undefined,
    });

    await auditRepository.create({
      userId,
      eventType: 'APPROVAL',
      eventCode: 'APPROVAL_CREATED',
      action: 'create',
      resourceType: 'approval',
      resourceId: approval.id,
      success: true,
      ipAddress: req.ip || 'unknown',
      metadata: {
        transactionId: parsed.transactionId,
        riskScore: parsed.riskScore,
        priority,
      },
    });

    // Notify
    await notificationService.notifyApprovalRequired({
      approvalId: approval.id,
      transactionId: parsed.transactionId,
      riskScore: parsed.riskScore,
      riskLevel,
      priority,
      expiresAt: expiresAt.toISOString(),
      userId,
      agentId: parsed.agentId,
    });

    logger.info({
      approvalId: approval.id,
      transactionId: parsed.transactionId,
      riskScore: parsed.riskScore,
      priority,
    }, 'Approval request created');

    return res.status(201).json({
      success: true,
      approval,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create approval');
    return next(error);
  }
});

// List pending approvals
router.get('/pending', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { priority, agentId, riskLevel, limit = '50', offset = '0' } = req.query;

    // Expire old approvals first
    await approvalRepository.expireOld();

    const result = await approvalRepository.listPending({
      userId,
      agentId: agentId as string | undefined,
      priority: priority as ApprovalPriority | undefined,
      riskLevel: riskLevel as RiskLevel | undefined,
      skip: Number(offset),
      take: Number(limit),
    });

    return res.json({
      success: true,
      approvals: result.approvals,
      total: result.total,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list pending approvals');
    return next(error);
  }
});

// Get approval by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const approval = await approvalRepository.findByIdWithTransaction(id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'Approval not found',
      });
    }

    return res.json({
      success: true,
      approval,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get approval');
    return next(error);
  }
});

// Approve request
router.post('/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const parsed = resolveApprovalSchema.parse(req.body);

    const existing = await approvalRepository.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Approval not found',
      });
    }

    if (existing.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: `Cannot approve: request is ${existing.status}`,
      });
    }

    if (existing.expiresAt && new Date() > existing.expiresAt) {
      await approvalRepository.update(id, { status: 'EXPIRED', resolvedAt: new Date() });
      return res.status(400).json({
        success: false,
        error: 'Approval request has expired',
      });
    }

    const approval = await approvalRepository.approve(id, userId, parsed.resolution);

    // Update transaction status
    await transactionRepository.update(existing.transactionId, { status: 'QUEUED' });

    await auditRepository.create({
      userId,
      eventType: 'APPROVAL',
      eventCode: 'APPROVAL_APPROVED',
      action: 'approve',
      resourceType: 'approval',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
      metadata: { transactionId: existing.transactionId },
    });

    // Notify
    await notificationService.notifyApprovalResolved({
      approvalId: id,
      transactionId: existing.transactionId,
      status: 'approved',
      resolvedBy: userId,
      userId: existing.userId || undefined,
      agentId: existing.agentId || undefined,
    });

    logger.info({ approvalId: id, transactionId: existing.transactionId, userId }, 'Approval approved');

    return res.json({
      success: true,
      approval,
      message: 'Transaction approved for execution',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to approve');
    return next(error);
  }
});

// Reject request
router.post('/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason required',
      });
    }

    const existing = await approvalRepository.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Approval not found',
      });
    }

    if (existing.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: `Cannot reject: request is ${existing.status}`,
      });
    }

    const approval = await approvalRepository.reject(id, userId, reason);

    // Update transaction status
    await transactionRepository.update(existing.transactionId, { status: 'REJECTED' });

    await auditRepository.create({
      userId,
      eventType: 'APPROVAL',
      eventCode: 'APPROVAL_REJECTED',
      action: 'reject',
      resourceType: 'approval',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
      metadata: { transactionId: existing.transactionId, reason },
    });

    // Notify
    await notificationService.notifyApprovalResolved({
      approvalId: id,
      transactionId: existing.transactionId,
      status: 'rejected',
      resolvedBy: userId,
      userId: existing.userId || undefined,
      agentId: existing.agentId || undefined,
    });

    logger.info({ approvalId: id, transactionId: existing.transactionId, userId, reason }, 'Approval rejected');

    return res.json({
      success: true,
      approval,
      message: 'Transaction rejected',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to reject');
    return next(error);
  }
});

// Cancel request
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const existing = await approvalRepository.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Approval not found',
      });
    }

    if (existing.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel: request is ${existing.status}`,
      });
    }

    const approval = await approvalRepository.cancel(id);

    // Update transaction status
    await transactionRepository.update(existing.transactionId, { status: 'CANCELLED' });

    await auditRepository.create({
      userId,
      eventType: 'APPROVAL',
      eventCode: 'APPROVAL_CANCELLED',
      action: 'cancel',
      resourceType: 'approval',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
    });

    logger.info({ approvalId: id, userId }, 'Approval cancelled');

    return res.json({
      success: true,
      approval,
      message: 'Approval request cancelled',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to cancel approval');
    return next(error);
  }
});

// Get approval statistics
router.get('/stats/summary', async (req, res, next) => {
  try {
    const userId = getUserId(req);

    // Expire old approvals first
    const expiredCount = await approvalRepository.expireOld();

    const pendingResult = await approvalRepository.listPending({ userId });
    const allResult = await approvalRepository.listByUser(userId);

    const stats = {
      total: allResult.total,
      pending: pendingResult.total,
      approved: allResult.approvals.filter(a => a.status === 'APPROVED').length,
      rejected: allResult.approvals.filter(a => a.status === 'REJECTED').length,
      expired: allResult.approvals.filter(a => a.status === 'EXPIRED').length + expiredCount,
      cancelled: allResult.approvals.filter(a => a.status === 'CANCELLED').length,
      byPriority: {
        urgent: pendingResult.approvals.filter(a => a.priority === 'URGENT').length,
        high: pendingResult.approvals.filter(a => a.priority === 'HIGH').length,
        normal: pendingResult.approvals.filter(a => a.priority === 'NORMAL').length,
        low: pendingResult.approvals.filter(a => a.priority === 'LOW').length,
      },
      byRiskLevel: {
        critical: allResult.approvals.filter(a => a.riskLevel === 'CRITICAL').length,
        high: allResult.approvals.filter(a => a.riskLevel === 'HIGH').length,
        medium: allResult.approvals.filter(a => a.riskLevel === 'MEDIUM').length,
        low: allResult.approvals.filter(a => a.riskLevel === 'LOW').length,
      },
    };

    return res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get approval stats');
    return next(error);
  }
});

// List all approvals
router.get('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { status, limit = '50', offset = '0' } = req.query;

    const result = await approvalRepository.listByUser(userId, {
      status: status as ApprovalStatus | undefined,
      skip: Number(offset),
      take: Number(limit),
    });

    return res.json({
      success: true,
      approvals: result.approvals,
      total: result.total,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list approvals');
    return next(error);
  }
});

export { router as approvalRoutes };
