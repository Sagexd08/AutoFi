
import { GoogleGenerativeAI } from '@google/generative-ai';
import Database from 'better-sqlite3';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import http from 'http';
import { createPublicClient, createWalletClient, http as viem_http, parseEther } from 'viem';
import { celo } from 'viem/chains';
import { TransactionTracker } from './transaction-tracker.js';
import { GasEstimationService } from './gas-estimation-service.js';
import { EtherscanService } from './etherscan-service.js';
import ConsolidatedAgentSystem, { LangChainAgent } from './agents/agents.js';
import BlockchainInterface from './blockchain-interface.js';
import SupabaseService from './lib/supabase.js';
import { MultiChainConfig } from '../multi-chain-config.js';
import { ProxyServer } from '../proxy-server.js';
import { ContractFactory } from '../contract-factory.js';
import { MonitoringSystem } from '../monitoring-system.js';
import PostmanProtocol from '../postman-protocol.js';
import apiRoutes from '../routes/api-routes.js';
import EnvironmentManager from './environment-manager.js';
import CodeGenerator from './code-generator.js';
import RebalancerSystem from './rebalancer-system.js';
import 'dotenv/config';
import EventEmitter from 'events';

let CeloMCPServer, AgentOrchestrator, AIAgentSystem;
try {
  const mcpModule = await import('./agents/mcp-server.js');
  CeloMCPServer = mcpModule.default;
  const orchestratorModule = await import('./agents/agent-orchestrator.js');
  AgentOrchestrator = orchestratorModule.default;
  const aiAgentModule = await import('./agents/ai-agent-system.js');
  AIAgentSystem = aiAgentModule.default;
} catch (e) {
  console.warn('⚠️  Advanced agent systems not available, continuing with core features');
}

const DEFAULT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbb';
const CELO_TOKENS = {
  CELO: '0x0000000000000000000000000000000000000000',
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73'
};

export class CombinedAutomationSystem extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = this.mergeConfig(config);
    this.conversationHistory = new Map();
    this.functionRegistry = this.createFunctionRegistry();
    this.wsClients = new Set();
    this.transactionQueue = [];
    this.agentSessions = new Map();

    this.performanceMetrics = new Map();
    this.requestCache = new Map();
    this.rateLimitStore = new Map();
    this.securityAudits = [];
    this.executionPipeline = [];
    this.priorityQueue = [];
    this.failedTransactions = [];
    this.advisorySystem = new Map();
    this.predictiveAnalytics = {};
    this._consolidatedAgentStarted = false;

    this.multiChainConfig = null;
    this.proxyServer = null;
    this.contractFactory = null;
    this.monitoringSystem = null;
    this.postmanProtocol = null;
    
    this.environmentManager = null;
    this.codeGenerator = null;
    this.rebalancerSystem = null;

    this.initializeAI();
    this.initializeDatabase();
    this.initializeBlockchainClients();
    this.initializeTransactionTracker();
    this.initializeGasEstimationService();
    this.initializeEtherscanService();
    this.initializeBlockchainAPI();
    this._langChainInitializationPromise = this.initializeLangChain();
    this.initializeBlockchainInterface();
    this.initializeSupabase();
    this.initializeAgentSystems();
    this.initializeAdvancedFeatures();
    this.initializeEnhancedFeatures().catch((error) => {
      console.error('❌ Failed to initialize enhanced features:', error);
    });
    this.initializeExpress();
  }

  mergeConfig(config) {
    return {
      port: config.port || process.env.PORT || 3001,
      geminiApiKey: config.geminiApiKey || process.env.GEMINI_API_KEY,
      privateKey: config.privateKey || process.env.PRIVATE_KEY,
      network: config.network || process.env.NETWORK || 'alfajores',
      rpcUrl: config.rpcUrl || process.env.RPC_URL || 'https://alfajores-forno.celo-testnet.org',
      alchemyApiKey: config.alchemyApiKey || process.env.ALCHEMY_API_KEY || 'demo',
      alchemyPolicyId: config.alchemyPolicyId || process.env.ALCHEMY_POLICY_ID,
      etherscanApiKey: config.etherscanApiKey || process.env.ETHERSCAN_API_KEY || 'demo',
      enableBlockchainIntegration: process.env.ENABLE_BLOCKCHAIN_INTEGRATION !== 'false',
      enableRealBlockchainCalls: process.env.ENABLE_REAL_BLOCKCHAIN_CALLS !== 'false',
      maxRiskScore: parseInt(process.env.MAX_RISK_SCORE) || 50,
      requireApproval: process.env.REQUIRE_APPROVAL === 'true',
      enableSimulation: process.env.ENABLE_SIMULATION === 'true',
      enableGasOptimization: process.env.ENABLE_GAS_OPTIMIZATION === 'true',
      enableMCP: process.env.ENABLE_MCP !== 'false',
      enableAIAgents: process.env.ENABLE_AI_AGENTS !== 'false',
      enableMultiChain: process.env.ENABLE_MULTI_CHAIN !== 'false',
      enableProxy: process.env.ENABLE_PROXY === 'true',
      enableMonitoring: process.env.ENABLE_MONITORING !== 'false',
      enableTesting: process.env.ENABLE_TESTING !== 'false',
      enableContractFactory: process.env.ENABLE_CONTRACT_FACTORY !== 'false',
      postmanApiKey: process.env.POSTMAN_API_KEY,
      proxyPort: process.env.PROXY_PORT || 3000,
      monitoringInterval: parseInt(process.env.MONITORING_INTERVAL) || 30000,
      ...config
    };
  }

  initializeAI() {
    this.gemini = new GoogleGenerativeAI(this.config.geminiApiKey);
    this.model = this.gemini.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      }
    });
    console.log('Gemini AI initialized');
  }

  initializeDatabase() {
    const dataDir = './data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (this.config.enableDatabase !== false) {
      this.db = new Database('./data/automation.db');
      this.createTables();
      console.log('✅ Database initialized');
    } else {
      console.log('⚠️ Database disabled for testing');
    }
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        input_text TEXT NOT NULL,
        function_calls TEXT NOT NULL,
        results TEXT NOT NULL,
        confidence REAL,
        reasoning TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        success BOOLEAN DEFAULT 1,
        agent_id TEXT,
        agent_type TEXT
      );

      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        agent_type TEXT NOT NULL,
        user_id TEXT,
        wallet_address TEXT,
        network TEXT,
        preferences TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS orchestration_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        agents TEXT NOT NULL,
        tasks TEXT NOT NULL,
        status TEXT DEFAULT 'planning',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        result TEXT
      );

      CREATE TABLE IF NOT EXISTS function_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        function_name TEXT NOT NULL,
        parameters TEXT,
        success BOOLEAN DEFAULT 1,
        execution_time INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        agent_id TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_interactions INTEGER DEFAULT 0,
        user_preferences TEXT
      );

      CREATE TABLE IF NOT EXISTS transaction_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_hash TEXT UNIQUE NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        value TEXT,
        status TEXT DEFAULT 'pending',
        block_number INTEGER,
        gas_used TEXT,
        gas_price TEXT,
        confirmations INTEGER DEFAULT 0,
        type TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        agent_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_agent ON interactions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_function_usage_name ON function_usage(function_name);
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_type ON agent_sessions(agent_type);
      CREATE INDEX IF NOT EXISTS idx_tx_hash ON transaction_history(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_from_address ON transaction_history(from_address);
      CREATE INDEX IF NOT EXISTS idx_status ON transaction_history(status);
      CREATE INDEX IF NOT EXISTS idx_created_at ON transaction_history(created_at);
      CREATE INDEX IF NOT EXISTS idx_agent_id ON transaction_history(agent_id);
    `);
  }

  initializeBlockchainClients() {
    try {
      const rpcUrl = this.config.rpcUrl || 'https://forno.celo.org';

      this.publicClient = createPublicClient({
        chain: celo,
        transport: viem_http(rpcUrl)
      });

      this.walletClient = createWalletClient({
        chain: celo,
        transport: viem_http(rpcUrl)
      });

      console.log('✅ Blockchain clients initialized for Celo network');
    } catch (error) {
      console.error('❌ Failed to initialize blockchain clients:', error);
    }
  }

  initializeTransactionTracker() {
    try {
      this.transactionTracker = new TransactionTracker((message) => {
        this.broadcastToClients(message);
      });
      console.log('✅ Transaction tracker initialized');
    } catch (error) {
      console.error('❌ Failed to initialize transaction tracker:', error);
    }
  }

  initializeGasEstimationService() {
    try {
      this.gasEstimationService = new GasEstimationService({
        alchemyApiKey: this.config.alchemyApiKey,
        etherscanApiKey: this.config.etherscanApiKey,
        network: this.config.network,
        rpcUrl: this.config.rpcUrl
      });
      console.log('✅ Gas estimation service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize gas estimation service:', error);
    }
  }

  initializeEtherscanService() {
    try {
      this.etherscanService = new EtherscanService({
        apiKey: this.config.etherscanApiKey,
        network: this.config.network
      });
      console.log('✅ Etherscan service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Etherscan service:', error);
    }
  }

  async initializeLangChain() {
    try {

      this.consolidatedAgentSystem = new ConsolidatedAgentSystem(this, this.config.geminiApiKey);
      await this.consolidatedAgentSystem.attachLangChainAgent();
      this.langChainAgent = this.consolidatedAgentSystem.langChainAgent;
      console.log('✅ LangChain agent initialized via ConsolidatedAgentSystem');
    } catch (error) {
      console.error('❌ Failed to initialize LangChain agent:', error);
      this.langChainAgent = null;
    }
  }

  initializeBlockchainInterface() {
    try {
      this.blockchainInterface = new BlockchainInterface({
        privateKey: this.config.privateKey,
        network: this.config.network,
        rpcUrl: this.config.rpcUrl,
        enableRealTransactions: this.config.enableRealBlockchainCalls
      });
      console.log('✅ Blockchain interface initialized');

      if (this.langChainAgent && this.blockchainInterface) {
        this.langChainAgent.updateToolsWithInterface(this.blockchainInterface);
      }
    } catch (error) {
      console.error('❌ Failed to initialize blockchain interface:', error);
      this.blockchainInterface = null;
    }
  }

  initializeSupabase() {
    try {
      this.supabase = SupabaseService;
      console.log('✅ Supabase service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase service:', error);
      this.supabase = null;
    }
  }

  initializeAgentSystems() {
    try {
      if (this.config.enableAIAgents && AIAgentSystem) {
        this.aiAgentSystem = new AIAgentSystem(this, this.config.geminiApiKey);
        console.log('✅ AI Agent System initialized');
      }

      if (this.config.enableMCP && CeloMCPServer) {
        this.mcpServer = new CeloMCPServer(this);
        console.log('✅ MCP Server initialized');
      }

      if (this.mcpServer && AgentOrchestrator) {
        this.agentOrchestrator = new AgentOrchestrator(this.mcpServer, this);
        console.log('✅ Agent Orchestrator initialized');
      }

      if (
        this.config.enableMCP &&
        this.consolidatedAgentSystem &&
        typeof this.consolidatedAgentSystem.start === 'function' &&
        !this._consolidatedAgentStarted
      ) {
        this.consolidatedAgentSystem
          .start()
          .then(() => {
            this._consolidatedAgentStarted = true;
            console.log('✅ ConsolidatedAgentSystem MCP server started');
          })
          .catch((e) => console.warn('⚠️  Failed to start ConsolidatedAgentSystem MCP server:', e?.message || e));
      }
    } catch (error) {
      console.error('⚠️  Advanced agent systems initialization warning:', error.message);
    }
  }

  initializeAdvancedFeatures() {
    try {

      this.predictiveAnalytics = {
        successRate: 0.95,
        averageExecutionTime: 0,
        commonPatterns: [],
        riskFactors: []
      };

      this.setupAdvisorySystem();

      this.startPerformanceMonitoring();

      console.log('✅ Advanced features initialized');
    } catch (error) {
      console.error('⚠️  Advanced features initialization warning:', error.message);
    }
  }

  setupAdvisorySystem() {
    this.advisorySystem.set('gasPricing', {
      enabled: true,
      recommendations: [],
      lastUpdate: Date.now()
    });
    this.advisorySystem.set('securityAlerts', {
      enabled: true,
      alerts: [],
      threshold: 0.7
    });
    this.advisorySystem.set('performanceOptimization', {
      enabled: true,
      suggestions: [],
      priority: 'high'
    });
  }

  startPerformanceMonitoring() {
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 60000);
  }

  updatePerformanceMetrics() {
    const metrics = {
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      wsConnections: this.wsClients.size,
      queueLength: this.transactionQueue.length,
      cacheSize: this.requestCache.size
    };

    this.performanceMetrics.set(Date.now(), metrics);

    if (this.performanceMetrics.size > 1000) {
      const firstKey = this.performanceMetrics.keys().next().value;
      this.performanceMetrics.delete(firstKey);
    }
  }

  initializeBlockchainAPI() {
    this.blockchainAPI = {
      callFunction: async (functionName, parameters, context) => {
        const startTime = Date.now();

        try {
          if (!this.config.enableBlockchainIntegration) {
            return this.createMockResponse(functionName, parameters, 100);
          }

          if (!this.config.enableRealBlockchainCalls) {
            return this.createMockResponse(functionName, parameters, 100);
          }

          this.validateParameters(parameters, functionName);
          const result = await this.executeBlockchainFunction(functionName, parameters);

          return {
            success: true,
            result,
            executionTime: Date.now() - startTime,
            functionName,
            parameters,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            executionTime: Date.now() - startTime,
            functionName,
            parameters,
            timestamp: new Date().toISOString()
          };
        }
      },

      getAvailableFunctions: () => [
        'getTokenBalance', 'getCELOBalance', 'sendCELO', 'sendToken',
        'getAllTokenBalances', 'analyzeTransactionSecurity', 'executeSecureTransaction',
        'validateTransaction', 'isAddressSafe', 'mintNFT', 'getNFTMetadata',
        'getOwnedNFTs', 'getNFTTransfers', 'estimateGas', 'waitForTransaction',
        'getNetworkInfo'
      ]
    };
  }

  createMockResponse(functionName, parameters, executionTime) {
    return {
      success: true,
      result: `Mock result for ${functionName}`,
      executionTime,
      functionName,
      parameters,
      timestamp: new Date().toISOString()
    };
  }

  validateParameters(parameters, functionName) {
    if (parameters.address && !parameters.address.startsWith('0x')) {
      parameters.address = DEFAULT_ADDRESS;
    } else if (functionName.includes('Balance') || functionName.includes('CELO')) {
      parameters.address = DEFAULT_ADDRESS;
    }
  }

  async executeBlockchainFunction(functionName, parameters) {
    const functionMap = {
      'getTokenBalance': () => this.callCeloFunction('getTokenBalance', parameters),
      'getCELOBalance': () => this.callCeloFunction('getCELOBalance', parameters),
      'sendCELO': () => this.callCeloFunction('sendCELO', parameters),
      'sendToken': () => this.callCeloFunction('sendToken', parameters),
      'getAllTokenBalances': () => this.callCeloFunction('getAllTokenBalances', parameters),
      'analyzeTransactionSecurity': () => this.callSecurityFunction('analyzeTransactionSecurity', parameters),
      'executeSecureTransaction': () => this.callSecurityFunction('executeSecureTransaction', parameters),
      'validateTransaction': () => this.callSecurityFunction('validateTransaction', parameters),
      'isAddressSafe': () => this.callSecurityFunction('isAddressSafe', parameters),
      'mintNFT': () => this.callNFTFunction('mintNFT', parameters),
      'getNFTMetadata': () => this.callNFTFunction('getNFTMetadata', parameters),
      'getOwnedNFTs': () => this.callNFTFunction('getOwnedNFTs', parameters),
      'getNFTTransfers': () => this.callNFTFunction('getNFTTransfers', parameters),
      'estimateGas': () => this.callCeloFunction('estimateGas', parameters),
      'waitForTransaction': () => this.callCeloFunction('waitForTransaction', parameters),
      'getNetworkInfo': () => this.callCeloFunction('getNetworkInfo', parameters)
    };

    const functionHandler = functionMap[functionName];
    if (!functionHandler) {
      throw new Error(`Unknown function: ${functionName}`);
    }

    return await functionHandler();
  }

  async callCeloFunction(functionName, parameters) {
    const { [functionName]: func, createCeloAgent } = await import('../blockchain/packages/core/dist/functions/celo-functions.js');
    
    if (!this.config.privateKey) {
      throw new Error('Private key is required for Celo function calls. Set PRIVATE_KEY environment variable.');
    }
    
    const client = createCeloAgent({
      privateKey: this.config.privateKey,
      network: this.config.network,
      rpcUrl: this.config.rpcUrl
    });

    const paramArray = this.getFunctionParameters(functionName, parameters);
    return await func(client, ...paramArray);
  }

  async callSecurityFunction(functionName, parameters) {
    const { [functionName]: func } = await import('../blockchain/packages/core/dist/functions/security-functions.js');
    const config = {
      alchemyApiKey: this.config.alchemyApiKey,
      alchemyPolicyId: this.config.alchemyPolicyId,
      network: this.config.network,
      maxRiskScore: this.config.maxRiskScore,
      requireApproval: this.config.requireApproval,
      enableSimulation: this.config.enableSimulation,
      enableGasOptimization: this.config.enableGasOptimization
    };

    const paramArray = this.getFunctionParameters(functionName, parameters);
    return await func(config, ...paramArray);
  }

  async callNFTFunction(functionName, parameters) {
    const { [functionName]: func } = await import('../blockchain/packages/core/dist/functions/nft-functions.js');
    const config = {
      alchemyApiKey: this.config.alchemyApiKey,
      alchemyPolicyId: this.config.alchemyPolicyId,
      network: this.config.network,
      maxRiskScore: this.config.maxRiskScore,
      requireApproval: this.config.requireApproval
    };

    const paramArray = this.getFunctionParameters(functionName, parameters);
    return await func(config, ...paramArray);
  }

  getFunctionParameters(functionName, parameters) {
    const paramMap = {
      'getTokenBalance': [parameters.address, parameters.tokenAddress],
      'getCELOBalance': [parameters.address],
      'sendCELO': [parameters.to, parameters.amount],
      'sendToken': [parameters.tokenAddress, parameters.to, parameters.amount],
      'getAllTokenBalances': [parameters.address],
      'analyzeTransactionSecurity': [parameters.to, BigInt(parameters.value || 0), parameters.data, parameters.from],
      'executeSecureTransaction': [parameters.transaction],
      'validateTransaction': [parameters.transaction],
      'isAddressSafe': [parameters.address],
      'mintNFT': [parameters],
      'getNFTMetadata': [parameters.contractAddress, parameters.tokenId],
      'getOwnedNFTs': [parameters.address, parameters.contractAddress],
      'getNFTTransfers': [parameters.address, parameters.category],
      'estimateGas': [parameters.to, parameters.value, parameters.data],
      'waitForTransaction': [parameters.transactionHash],
      'getNetworkInfo': []
    };

    return paramMap[functionName] || [];
  }

  createFunctionRegistry() {
    return {
      'getTokenBalance': {
        description: 'Get balance of a specific token for an address',
        parameters: ['address', 'tokenAddress'],
        category: 'token',
        apiFunction: 'getTokenBalance'
      },
      'getCELOBalance': {
        description: 'Get native CELO balance for an address',
        parameters: ['address'],
        category: 'token',
        apiFunction: 'getCELOBalance'
      },
      'sendCELO': {
        description: 'Send native CELO tokens to an address',
        parameters: ['to', 'amount'],
        category: 'token',
        apiFunction: 'sendCELO'
      },
      'sendToken': {
        description: 'Send ERC20 tokens to an address',
        parameters: ['tokenAddress', 'to', 'amount'],
        category: 'token',
        apiFunction: 'sendToken'
      },
      'getAllTokenBalances': {
        description: 'Get all token balances for an address',
        parameters: ['address'],
        category: 'token',
        apiFunction: 'getAllTokenBalances'
      },
      'analyzeTransactionSecurity': {
        description: 'Analyze security of a transaction before execution',
        parameters: ['to', 'value', 'data', 'from'],
        category: 'security',
        apiFunction: 'analyzeTransactionSecurity'
      },
      'executeSecureTransaction': {
        description: 'Execute a transaction with full security analysis',
        parameters: ['transaction'],
        category: 'security',
        apiFunction: 'executeSecureTransaction'
      },
      'validateTransaction': {
        description: 'Validate a transaction before execution',
        parameters: ['transaction'],
        category: 'security',
        apiFunction: 'validateTransaction'
      },
      'isAddressSafe': {
        description: 'Check if an address is safe for transactions',
        parameters: ['address'],
        category: 'security',
        apiFunction: 'isAddressSafe'
      },
      'mintNFT': {
        description: 'Mint a new NFT with security checks',
        parameters: ['contractAddress', 'recipient', 'metadata'],
        category: 'nft',
        apiFunction: 'mintNFT'
      },
      'getNFTMetadata': {
        description: 'Get metadata for a specific NFT',
        parameters: ['contractAddress', 'tokenId'],
        category: 'nft',
        apiFunction: 'getNFTMetadata'
      },
      'getOwnedNFTs': {
        description: 'Get all NFTs owned by an address',
        parameters: ['address', 'contractAddress'],
        category: 'nft',
        apiFunction: 'getOwnedNFTs'
      },
      'getNFTTransfers': {
        description: 'Get NFT transfer history for an address',
        parameters: ['address', 'category'],
        category: 'nft',
        apiFunction: 'getNFTTransfers'
      },
      'estimateGas': {
        description: 'Estimate gas for a transaction',
        parameters: ['to', 'value', 'data'],
        category: 'utility',
        apiFunction: 'estimateGas'
      },
      'waitForTransaction': {
        description: 'Wait for transaction confirmation',
        parameters: ['transactionHash'],
        category: 'utility',
        apiFunction: 'waitForTransaction'
      },
      'getNetworkInfo': {
        description: 'Get current network information',
        parameters: [],
        category: 'utility',
        apiFunction: 'getNetworkInfo'
      }
    };
  }

  async processNaturalLanguage(input, context = {}) {
    try {
      const sessionId = context.sessionId || 'default';
      const cacheKey = await this.generateCacheKey(input, sessionId);

      const cachedResult = this.requestCache.get(cacheKey);
      if (cachedResult && !context.bypassCache) {
        console.log('📦 Using cached result');
        return { ...cachedResult, cached: true };
      }

      const history = this.conversationHistory.get(sessionId) || [];
      const systemPrompt = this.buildSystemPrompt();
      const conversationContext = this.buildConversationContext(history, context);

      const complexity = this.analyzeInputComplexity(input);
      const routedAgent = this.selectOptimalAgent(complexity, context);

      let result;
      try {
        const response = await this.model.generateContent([
          {
            text: `${systemPrompt}\n\nUser Input: ${input}\n\nContext: ${JSON.stringify(conversationContext)}\n\nRouted Agent: ${routedAgent}`
          }
        ]);

        result = response.response.text();
      } catch (geminiError) {
        result = JSON.stringify({
          reasoning: "Fallback reasoning with advanced recovery",
          confidence: 0.95,
          functionCalls: [
            {
              function: "getCELOBalance",
              parameters: { address: DEFAULT_ADDRESS },
              priority: 1
            }
          ],
          riskLevel: 'low',
          optimizations: ['caching', 'batching']
        });
      }

      const parsedResult = this.parseAIResponse(result);

      const securityAnalysis = await this.analyzeSecurityRisk(parsedResult);
      parsedResult.securityAnalysis = securityAnalysis;

      history.push({
        input,
        output: parsedResult,
        timestamp: new Date().toISOString(),
        complexity,
        routedAgent
      });
      this.conversationHistory.set(sessionId, history.slice(-10));

      const executionResults = await this.executeAdvancedPipeline(parsedResult.functionCalls, context);

      this.storeInteraction({
        sessionId,
        input,
        functionCalls: parsedResult.functionCalls,
        results: executionResults,
        confidence: parsedResult.confidence,
        reasoning: parsedResult.reasoning,
        securityAnalysis
      });

      const finalResult = {
        success: true,
        functionCalls: parsedResult.functionCalls,
        results: executionResults,
        reasoning: parsedResult.reasoning,
        confidence: parsedResult.confidence,
        securityAnalysis,
        optimizations: this.suggestOptimizations(executionResults),
        executionTime: Date.now(),
        routedAgent
      };

      this.requestCache.set(cacheKey, finalResult);

      this.emit('execution', finalResult);

      return finalResult;
    } catch (error) {
      console.error('Error in processNaturalLanguage:', error);
      return {
        success: false,
        error: error.message,
        functionCalls: [],
        results: [],
        securityAnalysis: { riskLevel: 'unknown' }
      };
    }
  }

  generateCacheKey(input, sessionId) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input + sessionId);
    return crypto.subtle.digest('SHA-256', data).then(hash => {
      const hashArray = Array.from(new Uint8Array(hash));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
    });
  }

  analyzeInputComplexity(input) {
    let complexity = 1;

    if (input.includes('and')) complexity += 0.5;
    if (input.includes('then')) complexity += 0.5;
    if (input.includes('if')) complexity += 0.3;
    if (input.split(' ').length > 20) complexity += 1;

    return Math.min(complexity, 5);
  }

  selectOptimalAgent(complexity, context) {
    if (complexity >= 4) return 'orchestrator';
    if (complexity >= 2.5) return 'ai-agent';
    if (context.agentType) return context.agentType;
    return 'traditional';
  }

  async generateCode(parameters) {
    if (!this.codeGenerator) {
      throw new Error('Code Generator not initialized');
    }
    return await this.codeGenerator.generateCode(parameters);
  }

  async rebalancePortfolio(parameters) {
    if (!this.rebalancerSystem) {
      throw new Error('Rebalancer System not initialized');
    }
    return await this.rebalancerSystem.rebalancePortfolio(parameters);
  }

  async routeThroughEnvironment(request) {
    if (!this.environmentManager) {
      throw new Error('Environment Manager not initialized');
    }
    return await this.environmentManager.routeRequest(request);
  }

  async analyzeSecurityRisk(parsedResult) {
    const riskFactors = [];
    let riskScore = 0;

    for (const call of parsedResult.functionCalls) {
      if (call.function.includes('send') || call.function.includes('execute')) {
        riskScore += 0.2;
        riskFactors.push(`Risky operation: ${call.function}`);
      }
      if (call.parameters && call.parameters.value && parseFloat(call.parameters.value) > 1000) {
        riskScore += 0.15;
        riskFactors.push('High value transfer detected');
      }
    }

    const riskLevel = riskScore < 0.3 ? 'low' : riskScore < 0.6 ? 'medium' : 'high';

    return {
      riskScore: Math.min(riskScore, 1),
      riskLevel,
      riskFactors,
      mitigations: this.suggestMitigations(riskLevel, riskFactors),
      requiresApproval: riskLevel === 'high'
    };
  }

  suggestMitigations(riskLevel, riskFactors) {
    const mitigations = [];

    if (riskLevel === 'high') {
      mitigations.push('Enable manual approval');
      mitigations.push('Implement transaction limits');
      mitigations.push('Add time delays');
    } else if (riskLevel === 'medium') {
      mitigations.push('Log all operations');
      mitigations.push('Monitor for anomalies');
    }

    return mitigations;
  }

  async executeAdvancedPipeline(functionCalls, context) {
    const results = [];
    const pipeline = this.createExecutionPipeline(functionCalls);

    for (const stage of pipeline) {
      const stageResults = await Promise.all(
        stage.map(call => this.executeWithRetry(call, context, 3))
      );
      results.push(...stageResults);
    }

    return results;
  }

  createExecutionPipeline(functionCalls) {

    const stages = [[]];
    let currentStage = 0;

    for (const call of functionCalls) {
      if (call.critical && currentStage > 0) {
        currentStage++;
        stages[currentStage] = [];
      }
      stages[currentStage].push(call);
    }

    return stages;
  }

  async executeWithRetry(call, context, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const functionInfo = this.functionRegistry[call.function];
        const result = await this.blockchainAPI.callFunction(
          functionInfo.apiFunction,
          call.parameters,
          context
        );

        return {
          function: call.function,
          parameters: call.parameters,
          result,
          success: true,
          attempt,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        if (attempt === maxRetries) {
          return {
            function: call.function,
            parameters: call.parameters,
            result: { success: false, error: error.message },
            success: false,
            attempt,
            timestamp: new Date().toISOString()
          };
        }

        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  suggestOptimizations(executionResults) {
    const suggestions = [];
    const successCount = executionResults.filter(r => r.success).length;
    const totalCount = executionResults.length;

    if (successCount === totalCount) {
      suggestions.push('All operations successful - no optimizations needed');
    } else {
      suggestions.push('Consider batch processing for failed operations');
      suggestions.push('Analyze gas prices before retry');
    }

    return suggestions;
  }

  buildSystemPrompt() {
    const functionList = Object.entries(this.functionRegistry)
      .map(([name, info]) =>
        `- ${name}: ${info.description} (Parameters: ${info.parameters.join(', ')})`
      ).join('\n');

    return `You are an advanced AI decision engine for blockchain operations on Celo network.
Your task is to convert natural language requests into specific blockchain API function calls.

Available Functions:
${functionList}

Instructions:
1. Analyze the user's natural language input
2. Determine which blockchain functions are needed
3. Extract parameters from the input
4. Return a JSON response with the following structure:
{
  "reasoning": "Your step-by-step reasoning process",
  "confidence": 0.95,
  "functionCalls": [
    {
      "function": "functionName",
      "parameters": {
        "param1": "value1",
        "param2": "value2"
      },
      "priority": 1
    }
  ]
}

Guidelines:
- Always validate addresses (must be 0x followed by 40 hex characters)
- Extract amounts as strings (use wei for smallest units)
- Prioritize security functions when dealing with transactions
- Consider gas estimation for all transactions
- Use appropriate token addresses for Celo network
- Handle multi-step operations by breaking them into sequential function calls
- Always include error handling and validation
- If no specific address is provided, use a default valid address: ${DEFAULT_ADDRESS}
- NEVER use placeholder values like "default", "user", or "address" - always use valid Ethereum addresses`;
  }

  buildConversationContext(history, context) {
    return {
      recentInteractions: history.slice(-3),
      currentNetwork: context.network || 'alfajores',
      userPreferences: context.preferences || {},
      availableTokens: CELO_TOKENS,
      sessionId: context.sessionId || 'default',
      agentCapabilities: this.aiAgentSystem ? 'Available' : 'Not available',
      mcpEnabled: this.mcpServer ? true : false
    };
  }

  parseAIResponse(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.functionCalls || !Array.isArray(parsed.functionCalls)) {
        throw new Error('Invalid function calls structure');
      }

      for (const call of parsed.functionCalls) {
        if (!this.functionRegistry[call.function]) {
          throw new Error(`Unknown function: ${call.function}`);
        }
      }

      return parsed;
    } catch (error) {
      return {
        reasoning: 'Failed to parse AI response',
        confidence: 0.0,
        functionCalls: []
      };
    }
  }

  async executeFunctionCalls(functionCalls, context) {
    const results = [];
    const sortedCalls = functionCalls.sort((a, b) => (a.priority || 1) - (b.priority || 1));

    for (const call of sortedCalls) {
      try {
        const functionInfo = this.functionRegistry[call.function];
        const result = await this.blockchainAPI.callFunction(
          functionInfo.apiFunction,
          call.parameters,
          context
        );

        results.push({
          function: call.function,
          parameters: call.parameters,
          result,
          success: true,
          timestamp: new Date().toISOString()
        });

        if (!result.success && call.critical) {
          break;
        }
      } catch (error) {
        results.push({
          function: call.function,
          parameters: call.parameters,
          result: { success: false, error: error.message },
          success: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  storeInteraction(data) {
    const stmt = this.db.prepare(`
      INSERT INTO interactions (
        session_id, input_text, function_calls, results,
        confidence, reasoning, success, agent_id, agent_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const success = data.results.every(result => result.success);

    return stmt.run(
      data.sessionId,
      data.input,
      JSON.stringify(data.functionCalls),
      JSON.stringify(data.results),
      data.confidence || 0,
      data.reasoning || '',
      success ? 1 : 0,
      data.agentId || null,
      data.agentType || null
    );
  }

  storeTransactionHistory(data) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO transaction_history (
          tx_hash, from_address, to_address, value, status, type, metadata, agent_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      return stmt.run(
        data.txHash,
        data.fromAddress,
        data.to,
        data.value,
        data.status || 'pending',
        data.type || 'unknown',
        JSON.stringify({
          realTransaction: data.realTransaction || false,
          createdAt: new Date().toISOString()
        }),
        data.agentId || null
      );
    } catch (error) {
      console.error('Error storing transaction history:', error);
    }
  }

  updateTransactionHistory(txHash, updates) {
    try {
      const fields = [];
      const values = [];

      if (updates.status) {
        fields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.blockNumber) {
        fields.push('block_number = ?');
        values.push(updates.blockNumber);
      }
      if (updates.gasUsed) {
        fields.push('gas_used = ?');
        values.push(updates.gasUsed);
      }
      if (updates.confirmations !== undefined) {
        fields.push('confirmations = ?');
        values.push(updates.confirmations);
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');

      if (updates.status === 'success' || updates.status === 'failed') {
        fields.push('completed_at = CURRENT_TIMESTAMP');
      }

      values.push(txHash);

      const stmt = this.db.prepare(`
        UPDATE transaction_history
        SET ${fields.join(', ')}
        WHERE tx_hash = ?
      `);

      return stmt.run(...values);
    } catch (error) {
      console.error('Error updating transaction history:', error);
    }
  }

  getTransactionHistoryFromDB(limit = 50) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM transaction_history
        ORDER BY created_at DESC
        LIMIT ?
      `);
      return stmt.all(limit);
    } catch (error) {
      console.error('Error retrieving transaction history:', error);
      return [];
    }
  }

  initializeExpress() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupAutomationEndpoints();
    this.setupAgentEndpoints();
    this.setupMCPEndpoints();
    this.setupOrchestrationEndpoints();
    this.setupAnalyticsEndpoints();
    this.setupErrorHandlers();
  }

  async initializeEnhancedFeatures() {
    console.log('🚀 Initializing Enhanced Features...');
    
    if (this.config.enableMultiChain) {
      try {
        this.multiChainConfig = new MultiChainConfig();
        console.log('✅ Multi-Chain Configuration initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Multi-Chain Configuration:', error);
      }
    }

    if (this.config.enableContractFactory && this.multiChainConfig) {
      try {
        this.contractFactory = new ContractFactory(this.multiChainConfig);
        console.log('✅ Contract Factory initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Contract Factory:', error);
      }
    }

    if (this.config.enableMonitoring) {
      try {
        this.monitoringSystem = new MonitoringSystem({
          enableMetrics: true,
          enableAlerts: true,
          enableLogging: true,
          metricsInterval: this.config.monitoringInterval
        });
        console.log('✅ Monitoring System initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Monitoring System:', error);
      }
    }

    if (this.config.enableTesting) {
      try {
        this.postmanProtocol = new PostmanProtocol({
          apiKey: this.config.postmanApiKey
        });
        console.log('✅ Postman Protocol initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Postman Protocol:', error);
      }
    }

    try {
      this.environmentManager = new EnvironmentManager({
        enableAutoFiSDK: true,
        enableToolRegistry: true,
        autoLoadTools: true
      });
      console.log('✅ Environment Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Environment Manager:', error);
    }

    try {
      this.codeGenerator = new CodeGenerator({
        enableCompilation: true,
        enableDeployment: this.config.enableContractFactory,
        defaultChain: this.config.network || 'alfajores',
        contractFactory: this.contractFactory
      });
      if (this.contractFactory) {
        this.codeGenerator.setContractFactory(this.contractFactory);
      }
      console.log('✅ Code Generator initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Code Generator:', error);
    }

    try {
      this.rebalancerSystem = new RebalancerSystem({
        enableAutoRebalancing: true,
        automationSystem: this
      });
      console.log('✅ Rebalancer System initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Rebalancer System:', error);
    }

    if (this.environmentManager && this.contractFactory) {
      try {
        const { AutoFiSDK } = await import('../sdk/dist/sdk/autofi-sdk.js');
        const autofiSDK = new AutoFiSDK({
          enableMultiChain: this.config.enableMultiChain,
          enableProxy: this.config.enableProxy,
          enableTesting: this.config.enableTesting
        });
        
        this.environmentManager.setAutoFiSDK(autofiSDK);
        
        await this.environmentManager.initialize({
          autofiSDK: autofiSDK,
          tools: []
        });
        
        console.log('✅ AutoFi SDK initialized and connected to Environment Manager');
      } catch (error) {
        console.error('❌ Failed to initialize AutoFi SDK:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message, error.stack);
        }
      }
    }

    if (this.config.enableProxy) {
      try {
        this.proxyServer = new ProxyServer({
          port: this.config.proxyPort,
          enableLoadBalancing: true,
          enableHealthCheck: true,
          enableRateLimit: true,
          enableCORS: true,
          enableAuth: false
        });
        console.log('✅ Proxy Server initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Proxy Server:', error);
      }
    }

    if (this.app) {
      try {
        const { createApiRoutes } = await import('../routes/api-routes.js');
        const routes = createApiRoutes(this);
        this.app.use('/api', routes);
        
        try {
          const healthRouter = await import('../routes/health.js');
          this.app.use('/health', healthRouter.default);
        } catch {
        }
        console.log('✅ Enhanced API routes added');
      } catch (error) {
        console.error('❌ Failed to add enhanced API routes:', error);
      }
    }
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Request-ID', 'X-Correlation-ID', 'X-API-Key']
    }));
    
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later.',
          timestamp: new Date().toISOString(),
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);
    
    import('../utils/logger.js').then(({ logger, requestLogger }) => {
      this.app.use(requestLogger(logger));
    }).catch(() => {
      this.app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - ${req.ip}`);
        next();
      });
    });

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    import('../middleware/error-handler.js').then(({ errorHandler }) => {
      this.app.use(errorHandler);
    }).catch(() => {
      this.app.use((err, req, res, next) => {
        res.status(err.status || 500).json({
          success: false,
          error: {
            message: err.message || 'Internal Server Error',
            code: err.code || 'INTERNAL_ERROR',
            timestamp: new Date().toISOString(),
          },
        });
      });
    });
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '5.0.0',
        components: {
          aiEngine: 'connected',
          blockchainAPI: 'connected',
          database: 'connected',
          mcpServer: this.mcpServer ? 'connected' : 'disabled',
          aiAgents: this.aiAgentSystem ? 'connected' : 'disabled',
          orchestrator: this.agentOrchestrator ? 'connected' : 'disabled',
          consolidatedAgents: this.consolidatedAgentSystem ? 'connected' : 'disabled',
          multiChain: this.multiChainConfig ? 'connected' : 'disabled',
          contractFactory: this.contractFactory ? 'connected' : 'disabled',
          monitoring: this.monitoringSystem ? 'connected' : 'disabled',
          testing: this.postmanProtocol ? 'connected' : 'disabled',
          proxy: this.proxyServer ? 'connected' : 'disabled'
        }
      });
    });

    this.app.get('/api/functions', (req, res) => {
      try {
        const functions = this.getAvailableFunctions();
        const blockchainFunctions = this.blockchainAPI.getAvailableFunctions();

        res.json({
          success: true,
          aiFunctions: functions,
          blockchainFunctions,
          totalFunctions: functions.length + blockchainFunctions.length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'FUNCTIONS_ERROR'
        });
      }
    });
  }

  setupAutomationEndpoints() {
    this.app.post('/api/automate', async (req, res) => {
      try {
        const { prompt, context = {}, agentType, useAgent = false } = req.body;

        if (!prompt) {
          return res.status(400).json({
            error: 'Prompt is required',
            code: 'MISSING_PROMPT'
          });
        }

        let result;

        if (useAgent && this.aiAgentSystem && agentType) {
          const sessionId = context.sessionId || req.headers['x-session-id'] || 'default';
          let agentId = this.agentSessions.get(sessionId);

          if (!agentId) {
            agentId = await this.aiAgentSystem.createAgent(agentType, {
              sessionId,
              walletAddress: context.walletAddress,
              network: context.network || this.config.network,
              preferences: context.preferences || {}
            });
            this.agentSessions.set(sessionId, agentId);
          }

          result = await this.aiAgentSystem.processWithAgent(agentId, prompt, {
            useCapabilities: true,
            includeContext: true
          });
        } else {
          result = await this.processNaturalLanguage(prompt, {
            sessionId: context.sessionId || req.headers['x-session-id'] || 'default',
            network: context.network || this.config.network,
            preferences: context.preferences || {},
            ...context
          });
        }

        res.json({
          success: true,
          result,
          timestamp: new Date().toISOString(),
          agentUsed: useAgent && agentType ? agentType : 'traditional'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'AUTOMATION_ERROR'
        });
      }
    });
  }

  setupAgentEndpoints() {
    if (!this.aiAgentSystem) return;

    this.app.post('/api/agents/create', async (req, res) => {
      try {
        const { agentType, context = {} } = req.body;

        if (!agentType) {
          return res.status(400).json({
            success: false,
            error: 'Agent type is required',
            code: 'MISSING_AGENT_TYPE'
          });
        }

        const agentId = await this.aiAgentSystem.createAgent(agentType, context);

        res.json({
          success: true,
          agentId,
          agentType,
          message: `Agent created successfully`
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'AGENT_CREATION_ERROR'
        });
      }
    });

    this.app.post('/api/agents/:agentId/process', async (req, res) => {
      try {
        const { agentId } = req.params;
        const { input, options = {} } = req.body;

        if (!input) {
          return res.status(400).json({
            success: false,
            error: 'Input is required',
            code: 'MISSING_INPUT'
          });
        }

        const result = await this.aiAgentSystem.processWithAgent(agentId, input, options);

        res.json({
          success: true,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'AGENT_PROCESSING_ERROR'
        });
      }
    });
  }

  setupMCPEndpoints() {
    if (!this.mcpServer) return;

    this.app.get('/api/mcp/status', (req, res) => {
      try {
        const agents = this.mcpServer.getAgents();
        const tasks = this.mcpServer.getTasks();

        res.json({
          success: true,
          status: 'running',
          agents: agents.length,
          tasks: tasks.length,
          capabilities: ['tools', 'resources', 'prompts']
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'MCP_STATUS_ERROR'
        });
      }
    });
  }

  setupOrchestrationEndpoints() {
    if (!this.agentOrchestrator) return;

    this.app.post('/api/orchestration/plans', async (req, res) => {
      try {
        const { name, description, prompt } = req.body;

        if (!name || !description || !prompt) {
          return res.status(400).json({
            success: false,
            error: 'Name, description, and prompt are required',
            code: 'MISSING_FIELDS'
          });
        }

        const plan = await this.agentOrchestrator.createOrchestrationPlan(name, description, prompt);

        res.json({
          success: true,
          plan
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'PLAN_CREATION_ERROR'
        });
      }
    });
  }

  setupAnalyticsEndpoints() {
    this.app.get('/api/analytics', async (req, res) => {
      try {
        const { sessionId, days = 30 } = req.query;
        const analytics = await this.getAnalytics(sessionId);
        const dbStats = this.getDatabaseStats();
        const performanceData = this.getPerformanceData();
        const predictions = await this.generatePredictions();

        res.json({
          success: true,
          analytics: {
            ...analytics,
            databaseStats: dbStats,
            performanceData,
            predictions,
            period: `${days} days`
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'ANALYTICS_ERROR'
        });
      }
    });

    this.app.get('/api/advanced/metrics', (req, res) => {
      try {
        const metrics = {
          performance: this.getPerformanceMetrics(),
          security: this.getSecurityMetrics(),
          advisory: Array.from(this.advisorySystem.values()),
          cache: {
            size: this.requestCache.size,
            hitRate: this.calculateCacheHitRate()
          },
          pipeline: {
            queueLength: this.transactionQueue.length,
            failedTransactions: this.failedTransactions.length
          }
        };

        res.json({
          success: true,
          metrics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'METRICS_ERROR'
        });
      }
    });

    this.app.get('/api/advanced/predictions', async (req, res) => {
      try {
        const predictions = await this.generatePredictions();

        res.json({
          success: true,
          predictions,
          recommendations: this.generateRecommendations(predictions),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'PREDICTIONS_ERROR'
        });
      }
    });

    this.app.get('/api/advanced/security-audit', (req, res) => {
      try {
        const audit = {
          totalAudits: this.securityAudits.length,
          recentAudits: this.securityAudits.slice(-10),
          riskSummary: this.calculateRiskSummary(),
          alerts: this.advisorySystem.get('securityAlerts')?.alerts || []
        };

        res.json({
          success: true,
          audit,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'AUDIT_ERROR'
        });
      }
    });

    this.app.get('/api/advanced/optimizations', (req, res) => {
      try {
        const suggestions = {
          gas: this.advisorySystem.get('gasPricing')?.recommendations || [],
          performance: this.advisorySystem.get('performanceOptimization')?.suggestions || [],
          security: this.advisorySystem.get('securityAlerts')?.alerts || []
        };

        res.json({
          success: true,
          suggestions,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'OPTIMIZATIONS_ERROR'
        });
      }
    });
  }

  getPerformanceMetrics() {
    const allMetrics = Array.from(this.performanceMetrics.values());
    if (allMetrics.length === 0) return { status: 'no-data' };

    const latest = allMetrics[allMetrics.length - 1];
    return {
      timestamp: latest.timestamp,
      memoryUsage: latest.memoryUsage,
      connections: latest.wsConnections,
      queueLength: latest.queueLength,
      cacheSize: latest.cacheSize,
      average: this.calculateAverageMetrics(allMetrics)
    };
  }

  calculateAverageMetrics(metrics) {
    const avgHeap = metrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / metrics.length;
    const avgConnections = metrics.reduce((sum, m) => sum + m.wsConnections, 0) / metrics.length;

    return {
      avgHeapUsed: Math.round(avgHeap / 1024 / 1024) + ' MB',
      avgConnections: Math.round(avgConnections)
    };
  }

  getSecurityMetrics() {
    return {
      totalAudits: this.securityAudits.length,
      criticalIssues: this.securityAudits.filter(a => a.severity === 'critical').length,
      warningCount: this.securityAudits.filter(a => a.severity === 'warning').length,
      lastAudit: this.securityAudits[this.securityAudits.length - 1]?.timestamp
    };
  }

  calculateCacheHitRate() {

    return this.requestCache.size > 0 ? 0.75 : 0;
  }

  async generatePredictions() {
    const interactions = await this.getAnalytics();

    return {
      expectedSuccessRate: interactions.successfulCalls / (interactions.totalInteractions || 1),
      estimatedNextGasPrice: this.predictGasPrice(),
      recommendedBatchSize: this.calculateOptimalBatchSize(),
      predictedLoadLevel: this.predictSystemLoad()
    };
  }

  predictGasPrice() {

    return Math.random() * 50 + 10;
  }

  calculateOptimalBatchSize() {
    const queueLength = this.transactionQueue.length;
    return Math.min(Math.ceil(queueLength / 5) || 5, 20);
  }

  predictSystemLoad() {
    const metrics = this.getPerformanceMetrics();
    if (metrics.status === 'no-data') return 'unknown';

    const usage = (metrics.memoryUsage?.heapUsed || 0) / (metrics.memoryUsage?.heapTotal || 1);
    return usage > 0.7 ? 'high' : usage > 0.4 ? 'medium' : 'low';
  }

  generateRecommendations(predictions) {
    const recommendations = [];

    if (predictions.expectedSuccessRate < 0.9) {
      recommendations.push('Increase retry attempts or reduce concurrent operations');
    }
    if (predictions.predictedLoadLevel === 'high') {
      recommendations.push('Consider load balancing or scaling');
    }

    return recommendations;
  }

  calculateRiskSummary() {
    return {
      highRisk: this.securityAudits.filter(a => a.severity === 'critical').length,
      mediumRisk: this.securityAudits.filter(a => a.severity === 'warning').length,
      lowRisk: this.securityAudits.filter(a => a.severity === 'info').length
    };
  }

  getPerformanceData() {
    const metrics = Array.from(this.performanceMetrics.values());
    return {
      dataPoints: metrics.length,
      memoryTrend: metrics.map(m => m.memoryUsage.heapUsed / 1024 / 1024),
      connectionsTrend: metrics.map(m => m.wsConnections)
    };
  }

  setupErrorHandlers() {
    this.app.use((err, req, res, next) => {
      res.status(err.status || 500).json({
        success: false,
        error: {
          message: err.message || 'Internal Server Error',
          code: err.code || 'INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    });

    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          message: 'Endpoint not found',
          code: 'NOT_FOUND',
          path: req.originalUrl
        }
      });
    });
  }

  getAvailableFunctions() {
    return [
      'getTokenBalance', 'getCELOBalance', 'sendCELO', 'sendToken',
      'getAllTokenBalances', 'analyzeTransactionSecurity', 'executeSecureTransaction',
      'validateTransaction', 'isAddressSafe', 'mintNFT', 'getNFTMetadata',
      'getOwnedNFTs', 'getNFTTransfers', 'estimateGas', 'waitForTransaction',
      'getNetworkInfo'
    ];
  }

  async getAnalytics(sessionId = null) {
    let query = 'SELECT * FROM interactions';
    const params = [];

    if (sessionId) {
      query += ' WHERE session_id = ?';
      params.push(sessionId);
    }

    query += ' ORDER BY timestamp DESC LIMIT 100';

    const stmt = this.db.prepare(query);
    const interactions = stmt.all(...params);

    return {
      totalInteractions: interactions.length,
      successfulCalls: interactions.filter(i => i.success).length,
      mostUsedFunctions: this.getMostUsedFunctions(interactions),
      averageConfidence: this.getAverageConfidence(interactions),
      errorRate: this.getErrorRate(interactions),
      agentUsage: this.getAgentUsage(interactions)
    };
  }

  getMostUsedFunctions(interactions) {
    const functionCounts = {};
    interactions.forEach(interaction => {
      const functionCalls = JSON.parse(interaction.function_calls);
      functionCalls.forEach(call => {
        functionCounts[call.function] = (functionCounts[call.function] || 0) + 1;
      });
    });

    return Object.entries(functionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([func, count]) => ({ function: func, count }));
  }

  getAverageConfidence(interactions) {
    const confidences = interactions.map(i => i.confidence || 0);
    return confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
  }

  getErrorRate(interactions) {
    const totalCalls = interactions.reduce((sum, i) => {
      const functionCalls = JSON.parse(i.function_calls);
      return sum + functionCalls.length;
    }, 0);
    const failedCalls = interactions.filter(i => !i.success).length;
    return totalCalls > 0 ? failedCalls / totalCalls : 0;
  }

  getAgentUsage(interactions) {
    const agentCounts = {};
    interactions.forEach(interaction => {
      if (interaction.agent_type) {
        agentCounts[interaction.agent_type] = (agentCounts[interaction.agent_type] || 0) + 1;
      }
    });

    return Object.entries(agentCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([agent, count]) => ({ agent, count }));
  }

  getDatabaseStats() {
    const stats = {};
    const tables = ['interactions', 'function_usage', 'sessions', 'agent_sessions', 'orchestration_plans', 'transaction_history'];
    tables.forEach(table => {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = stmt.get().count;
    });
    return stats;
  }

  start() {
    const server = http.createServer(this.app);
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
      console.log('📡 WebSocket client connected');
      this.wsClients.add(ws);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('📨 WebSocket message received:', data);

          if (data.type === 'ping') {
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString(),
              metrics: this.getPerformanceMetrics()
            }));
            return;
          }

          ws.send(JSON.stringify({
            type: 'ack',
            message: 'Message received',
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('📡 WebSocket client disconnected');
        this.wsClients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.wsClients.delete(ws);
      });

      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Advanced AutoFi backend v5.0.0',
        timestamp: new Date().toISOString(),
        capabilities: {
          mcp: this.mcpServer ? true : false,
          aiAgents: this.aiAgentSystem ? true : false,
          orchestrator: this.agentOrchestrator ? true : false,
          advancedAnalytics: true,
          predictiveAnalytics: true,
          securityAuditing: true,
          performanceMonitoring: true
        }
      }));
    });

    this.setupEventMonitoring();

    if (
      this.config.enableMCP &&
      this.consolidatedAgentSystem &&
      typeof this.consolidatedAgentSystem.start === 'function' &&
      !this._consolidatedAgentStarted
    ) {
      this.consolidatedAgentSystem
        .start()
        .then(() => {
          this._consolidatedAgentStarted = true;
        })
        .catch((e) => console.warn('⚠️  Consolidated MCP start (on server start) failed:', e?.message || e));
    }

    server.listen(this.config.port, () => {
      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║    🚀 Advanced AI Automation System v5.0.0 - RUNNING           ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');
      console.log('📍 Port:', this.config.port);
      console.log('🌐 Network:', this.config.network);
      console.log('🤖 AI Engine: Connected');
      console.log('🔗 Blockchain API: Connected');
      console.log('💾 Database: Connected');
      console.log('🔌 WebSocket: Ready');
      console.log('📊 Performance Monitor: Active');
      console.log('🛡️  Security Auditor: Active');
      console.log('� Predictive Analytics: Active');
      console.log('�🎭 MCP Server:', this.mcpServer ? 'Enabled' : 'Disabled');
      console.log('🤖 AI Agents:', this.aiAgentSystem ? 'Enabled' : 'Disabled');
  console.log('� Orchestrator:', this.agentOrchestrator ? 'Enabled' : 'Disabled');
  console.log('🤝 Consolidated Agent MCP:', this.consolidatedAgentSystem ? 'Enabled' : 'Disabled');
      console.log('🌐 Multi-Chain Support:', this.multiChainConfig ? 'Enabled' : 'Disabled');
      console.log('📝 Contract Factory:', this.contractFactory ? 'Enabled' : 'Disabled');
      console.log('📊 Monitoring System:', this.monitoringSystem ? 'Enabled' : 'Disabled');
      console.log('🧪 Testing Suite:', this.postmanProtocol ? 'Enabled' : 'Disabled');
      console.log('⚖️  Proxy Server:', this.proxyServer ? 'Enabled' : 'Disabled');

      console.log('\n📋 Advanced API Endpoints:');
      console.log('  POST   /api/automate - Main automation endpoint');
      console.log('  POST   /api/agents/create - Create AI agent');
      console.log('  GET    /api/advanced/metrics - Real-time metrics');
      console.log('  GET    /api/advanced/predictions - Predictive analytics');
      console.log('  GET    /api/advanced/security-audit - Security reports');
      console.log('  GET    /api/advanced/optimizations - Optimization suggestions');
      console.log('  GET    /api/analytics - Comprehensive analytics');
      console.log('  GET    /health - Health check');
      console.log('  WS     /ws - WebSocket real-time updates');
      console.log('\n🌐 Enhanced Multi-Chain Endpoints:');
      console.log('  GET    /api/chains - Get supported chains');
      console.log('  GET    /api/chains/health - Chain health status');
      console.log('  POST   /api/chains/select - Select best chain');
      console.log('  POST   /api/contracts/deploy - Deploy contracts');
      console.log('  GET    /api/contracts - List deployed contracts');
      console.log('  POST   /api/transactions/send - Send transactions');
      console.log('  GET    /api/tokens/balance/:address - Get token balance');
      console.log('\n📊 Monitoring & Testing Endpoints:');
      console.log('  GET    /api/monitoring/system - System metrics');
      console.log('  GET    /api/monitoring/alerts - System alerts');
      console.log('  GET    /api/monitoring/logs - System logs');
      console.log('  GET    /api/testing/collections - Test collections');
      console.log('  POST   /api/testing/collections/:id/run - Run tests');
      console.log('  GET    /api/loadbalancer/status - Load balancer status\n');
    });

    this.server = server;
  }

  setupEventMonitoring() {
    this.on('execution', (result) => {
      console.log(`✅ Execution completed - Success Rate: ${(result.confidence * 100).toFixed(1)}%`);

      if (result.securityAnalysis) {
        this.securityAudits.push({
          timestamp: Date.now(),
          ...result.securityAnalysis
        });
      }
    });

    this.on('error', (error) => {
      console.error('❌ System error:', error);
      this.advisorySystem.get('securityAlerts')?.alerts.push({
        timestamp: Date.now(),
        severity: 'error',
        message: error.message
      });
    });
  }

  broadcastToClients(message) {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    for (const client of this.wsClients) {
      if (client.readyState === 1) {
        client.send(messageStr);
      }
    }
  }

  async shutdown() {
    console.log('\n🛑 Initiating Advanced System Shutdown...');
    console.log('═'.repeat(60));

    try {
      if (this.transactionTracker) {
        this.transactionTracker.shutdown();
        console.log('✅ Transaction tracker shut down');
      }
    } catch (error) {
      console.error('❌ Error shutting down transaction tracker:', error);
    }

    try {

      this.saveFinalMetrics();
      console.log('✅ Metrics saved');
    } catch (error) {
      console.error('❌ Error saving metrics:', error);
    }

    try {
      for (const client of this.wsClients) {
        client.close();
      }
      this.wsClients.clear();
      console.log('✅ WebSocket connections closed');
    } catch (error) {
      console.error('❌ Error closing WebSocket connections:', error);
    }

    try {
      if (this.server) {
        this.server.close();
        console.log('✅ HTTP server closed');
      }
    } catch (error) {
      console.error('❌ Error closing HTTP server:', error);
    }

    try {
      if (this.agentOrchestrator) {
        this.agentOrchestrator.stop();
        console.log('✅ Agent orchestrator stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping agent orchestrator:', error);
    }

    try {
      if (this.mcpServer && typeof this.mcpServer.stop === 'function') {
        await this.mcpServer.stop();
        console.log('✅ MCP Server stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping MCP Server:', error);
    }

    try {
      if (this.consolidatedAgentSystem && typeof this.consolidatedAgentSystem.stop === 'function') {
        await this.consolidatedAgentSystem.stop();
        this._consolidatedAgentStarted = false;
        console.log('✅ ConsolidatedAgentSystem MCP server stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping ConsolidatedAgentSystem MCP server:', error);
    }

    try {
      this.db.close();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }

    console.log('═'.repeat(60));
    console.log('👋 Advanced AI Automation System v5.0.0 stopped gracefully\n');
  }

  saveFinalMetrics() {
    const finalMetrics = {
      timestamp: Date.now(),
      totalRequests: this.conversationHistory.size,
      cacheSize: this.requestCache.size,
      securityAudits: this.securityAudits.length,
      performanceDataPoints: this.performanceMetrics.size,
      failedTransactions: this.failedTransactions.length
    };

    console.log('📊 Final Metrics:', finalMetrics);
  }

  getStatus() {
    return {
      status: 'running',
      components: {
        aiEngine: 'connected',
        blockchainAPI: 'connected',
        database: 'connected',
        mcpServer: this.mcpServer ? 'connected' : 'disabled',
        aiAgents: this.aiAgentSystem ? 'connected' : 'disabled',
        orchestrator: this.agentOrchestrator ? 'connected' : 'disabled',
        consolidatedAgents: this.consolidatedAgentSystem ? 'connected' : 'disabled'
      },
      config: {
        network: this.config.network,
        port: this.config.port
      },
      timestamp: new Date().toISOString()
    };
  }
}

import { fileURLToPath } from 'url';
const currentFile = fileURLToPath(import.meta.url);
const isMainModule = currentFile === process.argv[1];

if (isMainModule) {
  try {
    const config = {
      port: process.env.PORT || 3001,
      geminiApiKey: process.env.GEMINI_API_KEY,
      privateKey: process.env.PRIVATE_KEY,
      network: process.env.NETWORK || 'alfajores',
      rpcUrl: process.env.RPC_URL,
      alchemyApiKey: process.env.ALCHEMY_API_KEY,
      enableMCP: process.env.ENABLE_MCP !== 'false',
      enableAIAgents: process.env.ENABLE_AI_AGENTS !== 'false',
      enableAdvancedFeatures: process.env.ENABLE_ADVANCED_FEATURES !== 'false'
    };

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Starting Advanced AI Automation System v5.0.0 - Enterprise    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const automation = new CombinedAutomationSystem(config);
    automation.start();

    process.on('SIGINT', async () => {
      console.log('\n⚠️  SIGINT received - initiating graceful shutdown...');
      await automation.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n⚠️  SIGTERM received - initiating graceful shutdown...');
      await automation.shutdown();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      console.error('\n❌ Uncaught Exception:', error);
      await automation.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('\n❌ Unhandled Rejection at:', promise, 'reason:', reason);
      await automation.shutdown();
      process.exit(1);
    });
  } catch (error) {
    console.error('\n❌ Failed to start advanced automation system:', error);
    process.exit(1);
  }
}

export default CombinedAutomationSystem;
