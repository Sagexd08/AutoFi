import { db } from '../client.js';
import type { Agent, Prisma, AgentType } from '@prisma/client';

export class AgentRepository {
  async create(data: Prisma.AgentCreateInput): Promise<Agent> {
    return db.agent.create({ data });
  }

  async findById(id: string): Promise<Agent | null> {
    return db.agent.findUnique({ where: { id } });
  }

  async findByIdWithRelations(id: string): Promise<Agent | null> {
    return db.agent.findUnique({
      where: { id },
      include: {
        user: true,
        workflows: { take: 10, orderBy: { createdAt: 'desc' } },
        transactions: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async update(id: string, data: Prisma.AgentUpdateInput): Promise<Agent> {
    return db.agent.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await db.agent.delete({ where: { id } });
  }

  async listByUser(userId: string, params?: {
    skip?: number;
    take?: number;
    type?: AgentType;
    isActive?: boolean;
  }): Promise<{ agents: Agent[]; total: number }> {
    const where: Prisma.AgentWhereInput = {
      userId,
      ...(params?.type && { type: params.type }),
      ...(params?.isActive !== undefined && { isActive: params.isActive }),
    };

    const [agents, total] = await Promise.all([
      db.agent.findMany({
        skip: params?.skip,
        take: params?.take,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      db.agent.count({ where }),
    ]);
    return { agents, total };
  }

  async updateSpendingLimits(id: string, data: {
    dailyLimit?: string;
    perTxLimit?: string;
    cumulative24h?: string;
    lastResetAt?: Date;
  }): Promise<Agent> {
    return db.agent.update({
      where: { id },
      data,
    });
  }

  async resetDailySpending(id: string): Promise<Agent> {
    return db.agent.update({
      where: { id },
      data: {
        cumulative24h: '0',
        lastResetAt: new Date(),
      },
    });
  }

  async addToWhitelist(id: string, addresses: string[]): Promise<Agent> {
    const agent = await this.findById(id);
    if (!agent) throw new Error('Agent not found');
    
    const uniqueAddresses = [...new Set([...agent.whitelist, ...addresses])];
    return this.update(id, { whitelist: uniqueAddresses });
  }

  async removeFromWhitelist(id: string, addresses: string[]): Promise<Agent> {
    const agent = await this.findById(id);
    if (!agent) throw new Error('Agent not found');
    
    const filteredAddresses = agent.whitelist.filter((a: string) => !addresses.includes(a));
    return this.update(id, { whitelist: filteredAddresses });
  }

  async addToBlacklist(id: string, addresses: string[]): Promise<Agent> {
    const agent = await this.findById(id);
    if (!agent) throw new Error('Agent not found');
    
    const uniqueAddresses = [...new Set([...agent.blacklist, ...addresses])];
    return this.update(id, { blacklist: uniqueAddresses });
  }

  async getActiveAgentsByType(type: AgentType): Promise<Agent[]> {
    return db.agent.findMany({
      where: { type, isActive: true },
    });
  }
}

export const agentRepository = new AgentRepository();
