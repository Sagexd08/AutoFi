import { db } from '../client.js';
import type { Chain, Prisma } from '@prisma/client';

export class ChainRepository {
  async create(data: Prisma.ChainCreateInput): Promise<Chain> {
    return db.chain.create({ data });
  }

  async findById(id: number): Promise<Chain | null> {
    return db.chain.findUnique({ where: { id } });
  }

  async update(id: number, data: Prisma.ChainUpdateInput): Promise<Chain> {
    return db.chain.update({ where: { id }, data });
  }

  async delete(id: number): Promise<void> {
    await db.chain.delete({ where: { id } });
  }

  async listAll(): Promise<Chain[]> {
    return db.chain.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async listEnabled(): Promise<Chain[]> {
    return db.chain.findMany({
      where: { isEnabled: true },
      orderBy: { name: 'asc' },
    });
  }

  async listHealthy(): Promise<Chain[]> {
    return db.chain.findMany({
      where: {
        isEnabled: true,
        isHealthy: true,
      },
      orderBy: { latencyMs: 'asc' },
    });
  }

  async updateHealth(id: number, data: {
    isHealthy: boolean;
    latencyMs?: number;
  }): Promise<Chain> {
    return db.chain.update({
      where: { id },
      data: {
        ...data,
        lastHealthCheck: new Date(),
      },
    });
  }

  async setEnabled(id: number, enabled: boolean): Promise<Chain> {
    return db.chain.update({
      where: { id },
      data: { isEnabled: enabled },
    });
  }

  async upsert(id: number, data: Omit<Prisma.ChainCreateInput, 'id'>): Promise<Chain> {
    return db.chain.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  async seedDefaultChains(): Promise<void> {
    const defaultChains: Prisma.ChainCreateInput[] = [
      {
        id: 1,
        name: 'Ethereum Mainnet',
        shortName: 'eth',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
        blockExplorerUrls: ['https://etherscan.io'],
        isEnabled: true,
        isTestnet: false,
      },
      {
        id: 137,
        name: 'Polygon Mainnet',
        shortName: 'matic',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        rpcUrls: ['https://polygon.llamarpc.com', 'https://rpc.ankr.com/polygon'],
        blockExplorerUrls: ['https://polygonscan.com'],
        isEnabled: true,
        isTestnet: false,
      },
      {
        id: 42161,
        name: 'Arbitrum One',
        shortName: 'arb1',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'],
        blockExplorerUrls: ['https://arbiscan.io'],
        isEnabled: true,
        isTestnet: false,
      },
      {
        id: 10,
        name: 'Optimism',
        shortName: 'oeth',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism'],
        blockExplorerUrls: ['https://optimistic.etherscan.io'],
        isEnabled: true,
        isTestnet: false,
      },
      {
        id: 8453,
        name: 'Base',
        shortName: 'base',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://mainnet.base.org', 'https://base.llamarpc.com'],
        blockExplorerUrls: ['https://basescan.org'],
        isEnabled: true,
        isTestnet: false,
      },
      {
        id: 43114,
        name: 'Avalanche C-Chain',
        shortName: 'avax',
        nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
        rpcUrls: ['https://api.avax.network/ext/bc/C/rpc', 'https://rpc.ankr.com/avalanche'],
        blockExplorerUrls: ['https://snowtrace.io'],
        isEnabled: true,
        isTestnet: false,
      },
      {
        id: 42220,
        name: 'Celo Mainnet',
        shortName: 'celo',
        nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
        rpcUrls: ['https://forno.celo.org'],
        blockExplorerUrls: ['https://celoscan.io'],
        isEnabled: true,
        isTestnet: false,
      },
      {
        id: 44787,
        name: 'Celo Alfajores Testnet',
        shortName: 'alfajores',
        nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
        rpcUrls: ['https://alfajores-forno.celo-testnet.org'],
        blockExplorerUrls: ['https://alfajores.celoscan.io'],
        isEnabled: true,
        isTestnet: true,
      },
      {
        id: 56,
        name: 'BNB Smart Chain',
        shortName: 'bnb',
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        rpcUrls: ['https://bsc-dataseed.binance.org', 'https://rpc.ankr.com/bsc'],
        blockExplorerUrls: ['https://bscscan.com'],
        isEnabled: true,
        isTestnet: false,
      },
    ];

    for (const chain of defaultChains) {
      await this.upsert(chain.id as number, chain);
    }
  }
}

export const chainRepository = new ChainRepository();
