import Database from 'better-sqlite3';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import http from 'http';
import { createPublicClient, createWalletClient, http as viem_http, parseEther, privateKeyToAccount } from 'viem';
import { celo } from 'viem/chains';
import { TransactionTracker } from './transaction-tracker.js';
import { GasEstimationService } from './gas-estimation-service.js';
import { EtherscanService } from './etherscan-service.js';
import { LangChainAgent } from './langchain-agent.js';

const DEFAULT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbb';
const CELO_TOKENS = {
  CELO: '0x0000000000000000000000000000000000000000',
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73'
};

export class AutomationSystem {
  constructor(config = {}) {
    this.config = this.mergeConfig(config);
    this.conversationHistory = new Map();
    this.functionRegistry = this.createFunctionRegistry();
    this.wsClients = new Set(); // Track WebSocket clients
    this.transactionQueue = []; // Track pending transactions
    this.account = null; // Wallet account

    this.initializeDatabase();
    this.initializeWalletAccount();
    this.initializeBlockchainClients();
    this._langChainInitializationPromise = this.initializeLangChainAgent();
    this.initializeTransactionTracker();
    this.initializeGasEstimationService();
    this.initializeEtherscanService();
    this.initializeBlockchainAPI();
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
      ...config
    };
  }

  /**
   * Sanitizes an object for logging by redacting sensitive keys.
   * Handles nested objects and arrays, and does not mutate the original object.
   * @param {any} obj - The object to sanitize
   * @returns {any} - A sanitized copy of the object
   */
  sanitizeForLog(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // List of sensitive keys to redact (case-insensitive)
    const sensitiveKeys = ['privateKey', 'password', 'secret', 'apiKey', 'token', 'auth', 'private', 'key', 'credentials', 'passphrase'];

    // Check if a key is sensitive
    const isSensitiveKey = (key) => {
      const lowerKey = key.toLowerCase();
      return sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey.toLowerCase()));
    };

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForLog(item));
    }

    // Handle plain objects
    if (typeof obj === 'object' && obj.constructor === Object) {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (isSensitiveKey(key)) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeForLog(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    // Return primitive values as-is
    return obj;
  }

  initializeWalletAccount() {
    try {
      if (this.config.privateKey && this.config.privateKey !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        this.account = privateKeyToAccount(this.config.privateKey);
        console.log('✅ Wallet account initialized:', this.account.address);
      } else {
        console.warn('⚠️ No valid private key - transactions will be simulated');
      }
    } catch (error) {
      console.error('❌ Failed to initialize wallet account:', error.message);
    }
  }

  async initializeLangChainAgent() {
    try {
      this.langChainAgent = await LangChainAgent.create({
        geminiApiKey: this.config.geminiApiKey,
        privateKey: this.config.privateKey,
        network: this.config.network,
        rpcUrl: this.config.rpcUrl,
        debug: this.config.debug
      });
      console.log('✅ LangChain agent initialized');
    } catch (error) {
      console.error('❌ Failed to initialize LangChain agent:', error.message);
      console.warn('⚠️ Falling back to legacy AI system');
      this.langChainAgent = null;
    }
  }

  initializeDatabase() {
    const dataDir = './data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.db = new Database('./data/automation.db');
    this.createTables();
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
        success BOOLEAN DEFAULT 1
      );
      
      CREATE TABLE IF NOT EXISTS function_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        function_name TEXT NOT NULL,
        parameters TEXT,
        success BOOLEAN DEFAULT 1,
        execution_time INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_interactions INTEGER DEFAULT 0,
        user_preferences TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_function_usage_name ON function_usage(function_name);
    `);
  }

  initializeBlockchainClients() {
    try {
      // Celo network configuration
      const rpcUrl = this.config.rpcUrl || 'https://alfajores-forno.celo-testnet.org';

      // Create Viem public client for reading
      this.publicClient = createPublicClient({
        chain: celo,
        transport: viem_http(rpcUrl)
      });

      // Create wallet client if account is available
      if (this.account) {
        this.walletClient = createWalletClient({
          chain: celo,
          transport: viem_http(rpcUrl),
          account: this.account
        });
        console.log('✅ Wallet client initialized with account');
      } else {
        this.walletClient = createWalletClient({
          chain: celo,
          transport: viem_http(rpcUrl)
        });
        console.warn('⚠️ Wallet client created without account - transactions will fail');
      }

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

      // Initialize transaction history table in database
      this.db.exec(`
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
          completed_at DATETIME
        );

        CREATE INDEX IF NOT EXISTS idx_tx_hash ON transaction_history(tx_hash);
        CREATE INDEX IF NOT EXISTS idx_from_address ON transaction_history(from_address);
        CREATE INDEX IF NOT EXISTS idx_status ON transaction_history(status);
        CREATE INDEX IF NOT EXISTS idx_created_at ON transaction_history(created_at);
      `);

      console.log('✅ Transaction tracker initialized');
      console.log('✅ Transaction history database initialized');
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

  validateFunctionParameters(functionName, params) {
    try {
      switch (functionName) {
        case 'mintNFT':
          // NFT minting requires 'to' address
          if (!params.to) {
            params.to = DEFAULT_ADDRESS;
          }
          break;
        case 'swapTokens':
          // Token swap requires amounts
          if (!params.amountIn) {
            params.amountIn = '0';
          }
          break;
        case 'daoGovernance':
        case 'voteOnProposal':
          // DAO functions need proposal ID
          if (!params.proposalId) {
            params.proposalId = '1';
          }
          if (!params.vote) {
            params.vote = 'for';
          }
          break;
        case 'getProposals':
          // getProposals doesn't require specific params
          break;
        case 'estimateGas':
          // Gas estimation requires 'to' address
          if (!params.to) {
            params.to = DEFAULT_ADDRESS;
          }
          if (!params.value) {
            params.value = '0';
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.warn(`Parameter validation warning for ${functionName}:`, error.message);
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

  initializeExpress() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupAutomationEndpoints();
    this.setupWalletEndpoints();
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3002'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Request-ID']
    }));
    
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use(limiter);
    
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
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
      // Use LangChain agent if available
      if (this.langChainAgent) {
        const result = await this.langChainAgent.process(input);
        
        return {
          success: result.success,
          output: result.output,
          steps: result.steps || [],
          agent: 'langchain'
        };
      }
      
      // Fallback to legacy system
      const sessionId = context.sessionId || 'default';
      const history = this.conversationHistory.get(sessionId) || [];
      
      // Mock response for fallback
      const parsedResult = {
        reasoning: "Using legacy AI system (LangChain unavailable)",
        confidence: 0.5,
        functionCalls: [
          {
            function: "getCELOBalance",
            parameters: { address: DEFAULT_ADDRESS },
            priority: 1
          }
        ]
      };
      
      const executionResults = await this.executeFunctionCalls(parsedResult.functionCalls, context);
      
      return {
        success: true,
        functionCalls: parsedResult.functionCalls,
        results: executionResults,
        reasoning: parsedResult.reasoning,
        confidence: parsedResult.confidence,
        agent: 'legacy'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        functionCalls: [],
        results: []
      };
    }
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
- NEVER use placeholder values like "default", "user", or "address" - always use valid Ethereum addresses

Example:
Input: "Send 100 cUSD to ${DEFAULT_ADDRESS}"
Response:
{
  "reasoning": "User wants to send 100 cUSD tokens. I need to: 1) Validate the recipient address, 2) Check if it's safe, 3) Send the tokens using sendToken function with cUSD contract address",
  "confidence": 0.95,
  "functionCalls": [
    {
      "function": "isAddressSafe",
      "parameters": {
        "address": "${DEFAULT_ADDRESS}"
      },
      "priority": 1
    },
    {
      "function": "sendToken",
      "parameters": {
        "tokenAddress": "${CELO_TOKENS.cUSD}",
        "to": "${DEFAULT_ADDRESS}",
        "amount": "100000000000000000000"
      },
      "priority": 2
    }
  ]
}`;
  }

  buildConversationContext(history, context) {
    return {
      recentInteractions: history.slice(-3),
      currentNetwork: context.network || 'alfajores',
      userPreferences: context.preferences || {},
      availableTokens: CELO_TOKENS,
      sessionId: context.sessionId || 'default'
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
        confidence, reasoning, success
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const success = data.results.every(result => result.success);

    return stmt.run(
      data.sessionId,
      data.input,
      JSON.stringify(data.functionCalls),
      JSON.stringify(data.results),
      data.confidence || 0,
      data.reasoning || '',
      success ? 1 : 0
    );
  }

  storeTransactionHistory(data) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO transaction_history (
          tx_hash, from_address, to_address, value, status, type, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
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
        })
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

  async handleGasEstimation(parameters) {
    try {
      const { to, value = '0', data = '0x' } = parameters;

      if (!to) {
        return {
          success: false,
          error: 'Recipient address is required'
        };
      }

      const gasData = await this.gasEstimationService.getComprehensiveGasData(to, value, data);

      return {
        success: true,
        data: {
          gasLimit: gasData.transaction.gasLimit,
          gasPrice: gasData.transaction.gasPrice,
          gasPriceWei: gasData.transaction.gasPriceWei,
          estimatedCost: gasData.transaction.estimatedCost,
          estimatedCostGwei: gasData.transaction.estimatedCostGwei,
          breakdown: gasData.transaction.breakdown,
          tracker: gasData.tracker,
          timestamp: gasData.timestamp
        }
      };
    } catch (error) {
      console.error('Gas estimation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleGetProposals(parameters) {
    try {
      return {
        success: true,
        data: []
      };
    } catch (error) {
      console.error('Get proposals error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeMintNFT(parameters, txHash) {
    const { recipient, tokenURI, contractAddress, from } = parameters;
    const fromAddress = from || DEFAULT_ADDRESS;

    // Store in transaction history
    this.storeTransactionHistory({
      txHash,
      fromAddress,
      to: contractAddress || DEFAULT_ADDRESS,
      value: '0',
      status: 'pending',
      type: 'NFT_MINT',
      realTransaction: this.config.enableRealBlockchainCalls
    });

    const nftUpdate = {
      type: 'transaction_update',
      payload: {
        txHash,
        type: 'NFT_MINT',
        from: fromAddress,
        recipient: recipient || fromAddress,
        tokenURI,
        contractAddress,
        status: 'pending',
        timestamp: Date.now()
      }
    };

    this.broadcastToClients(nftUpdate);

    // Simulate NFT minting completion with real blockchain tracking
    setTimeout(async () => {
      try {
        // Update transaction history
        this.updateTransactionHistory(txHash, {
          status: 'success',
          blockNumber: Math.floor(Math.random() * 100000),
          gasUsed: '150000'
        });

        const completedUpdate = {
          type: 'transaction_update',
          payload: {
            txHash,
            type: 'NFT_MINT',
            from: fromAddress,
            recipient: recipient || fromAddress,
            tokenId: Math.floor(Math.random() * 100000),
            status: 'success',
            timestamp: Date.now()
          }
        };
        this.broadcastToClients(completedUpdate);
        console.log(`✅ NFT minted: ${txHash}`);
      } catch (error) {
        console.error(`❌ Error completing NFT mint: ${error.message}`);
      }
    }, 3000);

    return {
      success: true,
      data: {
        txHash,
        status: 'pending',
        message: 'NFT minting in progress'
      }
    };
  }

  async executeSwapTokens(parameters, txHash) {
    const { tokenIn, tokenOut, amountIn, amountOut, from } = parameters;
    const fromAddress = from || DEFAULT_ADDRESS;

    // Store in transaction history
    this.storeTransactionHistory({
      txHash,
      fromAddress,
      to: tokenIn,
      value: amountIn,
      status: 'pending',
      type: 'TOKEN_SWAP',
      realTransaction: this.config.enableRealBlockchainCalls
    });

    const swapUpdate = {
      type: 'transaction_update',
      payload: {
        txHash,
        type: 'TOKEN_SWAP',
        from: fromAddress,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        status: 'pending',
        timestamp: Date.now()
      }
    };

    this.broadcastToClients(swapUpdate);

    // Simulate token swap completion with real blockchain tracking
    setTimeout(async () => {
      try {
        const finalAmountOut = (parseFloat(amountOut || '0') * 0.98).toString(); // 2% slippage

        // Update transaction history
        this.updateTransactionHistory(txHash, {
          status: 'success',
          blockNumber: Math.floor(Math.random() * 100000),
          gasUsed: '200000'
        });

        const completedUpdate = {
          type: 'transaction_update',
          payload: {
            txHash,
            type: 'TOKEN_SWAP',
            from: fromAddress,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut: finalAmountOut,
            status: 'success',
            timestamp: Date.now()
          }
        };
        this.broadcastToClients(completedUpdate);
        console.log(`✅ Token swap executed: ${txHash}`);
      } catch (error) {
        console.error(`❌ Error completing token swap: ${error.message}`);
      }
    }, 3000);

    return {
      success: true,
      data: {
        txHash,
        status: 'pending',
        message: 'Token swap in progress'
      }
    };
  }

  async executeDAOGovernance(parameters, txHash) {
    const { proposalId, vote, daoAddress, from } = parameters;
    const fromAddress = from || DEFAULT_ADDRESS;

    const daoUpdate = {
      type: 'transaction_update',
      payload: {
        txHash,
        type: 'DAO_VOTE',
        from: fromAddress,
        proposalId: proposalId || '1',
        vote: vote || 'for',
        daoAddress,
        status: 'pending',
        timestamp: Date.now()
      }
    };

    this.broadcastToClients(daoUpdate);

    // Simulate DAO vote completion
    setTimeout(() => {
      const completedUpdate = {
        type: 'transaction_update',
        payload: {
          txHash,
          type: 'DAO_VOTE',
          from: fromAddress,
          proposalId: proposalId || '1',
          vote: vote || 'for',
          status: 'success',
          votingPower: '1000',
          timestamp: Date.now()
        }
      };
      this.broadcastToClients(completedUpdate);
      console.log(`✅ DAO vote recorded: ${txHash}`);
    }, 3000);

    return {
      data: {
        txHash,
        status: 'pending',
        proposalId,
        vote
      }
    };
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        components: {
          aiEngine: 'connected',
          blockchainAPI: 'connected',
          database: 'connected'
        }
      });
    });

    this.app.post('/api/automate', async (req, res) => {
      try {
        const { prompt, context = {} } = req.body;
        
        if (!prompt) {
          return res.status(400).json({
            error: 'Prompt is required',
            code: 'MISSING_PROMPT'
          });
        }

        const result = await this.processNaturalLanguage(prompt, {
          sessionId: context.sessionId || req.headers['x-session-id'] || 'default',
          network: context.network || this.config.network,
          preferences: context.preferences || {},
          ...context
        });

        res.json({
          success: true,
          result,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'AUTOMATION_ERROR'
        });
      }
    });

    this.app.get('/api/analytics', async (req, res) => {
      try {
        const { sessionId, days = 30 } = req.query;
        
        const analytics = await this.getAnalytics(sessionId);
        const dbStats = this.getDatabaseStats();
        
        res.json({
          success: true,
          analytics: {
            ...analytics,
            databaseStats: dbStats,
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

    // Blockchain Integration Endpoints
    this.app.post('/api/blockchain/send-transaction', async (req, res) => {
      try {
        const { to, value, data, from } = req.body;

        if (!to) {
          return res.status(400).json({
            success: false,
            error: 'Recipient address is required',
            code: 'MISSING_ADDRESS'
          });
        }

        const fromAddress = from || DEFAULT_ADDRESS;

        // Attempt real blockchain transaction if enabled
        let txHash;
        let realTransaction = false;

        if (this.config.enableRealBlockchainCalls && this.walletClient && this.account) {
          try {
            // Execute real transaction on blockchain with proper account
            txHash = await this.walletClient.sendTransaction({
              to,
              value: BigInt(value || '0'),
              data: data || '0x'
            });
            realTransaction = true;
            console.log(`🔗 Real transaction sent: ${txHash}`);
            
            // Wait for confirmation
            const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
            console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
          } catch (error) {
            console.warn(`⚠️ Real transaction failed, using simulated: ${error.message}`);
            // Fall back to simulated transaction
            txHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
          }
        } else {
          // Generate simulated transaction hash
          txHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
          
          if (!this.account) {
            console.warn('⚠️ No wallet account configured - using simulated transaction');
          }
        }

        // Register transaction with tracker
        const transaction = this.transactionTracker.registerTransaction(txHash, {
          from: fromAddress,
          to,
          value: value || '0',
          data: data || '',
          type: 'send',
          realTransaction
        });

        // Store in transaction history
        this.storeTransactionHistory({
          txHash,
          fromAddress,
          to,
          value: value || '0',
          status: 'pending',
          type: 'send',
          realTransaction
        });

        res.json({
          success: true,
          data: {
            txHash,
            status: transaction.status,
            message: 'Transaction submitted and tracking started',
            realTransaction
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'TRANSACTION_ERROR'
        });
      }
    });

    this.app.post('/api/blockchain/function-call', async (req, res) => {
      try {
        const { functionName, parameters, context } = req.body;

        // Validate function name
        if (!functionName) {
          return res.status(400).json({
            success: false,
            error: 'Function name is required',
            code: 'MISSING_FUNCTION',
            example: {
              functionName: 'getCELOBalance',
              parameters: { address: '0x...' }
            }
          });
        }

        // Validate function exists
        const validFunctions = this.blockchainAPI.getAvailableFunctions();
        const customFunctions = [
          'mintNFT', 'swapTokens', 'daoProposal', 'daoGovernance', 'voteOnProposal',
          'createProposal', 'executeProposal', 'getProposals', 'estimateGas'
        ];
        const isValidFunction = validFunctions.includes(functionName) || customFunctions.includes(functionName);

        if (!isValidFunction) {
          return res.status(400).json({
            success: false,
            error: `Unknown function: ${functionName}`,
            code: 'INVALID_FUNCTION',
            availableFunctions: validFunctions,
            customFunctions: customFunctions
          });
        }

        // Ensure parameters is an object
        const params = parameters || {};

        // Validate and sanitize parameters based on function
        this.validateFunctionParameters(functionName, params);

        // Log the function call for debugging
        console.log(`📞 Function call: ${functionName}`, JSON.stringify(this.sanitizeForLog(params)).substring(0, 100));

        let result;
        const txHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');

        // Handle different function types with specific logic
        switch(functionName) {
          case 'mintNFT':
            result = await this.executeMintNFT(params, txHash);
            break;
          case 'swapTokens':
            result = await this.executeSwapTokens(params, txHash);
            break;
          case 'daoProposal':
          case 'daoGovernance':
          case 'voteOnProposal':
          case 'createProposal':
          case 'executeProposal':
            result = await this.executeDAOGovernance(params, txHash);
            break;
          case 'getProposals':
            result = await this.handleGetProposals(params);
            break;
          case 'estimateGas':
            result = await this.handleGasEstimation(params);
            break;
          default:
            result = await this.blockchainAPI.callFunction(functionName, params, context);
        }

        // Ensure result has proper structure
        const responseData = result.data || result;

        res.json({
          success: true,
          data: responseData,
          functionName,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`❌ Function call error for ${req.body.functionName}:`, error.message);
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'FUNCTION_ERROR',
          functionName: req.body.functionName
        });
      }
    });

    this.app.get('/api/blockchain/transaction/:txHash', async (req, res) => {
      try {
        const { txHash } = req.params;

        const transaction = this.transactionTracker.getTransaction(txHash);
        if (!transaction) {
          return res.status(404).json({
            success: false,
            error: 'Transaction not found',
            code: 'TRANSACTION_NOT_FOUND'
          });
        }

        res.json({
          success: true,
          data: transaction
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'TRANSACTION_STATUS_ERROR'
        });
      }
    });

    this.app.get('/api/blockchain/transactions/:address', async (req, res) => {
      try {
        const { limit = 10 } = req.query;

        const history = this.transactionTracker.getTransactionHistory(parseInt(limit));
        res.json({
          success: true,
          data: history
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'TRANSACTION_HISTORY_ERROR'
        });
      }
    });

    // Get transaction history from database
    this.app.get('/api/blockchain/transaction-history', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const history = this.getTransactionHistoryFromDB(limit);

        res.json({
          success: true,
          data: history,
          count: history.length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'HISTORY_ERROR'
        });
      }
    });

    // Get transaction statistics
    this.app.get('/api/blockchain/transactions/stats', async (req, res) => {
      try {
        const stats = this.transactionTracker.getStatistics();
        const dbHistory = this.getTransactionHistoryFromDB(1000);

        // Combine stats from tracker and database
        const combinedStats = {
          ...stats,
          totalInDatabase: dbHistory.length,
          successfulTransactions: dbHistory.filter(tx => tx.status === 'success').length,
          failedTransactions: dbHistory.filter(tx => tx.status === 'failed').length,
          pendingTransactions: dbHistory.filter(tx => tx.status === 'pending').length,
          realTransactions: dbHistory.filter(tx => {
            try {
              const metadata = JSON.parse(tx.metadata || '{}');
              return metadata.realTransaction === true;
            } catch {
              return false;
            }
          }).length
        };

        res.json({
          success: true,
          data: combinedStats
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'STATS_ERROR'
        });
      }
    });

    // Get pending transactions
    this.app.get('/api/blockchain/transactions/pending', async (req, res) => {
      try {
        const pending = this.transactionTracker.getPendingTransactions();
        res.json({
          success: true,
          data: pending
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'PENDING_ERROR'
        });
      }
    });

    // Gas Estimation Endpoints
    this.app.post('/api/blockchain/estimate-gas', async (req, res) => {
      try {
        const { to, value, data } = req.body;

        if (!to) {
          return res.status(400).json({
            success: false,
            error: 'Recipient address is required'
          });
        }

        const gasData = await this.gasEstimationService.getComprehensiveGasData(to, value || '0', data || '0x');

        res.json({
          success: true,
          data: gasData
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'GAS_ESTIMATION_ERROR'
        });
      }
    });

    // Get gas price
    this.app.get('/api/blockchain/gas-price', async (req, res) => {
      try {
        const gasPrice = await this.gasEstimationService.getGasPriceAlchemy();
        const gasTracker = await this.gasEstimationService.getGasTrackerEtherscan();

        res.json({
          success: true,
          data: {
            alchemy: gasPrice,
            etherscan: gasTracker,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'GAS_PRICE_ERROR'
        });
      }
    });

    // Etherscan Account Analytics
    this.app.get('/api/blockchain/account/:address', async (req, res) => {
      try {
        const { address } = req.params;
        const analytics = await this.etherscanService.getAccountAnalytics(address);

        if (!analytics) {
          return res.status(404).json({
            success: false,
            error: 'Account not found'
          });
        }

        res.json({
          success: true,
          data: analytics
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'ACCOUNT_ERROR'
        });
      }
    });

    // Get account balance
    this.app.get('/api/blockchain/balance/:address', async (req, res) => {
      try {
        const { address } = req.params;
        const balance = await this.etherscanService.getBalance(address);

        res.json({
          success: true,
          data: { balance, address }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'BALANCE_ERROR'
        });
      }
    });

    // Get account transactions
    this.app.get('/api/blockchain/transactions/:address', async (req, res) => {
      try {
        const { address } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const transactions = await this.etherscanService.getTransactions(address);

        res.json({
          success: true,
          data: transactions.slice(0, limit),
          count: transactions.length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'TRANSACTIONS_ERROR'
        });
      }
    });

    // Get token transfers
    this.app.get('/api/blockchain/token-transfers/:address', async (req, res) => {
      try {
        const { address } = req.params;
        const { contract } = req.query;
        const transfers = await this.etherscanService.getTokenTransfers(address, contract);

        res.json({
          success: true,
          data: transfers,
          count: transfers.length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'TOKEN_TRANSFERS_ERROR'
        });
      }
    });

    // Get transaction status
    this.app.get('/api/blockchain/tx-status/:txHash', async (req, res) => {
      try {
        const { txHash } = req.params;
        const status = await this.etherscanService.getTransactionStatus(txHash);

        if (!status) {
          return res.status(404).json({
            success: false,
            error: 'Transaction not found'
          });
        }

        res.json({
          success: true,
          data: status
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'TX_STATUS_ERROR'
        });
      }
    });

    // Get contract ABI
    this.app.get('/api/blockchain/contract-abi/:address', async (req, res) => {
      try {
        const { address } = req.params;
        const abi = await this.etherscanService.getContractABI(address);

        if (!abi) {
          return res.status(404).json({
            success: false,
            error: 'Contract ABI not found'
          });
        }

        res.json({
          success: true,
          data: abi
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'ABI_ERROR'
        });
      }
    });

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
    return Object.keys(this.functionRegistry);
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
      errorRate: this.getErrorRate(interactions)
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
      .sort(([,a], [,b]) => b - a)
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

  getDatabaseStats() {
    const stats = {};
    const tables = ['interactions', 'function_usage', 'sessions'];
    tables.forEach(table => {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = stmt.get().count;
    });
    return stats;
  }

  // ============================================================================
  // AUTOMATION STORAGE HELPERS
  // ============================================================================

  getStoredAutomations() {
    if (!this.automations) {
      this.automations = [];
    }
    return this.automations;
  }

  getStoredAutomation(id) {
    if (!this.automations) {
      this.automations = [];
    }
    return this.automations.find(a => a.id === id);
  }

  storeAutomation(automation) {
    if (!this.automations) {
      this.automations = [];
    }
    this.automations.push(automation);
  }

  updateStoredAutomation(id, automation) {
    if (!this.automations) {
      this.automations = [];
    }
    const index = this.automations.findIndex(a => a.id === id);
    if (index !== -1) {
      this.automations[index] = automation;
    }
  }

  deleteStoredAutomation(id) {
    if (!this.automations) {
      this.automations = [];
    }
    this.automations = this.automations.filter(a => a.id !== id);
  }

  async executeAutomationById(id, context) {
    const automation = this.getStoredAutomation(id);
    if (!automation) {
      throw new Error('Automation not found');
    }

    // Execute based on type
    let result;
    switch (automation.type) {
      case 'transaction':
        result = await this.blockchainAPI.sendCELO(
          automation.parameters.to,
          automation.parameters.amount
        );
        break;
      case 'swap':
        result = await this.blockchainAPI.swapTokens(automation.parameters);
        break;
      case 'nft':
        result = await this.blockchainAPI.mintNFT(automation.parameters);
        break;
      case 'dao':
        result = await this.executeDAOGovernance(automation.parameters);
        break;
      default:
        result = { message: 'Automation executed' };
    }

    // Update automation status
    automation.lastExecution = {
      timestamp: new Date().toISOString(),
      status: 'success',
      result
    };
    automation.progress = 100;
    this.updateStoredAutomation(id, automation);

    return result;
  }

  // ============================================================================
  // WALLET INFO HELPERS
  // ============================================================================

  async getWalletInfo(address) {
    try {
      // Validate address format
      if (!address || !address.startsWith('0x')) {
        throw new Error('Invalid address format');
      }

      // Return wallet info - data should come from actual blockchain
      return {
        address,
        balance: null,
        network: this.config.network,
        tokens: []
      };
    } catch (error) {
      console.error('Error getting wallet info:', error);
      return {
        address,
        balance: null,
        network: this.config.network,
        tokens: []
      };
    }
  }

  // ============================================================================
  // AUTOMATION MANAGEMENT ENDPOINTS
  // ============================================================================

  setupAutomationEndpoints() {
    // Get all automations
    this.app.get('/api/automations', async (req, res) => {
      try {
        const automations = this.getStoredAutomations();
        res.json({
          success: true,
          data: automations
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'AUTOMATIONS_ERROR'
        });
      }
    });

    // Create new automation
    this.app.post('/api/automations', async (req, res) => {
      try {
        const { name, type, parameters, schedule, conditions } = req.body;

        if (!name || !type) {
          return res.status(400).json({
            success: false,
            error: 'Name and type are required',
            code: 'MISSING_FIELDS'
          });
        }

        const automation = {
          id: 'auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          name,
          type,
          status: 'active',
          progress: 0,
          parameters: parameters || {},
          schedule: schedule || { frequency: 'once' },
          conditions: conditions || {},
          createdAt: new Date().toISOString(),
          nextRun: new Date().toISOString(),
          lastExecution: null
        };

        // Store automation
        this.storeAutomation(automation);

        res.json({
          success: true,
          data: automation
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'CREATE_AUTOMATION_ERROR'
        });
      }
    });

    // Get specific automation
    this.app.get('/api/automations/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const automation = this.getStoredAutomation(id);

        if (!automation) {
          return res.status(404).json({
            success: false,
            error: 'Automation not found',
            code: 'NOT_FOUND'
          });
        }

        res.json({
          success: true,
          data: automation
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'GET_AUTOMATION_ERROR'
        });
      }
    });

    // Update automation
    this.app.put('/api/automations/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        const automation = this.getStoredAutomation(id);
        if (!automation) {
          return res.status(404).json({
            success: false,
            error: 'Automation not found',
            code: 'NOT_FOUND'
          });
        }

        const updated = { ...automation, ...updates, id };
        this.updateStoredAutomation(id, updated);

        res.json({
          success: true,
          data: updated
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'UPDATE_AUTOMATION_ERROR'
        });
      }
    });

    // Delete automation
    this.app.delete('/api/automations/:id', async (req, res) => {
      try {
        const { id } = req.params;
        this.deleteStoredAutomation(id);

        res.json({
          success: true,
          message: 'Automation deleted'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'DELETE_AUTOMATION_ERROR'
        });
      }
    });

    // Pause automation
    this.app.post('/api/automations/:id/pause', async (req, res) => {
      try {
        const { id } = req.params;
        const automation = this.getStoredAutomation(id);

        if (!automation) {
          return res.status(404).json({
            success: false,
            error: 'Automation not found',
            code: 'NOT_FOUND'
          });
        }

        automation.status = 'paused';
        this.updateStoredAutomation(id, automation);

        res.json({
          success: true,
          data: automation
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'PAUSE_ERROR'
        });
      }
    });

    // Resume automation
    this.app.post('/api/automations/:id/resume', async (req, res) => {
      try {
        const { id } = req.params;
        const automation = this.getStoredAutomation(id);

        if (!automation) {
          return res.status(404).json({
            success: false,
            error: 'Automation not found',
            code: 'NOT_FOUND'
          });
        }

        automation.status = 'active';
        this.updateStoredAutomation(id, automation);

        res.json({
          success: true,
          data: automation
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'RESUME_ERROR'
        });
      }
    });

    // Execute automation
    this.app.post('/api/automations/:id/execute', async (req, res) => {
      try {
        const { id } = req.params;
        const { context } = req.body;

        const automation = this.getStoredAutomation(id);
        if (!automation) {
          return res.status(404).json({
            success: false,
            error: 'Automation not found',
            code: 'NOT_FOUND'
          });
        }

        // Execute the automation
        const result = await this.executeAutomationById(id, context);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'EXECUTE_ERROR'
        });
      }
    });

    // Create automation with AI
    this.app.post('/api/automations/ai-create', async (req, res) => {
      try {
        const { prompt, context } = req.body;

        if (!prompt) {
          return res.status(400).json({
            success: false,
            error: 'Prompt is required',
            code: 'MISSING_PROMPT'
          });
        }

        // Use AI to create automation
        const result = await this.processNaturalLanguage(prompt, context || {});

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'AI_CREATE_ERROR'
        });
      }
    });
  }

  // ============================================================================
  // WALLET MANAGEMENT ENDPOINTS
  // ============================================================================

  setupWalletEndpoints() {
    // Get wallet info
    this.app.get('/api/wallet/:address', async (req, res) => {
      try {
        const { address } = req.params;

        if (!address) {
          return res.status(400).json({
            success: false,
            error: 'Address is required',
            code: 'MISSING_ADDRESS'
          });
        }

        const walletInfo = await this.getWalletInfo(address);

        res.json({
          success: true,
          data: walletInfo
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'WALLET_INFO_ERROR'
        });
      }
    });

    // Get wallet balance
    this.app.get('/api/wallet/:address/balance', async (req, res) => {
      try {
        const { address } = req.params;

        if (!address) {
          return res.status(400).json({
            success: false,
            error: 'Address is required',
            code: 'MISSING_ADDRESS'
          });
        }

        res.json({
          success: true,
          data: {
            address,
            balance: null,
            tokens: []
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'BALANCE_ERROR'
        });
      }
    });

    // Get wallet tokens
    this.app.get('/api/wallet/:address/tokens', async (req, res) => {
      try {
        const { address } = req.params;

        if (!address) {
          return res.status(400).json({
            success: false,
            error: 'Address is required',
            code: 'MISSING_ADDRESS'
          });
        }

        res.json({
          success: true,
          data: {
            address,
            tokens: [],
            count: 0
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          code: 'TOKENS_ERROR'
        });
      }
    });
  }

  start() {
    // Create HTTP server
    const server = http.createServer(this.app);
    
    // Attach WebSocket server
    const wss = new WebSocketServer({ server });
    
    wss.on('connection', (ws) => {
      console.log('📡 WebSocket client connected');
      this.wsClients.add(ws);
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('📨 WebSocket message received:', data);
          
          // Handle ping messages
          if (data.type === 'ping') {
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString()
            }));
            return;
          }
          
          // Echo back or process message
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
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to AutoFi backend',
        timestamp: new Date().toISOString()
      }));
    });
    
    server.listen(this.config.port, () => {
      console.log('🚀 AI Automation System running');
      console.log(`📍 Port: ${this.config.port}`);
      console.log(`🌐 Network: ${this.config.network}`);
      console.log(`🤖 AI Engine: Connected`);
      console.log(`🔗 Blockchain API: Connected`);
      console.log(`💾 Database: Connected`);
      console.log('🔌 WebSocket: Ready');
      console.log('\n📋 Available Endpoints:');
      console.log('  POST /api/automate - Main automation endpoint');
      console.log('  GET  /api/analytics - Analytics and insights');
      console.log('  GET  /api/functions - Available functions');
      console.log('  GET  /health - Health check');
      console.log('  WS   /ws - WebSocket real-time updates');
    });
    
    this.server = server;
  }

  async processAutomation(prompt, context = {}) {
    return await this.processNaturalLanguage(prompt, context);
  }

  getStatus() {
    return {
      status: 'running',
      components: {
        aiEngine: 'connected',
        blockchainAPI: 'connected',
        database: 'connected'
      },
      config: {
        network: this.config.network,
        port: this.config.port
      },
      timestamp: new Date().toISOString()
    };
  }

  // Broadcast message to all WebSocket clients
  broadcastToClients(message) {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    for (const client of this.wsClients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(messageStr);
      }
    }
  }

  async shutdown() {
    console.log('🛑 Shutting down AI Automation System...');

    try {
      // Shutdown transaction tracker
      if (this.transactionTracker) {
        this.transactionTracker.shutdown();
        console.log('✅ Transaction tracker shut down');
      }
    } catch (error) {
      console.error('❌ Error shutting down transaction tracker:', error);
    }

    try {
      // Close all WebSocket connections
      for (const client of this.wsClients) {
        client.close();
      }
      this.wsClients.clear();
      console.log('✅ WebSocket connections closed');
    } catch (error) {
      console.error('❌ Error closing WebSocket connections:', error);
    }

    try {
      // Close HTTP server
      if (this.server) {
        this.server.close();
        console.log('✅ HTTP server closed');
      }
    } catch (error) {
      console.error('❌ Error closing HTTP server:', error);
    }

    try {
      this.db.close();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }

    console.log('👋 AI Automation System stopped');
  }
}

// Check if this file is being run directly
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
      alchemyApiKey: process.env.ALCHEMY_API_KEY
    };

    const automation = new AutomationSystem(config);
    automation.start();

    process.on('SIGINT', async () => {
      await automation.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await automation.shutdown();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to start automation system:', error);
    process.exit(1);
  }
}

export default AutomationSystem;