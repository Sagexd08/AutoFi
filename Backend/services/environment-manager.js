import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

export class EnvironmentManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      enableAutoFiSDK: config.enableAutoFiSDK !== false,
      enableToolRegistry: config.enableToolRegistry !== false,
      autoLoadTools: config.autoLoadTools !== false,
      ...config
    };
    this.toolRegistry = new Map();
    this.autofiSDK = null;
    this.initialized = false;
    this.stats = {
      toolCalls: 0,
      sdkCalls: 0,
      errors: 0,
      totalRequests: 0
    };
  }
  async initialize(dependencies = {}) {
    if (this.initialized) {
      logger.warn('Environment Manager already initialized');
      return;
    }
    try {
      logger.info('Initializing Environment Manager...');
      if (this.config.enableAutoFiSDK && dependencies.autofiSDK) {
        this.autofiSDK = dependencies.autofiSDK;
        logger.info('AutoFi SDK initialized');
      } else if (this.config.enableAutoFiSDK === true && !this.autofiSDK) {
        logger.warn('AutoFi SDK not provided but enabled');
      }
      if (dependencies.tools) {
        if (!Array.isArray(dependencies.tools)) {
          throw new Error('Tools must be an array');
        }
        dependencies.tools.forEach(tool => {
          try {
            this.registerTool(tool);
          } catch (error) {
            logger.error(`Failed to register tool: ${error.message}`, { tool });
          }
        });
      }
      if (this.config.autoLoadTools) {
        this.loadDefaultTools();
      }
      this.initialized = true;
      this.emit('initialized', { 
        toolCount: this.toolRegistry.size,
        sdkEnabled: !!this.autofiSDK
      });
      logger.info(`Environment Manager initialized with ${this.toolRegistry.size} tools`);
    } catch (error) {
      logger.error('Failed to initialize Environment Manager', { error: error.message });
      this.stats.errors++;
      throw error;
    }
  }
  registerTool(tool) {
    if (!tool || typeof tool !== 'object') {
      throw new Error('Tool must be an object');
    }
    if (!tool.id || typeof tool.id !== 'string') {
      throw new Error('Tool must have a valid string id');
    }
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid string name');
    }
    if (!tool.handler || typeof tool.handler !== 'function') {
      throw new Error('Tool must have a valid function handler');
    }
    if (this.toolRegistry.has(tool.id)) {
      logger.warn(`Tool ${tool.id} already registered, overwriting`);
    }
    this.toolRegistry.set(tool.id, {
      id: tool.id,
      name: tool.name,
      description: tool.description || '',
      category: tool.category || 'general',
      handler: tool.handler,
      version: tool.version || '1.0.0',
      registeredAt: new Date().toISOString()
    });
    this.emit('toolRegistered', { toolId: tool.id, toolName: tool.name });
    logger.debug(`Tool registered: ${tool.name} (${tool.id})`);
  }
  unregisterTool(toolId) {
    if (this.toolRegistry.has(toolId)) {
      const tool = this.toolRegistry.get(toolId);
      this.toolRegistry.delete(toolId);
      this.emit('toolUnregistered', { toolId, toolName: tool.name });
      logger.debug(`Tool unregistered: ${tool.name} (${toolId})`);
      return true;
    }
    return false;
  }
  getTools() {
    return Array.from(this.toolRegistry.values()).map(tool => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      version: tool.version
    }));
  }
  getTool(toolId) {
    return this.toolRegistry.get(toolId) || null;
  }
  async executeTool(toolId, parameters = {}) {
    if (!toolId || typeof toolId !== 'string') {
      const error = new Error('Invalid toolId provided');
      this.stats.errors++;
      this.emit('toolError', { toolId, error: error.message });
      throw error;
    }
    this.stats.toolCalls++;
    try {
      const tool = this.toolRegistry.get(toolId);
      if (!tool) {
        throw new Error(`Tool ${toolId} not found`);
      }
      if (typeof tool.handler !== 'function') {
        throw new Error(`Tool ${toolId} has invalid handler`);
      }
      this.emit('toolExecuting', { toolId, parameters });
      const result = await tool.handler(parameters);
      this.emit('toolExecuted', { toolId, parameters, result });
      return {
        success: true,
        toolId,
        result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.stats.errors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('toolError', { toolId, error: errorMessage });
      return {
        success: false,
        toolId,
        error: errorMessage,
        timestamp: new Date().toISOString()
      };
    }
  }
  async routeToAutoFiSDK(method, parameters = {}) {
    this.stats.sdkCalls++;
    if (!this.autofiSDK) {
      const error = new Error('AutoFi SDK not initialized');
      this.stats.errors++;
      this.emit('sdkError', { method, error: error.message });
      throw error;
    }
    try {
      this.emit('sdkCall', { method, parameters });
      if (typeof this.autofiSDK[method] !== 'function') {
        const error = new Error(`SDK method ${method} not found`);
        this.stats.errors++;
        this.emit('sdkError', { method, error: error.message });
        throw error;
      }
      const result = await this.autofiSDK[method](parameters);
      this.emit('sdkResult', { method, parameters, result });
      return {
        success: true,
        method,
        result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.stats.errors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('sdkError', { method, error: errorMessage });
      return {
        success: false,
        method,
        error: errorMessage,
        timestamp: new Date().toISOString()
      };
    }
  }
  async routeRequest(request) {
    if (!request || typeof request !== 'object') {
      throw new Error('Invalid request object');
    }
    const { type, target, parameters = {} } = request;
    try {
      this.stats.totalRequests++;
      if (!type || typeof type !== 'string') {
        throw new Error('Request type is required');
      }
      if (!target || typeof target !== 'string') {
        throw new Error('Request target is required');
      }
      if (type === 'tool') {
        return await this.executeTool(target, parameters);
      } else if (type === 'sdk') {
        return await this.routeToAutoFiSDK(target, parameters);
      } else {
        throw new Error(`Unknown request type: ${type}. Expected 'tool' or 'sdk'`);
      }
    } catch (error) {
      this.stats.errors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('routingError', { request, error: errorMessage });
      throw error;
    }
  }
  getAutoFiSDK() {
    return this.autofiSDK;
  }
  setAutoFiSDK(sdk) {
    if (!sdk) {
      this.autofiSDK = null;
      this.emit('sdkSet', { sdkAvailable: false });
      return;
    }
    if (typeof sdk !== 'object') {
      throw new Error('SDK must be an object');
    }
    this.autofiSDK = sdk;
    this.emit('sdkSet', { sdkAvailable: true });
    if (this.initialized && this.config.autoLoadTools) {
      this.registerSDKMethodsAsTools();
    }
  }
  loadDefaultTools() {
    if (this.autofiSDK) {
      this.registerSDKMethodsAsTools();
    }
  }
  registerSDKMethodsAsTools() {
    if (!this.autofiSDK) {
      console.warn('⚠️  Cannot register SDK tools: AutoFi SDK not available');
      return;
    }
    try {
      const sdkMethods = [
      {
        id: 'sdk_initialize',
        name: 'Initialize SDK',
        description: 'Initialize the AutoFi SDK with chains and services',
        category: 'sdk',
        handler: async (params) => {
          return await this.autofiSDK.initialize();
        }
      },
      {
        id: 'sdk_execute_transaction',
        name: 'Execute Transaction',
        description: 'Execute a blockchain transaction through the SDK',
        category: 'sdk',
        handler: async (params) => {
          return await this.autofiSDK.executeTransaction(params);
        }
      },
      {
        id: 'sdk_get_token_balance',
        name: 'Get Token Balance',
        description: 'Get token balance for an address',
        category: 'sdk',
        handler: async (params) => {
          if (!params.address || !params.tokenAddress) {
            throw new Error('Missing required parameters: address and tokenAddress');
          }
          return await this.autofiSDK.getTokenBalance(params.address, params.tokenAddress);
        }
      },
      {
        id: 'sdk_send_token',
        name: 'Send Token',
        description: 'Send tokens to an address',
        category: 'sdk',
        handler: async (params) => {
          return await this.autofiSDK.sendToken(params.to, params.amount, params.tokenAddress);
        }
      },
      {
        id: 'sdk_deploy_contract',
        name: 'Deploy Contract',
        description: 'Deploy a smart contract through the SDK',
        category: 'sdk',
        handler: async (params) => {
          return await this.autofiSDK.deployContract(params);
        }
      },
      {
        id: 'sdk_create_agent',
        name: 'Create Agent',
        description: 'Create an AI agent through the SDK',
        category: 'sdk',
        handler: async (params) => {
          return await this.autofiSDK.createAgent(params.agentType, params.config);
        }
      },
      {
        id: 'sdk_get_chain_health',
        name: 'Get Chain Health',
        description: 'Get health status of blockchain chains',
        category: 'sdk',
        handler: async (params) => {
          return await this.autofiSDK.getAllChainHealth();
        }
      },
      {
        id: 'sdk_get_supported_chains',
        name: 'Get Supported Chains',
        description: 'Get list of supported blockchain chains',
        category: 'sdk',
        handler: async (params) => {
          return await this.autofiSDK.getSupportedChains();
        }
      }
      ];
      sdkMethods.forEach(method => {
        try {
          this.registerTool(method);
        } catch (error) {
          console.error(`❌ Failed to register SDK tool ${method.id}:`, error.message);
        }
      });
    } catch (error) {
      console.error('❌ Failed to register SDK methods as tools:', error);
    }
  }
  getStats() {
    return {
      ...this.stats,
      toolCount: this.toolRegistry.size,
      sdkAvailable: !!this.autofiSDK,
      initialized: this.initialized
    };
  }
  getHealth() {
    return {
      status: this.initialized ? 'healthy' : 'not_initialized',
      toolCount: this.toolRegistry.size,
      sdkAvailable: !!this.autofiSDK,
      stats: this.stats
    };
  }
  resetStats() {
    this.stats = {
      toolCalls: 0,
      sdkCalls: 0,
      errors: 0,
      totalRequests: 0
    };
  }
}
export default EnvironmentManager;
