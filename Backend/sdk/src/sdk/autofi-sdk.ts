import { EventEmitter } from 'events';

import { CeloAISDK } from '../core/sdk';

import type { SDKConfig, ContractConfig, AgentConfig } from '../types/config';

import type { TransactionRequest, TransactionResponse, AgentResponse } from '../types/core';

export class AutoFiSDK extends EventEmitter {

  private readonly brand: string;

  private readonly version: string;

  private readonly sdk: CeloAISDK;

  private readonly features: {

    multiChain: boolean;

    aiAgents: boolean;

    contractFactory: boolean;

    proxy: boolean;

    testing: boolean;

  };

  constructor(config: SDKConfig = {}) {

    super();

    this.brand = 'AutoFi';

    this.version = '1.0.0';

    this.sdk = new CeloAISDK(config);

    this.features = {

      multiChain: true,

      aiAgents: true,

      contractFactory: true,

      proxy: true,

      testing: true

    };

    this.forwardSDKEvents();

  }

  private forwardSDKEvents(): void {

    const events = [

      'chainHealthChanged',

      'chainError',

      'agentCreated',

      'agentResponse',

      'contractDeployed',

      'contractUpdated',

      'testCompleted',

      'testFailed'

    ] as const;

    events.forEach(eventName => {

      this.sdk.on(eventName, (data: unknown) => {

        this.emit(eventName, data);

      });

    });

  }

  getInfo(): {

    brand: string;

    version: string;

    sdkVersion: string;

    features: {

      multiChain: boolean;

      aiAgents: boolean;

      contractFactory: boolean;

      proxy: boolean;

      testing: boolean;

    };

    timestamp: string;

  } {

    return {

      brand: this.brand,

      version: this.version,

      sdkVersion: this.sdk.constructor.name,

      features: this.features,

      timestamp: new Date().toISOString()

    };

  }

  async initialize(): Promise<void> {


    if (typeof (this.sdk as any).initializeChains === 'function') {

      return await (this.sdk as any).initializeChains();

    }


  }

  async executeTransaction(request: TransactionRequest): Promise<TransactionResponse> {

    if (!request || typeof request !== 'object') {

      throw new Error('Invalid transaction request');

    }

    return await this.sdk.sendTransaction(request);

  }

  async getTokenBalance(address: string, tokenAddress: string): Promise<unknown> {

    if (!address || typeof address !== 'string') {

      throw new Error('Valid address is required');

    }

    if (!tokenAddress || typeof tokenAddress !== 'string') {

      throw new Error('Valid token address is required');

    }

    return await (this.sdk as any).getTokenBalance(address, tokenAddress);

  }

  async sendToken(to: string, amount: string, tokenAddress: string): Promise<unknown> {

    if (!to || typeof to !== 'string') {

      throw new Error('Valid recipient address is required');

    }

    if (!amount || typeof amount !== 'string') {

      throw new Error('Valid amount is required');

    }

    if (!tokenAddress || typeof tokenAddress !== 'string') {

      throw new Error('Valid token address is required');

    }

    return await (this.sdk as any).sendToken(to, amount, tokenAddress);

  }

  async deployContract(config: ContractConfig): Promise<unknown> {

    if (!config || typeof config !== 'object') {

      throw new Error('Invalid contract configuration');

    }

    return await this.sdk.deployContract(config);

  }

  async createAgent(agentType: string, config: AgentConfig): Promise<unknown> {

    if (!agentType || typeof agentType !== 'string') {

      throw new Error('Valid agent type is required');

    }

    if (!config || typeof config !== 'object') {

      throw new Error('Invalid agent configuration');

    }


    return await (this.sdk as any).createAgent(agentType, config);

  }

  async processAgentRequest(agentId: string, request: Record<string, unknown>): Promise<unknown> {

    if (!agentId || typeof agentId !== 'string') {

      throw new Error('Valid agent ID is required');

    }

    if (!request || typeof request !== 'object') {

      throw new Error('Invalid agent request');

    }

    return await (this.sdk as any).processAgentRequest(agentId, request);

  }

  async runTests(collectionId: string): Promise<unknown> {

    if (!collectionId || typeof collectionId !== 'string') {

      throw new Error('Valid collection ID is required');

    }

    return await this.sdk.runTests(collectionId);

  }

  async getSupportedChains(): Promise<unknown[]> {

    if (typeof this.sdk.getSupportedChains === 'function') {

      return await this.sdk.getSupportedChains();

    }

    const manager = this.getMultiChainManager();

    return manager ? await manager.getSupportedChains() : [];

  }

  async getAllChainHealth(): Promise<Record<string, unknown>> {

    if (typeof this.sdk.getAllChainHealth === 'function') {

      return await this.sdk.getAllChainHealth();

    }

    const manager = this.getMultiChainManager();

    return manager ? await manager.getAllChainHealth() : {};

  }

  getMultiChainManager() {

    return this.sdk.getMultiChainManager();

  }

  getChainRouter() {

    return this.sdk.getChainRouter();

  }

  getContractFactory() {

    return this.sdk.getContractFactory();

  }

  getAgentSystem() {

    return this.sdk.getAIAgentSystem();

  }

  getAgentOrchestrator() {

    return this.sdk.getAgentOrchestrator();

  }

  getUnderlyingSDK(): CeloAISDK {

    return this.sdk;

  }

  getHealth(): {

    brand: string;

    status: string;

    version: string;

    timestamp: string;

  } {

    return {

      brand: this.brand,

      status: 'healthy',

      version: this.version,

      timestamp: new Date().toISOString()

    };

  }

  async shutdown(): Promise<void> {

    try {

      if (typeof (this.sdk as any).shutdown === 'function') {

        await (this.sdk as any).shutdown();

      }

    } catch (error) {

      console.error('Error during SDK shutdown:', error);

    } finally {

      this.emit('shutdown');

    }

  }

}

export default AutoFiSDK;

export { CeloAISDK } from '../core/sdk';

export const AUTOFI_VERSION = '1.0.0';

export const AUTOFI_BRAND = 'AutoFi';

