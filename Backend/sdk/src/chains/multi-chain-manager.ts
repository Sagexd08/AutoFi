import { EventEmitter } from 'events';
import { createPublicClient, createWalletClient, http } from 'viem';
import type { SDKConfig, ChainConfig } from '../types/config';
import type { TransactionRequest, TransactionResponse, TokenBalance } from '../types/core';
export class MultiChainManager extends EventEmitter {
  private readonly config: SDKConfig;
  private readonly supportedChains: Map<string, ChainConfig> = new Map();
  private readonly chainHealth: Map<string, boolean> = new Map();
  private readonly chainClients: Map<string, any> = new Map();
  constructor(config: SDKConfig) {
    super();
    this.config = config;
    this.initializeSupportedChains();
  }
  private initializeSupportedChains(): void {
    this.supportedChains.set('ethereum', {
      id: 'ethereum',
      name: 'Ethereum',
      chainId: 1,
      rpcUrls: ['https://eth-mainnet.g.alchemy.com/v2/demo'],
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      blockExplorer: 'https://etherscan.io',
      isTestnet: false,
      priority: 1,
      gasPriceMultiplier: 1.0,
      maxGasPrice: '100000000000',
      minGasPrice: '20000000000',
    });
    this.supportedChains.set('polygon', {
      id: 'polygon',
      name: 'Polygon',
      chainId: 137,
      rpcUrls: ['https://polygon-mainnet.g.alchemy.com/v2/demo'],
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      blockExplorer: 'https://polygonscan.com',
      isTestnet: false,
      priority: 2,
      gasPriceMultiplier: 0.8,
      maxGasPrice: '500000000000',
      minGasPrice: '30000000000',
    });
    this.supportedChains.set('bsc', {
      id: 'bsc',
      name: 'Binance Smart Chain',
      chainId: 56,
      rpcUrls: ['https://bsc-dataseed.binance.org'],
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      blockExplorer: 'https://bscscan.com',
      isTestnet: false,
      priority: 3,
      gasPriceMultiplier: 0.5,
      maxGasPrice: '20000000000',
      minGasPrice: '5000000000',
    });
    this.supportedChains.set('celo', {
      id: 'celo',
      name: 'Celo',
      chainId: 42220,
      rpcUrls: ['https://forno.celo.org'],
      nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
      blockExplorer: 'https://explorer.celo.org',
      isTestnet: false,
      priority: 4,
      gasPriceMultiplier: 0.7,
      maxGasPrice: '5000000000',
      minGasPrice: '1000000000',
    });
  }
  async initialize(): Promise<void> {
    try {
      for (const [chainId, chain] of this.supportedChains) {
        await this.initializeChain(chainId);
      }
      this.emit('chainsInitialized');
    } catch (error) {
      this.emit('chainError', { chainId: 'all', error: (error instanceof Error ? error.message : String(error)) });
      throw error;
    }
  }
  private async initializeChain(chainId: string): Promise<void> {
    try {
      const chain = this.supportedChains.get(chainId);
      if (!chain) {
        throw new Error(`Chain ${chainId} not found`);
      }
      const rpcUrl = chain.rpcUrls[0];
      const client = createPublicClient({
        chain: chain as any,
        transport: http(rpcUrl),
      });
      await client.getBlockNumber();
      this.chainHealth.set(chainId, true);
      this.chainClients.set(chainId, client);
      this.emit('chainHealthChanged', { chainId, healthy: true });
    } catch (error) {
      this.chainHealth.set(chainId, false);
      this.emit('chainHealthChanged', { chainId, healthy: false });
      this.emit('chainError', { chainId, error: (error instanceof Error ? error.message : String(error)) });
    }
  }
  async getSupportedChains(): Promise<ChainConfig[]> {
    return Array.from(this.supportedChains.values());
  }
  async getChain(chainId: string): Promise<ChainConfig | undefined> {
    return this.supportedChains.get(chainId);
  }
  async getChainHealth(chainId: string): Promise<boolean> {
    return this.chainHealth.get(chainId) || false;
  }
  async getAllChainHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    for (const [chainId, isHealthy] of this.chainHealth) {
      health[chainId] = isHealthy;
    }
    return health;
  }
  async createChainClient(chainId: string, privateKey?: string): Promise<any> {
    const chain = this.supportedChains.get(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    const rpcUrl = chain.rpcUrls[0];
    const publicClient = createPublicClient({
      chain: chain as any,
      transport: http(rpcUrl),
    });
    let walletClient = null;
    if (privateKey) {
      const { privateKeyToAccount } = await import('viem/accounts');
      const privateKey = this.config.privateKey || '';
      if (!privateKey.startsWith('0x')) {
        throw new Error('Invalid private key format');
      }
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      walletClient = createWalletClient({
        account,
        chain: chain as any,
        transport: http(rpcUrl),
      });
    }
    return {
      chain,
      publicClient,
      walletClient,
      rpcUrl,
      sendTransaction: async (request: TransactionRequest): Promise<TransactionResponse> => {
        try {
          if (!walletClient) {
            throw new Error('Wallet client not initialized');
          }
          const txHash = await walletClient.sendTransaction({
            chain: chain as any,
            to: request.to as `0x${string}`,
            value: request.value ? BigInt(request.value) : 0n,
            data: request.data as `0x${string}` | undefined,
            gas: request.gasLimit ? BigInt(request.gasLimit) : undefined,
            gasPrice: request.gasPrice ? BigInt(request.gasPrice) : undefined,
          });
          return {
            success: true,
            txHash,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return {
            success: false,
            error: (error instanceof Error ? error.message : String(error)),
            timestamp: new Date().toISOString(),
          };
        }
      },
      getTokenBalance: async (address: string, tokenAddress: string): Promise<TokenBalance> => {
        try {
          if (tokenAddress === '0x0000000000000000000000000000000000000000') {
            const balance = await publicClient.getBalance({ address: address as `0x${string}` });
            return {
              success: true,
              balance: balance.toString(),
              raw: balance.toString(),
              decimals: 18,
              symbol: chain.nativeCurrency.symbol,
              address: tokenAddress,
            };
          }
          return {
            success: false,
            balance: '0',
            raw: '0',
            decimals: 18,
            symbol: 'UNKNOWN',
            address: tokenAddress,
            error: 'ERC20 balance checking not implemented',
          };
        } catch (error) {
          return {
            success: false,
            balance: '0',
            raw: '0',
            decimals: 18,
            symbol: 'UNKNOWN',
            address: tokenAddress,
            error: (error instanceof Error ? error.message : String(error)),
          };
        }
      },
    };
  }
}
