import { EventEmitter } from 'events';
import type { SDKConfig, ChainConfig, AgentConfig, ContractConfig, ProxyConfig, TestConfig } from '../types/config';
import type { TransactionRequest, TransactionResponse, AgentResponse, TestResult } from '../types/core';
import { MultiChainManager } from '../chains/multi-chain-manager';
import { ChainRouter } from '../chains/chain-router';
import { LoadBalancer } from '../proxy/load-balancer';
import { ProxyServer } from '../proxy/proxy-server';
import { ContractFactory } from '../contracts/contract-factory';
import { DynamicContractManager } from '../contracts/dynamic-contract-manager';
import { PostmanProtocol } from '../testing/postman-protocol';
import { APITestSuite } from '../testing/api-test-suite';
import { AIAgentSystem } from '../agents/ai-agent-system';
import { AgentOrchestrator } from '../agents/agent-orchestrator';
import { ErrorHandler } from '../utils/error-handler';
import { ValidationUtils } from '../utils/validation-utils';

export class CeloAISDK extends EventEmitter {
  private readonly config: SDKConfig;
  private readonly multiChainManager: MultiChainManager;
  private readonly chainRouter: ChainRouter;
  private readonly loadBalancer: LoadBalancer;
  private readonly proxyServer?: ProxyServer;
  private readonly contractFactory: ContractFactory;
  private readonly dynamicContractManager: DynamicContractManager;
  private readonly postmanProtocol: PostmanProtocol;
  private readonly apiTestSuite: APITestSuite;
  private readonly aiAgentSystem: AIAgentSystem;
  private readonly agentOrchestrator: AgentOrchestrator;
  private readonly errorHandler: ErrorHandler;
  private readonly validationUtils: ValidationUtils;

  constructor(config: SDKConfig = {}) {
    super();
    
    this.config = this.mergeConfig(config);
    this.errorHandler = new ErrorHandler();
    this.validationUtils = new ValidationUtils();
    
    this.multiChainManager = new MultiChainManager(this.config);
    this.chainRouter = new ChainRouter(this.multiChainManager);
    this.loadBalancer = new LoadBalancer(this.config);
    
    if (this.config.enableProxy) {
      this.proxyServer = new ProxyServer(this.config);
    }
    
    this.contractFactory = new ContractFactory(this.multiChainManager);
    this.dynamicContractManager = new DynamicContractManager(this.contractFactory);
    this.postmanProtocol = new PostmanProtocol(this.config);
    this.apiTestSuite = new APITestSuite(this.postmanProtocol);
    this.aiAgentSystem = new AIAgentSystem(this.config);
    this.agentOrchestrator = new AgentOrchestrator(this.aiAgentSystem);
    
    this.initializeEventHandlers();
  }

  private mergeConfig(config: SDKConfig): SDKConfig {
    return {
      enableRealTransactions: true,
      maxRiskScore: 50,
      requireApproval: false,
      enableSimulation: false,
      enableGasOptimization: true,
      enableMultiChain: true,
      enableProxy: false,
      enableTesting: false,
      logLevel: 'info',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  private initializeEventHandlers(): void {
    this.multiChainManager.on('chainHealthChanged', (data) => {
      this.emit('chainHealthChanged', data);
    });

    this.multiChainManager.on('chainError', (error) => {
      this.emit('chainError', error);
    });

    this.aiAgentSystem.on('agentCreated', (data) => {
      this.emit('agentCreated', data);
    });

    this.aiAgentSystem.on('agentResponse', (data) => {
      this.emit('agentResponse', data);
    });

    this.contractFactory.on('contractDeployed', (data) => {
      this.emit('contractDeployed', data);
    });

    this.dynamicContractManager.on('contractUpdated', (data) => {
      this.emit('contractUpdated', data);
    });

    this.apiTestSuite.on('testCompleted', (data) => {
      this.emit('testCompleted', data);
    });

    this.apiTestSuite.on('testFailed', (data) => {
      this.emit('testFailed', data);
    });
  }

  async initialize(): Promise<void> {
    return this.initializeChains();
  }

  async initializeChains(): Promise<void> {
    try {
      await this.multiChainManager.initialize();
      this.emit('chainsInitialized');
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to initialize chains');
      throw error;
    }
  }

  async getSupportedChains(): Promise<ChainConfig[]> {
    return this.multiChainManager.getSupportedChains();
  }

  async getChainHealth(chainId: string): Promise<boolean> {
    return this.multiChainManager.getChainHealth(chainId);
  }

  async getAllChainHealth(): Promise<Record<string, boolean>> {
    return this.multiChainManager.getAllChainHealth();
  }

  async sendTransaction(
    request: TransactionRequest,
    chainId?: string
  ): Promise<TransactionResponse> {
    try {
      this.validationUtils.validateTransactionRequest(request);
      
      const targetChain = chainId || this.config.network || 'ethereum';
      const chain = await this.multiChainManager.getChain(targetChain);
      
      if (!chain) {
        throw new Error(`Unsupported chain: ${targetChain}`);
      }

      const client = await this.multiChainManager.createChainClient(targetChain);
      const response = await client.sendTransaction(request);
      
      this.emit('transactionSent', { request, response, chainId: targetChain });
      return response;
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to send transaction');
      throw error;
    }
  }

  async getTokenBalance(
    address: string,
    tokenAddress: string,
    chainId?: string
  ): Promise<{ success: boolean; balance: string; error?: string }> {
    try {
      this.validationUtils.validateAddress(address);
      
      const targetChain = chainId || this.config.network || 'ethereum';
      const client = await this.multiChainManager.createChainClient(targetChain);
      
      return await client.getTokenBalance(address, tokenAddress);
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to get token balance');
      throw error;
    }
  }

  async createAgent(config: AgentConfig): Promise<string> {
    try {
      this.validationUtils.validateAgentConfig(config);
      return await this.aiAgentSystem.createAgent(config);
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to create agent');
      throw error;
    }
  }

  async processWithAgent(
    agentId: string,
    input: string,
    options: Record<string, unknown> = {}
  ): Promise<AgentResponse> {
    try {
      return await this.aiAgentSystem.processWithAgent(agentId, input, options);
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to process with agent');
      throw error;
    }
  }

  async getAgent(agentId: string): Promise<unknown> {
    return this.aiAgentSystem.getAgent(agentId);
  }

  async getAllAgents(): Promise<unknown[]> {
    return this.aiAgentSystem.getAllAgents();
  }

  async deployContract(
    config: ContractConfig,
    chainId?: string
  ): Promise<{ success: boolean; contractAddress?: string; txHash?: string; error?: string }> {
    try {
      this.validationUtils.validateContractConfig(config);
      
      const targetChain = chainId || this.config.network || 'ethereum';
      return await this.contractFactory.deployContract(config, targetChain);
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to deploy contract');
      throw error;
    }
  }

  async getContract(
    address: string,
    abi: readonly unknown[],
    chainId?: string
  ): Promise<unknown> {
    try {
      this.validationUtils.validateAddress(address);
      
      const targetChain = chainId || this.config.network || 'ethereum';
      return await this.contractFactory.getContract(address, abi, targetChain);
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to get contract');
      throw error;
    }
  }

  async runTests(testSuite?: string): Promise<TestResult[]> {
    try {
      if (!this.config.enableTesting) {
        throw new Error('Testing is not enabled');
      }
      
      return await this.apiTestSuite.runTests(testSuite);
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to run tests');
      throw error;
    }
  }

  async createTestCollection(name: string, description?: string): Promise<string> {
    try {
      return await this.postmanProtocol.createCollection({
        info: {
          name,
          description: description || '',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      });
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to create test collection');
      throw error;
    }
  }

  async startProxyServer(): Promise<void> {
    if (!this.proxyServer) {
      throw new Error('Proxy server is not enabled');
    }
    
    try {
      await this.proxyServer.start();
      this.emit('proxyServerStarted');
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to start proxy server');
      throw error;
    }
  }

  async stopProxyServer(): Promise<void> {
    if (!this.proxyServer) {
      return;
    }
    
    try {
      await this.proxyServer.stop();
      this.emit('proxyServerStopped');
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to stop proxy server');
      throw error;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; services: Record<string, boolean> }> {
    try {
      const services: Record<string, boolean> = {};
      
      const chainHealth = await this.getAllChainHealth();
      services.chains = Object.values(chainHealth).some(healthy => healthy);
      
      services.agents = this.aiAgentSystem ? true : false;
      
      services.contracts = this.contractFactory ? true : false;
      
      if (this.proxyServer) {
        services.proxy = await this.proxyServer.healthCheck();
      }
      
      const healthy = Object.values(services).every(status => status);
      
      return { healthy, services };
    } catch (error) {
      this.errorHandler.handleError(error, 'Health check failed');
      return { healthy: false, services: {} };
    }
  }

  async destroy(): Promise<void> {
    try {
      if (this.proxyServer) {
        await this.stopProxyServer();
      }
      
      this.removeAllListeners();
      this.emit('destroyed');
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to destroy SDK');
      throw error;
    }
  }

  getConfig(): Readonly<SDKConfig> {
    return this.config;
  }

  getMultiChainManager(): MultiChainManager {
    return this.multiChainManager;
  }

  getChainRouter(): ChainRouter {
    return this.chainRouter;
  }

  getLoadBalancer(): LoadBalancer {
    return this.loadBalancer;
  }

  getContractFactory(): ContractFactory {
    return this.contractFactory;
  }

  getDynamicContractManager(): DynamicContractManager {
    return this.dynamicContractManager;
  }

  getPostmanProtocol(): PostmanProtocol {
    return this.postmanProtocol;
  }

  getAPITestSuite(): APITestSuite {
    return this.apiTestSuite;
  }

  getAIAgentSystem(): AIAgentSystem {
    return this.aiAgentSystem;
  }

  getAgentOrchestrator(): AgentOrchestrator {
    return this.agentOrchestrator;
  }
}
