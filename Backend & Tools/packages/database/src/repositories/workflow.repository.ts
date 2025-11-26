import { db } from '../client.js';
import type { 
  Workflow, 
  WorkflowExecution, 
  WorkflowStep,
  Prisma, 
  WorkflowStatus,
  ExecutionStatus 
} from '@prisma/client';

export class WorkflowRepository {
  // Workflow CRUD
  async create(data: Prisma.WorkflowCreateInput): Promise<Workflow> {
    return db.workflow.create({ data });
  }

  async findById(id: string): Promise<Workflow | null> {
    return db.workflow.findUnique({ where: { id } });
  }

  async findByIdWithExecutions(id: string): Promise<Workflow & { executions: WorkflowExecution[] } | null> {
    return db.workflow.findUnique({
      where: { id },
      include: {
        executions: {
          take: 20,
          orderBy: { startedAt: 'desc' },
        },
      },
    });
  }

  async update(id: string, data: Prisma.WorkflowUpdateInput): Promise<Workflow> {
    return db.workflow.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await db.workflow.delete({ where: { id } });
  }

  async listByUser(userId: string, params?: {
    skip?: number;
    take?: number;
    status?: WorkflowStatus;
    enabled?: boolean;
    agentId?: string;
  }): Promise<{ workflows: Workflow[]; total: number }> {
    const where: Prisma.WorkflowWhereInput = {
      userId,
      ...(params?.status && { status: params.status }),
      ...(params?.enabled !== undefined && { enabled: params.enabled }),
      ...(params?.agentId && { agentId: params.agentId }),
    };

    const [workflows, total] = await Promise.all([
      db.workflow.findMany({
        skip: params?.skip,
        take: params?.take,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      db.workflow.count({ where }),
    ]);
    return { workflows, total };
  }

  async getScheduledWorkflows(): Promise<Workflow[]> {
    return db.workflow.findMany({
      where: {
        enabled: true,
        status: 'ACTIVE',
        cronExpression: { not: null },
        nextRunAt: { lte: new Date() },
      },
      orderBy: { nextRunAt: 'asc' },
    });
  }

  async updateNextRun(id: string, nextRunAt: Date): Promise<Workflow> {
    return db.workflow.update({
      where: { id },
      data: { nextRunAt },
    });
  }

  async incrementRunCount(id: string, success: boolean): Promise<Workflow> {
    return db.workflow.update({
      where: { id },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date(),
        ...(success 
          ? { successCount: { increment: 1 } }
          : { failureCount: { increment: 1 } }
        ),
      },
    });
  }

  // Execution CRUD
  async createExecution(data: Prisma.WorkflowExecutionCreateInput): Promise<WorkflowExecution> {
    return db.workflowExecution.create({ data });
  }

  async findExecutionById(id: string): Promise<WorkflowExecution | null> {
    return db.workflowExecution.findUnique({ where: { id } });
  }

  async findExecutionWithSteps(id: string): Promise<WorkflowExecution & { steps: WorkflowStep[] } | null> {
    return db.workflowExecution.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
      },
    });
  }

  async updateExecution(id: string, data: Prisma.WorkflowExecutionUpdateInput): Promise<WorkflowExecution> {
    return db.workflowExecution.update({ where: { id }, data });
  }

  async completeExecution(id: string, data: {
    status: ExecutionStatus;
    results?: any;
    error?: string;
    transactionHashes?: string[];
  }): Promise<WorkflowExecution> {
    const startTime = await db.workflowExecution.findUnique({
      where: { id },
      select: { startedAt: true },
    });
    
    const durationMs = startTime 
      ? Date.now() - startTime.startedAt.getTime()
      : undefined;

    return db.workflowExecution.update({
      where: { id },
      data: {
        status: data.status,
        completedAt: new Date(),
        results: data.results,
        error: data.error,
        transactionHashes: data.transactionHashes,
        durationMs,
      },
    });
  }

  async listExecutionsByWorkflow(workflowId: string, params?: {
    skip?: number;
    take?: number;
    status?: ExecutionStatus;
  }): Promise<{ executions: WorkflowExecution[]; total: number }> {
    const where: Prisma.WorkflowExecutionWhereInput = {
      workflowId,
      ...(params?.status && { status: params.status }),
    };

    const [executions, total] = await Promise.all([
      db.workflowExecution.findMany({
        skip: params?.skip,
        take: params?.take,
        where,
        orderBy: { startedAt: 'desc' },
      }),
      db.workflowExecution.count({ where }),
    ]);
    return { executions, total };
  }

  // Step CRUD
  async createStep(data: Prisma.WorkflowStepCreateInput): Promise<WorkflowStep> {
    return db.workflowStep.create({ data });
  }

  async updateStep(id: string, data: Prisma.WorkflowStepUpdateInput): Promise<WorkflowStep> {
    return db.workflowStep.update({ where: { id }, data });
  }

  async completeStep(id: string, data: {
    status: ExecutionStatus;
    result?: any;
    error?: string;
    transactionHash?: string;
  }): Promise<WorkflowStep> {
    return db.workflowStep.update({
      where: { id },
      data: {
        status: data.status,
        completedAt: new Date(),
        result: data.result,
        error: data.error,
        transactionHash: data.transactionHash,
      },
    });
  }

  async incrementStepRetry(id: string, error: string): Promise<WorkflowStep> {
    return db.workflowStep.update({
      where: { id },
      data: {
        retryCount: { increment: 1 },
        lastError: error,
      },
    });
  }

  // Generic findAll with filters
  async findAll(params?: {
    userId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Workflow[]> {
    const where: Prisma.WorkflowWhereInput = {};
    
    if (params?.userId) {
      where.userId = params.userId;
    }
    if (params?.status) {
      where.status = params.status as WorkflowStatus;
    }

    return db.workflow.findMany({
      where,
      take: params?.limit || 50,
      skip: params?.offset || 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Alias for listExecutionsByWorkflow with simpler params
  async findExecutionsByWorkflowId(workflowId: string, params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<WorkflowExecution[]> {
    const where: Prisma.WorkflowExecutionWhereInput = {
      workflowId,
      ...(params?.status && { status: params.status as ExecutionStatus }),
    };

    return db.workflowExecution.findMany({
      where,
      take: params?.limit || 50,
      skip: params?.offset || 0,
      orderBy: { startedAt: 'desc' },
    });
  }
}

export const workflowRepository = new WorkflowRepository();
