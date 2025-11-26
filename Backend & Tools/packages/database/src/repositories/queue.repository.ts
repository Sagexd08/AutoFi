import { db } from '../client.js';
import type { QueueJob, Prisma, JobStatus } from '@prisma/client';

export class QueueRepository {
  async create(data: Prisma.QueueJobCreateInput): Promise<QueueJob> {
    return db.queueJob.create({ data });
  }

  async findById(id: string): Promise<QueueJob | null> {
    return db.queueJob.findUnique({ where: { id } });
  }

  async findByJobId(queueName: string, jobId: string): Promise<QueueJob | null> {
    return db.queueJob.findUnique({
      where: { queueName_jobId: { queueName, jobId } },
    });
  }

  async update(id: string, data: Prisma.QueueJobUpdateInput): Promise<QueueJob> {
    return db.queueJob.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: JobStatus): Promise<QueueJob> {
    return db.queueJob.update({
      where: { id },
      data: { status },
    });
  }

  async startJob(id: string): Promise<QueueJob> {
    return db.queueJob.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async completeJob(id: string, result?: any): Promise<QueueJob> {
    return db.queueJob.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result,
      },
    });
  }

  async failJob(id: string, error: string): Promise<QueueJob> {
    const job = await this.findById(id);
    if (!job) throw new Error('Job not found');

    const newStatus: JobStatus = job.attempts >= job.maxAttempts ? 'FAILED' : 'PENDING';
    
    return db.queueJob.update({
      where: { id },
      data: {
        status: newStatus,
        lastError: error,
        ...(newStatus === 'FAILED' && { completedAt: new Date() }),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await db.queueJob.delete({ where: { id } });
  }

  async listByQueue(queueName: string, params?: {
    status?: JobStatus;
    skip?: number;
    take?: number;
  }): Promise<{ jobs: QueueJob[]; total: number }> {
    const where: Prisma.QueueJobWhereInput = {
      queueName,
      ...(params?.status && { status: params.status }),
    };

    const [jobs, total] = await Promise.all([
      db.queueJob.findMany({
        skip: params?.skip,
        take: params?.take,
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      }),
      db.queueJob.count({ where }),
    ]);
    return { jobs, total };
  }

  async getNextPendingJobs(queueName: string, limit: number): Promise<QueueJob[]> {
    return db.queueJob.findMany({
      where: {
        queueName,
        status: { in: ['PENDING', 'QUEUED'] },
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: new Date() } },
        ],
      },
      take: limit,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async getStats(queueName?: string): Promise<{
    pending: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const where: Prisma.QueueJobWhereInput = queueName ? { queueName } : {};

    const [pending, active, completed, failed, delayed] = await Promise.all([
      db.queueJob.count({ where: { ...where, status: 'PENDING' } }),
      db.queueJob.count({ where: { ...where, status: 'ACTIVE' } }),
      db.queueJob.count({ where: { ...where, status: 'COMPLETED' } }),
      db.queueJob.count({ where: { ...where, status: 'FAILED' } }),
      db.queueJob.count({ where: { ...where, status: 'DELAYED' } }),
    ]);

    return { pending, active, completed, failed, delayed };
  }

  async cleanup(olderThan: Date, status?: JobStatus): Promise<number> {
    const result = await db.queueJob.deleteMany({
      where: {
        completedAt: { lt: olderThan },
        ...(status && { status }),
      },
    });
    return result.count;
  }

  async retryFailed(queueName: string): Promise<number> {
    const result = await db.queueJob.updateMany({
      where: {
        queueName,
        status: 'FAILED',
      },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
        completedAt: null,
      },
    });
    return result.count;
  }

  async pauseQueue(queueName: string): Promise<number> {
    const result = await db.queueJob.updateMany({
      where: {
        queueName,
        status: { in: ['PENDING', 'QUEUED'] },
      },
      data: { status: 'PAUSED' },
    });
    return result.count;
  }

  async resumeQueue(queueName: string): Promise<number> {
    const result = await db.queueJob.updateMany({
      where: {
        queueName,
        status: 'PAUSED',
      },
      data: { status: 'PENDING' },
    });
    return result.count;
  }
}

export const queueRepository = new QueueRepository();
