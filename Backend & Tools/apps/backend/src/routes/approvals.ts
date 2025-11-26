import express, { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const router: Router = express.Router();

// Simple ID generator
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Approval status enum
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
type ApprovalPriority = 'low' | 'medium' | 'high' | 'critical';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// In-memory approval store
interface ApprovalRequest {
  id: string;
  transactionId: string;
  agentId?: string;
  workflowId?: string;
  userId?: string;
  
  // Transaction details
  chainId: number;
  to: string;
  value?: string;
  data?: string;
  
  // Risk assessment
  riskScore: number;
  riskLevel: RiskLevel;
  warnings: string[];
  recommendations: string[];
  
  // Approval status
  status: ApprovalStatus;
  priority: ApprovalPriority;
  
  // Approver info
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  
  // Expiration
  expiresAt: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Metadata
  metadata?: Record<string, unknown>;
}

const approvals = new Map<string, ApprovalRequest>();

// Schemas
const createApprovalSchema = z.object({
  transactionId: z.string().min(1),
  agentId: z.string().optional(),
  workflowId: z.string().optional(),
  userId: z.string().optional(),
  chainId: z.number().default(42220),
  to: z.string().min(1),
  value: z.string().optional(),
  data: z.string().optional(),
  riskScore: z.number().min(0).max(1),
  warnings: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  expiresInMinutes: z.number().min(1).max(1440).default(60), // 1 min to 24 hours
  metadata: z.record(z.unknown()).optional(),
});

const approveSchema = z.object({
  approverId: z.string().min(1),
  comment: z.string().optional(),
});

const rejectSchema = z.object({
  rejectorId: z.string().min(1),
  reason: z.string().min(1),
});

// Helper functions
function getRiskLevel(riskScore: number): RiskLevel {
  if (riskScore >= 0.85) return 'critical';
  if (riskScore >= 0.7) return 'high';
  if (riskScore >= 0.5) return 'medium';
  return 'low';
}

function getPriorityFromRisk(riskLevel: RiskLevel): ApprovalPriority {
  switch (riskLevel) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'medium': return 'medium';
    default: return 'low';
  }
}

function isExpired(approval: ApprovalRequest): boolean {
  return new Date() > approval.expiresAt;
}

// Create a new approval request
router.post('/', async (req, res, next) => {
  try {
    const parsed = createApprovalSchema.parse(req.body);
    const approvalId = generateId('apr');
    
    const riskLevel = getRiskLevel(parsed.riskScore);
    const priority = parsed.priority || getPriorityFromRisk(riskLevel);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + parsed.expiresInMinutes * 60 * 1000);
    
    const approval: ApprovalRequest = {
      id: approvalId,
      transactionId: parsed.transactionId,
      agentId: parsed.agentId,
      workflowId: parsed.workflowId,
      userId: parsed.userId,
      chainId: parsed.chainId,
      to: parsed.to,
      value: parsed.value,
      data: parsed.data,
      riskScore: parsed.riskScore,
      riskLevel,
      warnings: parsed.warnings || [],
      recommendations: parsed.recommendations || [],
      status: 'pending',
      priority,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      metadata: parsed.metadata,
    };
    
    approvals.set(approvalId, approval);
    
    logger.info({
      approvalId,
      transactionId: parsed.transactionId,
      riskScore: parsed.riskScore,
      riskLevel,
      priority,
    }, 'Approval request created');
    
    return res.status(201).json({
      success: true,
      approval: {
        id: approval.id,
        transactionId: approval.transactionId,
        status: approval.status,
        priority: approval.priority,
        riskLevel: approval.riskLevel,
        riskScore: approval.riskScore,
        expiresAt: approval.expiresAt,
        createdAt: approval.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Get all pending approvals
router.get('/pending', async (req, res) => {
  const { priority, agentId, userId, limit = '50', offset = '0' } = req.query;
  
  let results = Array.from(approvals.values())
    .filter(a => a.status === 'pending' && !isExpired(a));
  
  // Update expired approvals
  for (const approval of approvals.values()) {
    if (approval.status === 'pending' && isExpired(approval)) {
      approval.status = 'expired';
      approval.updatedAt = new Date();
      approvals.set(approval.id, approval);
    }
  }
  
  if (priority && typeof priority === 'string') {
    results = results.filter(a => a.priority === priority);
  }
  
  if (agentId && typeof agentId === 'string') {
    results = results.filter(a => a.agentId === agentId);
  }
  
  if (userId && typeof userId === 'string') {
    results = results.filter(a => a.userId === userId);
  }
  
  // Sort by priority (critical first) and creation time
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  results = results
    .sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(Number(offset), Number(offset) + Number(limit));
  
  return res.json({
    success: true,
    approvals: results,
    total: results.length,
  });
});

// Get approval by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const approval = approvals.get(id);
  
  if (!approval) {
    return res.status(404).json({
      success: false,
      error: 'Approval request not found',
    });
  }
  
  // Check if expired
  if (approval.status === 'pending' && isExpired(approval)) {
    approval.status = 'expired';
    approval.updatedAt = new Date();
    approvals.set(id, approval);
  }
  
  return res.json({
    success: true,
    approval,
  });
});

// Approve a request
router.post('/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = approveSchema.parse(req.body);
    
    const approval = approvals.get(id);
    
    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'Approval request not found',
      });
    }
    
    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot approve: request is ${approval.status}`,
      });
    }
    
    if (isExpired(approval)) {
      approval.status = 'expired';
      approval.updatedAt = new Date();
      approvals.set(id, approval);
      
      return res.status(400).json({
        success: false,
        error: 'Approval request has expired',
      });
    }
    
    approval.status = 'approved';
    approval.approvedBy = parsed.approverId;
    approval.approvedAt = new Date();
    approval.updatedAt = new Date();
    
    if (parsed.comment) {
      approval.metadata = {
        ...approval.metadata,
        approvalComment: parsed.comment,
      };
    }
    
    approvals.set(id, approval);
    
    logger.info({
      approvalId: id,
      transactionId: approval.transactionId,
      approvedBy: parsed.approverId,
    }, 'Approval request approved');
    
    return res.json({
      success: true,
      approval: {
        id: approval.id,
        transactionId: approval.transactionId,
        status: approval.status,
        approvedBy: approval.approvedBy,
        approvedAt: approval.approvedAt,
      },
      message: 'Transaction approved for execution',
    });
  } catch (error) {
    return next(error);
  }
});

// Reject a request
router.post('/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = rejectSchema.parse(req.body);
    
    const approval = approvals.get(id);
    
    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'Approval request not found',
      });
    }
    
    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot reject: request is ${approval.status}`,
      });
    }
    
    approval.status = 'rejected';
    approval.rejectedBy = parsed.rejectorId;
    approval.rejectedAt = new Date();
    approval.rejectionReason = parsed.reason;
    approval.updatedAt = new Date();
    
    approvals.set(id, approval);
    
    logger.info({
      approvalId: id,
      transactionId: approval.transactionId,
      rejectedBy: parsed.rejectorId,
      reason: parsed.reason,
    }, 'Approval request rejected');
    
    return res.json({
      success: true,
      approval: {
        id: approval.id,
        transactionId: approval.transactionId,
        status: approval.status,
        rejectedBy: approval.rejectedBy,
        rejectedAt: approval.rejectedAt,
        rejectionReason: approval.rejectionReason,
      },
      message: 'Transaction rejected',
    });
  } catch (error) {
    return next(error);
  }
});

// Cancel a request (by the requester)
router.post('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  
  const approval = approvals.get(id);
  
  if (!approval) {
    return res.status(404).json({
      success: false,
      error: 'Approval request not found',
    });
  }
  
  if (approval.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: `Cannot cancel: request is ${approval.status}`,
    });
  }
  
  approval.status = 'cancelled';
  approval.updatedAt = new Date();
  
  approvals.set(id, approval);
  
  logger.info({
    approvalId: id,
    transactionId: approval.transactionId,
  }, 'Approval request cancelled');
  
  return res.json({
    success: true,
    approval: {
      id: approval.id,
      transactionId: approval.transactionId,
      status: approval.status,
    },
    message: 'Approval request cancelled',
  });
});

// Get approval statistics
router.get('/stats/summary', async (_req, res) => {
  const all = Array.from(approvals.values());
  
  // Update expired
  for (const approval of all) {
    if (approval.status === 'pending' && isExpired(approval)) {
      approval.status = 'expired';
      approval.updatedAt = new Date();
      approvals.set(approval.id, approval);
    }
  }
  
  const stats = {
    total: all.length,
    pending: all.filter(a => a.status === 'pending').length,
    approved: all.filter(a => a.status === 'approved').length,
    rejected: all.filter(a => a.status === 'rejected').length,
    expired: all.filter(a => a.status === 'expired').length,
    cancelled: all.filter(a => a.status === 'cancelled').length,
    byPriority: {
      critical: all.filter(a => a.priority === 'critical' && a.status === 'pending').length,
      high: all.filter(a => a.priority === 'high' && a.status === 'pending').length,
      medium: all.filter(a => a.priority === 'medium' && a.status === 'pending').length,
      low: all.filter(a => a.priority === 'low' && a.status === 'pending').length,
    },
    byRiskLevel: {
      critical: all.filter(a => a.riskLevel === 'critical').length,
      high: all.filter(a => a.riskLevel === 'high').length,
      medium: all.filter(a => a.riskLevel === 'medium').length,
      low: all.filter(a => a.riskLevel === 'low').length,
    },
  };
  
  return res.json({
    success: true,
    stats,
  });
});

// List all approvals with filters
router.get('/', async (req, res) => {
  const { status, priority, riskLevel, agentId, userId, limit = '50', offset = '0' } = req.query;
  
  let results = Array.from(approvals.values());
  
  // Update expired
  for (const approval of results) {
    if (approval.status === 'pending' && isExpired(approval)) {
      approval.status = 'expired';
      approval.updatedAt = new Date();
      approvals.set(approval.id, approval);
    }
  }
  
  if (status && typeof status === 'string') {
    results = results.filter(a => a.status === status);
  }
  
  if (priority && typeof priority === 'string') {
    results = results.filter(a => a.priority === priority);
  }
  
  if (riskLevel && typeof riskLevel === 'string') {
    results = results.filter(a => a.riskLevel === riskLevel);
  }
  
  if (agentId && typeof agentId === 'string') {
    results = results.filter(a => a.agentId === agentId);
  }
  
  if (userId && typeof userId === 'string') {
    results = results.filter(a => a.userId === userId);
  }
  
  results = results
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(Number(offset), Number(offset) + Number(limit));
  
  return res.json({
    success: true,
    approvals: results,
    total: results.length,
  });
});

export { router as approvalRoutes };
