import { db } from '../client.js';
import type { User, Prisma } from '@prisma/client';

export class UserRepository {
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return db.user.create({ data });
  }

  async findById(id: string): Promise<User | null> {
    return db.user.findUnique({ where: { id } });
  }

  async findByWallet(walletAddress: string): Promise<User | null> {
    return db.user.findUnique({ where: { walletAddress } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return db.user.findUnique({ where: { email } });
  }

  async findByApiKey(apiKey: string): Promise<User | null> {
    return db.user.findUnique({ where: { apiKey } });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return db.user.update({ where: { id }, data });
  }

  async updateLastActive(id: string): Promise<void> {
    await db.user.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  }

  async delete(id: string): Promise<void> {
    await db.user.delete({ where: { id } });
  }

  async findOrCreate(walletAddress: string, data?: Partial<Prisma.UserCreateInput>): Promise<User> {
    const existing = await this.findByWallet(walletAddress);
    if (existing) return existing;
    
    return this.create({
      walletAddress,
      ...data,
    });
  }

  async list(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<{ users: User[]; total: number }> {
    const [users, total] = await Promise.all([
      db.user.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy ?? { createdAt: 'desc' },
      }),
      db.user.count({ where: params.where }),
    ]);
    return { users, total };
  }
}

export const userRepository = new UserRepository();
