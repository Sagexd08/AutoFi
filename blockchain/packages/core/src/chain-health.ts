import type { Address, Hash } from 'viem';
import { createPublicClient, http, type PublicClient, type Chain } from 'viem';
import { celo, celoAlfajores } from 'viem/chains';

export interface ChainHealthStatus {
  chainId: string | number;
  healthy: boolean;
  latencyMs?: number;
  blockNumber?: bigint;
  lastChecked: string;
  error?: string;
}

export interface RPCConfig {
  url: string;
  priority: number;
  timeout?: number;
}

class ChainHealthMonitor {
  private healthCache = new Map<string | number, ChainHealthStatus>();
  private rpcConfigs: Map<string | number, RPCConfig[]> = new Map();
  private checkInterval?: NodeJS.Timeout;

  constructor() {
    this.setupDefaultRPCs();
  }

  private setupDefaultRPCs(): void {
    // Celo Alfajores
    this.rpcConfigs.set(44787, [
      { url: 'https://alfajores-forno.celo-testnet.org', priority: 1 },
      { url: 'https://alfajores.infura.io/v3/YOUR_KEY', priority: 2 },
    ]);

    // Celo Mainnet
    this.rpcConfigs.set(42220, [
      { url: 'https://forno.celo.org', priority: 1 },
      { url: 'https://celo-mainnet.infura.io/v3/YOUR_KEY', priority: 2 },
    ]);
  }

  addRPC(chainId: string | number, config: RPCConfig): void {
    if (!this.rpcConfigs.has(chainId)) {
      this.rpcConfigs.set(chainId, []);
    }
    const configs = this.rpcConfigs.get(chainId)!;
    configs.push(config);
    configs.sort((a, b) => a.priority - b.priority);
  }

  async checkHealth(chainId: string | number): Promise<ChainHealthStatus> {
    const chain = this.getChain(chainId);
    if (!chain) {
      return {
        chainId,
        healthy: false,
        lastChecked: new Date().toISOString(),
        error: 'Chain not supported',
      };
    }

    const rpcs = this.rpcConfigs.get(chainId) || [];
    if (rpcs.length === 0) {
      return {
        chainId,
        healthy: false,
        lastChecked: new Date().toISOString(),
        error: 'No RPC endpoints configured',
      };
    }

    // Try RPCs in priority order
    for (const rpc of rpcs) {
      try {
        const start = Date.now();
        const client = createPublicClient({
          chain,
          transport: http(rpc.url, { timeout: rpc.timeout || 5000 }),
        });

        const blockNumber = await client.getBlockNumber();
        const latencyMs = Date.now() - start;

        const status: ChainHealthStatus = {
          chainId,
          healthy: true,
          latencyMs,
          blockNumber,
          lastChecked: new Date().toISOString(),
        };

        this.healthCache.set(chainId, status);
        return status;
      } catch (error) {
        // Try next RPC
        continue;
      }
    }

    // All RPCs failed
    const status: ChainHealthStatus = {
      chainId,
      healthy: false,
      lastChecked: new Date().toISOString(),
      error: 'All RPC endpoints failed',
    };

    this.healthCache.set(chainId, status);
    return status;
  }

  getHealth(chainId: string | number): ChainHealthStatus | undefined {
    return this.healthCache.get(chainId);
  }

  getAllHealth(): Map<string | number, ChainHealthStatus> {
    return new Map(this.healthCache);
  }

  startMonitoring(intervalMs = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      for (const chainId of this.rpcConfigs.keys()) {
        await this.checkHealth(chainId);
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  private getChain(chainId: string | number): Chain | undefined {
    const id = typeof chainId === 'string' ? parseInt(chainId) : chainId;
    if (id === 44787) return celoAlfajores;
    if (id === 42220) return celo;
    return undefined;
  }
}

export const chainHealthMonitor = new ChainHealthMonitor();

