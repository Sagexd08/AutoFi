import { db } from '../client.js';
import type { 
  Transaction, 
  Prisma, 
  TransactionStatus,
  RiskLevel 
} from '@prisma/client';

export class TransactionRepository {
  async create(data: Prisma.TransactionCreateInput): Promise<Transaction> {
    return db.transaction.create({ data });
  }

  async findById(id: string): Promise<Transaction | null> {
    return db.transaction.findUnique({ where: { id } });
  }

  async findByHash(hash: string): Promise<Transaction | null> {
    return db.transaction.findUnique({ where: { hash } });
  }

  async findByIdWithApproval(id: string): Promise<Transaction & { approval: any } | null> {
    return db.transaction.findUnique({
      where: { id },
      include: { approval: true },
    });
  }

  async update(id: string, data: Prisma.TransactionUpdateInput): Promise<Transaction> {
    return db.transaction.update({ where: { id }, data });
  }

  async updateByHash(hash: string, data: Prisma.TransactionUpdateInput): Promise<Transaction> {
    return db.transaction.update({ where: { hash }, data });
  }

  async confirm(id: string, data: {
    hash: string;
    blockNumber: number;
    blockHash: string;
    gasUsed?: string;
  }): Promise<Transaction> {
    return db.transaction.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        hash: data.hash,
        blockNumber: data.blockNumber,
        blockHash: data.blockHash,
        gasUsed: data.gasUsed,
        confirmedAt: new Date(),
      },
    });
  }

  async fail(id: string, error?: string): Promise<Transaction> {
    return db.transaction.update({
      where: { id },
      data: {
        status: 'FAILED',
        memo: error ? `Error: ${error}` : undefined,
      },
    });
  }

  async listByUser(userId: string, params?: {
    skip?: number;
    take?: number;
    status?: TransactionStatus;
    chainId?: number;
    agentId?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{ transactions: Transaction[]; total: number }> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(params?.status && { status: params.status }),
      ...(params?.chainId && { chainId: params.chainId }),
      ...(params?.agentId && { agentId: params.agentId }),
      ...(params?.fromDate && { createdAt: { gte: params.fromDate } }),
      ...(params?.toDate && { createdAt: { lte: params.toDate } }),
    };

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        skip: params?.skip,
        take: params?.take,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      db.transaction.count({ where }),
    ]);
    return { transactions, total };
  }

  async listPending(params?: {
    chainId?: number;
    limit?: number;
  }): Promise<Transaction[]> {
    return db.transaction.findMany({
      where: {
        status: { in: ['PENDING', 'QUEUED', 'BROADCASTING'] },
        ...(params?.chainId && { chainId: params.chainId }),
      },
      take: params?.limit ?? 100,
      orderBy: { createdAt: 'asc' },
    });
  }

  async listAwaitingApproval(userId?: string): Promise<Transaction[]> {
    return db.transaction.findMany({
      where: {
        status: 'AWAITING_APPROVAL',
        requiresApproval: true,
        ...(userId && { userId }),
      },
      include: { approval: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(userId: string, params?: {
    chainId?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    failed: number;
    totalValue: string;
    avgGasUsed: string | null;
  }> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(params?.chainId && { chainId: params.chainId }),
      createdAt: {
        ...(params?.fromDate && { gte: params.fromDate }),
        ...(params?.toDate && { lte: params.toDate }),
      },
    };

    const [total, pending, confirmed, failed] = await Promise.all([
      db.transaction.count({ where }),
      db.transaction.count({ where: { ...where, status: 'PENDING' } }),
      db.transaction.count({ where: { ...where, status: 'CONFIRMED' } }),
      db.transaction.count({ where: { ...where, status: 'FAILED' } }),
    ]);

    // Since value and gasUsed are strings, we calculate totals manually
    const confirmedTxs = await db.transaction.findMany({
      where: { ...where, status: 'CONFIRMED' },
      select: { value: true, gasUsed: true },
    });

    let totalValue = BigInt(0);
    let totalGasUsed = BigInt(0);
    let gasCount = 0;

    for (const tx of confirmedTxs) {
      if (tx.value) {
        try {
          totalValue += BigInt(tx.value);
        } catch {
          // Skip invalid values
        }
      }
      if (tx.gasUsed) {
        try {
          totalGasUsed += BigInt(tx.gasUsed);
          gasCount++;
        } catch {
          // Skip invalid values
        }
      }
    }

    const avgGasUsed = gasCount > 0 ? (totalGasUsed / BigInt(gasCount)).toString() : null;

    return {
      total,
      pending,
      confirmed,
      failed,
      totalValue: totalValue.toString(),
      avgGasUsed,
    };
  }

  async saveSimulationResult(id: string, result: any): Promise<Transaction> {
    return db.transaction.update({
      where: { id },
      data: {
        simulationResult: result,
        simulatedAt: new Date(),
      },
    });
  }

  async findByRiskLevel(riskLevel: RiskLevel, params?: {
    userId?: string;
    limit?: number;
  }): Promise<Transaction[]> {
    return db.transaction.findMany({
      where: {
        riskLevel,
        ...(params?.userId && { userId: params.userId }),
      },
      take: params?.limit ?? 100,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Simplified methods for route integration
  async updateStatus(id: string, status: TransactionStatus | string, metadata?: { error?: string }): Promise<Transaction> {
    return db.transaction.update({
      where: { id },
      data: { 
        status: status as TransactionStatus,
        ...(metadata?.error && { memo: `Error: ${metadata.error}` }),
      },
    });
  }

  async findByUserId(userId: string, params?: {
    limit?: number;
    offset?: number;
    status?: string;
    chainId?: number;
  }): Promise<Transaction[]> {
    return db.transaction.findMany({
      where: {
        userId,
        ...(params?.status && { status: params.status as TransactionStatus }),
        ...(params?.chainId && { chainId: params.chainId }),
      },
      take: params?.limit || 50,
      skip: params?.offset || 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByAgentId(agentId: string, params?: {
    limit?: number;
    offset?: number;
    status?: string;
    chainId?: number;
  }): Promise<Transaction[]> {
    return db.transaction.findMany({
      where: {
        agentId,
        ...(params?.status && { status: params.status as TransactionStatus }),
        ...(params?.chainId && { chainId: params.chainId }),
      },
      take: params?.limit || 50,
      skip: params?.offset || 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPending(): Promise<Transaction[]> {
    return db.transaction.findMany({
      where: {
        status: { in: ['PENDING', 'QUEUED', 'BROADCASTING', 'AWAITING_APPROVAL'] },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const transactionRepository = new TransactionRepository();
