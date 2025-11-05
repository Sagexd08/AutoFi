import { createPublicClient, createWalletClient, http } from 'viem';
import { 
  mainnet, 
  polygon, 
  bsc, 
  arbitrum, 
  optimism, 
  celo, 
  celoAlfajores,
  base,
  avalanche,
  fantom,
  moonbeam,
  gnosis
} from 'viem/chains';
import logger from './utils/logger.js';

export class MultiChainConfig {
  constructor() {
    this.supportedChains = new Map();
    this.chainHealth = new Map();
    this.performanceMetrics = new Map();
    this.initializeChains();
  }

  initializeChains() {
    this.supportedChains.set('ethereum', {
      id: 'ethereum',
      name: 'Ethereum',
      chainId: 1,
      viemChain: mainnet,
      rpcUrls: [
        'https://eth-mainnet.g.alchemy.com/v2/demo',
        'https://mainnet.infura.io/v3/demo',
        'https://ethereum.publicnode.com'
      ],
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorer: 'https://etherscan.io',
      isTestnet: false,
      priority: 1,
      gasPriceMultiplier: 1.0,
      maxGasPrice: '100000000000',
      minGasPrice: '20000000000'
    });

    this.supportedChains.set('polygon', {
      id: 'polygon',
      name: 'Polygon',
      chainId: 137,
      viemChain: polygon,
      rpcUrls: [
        'https://polygon-mainnet.g.alchemy.com/v2/demo',
        'https://polygon-rpc.com',
        'https://rpc-mainnet.maticvigil.com'
      ],
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      },
      blockExplorer: 'https://polygonscan.com',
      isTestnet: false,
      priority: 2,
      gasPriceMultiplier: 0.8,
      maxGasPrice: '500000000000',
      minGasPrice: '30000000000'
    });

    this.supportedChains.set('bsc', {
      id: 'bsc',
      name: 'Binance Smart Chain',
      chainId: 56,
      viemChain: bsc,
      rpcUrls: [
        'https://bsc-dataseed.binance.org',
        'https://bsc-dataseed1.defibit.io',
        'https://bsc-dataseed1.ninicoin.io'
      ],
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18
      },
      blockExplorer: 'https://bscscan.com',
      isTestnet: false,
      priority: 3,
      gasPriceMultiplier: 0.5,
      maxGasPrice: '20000000000',
      minGasPrice: '5000000000'
    });

    this.supportedChains.set('arbitrum', {
      id: 'arbitrum',
      name: 'Arbitrum One',
      chainId: 42161,
      viemChain: arbitrum,
      rpcUrls: [
        'https://arb-mainnet.g.alchemy.com/v2/demo',
        'https://arb1.arbitrum.io/rpc',
        'https://arbitrum.publicnode.com'
      ],
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorer: 'https://arbiscan.io',
      isTestnet: false,
      priority: 4,
      gasPriceMultiplier: 0.3,
      maxGasPrice: '1000000000',
      minGasPrice: '100000000'
    });

    this.supportedChains.set('optimism', {
      id: 'optimism',
      name: 'Optimism',
      chainId: 10,
      viemChain: optimism,
      rpcUrls: [
        'https://opt-mainnet.g.alchemy.com/v2/demo',
        'https://mainnet.optimism.io',
        'https://optimism.publicnode.com'
      ],
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorer: 'https://optimistic.etherscan.io',
      isTestnet: false,
      priority: 5,
      gasPriceMultiplier: 0.2,
      maxGasPrice: '1000000000',
      minGasPrice: '100000000'
    });

    this.supportedChains.set('celo', {
      id: 'celo',
      name: 'Celo',
      chainId: 42220,
      viemChain: celo,
      rpcUrls: [
        'https://forno.celo.org',
        'https://celo-mainnet.g.alchemy.com/v2/demo',
        'https://rpc.ankr.com/celo'
      ],
      nativeCurrency: {
        name: 'CELO',
        symbol: 'CELO',
        decimals: 18
      },
      blockExplorer: 'https://explorer.celo.org',
      isTestnet: false,
      priority: 6,
      gasPriceMultiplier: 0.7,
      maxGasPrice: '5000000000',
      minGasPrice: '1000000000'
    });

    this.supportedChains.set('celo-alfajores', {
      id: 'celo-alfajores',
      name: 'Celo Alfajores',
      chainId: 44787,
      viemChain: celoAlfajores,
      rpcUrls: [
        'https://alfajores-forno.celo-testnet.org',
        'https://celo-alfajores.g.alchemy.com/v2/demo'
      ],
      nativeCurrency: {
        name: 'CELO',
        symbol: 'CELO',
        decimals: 18
      },
      blockExplorer: 'https://alfajores.celoscan.io',
      isTestnet: true,
      priority: 7,
      gasPriceMultiplier: 1.0,
      maxGasPrice: '10000000000',
      minGasPrice: '1000000000'
    });

    this.supportedChains.set('base', {
      id: 'base',
      name: 'Base',
      chainId: 8453,
      viemChain: base,
      rpcUrls: [
        'https://base-mainnet.g.alchemy.com/v2/demo',
        'https://mainnet.base.org',
        'https://base.publicnode.com'
      ],
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorer: 'https://basescan.org',
      isTestnet: false,
      priority: 8,
      gasPriceMultiplier: 0.4,
      maxGasPrice: '1000000000',
      minGasPrice: '100000000'
    });

    this.supportedChains.set('avalanche', {
      id: 'avalanche',
      name: 'Avalanche C-Chain',
      chainId: 43114,
      viemChain: avalanche,
      rpcUrls: [
        'https://api.avax.network/ext/bc/C/rpc',
        'https://avalanche-mainnet.g.alchemy.com/v2/demo',
        'https://rpc.ankr.com/avalanche'
      ],
      nativeCurrency: {
        name: 'Avalanche',
        symbol: 'AVAX',
        decimals: 18
      },
      blockExplorer: 'https://snowtrace.io',
      isTestnet: false,
      priority: 9,
      gasPriceMultiplier: 0.6,
      maxGasPrice: '50000000000',
      minGasPrice: '25000000000'
    });

    for (const [chainId, chain] of this.supportedChains) {
      this.chainHealth.set(chainId, {
        status: 'unknown',
        lastChecked: null,
        responseTime: null,
        errorCount: 0,
        successCount: 0,
        isHealthy: false
      });
    }
  }

  getChain(chainId) {
    return this.supportedChains.get(chainId);
  }

  getAllChains() {
    return Array.from(this.supportedChains.values());
  }

  getMainnetChains() {
    return this.getAllChains().filter(chain => !chain.isTestnet);
  }

  getTestnetChains() {
    return this.getAllChains().filter(chain => chain.isTestnet);
  }

  getChainsByPriority() {
    return this.getAllChains().sort((a, b) => a.priority - b.priority);
  }

  async createChainClient(chainId, privateKey = null) {
    const chain = this.getChain(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    const rpcUrl = await this.getBestRpcUrl(chainId);
    
    const publicClient = createPublicClient({
      chain: chain.viemChain,
      transport: http(rpcUrl)
    });

    let walletClient = null;
    if (privateKey) {
      const { privateKeyToAccount } = await import('viem/accounts');
      const account = privateKeyToAccount(privateKey);
      walletClient = createWalletClient({
        account,
        chain: chain.viemChain,
        transport: http(rpcUrl)
      });
    }

    return {
      chain,
      publicClient,
      walletClient,
      rpcUrl
    };
  }

  async getBestRpcUrl(chainId) {
    const chain = this.getChain(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    for (const rpcUrl of chain.rpcUrls) {
      try {
        const client = createPublicClient({
          chain: chain.viemChain,
          transport: http(rpcUrl)
        });
        
        const startTime = Date.now();
        await client.getBlockNumber();
        const responseTime = Date.now() - startTime;
        
        const health = this.chainHealth.get(chainId);
        health.status = 'healthy';
        health.lastChecked = new Date();
        health.responseTime = responseTime;
        health.successCount++;
        health.isHealthy = true;
        
        return rpcUrl;
      } catch (error) {
        logger.warn('RPC URL failed', { chainId, rpcUrl, error: error.message });
        continue;
      }
    }

    const health = this.chainHealth.get(chainId);
    health.status = 'unhealthy';
    health.lastChecked = new Date();
    health.errorCount++;
    health.isHealthy = false;
    
    logger.error('All RPC URLs failed for chain', { chainId });
    return chain.rpcUrls[0];
  }

  async checkChainHealth(chainId) {
    const chain = this.getChain(chainId);
    if (!chain) {
      return { healthy: false, error: 'Chain not found' };
    }

    try {
      const rpcUrl = await this.getBestRpcUrl(chainId);
      const client = createPublicClient({
        chain: chain.viemChain,
        transport: http(rpcUrl)
      });

      const startTime = Date.now();
      const blockNumber = await client.getBlockNumber();
      const responseTime = Date.now() - startTime;

      const health = this.chainHealth.get(chainId);
      health.status = 'healthy';
      health.lastChecked = new Date();
      health.responseTime = responseTime;
      health.successCount++;
      health.isHealthy = true;

      return {
        healthy: true,
        blockNumber: blockNumber.toString(),
        responseTime,
        rpcUrl
      };
    } catch (error) {
      const health = this.chainHealth.get(chainId);
      health.status = 'unhealthy';
      health.lastChecked = new Date();
      health.errorCount++;
      health.isHealthy = false;

      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async checkAllChainsHealth() {
    const results = {};
    const promises = [];

    for (const chainId of this.supportedChains.keys()) {
      promises.push(
        this.checkChainHealth(chainId).then(result => {
          results[chainId] = result;
        })
      );
    }

    await Promise.allSettled(promises);
    return results;
  }

  getHealthyChains() {
    return this.getAllChains().filter(chain => {
      const health = this.chainHealth.get(chain.id);
      return health.isHealthy;
    });
  }

  getChainHealth(chainId) {
    return this.chainHealth.get(chainId);
  }

  getAllChainHealth() {
    const health = {};
    for (const [chainId, healthData] of this.chainHealth) {
      health[chainId] = healthData;
    }
    return health;
  }

  getBestChainForOperation(operation, preferences = {}) {
    const healthyChains = this.getHealthyChains();
    
    if (preferences.chainId) {
      const preferredChain = healthyChains.find(c => c.id === preferences.chainId);
      if (preferredChain) return preferredChain;
    }

    return healthyChains
      .sort((a, b) => {
        const gasScoreA = a.gasPriceMultiplier;
        const gasScoreB = b.gasPriceMultiplier;
        
        if (gasScoreA !== gasScoreB) {
          return gasScoreA - gasScoreB;
        }
        
        return a.priority - b.priority;
      })[0];
  }

  addCustomChain(chainConfig) {
    this.supportedChains.set(chainConfig.id, {
      ...chainConfig,
      priority: chainConfig.priority || 999,
      gasPriceMultiplier: chainConfig.gasPriceMultiplier || 1.0,
      maxGasPrice: chainConfig.maxGasPrice || '100000000000',
      minGasPrice: chainConfig.minGasPrice || '20000000000'
    });

    this.chainHealth.set(chainConfig.id, {
      status: 'unknown',
      lastChecked: null,
      responseTime: null,
      errorCount: 0,
      successCount: 0,
      isHealthy: false
    });
  }

  removeCustomChain(chainId) {
    this.supportedChains.delete(chainId);
    this.chainHealth.delete(chainId);
  }
}

export default MultiChainConfig;
