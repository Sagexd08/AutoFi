import { db } from '../client.js';
import type { 
  AuditLog, 
  Prisma, 
  AuditEventType 
} from '@prisma/client';

export interface CreateAuditLogInput {
  userId?: string;
  eventType: AuditEventType;
  eventCode: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  input?: any;
  output?: any;
  changes?: any;
  success?: boolean;
  errorMessage?: string;
  errorCode?: string;
  durationMs?: number;
  metadata?: any;
}

export class AuditRepository {
  async create(data: CreateAuditLogInput): Promise<AuditLog> {
    return db.auditLog.create({
      data: {
        ...data,
        input: data.input ?? undefined,
        output: data.output ?? undefined,
        changes: data.changes ?? undefined,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  async findById(id: string): Promise<AuditLog | null> {
    return db.auditLog.findUnique({ where: { id } });
  }

  async list(params: {
    userId?: string;
    eventType?: AuditEventType;
    eventCode?: string;
    resourceType?: string;
    resourceId?: string;
    success?: boolean;
    fromDate?: Date;
    toDate?: Date;
    skip?: number;
    take?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.userId && { userId: params.userId }),
      ...(params.eventType && { eventType: params.eventType }),
      ...(params.eventCode && { eventCode: params.eventCode }),
      ...(params.resourceType && { resourceType: params.resourceType }),
      ...(params.resourceId && { resourceId: params.resourceId }),
      ...(params.success !== undefined && { success: params.success }),
      createdAt: {
        ...(params.fromDate && { gte: params.fromDate }),
        ...(params.toDate && { lte: params.toDate }),
      },
    };

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        skip: params.skip,
        take: params.take,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      db.auditLog.count({ where }),
    ]);
    return { logs, total };
  }

  async listByResource(resourceType: string, resourceId: string, params?: {
    skip?: number;
    take?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      resourceType,
      resourceId,
    };

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        skip: params?.skip,
        take: params?.take,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      db.auditLog.count({ where }),
    ]);
    return { logs, total };
  }

  async search(query: string, params?: {
    userId?: string;
    fromDate?: Date;
    toDate?: Date;
    skip?: number;
    take?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      OR: [
        { action: { contains: query, mode: 'insensitive' } },
        { eventCode: { contains: query, mode: 'insensitive' } },
        { resourceType: { contains: query, mode: 'insensitive' } },
        { resourceId: { contains: query, mode: 'insensitive' } },
        { errorMessage: { contains: query, mode: 'insensitive' } },
      ],
      ...(params?.userId && { userId: params.userId }),
      createdAt: {
        ...(params?.fromDate && { gte: params.fromDate }),
        ...(params?.toDate && { lte: params.toDate }),
      },
    };

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        skip: params?.skip,
        take: params?.take,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      db.auditLog.count({ where }),
    ]);
    return { logs, total };
  }

  async getStats(params?: {
    userId?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{
    total: number;
    success: number;
    failed: number;
    byEventType: Record<string, number>;
    avgDurationMs: number | null;
  }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(params?.userId && { userId: params.userId }),
      createdAt: {
        ...(params?.fromDate && { gte: params.fromDate }),
        ...(params?.toDate && { lte: params.toDate }),
      },
    };

    const [total, success, failed, byType, avgDuration] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.count({ where: { ...where, success: true } }),
      db.auditLog.count({ where: { ...where, success: false } }),
      db.auditLog.groupBy({
        by: ['eventType'],
        where,
        _count: true,
      }),
      db.auditLog.aggregate({
        where,
        _avg: { durationMs: true },
      }),
    ]);

    const byEventType: Record<string, number> = {};
    for (const item of byType) {
      byEventType[item.eventType] = item._count;
    }

    return {
      total,
      success,
      failed,
      byEventType,
      avgDurationMs: avgDuration._avg.durationMs,
    };
  }

  async cleanup(olderThan: Date): Promise<number> {
    const result = await db.auditLog.deleteMany({
      where: { createdAt: { lt: olderThan } },
    });
    return result.count;
  }

  // Convenience methods for specific event types
  async logAuth(data: Omit<CreateAuditLogInput, 'eventType'>): Promise<AuditLog> {
    return this.create({ ...data, eventType: 'AUTH' });
  }

  async logAgent(data: Omit<CreateAuditLogInput, 'eventType'>): Promise<AuditLog> {
    return this.create({ ...data, eventType: 'AGENT' });
  }

  async logWorkflow(data: Omit<CreateAuditLogInput, 'eventType'>): Promise<AuditLog> {
    return this.create({ ...data, eventType: 'WORKFLOW' });
  }

  async logTransaction(data: Omit<CreateAuditLogInput, 'eventType'>): Promise<AuditLog> {
    return this.create({ ...data, eventType: 'TRANSACTION' });
  }

  async logApproval(data: Omit<CreateAuditLogInput, 'eventType'>): Promise<AuditLog> {
    return this.create({ ...data, eventType: 'APPROVAL' });
  }

  async logSystem(data: Omit<CreateAuditLogInput, 'eventType'>): Promise<AuditLog> {
    return this.create({ ...data, eventType: 'SYSTEM' });
  }

  async logApi(data: Omit<CreateAuditLogInput, 'eventType'>): Promise<AuditLog> {
    return this.create({ ...data, eventType: 'API' });
  }

  async logChain(data: Omit<CreateAuditLogInput, 'eventType'>): Promise<AuditLog> {
    return this.create({ ...data, eventType: 'CHAIN' });
  }
}

export const auditRepository = new AuditRepository();
