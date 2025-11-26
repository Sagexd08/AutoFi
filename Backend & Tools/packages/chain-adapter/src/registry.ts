import type { ChainAdapter } from './adapter.js';
import { EvmAdapter } from './evm/evm-adapter.js';

/**
 * Chain configuration for supported networks
 */
export interface ChainConfig {
  chainId: number;
  name: string;
  shortName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorer: string;
  isTestnet: boolean;
}

/**
 * Default chain configurations for supported EVM chains
 */
export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  // Ethereum Mainnet
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    shortName: 'eth',
    rpcUrls: [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://cloudflare-eth.com',
    ],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://etherscan.io',
    isTestnet: false,
  },
  // Polygon Mainnet
  137: {
    chainId: 137,
    name: 'Polygon Mainnet',
    shortName: 'matic',
    rpcUrls: [
      'https://polygon.llamarpc.com',
      'https://rpc.ankr.com/polygon',
      'https://polygon-rpc.com',
    ],
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    blockExplorer: 'https://polygonscan.com',
    isTestnet: false,
  },
  // Arbitrum One
  42161: {
    chainId: 42161,
    name: 'Arbitrum One',
    shortName: 'arb1',
    rpcUrls: [
      'https://arb1.arbitrum.io/rpc',
      'https://rpc.ankr.com/arbitrum',
    ],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://arbiscan.io',
    isTestnet: false,
  },
  // Optimism
  10: {
    chainId: 10,
    name: 'Optimism',
    shortName: 'oeth',
    rpcUrls: [
      'https://mainnet.optimism.io',
      'https://rpc.ankr.com/optimism',
    ],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://optimistic.etherscan.io',
    isTestnet: false,
  },
  // Base
  8453: {
    chainId: 8453,
    name: 'Base',
    shortName: 'base',
    rpcUrls: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
    ],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://basescan.org',
    isTestnet: false,
  },
  // Avalanche C-Chain
  43114: {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    shortName: 'avax',
    rpcUrls: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://rpc.ankr.com/avalanche',
    ],
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    blockExplorer: 'https://snowtrace.io',
    isTestnet: false,
  },
  // BSC (Binance Smart Chain)
  56: {
    chainId: 56,
    name: 'BNB Smart Chain',
    shortName: 'bsc',
    rpcUrls: [
      'https://bsc-dataseed.binance.org',
      'https://rpc.ankr.com/bsc',
      'https://bsc.llamarpc.com',
    ],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    blockExplorer: 'https://bscscan.com',
    isTestnet: false,
  },
  // Celo Mainnet
  42220: {
    chainId: 42220,
    name: 'Celo Mainnet',
    shortName: 'celo',
    rpcUrls: ['https://forno.celo.org'],
    nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
    blockExplorer: 'https://celoscan.io',
    isTestnet: false,
  },
  // Celo Alfajores Testnet
  44787: {
    chainId: 44787,
    name: 'Celo Alfajores',
    shortName: 'alfajores',
    rpcUrls: ['https://alfajores-forno.celo-testnet.org'],
    nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
    blockExplorer: 'https://alfajores.celoscan.io',
    isTestnet: true,
  },
  // Scroll
  534352: {
    chainId: 534352,
    name: 'Scroll',
    shortName: 'scroll',
    rpcUrls: [
      'https://rpc.scroll.io',
      'https://scroll.drpc.org',
    ],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://scrollscan.com',
    isTestnet: false,
  },
  // zkSync Era
  324: {
    chainId: 324,
    name: 'zkSync Era',
    shortName: 'zksync',
    rpcUrls: [
      'https://mainnet.era.zksync.io',
      'https://zksync.drpc.org',
    ],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://explorer.zksync.io',
    isTestnet: false,
  },
  // Linea
  59144: {
    chainId: 59144,
    name: 'Linea',
    shortName: 'linea',
    rpcUrls: [
      'https://rpc.linea.build',
      'https://linea.drpc.org',
    ],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://lineascan.build',
    isTestnet: false,
  },
  // Mantle
  5000: {
    chainId: 5000,
    name: 'Mantle',
    shortName: 'mantle',
    rpcUrls: [
      'https://rpc.mantle.xyz',
      'https://mantle.drpc.org',
    ],
    nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
    blockExplorer: 'https://explorer.mantle.xyz',
    isTestnet: false,
  },
  // Sepolia Testnet
  11155111: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    shortName: 'sepolia',
    rpcUrls: [
      'https://rpc.sepolia.org',
      'https://rpc.ankr.com/eth_sepolia',
    ],
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://sepolia.etherscan.io',
    isTestnet: true,
  },
  // Polygon Mumbai Testnet
  80001: {
    chainId: 80001,
    name: 'Polygon Mumbai',
    shortName: 'mumbai',
    rpcUrls: [
      'https://rpc-mumbai.maticvigil.com',
      'https://rpc.ankr.com/polygon_mumbai',
    ],
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    blockExplorer: 'https://mumbai.polygonscan.com',
    isTestnet: true,
  },
};

/**
 * Chain adapter registry - manages adapters for multiple chains
 */
export class ChainAdapterRegistry {
  private adapters: Map<number, ChainAdapter> = new Map();
  private privateKey?: string;
  private rpcOverrides: Map<number, string> = new Map();

  constructor(options?: { privateKey?: string; rpcOverrides?: Record<number, string> }) {
    this.privateKey = options?.privateKey;
    if (options?.rpcOverrides) {
      for (const [chainId, rpc] of Object.entries(options.rpcOverrides)) {
        this.rpcOverrides.set(Number(chainId), rpc);
      }
    }
  }

  /**
   * Get or create an adapter for a specific chain
   */
  getAdapter(chainId: number): ChainAdapter {
    if (this.adapters.has(chainId)) {
      return this.adapters.get(chainId)!;
    }

    const config = CHAIN_CONFIGS[chainId];
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    const rpcUrl = this.rpcOverrides.get(chainId) ?? config.rpcUrls[0];
    
    const adapter = new EvmAdapter({
      chainId,
      rpcUrl,
      privateKey: this.privateKey,
    });

    this.adapters.set(chainId, adapter);
    return adapter;
  }

  /**
   * Check if a chain is supported
   */
  isSupported(chainId: number): boolean {
    return chainId in CHAIN_CONFIGS;
  }

  /**
   * Get chain configuration
   */
  getChainConfig(chainId: number): ChainConfig | undefined {
    return CHAIN_CONFIGS[chainId];
  }

  /**
   * List all supported chain IDs
   */
  getSupportedChainIds(): number[] {
    return Object.keys(CHAIN_CONFIGS).map(Number);
  }

  /**
   * List supported mainnets only
   */
  getMainnetChainIds(): number[] {
    return Object.entries(CHAIN_CONFIGS)
      .filter(([_, config]) => !config.isTestnet)
      .map(([id]) => Number(id));
  }

  /**
   * Set a custom RPC URL for a chain
   */
  setRpcUrl(chainId: number, rpcUrl: string): void {
    this.rpcOverrides.set(chainId, rpcUrl);
    // Clear cached adapter so it's recreated with new RPC
    this.adapters.delete(chainId);
  }

  /**
   * Clear all cached adapters
   */
  clearAdapters(): void {
    this.adapters.clear();
  }
}

// Singleton instance
let registry: ChainAdapterRegistry | null = null;

export function getChainRegistry(options?: { privateKey?: string; rpcOverrides?: Record<number, string> }): ChainAdapterRegistry {
  if (!registry) {
    registry = new ChainAdapterRegistry(options);
  }
  return registry;
}

export function createChainRegistry(options?: { privateKey?: string; rpcOverrides?: Record<number, string> }): ChainAdapterRegistry {
  return new ChainAdapterRegistry(options);
}
