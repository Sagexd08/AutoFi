import { db } from '../client.js';
import { Prisma } from '@prisma/client';
import type { 
  Approval, 
  ApprovalStatus,
  ApprovalPriority,
  RiskLevel 
} from '@prisma/client';

export class ApprovalRepository {
  async create(data: Prisma.ApprovalCreateInput): Promise<Approval> {
    return db.approval.create({ data });
  }

  async findById(id: string): Promise<Approval | null> {
    return db.approval.findUnique({ where: { id } });
  }

  async findByTransactionId(transactionId: string): Promise<Approval | null> {
    return db.approval.findUnique({ where: { transactionId } });
  }

  async findByIdWithTransaction(id: string): Promise<Approval & { transaction: any } | null> {
    return db.approval.findUnique({
      where: { id },
      include: {
        transaction: true,
        agent: true,
        user: { select: { id: true, walletAddress: true, name: true } },
      },
    });
  }

  async update(id: string, data: Prisma.ApprovalUpdateInput): Promise<Approval> {
    return db.approval.update({ where: { id }, data });
  }

  async approve(id: string, resolvedBy: string, resolution?: string): Promise<Approval> {
    return db.approval.update({
      where: { id },
      data: {
        status: 'APPROVED',
        resolvedBy,
        resolvedAt: new Date(),
        resolution: resolution ?? 'Approved',
      },
    });
  }

  async reject(id: string, resolvedBy: string, resolution?: string): Promise<Approval> {
    return db.approval.update({
      where: { id },
      data: {
        status: 'REJECTED',
        resolvedBy,
        resolvedAt: new Date(),
        resolution: resolution ?? 'Rejected',
      },
    });
  }

  async cancel(id: string): Promise<Approval> {
    return db.approval.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        resolvedAt: new Date(),
      },
    });
  }

  async listPending(params?: {
    userId?: string;
    agentId?: string;
    priority?: ApprovalPriority;
    riskLevel?: RiskLevel;
    skip?: number;
    take?: number;
  }): Promise<{ approvals: Approval[]; total: number }> {
    const where: Prisma.ApprovalWhereInput = {
      status: 'PENDING',
      ...(params?.userId && { userId: params.userId }),
      ...(params?.agentId && { agentId: params.agentId }),
      ...(params?.priority && { priority: params.priority }),
      ...(params?.riskLevel && { riskLevel: params.riskLevel }),
    };

    const [approvals, total] = await Promise.all([
      db.approval.findMany({
        skip: params?.skip,
        take: params?.take,
        where,
        include: {
          transaction: true,
          agent: { select: { id: true, name: true, type: true } },
        },
        orderBy: [
          { priority: 'desc' },
          { requestedAt: 'asc' },
        ],
      }),
      db.approval.count({ where }),
    ]);
    return { approvals, total };
  }

  async listByUser(userId: string, params?: {
    status?: ApprovalStatus;
    skip?: number;
    take?: number;
  }): Promise<{ approvals: Approval[]; total: number }> {
    const where: Prisma.ApprovalWhereInput = {
      userId,
      ...(params?.status && { status: params.status }),
    };

    const [approvals, total] = await Promise.all([
      db.approval.findMany({
        skip: params?.skip,
        take: params?.take,
        where,
        include: {
          transaction: true,
          agent: { select: { id: true, name: true, type: true } },
        },
        orderBy: { requestedAt: 'desc' },
      }),
      db.approval.count({ where }),
    ]);
    return { approvals, total };
  }

  async getExpired(): Promise<Approval[]> {
    return db.approval.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lte: new Date() },
      },
    });
  }

  async expireOld(): Promise<number> {
    const result = await db.approval.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lte: new Date() },
      },
      data: {
        status: 'EXPIRED',
        resolvedAt: new Date(),
        resolution: 'Auto-expired',
      },
    });
    return result.count;
  }

  async getStats(userId?: string): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    avgResolutionTimeMs: number | null;
  }> {
    const where: Prisma.ApprovalWhereInput = userId ? { userId } : {};

    const [pending, approved, rejected, expired, avgTime] = await Promise.all([
      db.approval.count({ where: { ...where, status: 'PENDING' } }),
      db.approval.count({ where: { ...where, status: 'APPROVED' } }),
      db.approval.count({ where: { ...where, status: 'REJECTED' } }),
      db.approval.count({ where: { ...where, status: 'EXPIRED' } }),
      db.$queryRaw<{ avg: number }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "requestedAt")) * 1000) as avg
        FROM "Approval"
        WHERE "resolvedAt" IS NOT NULL
        ${userId ? Prisma.sql`AND "userId" = ${userId}` : Prisma.empty}
      `,
    ]);

    return {
      pending,
      approved,
      rejected,
      expired,
      avgResolutionTimeMs: avgTime[0]?.avg ?? null,
    };
  }
}

export const approvalRepository = new ApprovalRepository();
