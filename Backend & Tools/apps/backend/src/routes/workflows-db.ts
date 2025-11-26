import express, { Router } from 'express';
import { z } from 'zod';
import {
  workflowRepository,
  auditRepository,
  type WorkflowStatus,
  type ExecutionStatus,
} from '@autofi/database';
import { logger } from '../utils/logger.js';
import { notificationService } from '../services/notification.js';

const router: Router = express.Router();

// Schemas
const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  trigger: z.object({
    type: z.enum(['manual', 'schedule', 'event', 'condition']),
    config: z.record(z.unknown()).optional(),
  }).optional(),
  actions: z.array(z.object({
    type: z.string(),
    config: z.record(z.unknown()),
    order: z.number().optional(),
  })).optional(),
  agentId: z.string().optional(),
  cronExpression: z.string().optional(),
  enabled: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  trigger: z.object({
    type: z.enum(['manual', 'schedule', 'event', 'condition']),
    config: z.record(z.unknown()).optional(),
  }).optional(),
  actions: z.array(z.object({
    type: z.string(),
    config: z.record(z.unknown()),
    order: z.number().optional(),
  })).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  enabled: z.boolean().optional(),
  cronExpression: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Helper to get userId from request (will be set by auth middleware)
function getUserId(req: express.Request): string {
  return (req as any).userId || 'system';
}

// Create a new workflow
router.post('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const parsed = createWorkflowSchema.parse(req.body);

    const workflow = await workflowRepository.create({
      name: parsed.name,
      description: parsed.description,
      trigger: (parsed.trigger || {}) as object,
      actions: (parsed.actions || []) as object[],
      status: 'DRAFT' as WorkflowStatus,
      enabled: parsed.enabled ?? false,
      cronExpression: parsed.cronExpression,
      metadata: parsed.metadata as object | undefined,
      user: { connect: { id: userId } },
      ...(parsed.agentId && { agent: { connect: { id: parsed.agentId } } }),
    });

    // Create audit log
    await auditRepository.create({
      userId,
      eventType: 'WORKFLOW',
      eventCode: 'WORKFLOW_CREATED',
      action: 'create',
      resourceType: 'workflow',
      resourceId: workflow.id,
      success: true,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent'),
      metadata: { name: parsed.name },
    });

    logger.info({ workflowId: workflow.id, userId }, 'Workflow created');

    return res.status(201).json({
      success: true,
      workflow,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create workflow');
    return next(error);
  }
});

// List workflows
router.get('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { status, enabled, agentId, limit = '50', offset = '0' } = req.query;

    const result = await workflowRepository.listByUser(userId, {
      skip: Number(offset),
      take: Number(limit),
      status: status as WorkflowStatus | undefined,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      agentId: agentId as string | undefined,
    });

    return res.json({
      success: true,
      workflows: result.workflows,
      total: result.total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list workflows');
    return next(error);
  }
});

// Get workflow by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const includeExecutions = req.query.includeExecutions === 'true';

    const workflow = includeExecutions
      ? await workflowRepository.findByIdWithExecutions(id)
      : await workflowRepository.findById(id);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    return res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get workflow');
    return next(error);
  }
});

// Update workflow
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const parsed = updateWorkflowSchema.parse(req.body);

    const existing = await workflowRepository.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    const workflow = await workflowRepository.update(id, {
      ...(parsed.name && { name: parsed.name }),
      ...(parsed.description !== undefined && { description: parsed.description }),
      ...(parsed.trigger && { trigger: parsed.trigger as object }),
      ...(parsed.actions && { actions: parsed.actions as object[] }),
      ...(parsed.status && { status: parsed.status as WorkflowStatus }),
      ...(parsed.enabled !== undefined && { enabled: parsed.enabled }),
      ...(parsed.cronExpression !== undefined && { cronExpression: parsed.cronExpression }),
      ...(parsed.metadata && { metadata: parsed.metadata as object }),
    });

    // Create audit log
    await auditRepository.create({
      userId,
      eventType: 'WORKFLOW',
      eventCode: 'WORKFLOW_UPDATED',
      action: 'update',
      resourceType: 'workflow',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
      changes: {
        before: { name: existing.name, status: existing.status },
        after: { name: workflow.name, status: workflow.status },
      },
    });

    logger.info({ workflowId: id, userId }, 'Workflow updated');

    return res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update workflow');
    return next(error);
  }
});

// Delete workflow
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const existing = await workflowRepository.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    await workflowRepository.delete(id);

    // Create audit log
    await auditRepository.create({
      userId,
      eventType: 'WORKFLOW',
      eventCode: 'WORKFLOW_DELETED',
      action: 'delete',
      resourceType: 'workflow',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
      metadata: { name: existing.name },
    });

    logger.info({ workflowId: id, userId }, 'Workflow deleted');

    return res.json({
      success: true,
      message: 'Workflow deleted',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to delete workflow');
    return next(error);
  }
});

// Execute workflow
router.post('/:id/execute', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const { context } = req.body;

    const workflow = await workflowRepository.findById(id);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    if (workflow.status !== 'ACTIVE' && workflow.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: `Cannot execute workflow with status ${workflow.status}`,
      });
    }

    // Create execution record
    const execution = await workflowRepository.createExecution({
      workflow: { connect: { id } },
      status: 'RUNNING' as ExecutionStatus,
      startedAt: new Date(),
      metadata: context ? { triggerData: context } : undefined,
    });

    // Notify via WebSocket
    notificationService.notify({
      type: 'workflow:started',
      title: 'Workflow Started',
      message: `Workflow "${workflow.name}" execution started`,
      severity: 'info',
      data: {
        workflowId: id,
        executionId: execution.id,
        workflowName: workflow.name,
      },
      userId,
    });

    // Create audit log
    await auditRepository.create({
      userId,
      eventType: 'WORKFLOW',
      eventCode: 'WORKFLOW_EXECUTED',
      action: 'execute',
      resourceType: 'workflow',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
      metadata: { executionId: execution.id },
    });

    // TODO: Queue the workflow for actual execution via BullMQ
    // await workflowQueue.add('execute', { workflowId: id, executionId: execution.id, context });

    logger.info({ workflowId: id, executionId: execution.id, userId }, 'Workflow execution started');

    return res.json({
      success: true,
      execution: {
        id: execution.id,
        workflowId: id,
        status: execution.status,
        startedAt: execution.startedAt,
      },
      message: 'Workflow execution started',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to execute workflow');
    return next(error);
  }
});

// Get workflow executions
router.get('/:id/executions', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, limit = '20', offset = '0' } = req.query;

    const workflow = await workflowRepository.findById(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    const result = await workflowRepository.listExecutionsByWorkflow(id, {
      skip: Number(offset),
      take: Number(limit),
      status: status as ExecutionStatus | undefined,
    });

    return res.json({
      success: true,
      executions: result.executions,
      total: result.total,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list executions');
    return next(error);
  }
});

// Get execution by ID
router.get('/:workflowId/executions/:executionId', async (req, res, next) => {
  try {
    const { executionId } = req.params;
    const includeSteps = req.query.includeSteps === 'true';

    const execution = includeSteps
      ? await workflowRepository.findExecutionWithSteps(executionId)
      : await workflowRepository.findExecutionById(executionId);

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found',
      });
    }

    return res.json({
      success: true,
      execution,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get execution');
    return next(error);
  }
});

// Activate workflow
router.post('/:id/activate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const workflow = await workflowRepository.update(id, {
      status: 'ACTIVE' as WorkflowStatus,
      enabled: true,
    });

    await auditRepository.create({
      userId,
      eventType: 'WORKFLOW',
      eventCode: 'WORKFLOW_ACTIVATED',
      action: 'activate',
      resourceType: 'workflow',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
    });

    logger.info({ workflowId: id, userId }, 'Workflow activated');

    return res.json({
      success: true,
      workflow,
      message: 'Workflow activated',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to activate workflow');
    return next(error);
  }
});

// Pause workflow
router.post('/:id/pause', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const workflow = await workflowRepository.update(id, {
      status: 'PAUSED' as WorkflowStatus,
      enabled: false,
    });

    await auditRepository.create({
      userId,
      eventType: 'WORKFLOW',
      eventCode: 'WORKFLOW_PAUSED',
      action: 'pause',
      resourceType: 'workflow',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
    });

    logger.info({ workflowId: id, userId }, 'Workflow paused');

    return res.json({
      success: true,
      workflow,
      message: 'Workflow paused',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to pause workflow');
    return next(error);
  }
});

export { router as workflowRoutes };
