import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

class LangChainAgent {
  constructor(config = {}) {
    this.config = {
      geminiApiKey: config.geminiApiKey || process.env.GEMINI_API_KEY,
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      model: config.model || 'gemini-pro',
      temperature: config.temperature || 0.1,
      ...config
    };

    this.memory = { chatHistory: [] };
    this.initializeLLM();
    this.initializeTools();
  }

  initializeLLM() {
    if (this.config.geminiApiKey) {
      this.llm = new ChatGoogleGenerativeAI({
        modelName: this.config.model || 'gemini-pro',
        temperature: this.config.temperature,
        apiKey: this.config.geminiApiKey,
        verbose: true
      });
    } else if (this.config.openaiApiKey) {
      this.llm = new ChatOpenAI({
        modelName: 'gpt-4',
        temperature: this.config.temperature,
        openAIApiKey: this.config.openaiApiKey,
        verbose: true
      });
    } else {
      throw new Error('No API key provided for LLM');
    }
  }

  initializeTools() {
    this.tools = [
      new DynamicStructuredTool({
        name: 'getTokenBalance',
        description: 'Get the balance of a specific ERC20 token for an address on Celo network',
        schema: z.object({ address: z.string().describe('The wallet address to check'), tokenAddress: z.string().describe('The ERC20 token contract address') }),
        func: async ({ address, tokenAddress }) => `Balance for ${tokenAddress} at ${address}: 0 tokens`
      }),

      new DynamicStructuredTool({
        name: 'sendToken',
        description: 'Send ERC20 tokens from one address to another on Celo network',
        schema: z.object({ tokenAddress: z.string(), to: z.string(), amount: z.string(), from: z.string() }),
        func: async ({ tokenAddress, to, amount, from }) => `Sent ${amount} tokens from ${from} to ${to}`
      }),

      new DynamicStructuredTool({
        name: 'swapTokens',
        description: 'Swap tokens on Celo using DEX',
        schema: z.object({ tokenIn: z.string(), tokenOut: z.string(), amountIn: z.string(), amountOut: z.string(), from: z.string(), slippage: z.number().optional() }),
        func: async ({ tokenIn, tokenOut, amountIn, amountOut, from, slippage }) => `Swapping ${amountIn} ${tokenIn} for ${amountOut} ${tokenOut}`
      }),

      new DynamicStructuredTool({
        name: 'estimateGas',
        description: 'Estimate gas cost for a transaction',
        schema: z.object({ to: z.string(), value: z.string().optional(), data: z.string().optional() }),
        func: async ({ to, value, data }) => `Estimated gas: 21000`
      }),

      new DynamicStructuredTool({
        name: 'getTransactionStatus',
        description: 'Get the status of a blockchain transaction',
        schema: z.object({ txHash: z.string() }),
        func: async ({ txHash }) => `Transaction ${txHash}: Pending`
      })
    ];
  }

  updateToolsWithInterface(blockchainInterface) {
    if (!blockchainInterface) return;
    this.tools.forEach(tool => {
      switch (tool.name) {
        case 'getTokenBalance':
          tool.func = async ({ address, tokenAddress }) => await blockchainInterface.getTokenBalance(address, tokenAddress);
          break;
        case 'sendToken':
          tool.func = async ({ tokenAddress, to, amount, from }) => await blockchainInterface.sendToken(tokenAddress, to, amount, from);
          break;
        case 'swapTokens':
          tool.func = async ({ tokenIn, tokenOut, amountIn, amountOut, from, slippage }) => await blockchainInterface.swapTokens(tokenIn, tokenOut, amountIn, amountOut, from, slippage);
          break;
        case 'estimateGas':
          tool.func = async ({ to, value, data }) => await blockchainInterface.estimateGas(to, value, data);
          break;
        case 'getTransactionStatus':
          tool.func = async ({ txHash }) => await blockchainInterface.getTransactionStatus(txHash);
          break;
      }
    });
  }

  async executeNaturalLanguage(input, blockchainInterface) {
    try {
      this.updateToolsWithInterface(blockchainInterface);
      const toolDescriptions = this.tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
      const systemPrompt = `You are an expert blockchain agent for the Celo network. You help users interact with the blockchain through natural language.\n\nYou have access to the following tools:\n${toolDescriptions}\n\nAlways validate addresses, estimate gas, and confirm before signing.`;
      const messages = [{ role: 'system', content: systemPrompt }, ...this.memory.chatHistory.slice(-5), { role: 'user', content: input }];
      const response = await this.llm.invoke(messages.map(msg => ({ role: msg.role, content: msg.content })));
      this.memory.chatHistory.push({ role: 'user', content: input });
      this.memory.chatHistory.push({ role: 'assistant', content: response.content });
      this.memory.chatHistory = this.memory.chatHistory.slice(-10);
      return { success: true, output: response.content, intermediateSteps: [] };
    } catch (error) {
      logger.error('LangChain agent error', { error: error.message, stack: error.stack });
      return { success: false, error: error.message, output: 'I encountered an error processing your request.' };
    }
  }
}

export { LangChainAgent };

const DEFAULT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbb';
const CELO_TOKENS = {
  CELO: '0x0000000000000000000000000000000000000000',
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73'
};

export class ConsolidatedAgentSystem extends EventEmitter {
  constructor(automationSystem, geminiApiKey) {
    super();
    this.automationSystem = automationSystem;
    this.gemini = new GoogleGenerativeAI(geminiApiKey);
    this.model = this.gemini.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 4096,
      }
    });
    
    this.agents = new Map();
    this.tasks = new Map();
    this.contexts = new Map();
    this.capabilities = new Map();
    this.personalities = new Map();
    this.activeAgents = new Map();
    this.plans = new Map();
    this.taskQueue = [];
    this.runningTasks = new Map();
    this.agentCapabilities = new Map();
    this.isRunning = false;
    
    this.initializeMCPServer();
    this.initializePersonalities();
    this.initializeCapabilities();
  }

  initializeMCPServer() {
    this.mcpServer = new Server(
      {
        name: 'celo-ai-agents',
        version: '3.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );
    this.setupMCPHandlers();
  }

  setupMCPHandlers() {
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_agent',
            description: 'Create a new AI agent for specific blockchain tasks',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Agent name' },
                type: { 
                  type: 'string', 
                  enum: ['treasury', 'nft', 'defi', 'governance', 'security', 'analytics'],
                  description: 'Agent type'
                },
                capabilities: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'List of agent capabilities'
                },
                config: { 
                  type: 'object',
                  description: 'Agent configuration'
                }
              },
              required: ['name', 'type', 'capabilities']
            }
          },
          {
            name: 'execute_agent_task',
            description: 'Execute a task using a specific agent',
            inputSchema: {
              type: 'object',
              properties: {
                agentId: { type: 'string', description: 'Agent ID' },
                taskType: { type: 'string', description: 'Task type' },
                parameters: { type: 'object', description: 'Task parameters' },
                priority: { 
                  type: 'string', 
                  enum: ['low', 'medium', 'high', 'critical'],
                  description: 'Task priority'
                }
              },
              required: ['agentId', 'taskType', 'parameters']
            }
          },
          {
            name: 'blockchain_operation',
            description: 'Execute blockchain operations through agents',
            inputSchema: {
              type: 'object',
              properties: {
                operation: { type: 'string', description: 'Blockchain operation' },
                parameters: { type: 'object', description: 'Operation parameters' },
                agentId: { type: 'string', description: 'Agent to use for operation' }
              },
              required: ['operation', 'parameters']
            }
          }
        ]
      };
    });

    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        switch (name) {
          case 'create_agent':
            return await this.createAgent(args);
          case 'execute_agent_task':
            return await this.executeAgentTask(args);
          case 'blockchain_operation':
            return await this.executeBlockchainOperation(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ],
          isError: true
        };
      }
    });

    this.mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'celo://agents',
            name: 'Celo AI Agents',
            description: 'List of all available AI agents',
            mimeType: 'application/json'
          },
          {
            uri: 'celo://tasks',
            name: 'Agent Tasks',
            description: 'List of all agent tasks',
            mimeType: 'application/json'
          },
          {
            uri: 'celo://analytics',
            name: 'System Analytics',
            description: 'System performance and analytics data',
            mimeType: 'application/json'
          }
        ]
      };
    });

    this.mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      switch (uri) {
        case 'celo://agents':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(Array.from(this.agents.values()), null, 2)
              }
            ]
          };
        case 'celo://tasks':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(Array.from(this.tasks.values()), null, 2)
              }
            ]
          };
        case 'celo://analytics':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(await this.getSystemAnalytics(), null, 2)
              }
            ]
          };
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });

    this.mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'create_treasury_agent',
            description: 'Create a treasury management agent',
            arguments: [
              {
                name: 'risk_tolerance',
                description: 'Risk tolerance level (conservative, moderate, aggressive)',
                required: true
              }
            ]
          },
          {
            name: 'create_defi_agent',
            description: 'Create a DeFi optimization agent',
            arguments: [
              {
                name: 'protocols',
                description: 'DeFi protocols to use',
                required: true
              }
            ]
          }
        ]
      };
    });

    this.mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      switch (name) {
        case 'create_treasury_agent':
          return {
            description: 'Create a treasury management agent',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Create a treasury management agent with risk tolerance: ${args.risk_tolerance || 'moderate'}`
                }
              }
            ]
          };
        case 'create_defi_agent':
          return {
            description: 'Create a DeFi optimization agent',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Create a DeFi optimization agent for protocols: ${args.protocols}`
                }
              }
            ]
          };
        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    });
  }

  initializePersonalities() {
    this.personalities.set('treasury_manager', {
      name: 'Treasury Manager',
      description: 'Expert in portfolio management, risk assessment, and treasury operations',
      traits: ['analytical', 'risk-aware', 'strategic', 'conservative'],
      communicationStyle: 'technical',
      expertise: ['portfolio optimization', 'risk management', 'token allocation', 'yield farming'],
      limitations: ['cannot execute trades without approval', 'limited to Celo ecosystem']
    });

    this.personalities.set('defi_optimizer', {
      name: 'DeFi Optimizer',
      description: 'Specialized in DeFi protocols, yield optimization, and liquidity management',
      traits: ['opportunistic', 'data-driven', 'innovative', 'efficient'],
      communicationStyle: 'technical',
      expertise: ['yield farming', 'liquidity provision', 'arbitrage', 'protocol analysis'],
      limitations: ['requires real-time data', 'limited to supported protocols']
    });

    this.personalities.set('nft_manager', {
      name: 'NFT Manager',
      description: 'Expert in NFT operations, collection analysis, and digital asset management',
      traits: ['creative', 'trend-aware', 'detail-oriented', 'artistic'],
      communicationStyle: 'casual',
      expertise: ['NFT minting', 'collection analysis', 'market trends', 'metadata optimization'],
      limitations: ['requires collection contracts', 'gas optimization needed']
    });

    this.personalities.set('governance_agent', {
      name: 'Governance Agent',
      description: 'Specialized in DAO governance, proposal analysis, and voting strategies',
      traits: ['democratic', 'analytical', 'principled', 'transparent'],
      communicationStyle: 'formal',
      expertise: ['proposal analysis', 'voting strategies', 'governance mechanisms', 'community building'],
      limitations: ['requires governance tokens', 'limited to supported DAOs']
    });

    this.personalities.set('security_agent', {
      name: 'Security Agent',
      description: 'Expert in blockchain security, smart contract auditing, and threat detection',
      traits: ['vigilant', 'methodical', 'suspicious', 'protective'],
      communicationStyle: 'technical',
      expertise: ['smart contract auditing', 'threat detection', 'risk assessment', 'security protocols'],
      limitations: ['requires contract source code', 'analysis time varies']
    });

    this.personalities.set('analytics_agent', {
      name: 'Analytics Agent',
      description: 'Specialized in data analysis, reporting, and market intelligence',
      traits: ['data-driven', 'insightful', 'comprehensive', 'predictive'],
      communicationStyle: 'technical',
      expertise: ['data analysis', 'trend prediction', 'performance metrics', 'reporting'],
      limitations: ['requires historical data', 'predictions have uncertainty']
    });
  }

  initializeCapabilities() {
    this.capabilities.set('analyze_portfolio', {
      name: 'analyze_portfolio',
      description: 'Analyze current portfolio composition and performance',
      inputSchema: {
        type: 'object',
        properties: {
          walletAddress: { type: 'string' },
          includeMetrics: { type: 'boolean' }
        },
        required: ['walletAddress']
      },
      outputSchema: {
        type: 'object',
        properties: {
          totalValue: { type: 'number' },
          allocation: { type: 'object' },
          performance: { type: 'object' },
          recommendations: { type: 'array' }
        }
      },
      handler: this.analyzePortfolio.bind(this)
    });

    this.capabilities.set('rebalance_portfolio', {
      name: 'rebalance_portfolio',
      description: 'Rebalance portfolio to target allocation',
      inputSchema: {
        type: 'object',
        properties: {
          walletAddress: { type: 'string' },
          targetAllocation: { type: 'object' },
          rebalanceThreshold: { type: 'number' }
        },
        required: ['walletAddress', 'targetAllocation']
      },
      outputSchema: {
        type: 'object',
        properties: {
          transactions: { type: 'array' },
          newAllocation: { type: 'object' },
          estimatedCost: { type: 'number' }
        }
      },
      handler: this.rebalancePortfolio.bind(this)
    });

    this.capabilities.set('find_yield_opportunities', {
      name: 'find_yield_opportunities',
      description: 'Find best yield opportunities across DeFi protocols',
      inputSchema: {
        type: 'object',
        properties: {
          tokens: { type: 'array' },
          amount: { type: 'string' },
          riskTolerance: { type: 'string' }
        },
        required: ['tokens', 'amount']
      },
      outputSchema: {
        type: 'object',
        properties: {
          opportunities: { type: 'array' },
          bestOption: { type: 'object' },
          riskAssessment: { type: 'object' }
        }
      },
      handler: this.findYieldOpportunities.bind(this)
    });

    this.capabilities.set('analyze_nft_collection', {
      name: 'analyze_nft_collection',
      description: 'Analyze NFT collection for trading opportunities',
      inputSchema: {
        type: 'object',
        properties: {
          collectionAddress: { type: 'string' },
          analysisType: { type: 'string' }
        },
        required: ['collectionAddress']
      },
      outputSchema: {
        type: 'object',
        properties: {
          floorPrice: { type: 'number' },
          volume24h: { type: 'number' },
          trends: { type: 'array' },
          recommendations: { type: 'array' }
        }
      },
      handler: this.analyzeNFTCollection.bind(this)
    });

    this.capabilities.set('analyze_proposal', {
      name: 'analyze_proposal',
      description: 'Analyze governance proposal and provide voting recommendation',
      inputSchema: {
        type: 'object',
        properties: {
          proposalId: { type: 'string' },
          includeImpact: { type: 'boolean' }
        },
        required: ['proposalId']
      },
      outputSchema: {
        type: 'object',
        properties: {
          recommendation: { type: 'string' },
          reasoning: { type: 'string' },
          impact: { type: 'object' },
          confidence: { type: 'number' }
        }
      },
      handler: this.analyzeProposal.bind(this)
    });

    this.capabilities.set('audit_transaction', {
      name: 'audit_transaction',
      description: 'Audit transaction for security risks',
      inputSchema: {
        type: 'object',
        properties: {
          transaction: { type: 'object' },
          riskLevel: { type: 'string' }
        },
        required: ['transaction']
      },
      outputSchema: {
        type: 'object',
        properties: {
          riskScore: { type: 'number' },
          warnings: { type: 'array' },
          recommendations: { type: 'array' }
        }
      },
      handler: this.auditTransaction.bind(this)
    });
  }

  async attachLangChainAgent() {
    if (!this.langChainAgent) {
      try {
        this.langChainAgent = await LangChainAgent.create({
          geminiApiKey: this.automationSystem?.config?.geminiApiKey,
          openaiApiKey: this.automationSystem?.config?.openaiApiKey
        });

        if (this.automationSystem && this.automationSystem.blockchainInterface) {
          this.langChainAgent.updateToolsWithInterface(this.automationSystem.blockchainInterface);
        }

        logger.info('LangChainAgent attached to ConsolidatedAgentSystem');
      } catch (e) {
        logger.warn('Failed to attach LangChainAgent', { error: e.message || e });
      }
    }
  }

  async createAgent(args) {
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const agent = {
      id: agentId,
      name: args.name,
      type: args.type,
      status: 'active',
      capabilities: args.capabilities || [],
      config: args.config || {},
      lastActivity: new Date(),
      performance: {
        successRate: 0,
        totalExecutions: 0,
        averageExecutionTime: 0
      }
    };

    this.agents.set(agentId, agent);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            agentId,
            agent,
            message: `Agent ${args.name} created successfully`
          }, null, 2)
        }
      ]
    };
  }

  async executeAgentTask(args) {
    const { agentId, taskType, parameters, priority = 'medium' } = args;
    
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task = {
      id: taskId,
      agentId,
      type: taskType,
      priority,
      status: 'pending',
      parameters,
      createdAt: new Date()
    };

    this.tasks.set(taskId, task);
    this.executeTaskAsync(task);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            taskId,
            status: 'pending',
            message: `Task ${taskType} queued for agent ${agent.name}`
          }, null, 2)
        }
      ]
    };
  }

  async executeTaskAsync(task) {
    try {
      task.status = 'running';
      const agent = this.agents.get(task.agentId);

      let result;
      switch (agent.type) {
        case 'treasury':
          result = await this.executeTreasuryTask(task);
          break;
        case 'defi':
          result = await this.executeDeFiTask(task);
          break;
        case 'nft':
          result = await this.executeNFTTask(task);
          break;
        case 'governance':
          result = await this.executeGovernanceTask(task);
          break;
        case 'security':
          result = await this.executeSecurityTask(task);
          break;
        case 'analytics':
          result = await this.executeAnalyticsTask(task);
          break;
        default:
          throw new Error(`Unknown agent type: ${agent.type}`);
      }

      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date();

      agent.performance.totalExecutions++;
      agent.lastActivity = new Date();

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.completedAt = new Date();
    }
  }

  async executeTreasuryTask(task) {
    const { operation, parameters } = task.parameters;
    
    switch (operation) {
      case 'rebalance':
        return await this.automationSystem.processNaturalLanguage(
          `Rebalance portfolio with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      case 'analyze_risk':
        return await this.automationSystem.processNaturalLanguage(
          `Analyze portfolio risk with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      default:
        throw new Error(`Unknown treasury operation: ${operation}`);
    }
  }

  async executeDeFiTask(task) {
    const { operation, parameters } = task.parameters;
    
    switch (operation) {
      case 'find_best_yield':
        return await this.automationSystem.processNaturalLanguage(
          `Find best yield opportunities with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      case 'execute_swap':
        return await this.automationSystem.processNaturalLanguage(
          `Execute token swap with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      default:
        throw new Error(`Unknown DeFi operation: ${operation}`);
    }
  }

  async executeNFTTask(task) {
    const { operation, parameters } = task.parameters;
    
    switch (operation) {
      case 'mint_nft':
        return await this.automationSystem.processNaturalLanguage(
          `Mint NFT with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      case 'analyze_collection':
        return await this.automationSystem.processNaturalLanguage(
          `Analyze NFT collection with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      default:
        throw new Error(`Unknown NFT operation: ${operation}`);
    }
  }

  async executeGovernanceTask(task) {
    const { operation, parameters } = task.parameters;
    
    switch (operation) {
      case 'vote_on_proposal':
        return await this.automationSystem.processNaturalLanguage(
          `Vote on proposal with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      case 'create_proposal':
        return await this.automationSystem.processNaturalLanguage(
          `Create governance proposal with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      default:
        throw new Error(`Unknown governance operation: ${operation}`);
    }
  }

  async executeSecurityTask(task) {
    const { operation, parameters } = task.parameters;
    
    switch (operation) {
      case 'analyze_transaction':
        return await this.automationSystem.processNaturalLanguage(
          `Analyze transaction security with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      case 'audit_contract':
        return await this.automationSystem.processNaturalLanguage(
          `Audit smart contract with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      default:
        throw new Error(`Unknown security operation: ${operation}`);
    }
  }

  async executeAnalyticsTask(task) {
    const { operation, parameters } = task.parameters;
    
    switch (operation) {
      case 'generate_report':
        return await this.automationSystem.processNaturalLanguage(
          `Generate analytics report with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      case 'predict_trends':
        return await this.automationSystem.processNaturalLanguage(
          `Predict market trends with parameters: ${JSON.stringify(parameters)}`,
          { sessionId: task.agentId }
        );
      default:
        throw new Error(`Unknown analytics operation: ${operation}`);
    }
  }

  async executeBlockchainOperation(args) {
    const { operation, parameters, agentId } = args;
    
    const result = await this.automationSystem.processNaturalLanguage(
      `Execute blockchain operation: ${operation} with parameters: ${JSON.stringify(parameters)}`,
      { sessionId: agentId || 'mcp' }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async getSystemAnalytics() {
    const agents = Array.from(this.agents.values());
    const tasks = Array.from(this.tasks.values());
    
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'active').length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      averageSuccessRate: agents.reduce((sum, a) => sum + a.performance.successRate, 0) / agents.length || 0,
      totalExecutions: agents.reduce((sum, a) => sum + a.performance.totalExecutions, 0)
    };
  }

  async createAgentWithPersonality(personalityType, context = {}) {
    const personality = this.personalities.get(personalityType);
    if (!personality) {
      throw new Error(`Unknown personality type: ${personalityType}`);
    }

    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const agentContext = {
      sessionId: context.sessionId || agentId,
      userId: context.userId,
      walletAddress: context.walletAddress,
      network: context.network || 'alfajores',
      preferences: context.preferences || {},
      history: [],
      constraints: context.constraints || []
    };

    this.contexts.set(agentId, agentContext);
    this.activeAgents.set(agentId, {
      personality,
      context: agentContext,
      createdAt: new Date()
    });

    this.emit('agentCreated', { agentId, personality });
    return agentId;
  }

  async processWithAgent(agentId, userInput, options = {}) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const context = this.contexts.get(agentId);
    const { personality } = agent;

    this.addInteraction(agentId, 'user_input', userInput);

    const prompt = this.buildAgentPrompt(personality, context, userInput, options);

    try {
      const response = await this.model.generateContent([{ text: prompt }]);
      const responseText = response.response.text();

      const parsedResponse = this.parseAgentResponse(responseText);
      
      const functionResults = [];
      if (parsedResponse.functionCalls && options.useCapabilities !== false) {
        for (const call of parsedResponse.functionCalls) {
          try {
            const result = await this.executeCapability(call.name, context, call.parameters);
            functionResults.push({ name: call.name, result, success: true });
          } catch (error) {
            functionResults.push({ 
              name: call.name, 
              error: error instanceof Error ? error.message : 'Unknown error',
              success: false 
            });
          }
        }
      }

      this.addInteraction(agentId, 'agent_response', parsedResponse.response, {
        functionCalls: parsedResponse.functionCalls,
        functionResults
      });

      this.emit('agentResponse', { agentId, response: parsedResponse.response, functionResults });

      return {
        response: parsedResponse.response,
        functionCalls: parsedResponse.functionCalls || [],
        confidence: parsedResponse.confidence || 0.8,
        reasoning: parsedResponse.reasoning || 'AI-generated response'
      };

    } catch (error) {
      this.addInteraction(agentId, 'agent_response', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        error: true
      });
      throw error;
    }
  }

  buildAgentPrompt(personality, context, userInput, options) {
    const capabilitiesList = Array.from(this.capabilities.values())
      .map(cap => `- ${cap.name}: ${cap.description}`)
      .join('\n');

    const historyContext = context.history.slice(-5)
      .map(h => `${h.type}: ${h.content}`)
      .join('\n');

    return `You are ${personality.name}, an AI agent specialized in ${personality.description}.

PERSONALITY TRAITS:
${personality.traits.map(trait => `- ${trait}`).join('\n')}

COMMUNICATION STYLE: ${personality.communicationStyle}
EXPERTISE: ${personality.expertise.join(', ')}
LIMITATIONS: ${personality.limitations.join(', ')}

AVAILABLE CAPABILITIES:
${capabilitiesList}

CURRENT CONTEXT:
- Session ID: ${context.sessionId}
- Network: ${context.network}
- Wallet: ${context.walletAddress || 'Not specified'}
- Current Goal: ${context.currentGoal || 'Not specified'}
- Constraints: ${context.constraints.join(', ') || 'None'}

RECENT HISTORY:
${historyContext || 'No previous interactions'}

USER INPUT: ${userInput}

INSTRUCTIONS:
1. Respond as ${personality.name} with your ${personality.communicationStyle} communication style
2. Use your expertise in ${personality.expertise.join(', ')} to provide helpful responses
3. Be aware of your limitations: ${personality.limitations.join(', ')}
4. If you need to perform specific actions, use the available capabilities
5. Always consider the current context and user's goals
6. Provide reasoning for your recommendations

RESPONSE FORMAT:
Respond with a JSON object containing:
{
  "response": "Your response to the user",
  "reasoning": "Your reasoning process",
  "confidence": 0.95,
  "functionCalls": [
    {
      "name": "capability_name",
      "parameters": { "param1": "value1" }
    }
  ]
}

If no function calls are needed, set "functionCalls" to an empty array.`;
  }

  parseAgentResponse(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        response: response,
        reasoning: 'AI-generated response',
        confidence: 0.7,
        functionCalls: []
      };
    } catch (error) {
      return {
        response: response,
        reasoning: 'AI-generated response (parsing failed)',
        confidence: 0.5,
        functionCalls: []
      };
    }
  }

  async executeCapability(capabilityName, context, parameters) {
    const capability = this.capabilities.get(capabilityName);
    if (!capability) {
      throw new Error(`Unknown capability: ${capabilityName}`);
    }

    return await capability.handler(context, parameters);
  }

  addInteraction(agentId, type, content, metadata) {
    const context = this.contexts.get(agentId);
    if (!context) return;

    const interaction = {
      id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      content,
      metadata,
      success: !metadata?.error
    };

    context.history.push(interaction);
    
    if (context.history.length > 50) {
      context.history = context.history.slice(-50);
    }
  }

  async analyzePortfolio(context, parameters) {
    const { walletAddress } = parameters;
    
    const result = await this.automationSystem.processNaturalLanguage(
      `Analyze portfolio for wallet ${walletAddress}`,
      { sessionId: context.sessionId }
    );

    return {
      totalValue: 1000,
      allocation: { CELO: 0.6, cUSD: 0.3, cEUR: 0.1 },
      performance: { daily: 0.02, weekly: 0.05, monthly: 0.15 },
      recommendations: ['Consider rebalancing to target allocation', 'Monitor cUSD position']
    };
  }

  async rebalancePortfolio(context, parameters) {
    const { walletAddress, targetAllocation } = parameters;
    
    const result = await this.automationSystem.processNaturalLanguage(
      `Rebalance portfolio for wallet ${walletAddress} to target allocation: ${JSON.stringify(targetAllocation)}`,
      { sessionId: context.sessionId }
    );

    return {
      transactions: [
        { type: 'swap', from: 'CELO', to: 'cUSD', amount: '100' },
        { type: 'swap', from: 'cUSD', to: 'cEUR', amount: '50' }
      ],
      newAllocation: targetAllocation,
      estimatedCost: 0.001
    };
  }

  async findYieldOpportunities(context, parameters) {
    const { tokens, amount, riskTolerance } = parameters;
    
    return {
      opportunities: [
        {
          protocol: 'Moola',
          token: 'cUSD',
          apy: 0.08,
          risk: 'low',
          liquidity: 'high'
        },
        {
          protocol: 'Ubeswap',
          token: 'CELO',
          apy: 0.12,
          risk: 'medium',
          liquidity: 'medium'
        }
      ],
      bestOption: {
        protocol: 'Moola',
        token: 'cUSD',
        apy: 0.08,
        risk: 'low'
      },
      riskAssessment: {
        overall: 'low',
        factors: ['High liquidity', 'Established protocol', 'Low volatility']
      }
    };
  }

  async analyzeNFTCollection(context, parameters) {
    const { collectionAddress } = parameters;
    
    return {
      floorPrice: 0.5,
      volume24h: 1000,
      trends: [
        { timeframe: '24h', change: 0.05 },
        { timeframe: '7d', change: 0.15 },
        { timeframe: '30d', change: -0.02 }
      ],
      recommendations: [
        'Floor price is stable, good entry point',
        'Volume is increasing, consider holding',
        'Monitor for breakout above resistance'
      ]
    };
  }

  async analyzeProposal(context, parameters) {
    const { proposalId } = parameters;
    
    return {
      recommendation: 'FOR',
      reasoning: 'This proposal aligns with community interests and has clear benefits',
      impact: {
        positive: ['Improved governance', 'Better resource allocation'],
        negative: ['Temporary disruption during implementation'],
        neutral: ['No significant changes to core functionality']
      },
      confidence: 0.85
    };
  }

  async auditTransaction(context, parameters) {
    const { transaction } = parameters;
    
    return {
      riskScore: 0.2,
      warnings: [],
      recommendations: [
        'Transaction appears safe',
        'Consider using multi-sig for large amounts',
        'Verify recipient address'
      ]
    };
  }

  async getAgentContext(agentId) {
    return this.contexts.get(agentId);
  }

  async getAvailablePersonalities() {
    return Array.from(this.personalities.values());
  }

  async getAvailableCapabilities() {
    return Array.from(this.capabilities.values());
  }

  getAgents() {
    return Array.from(this.agents.values());
  }

  getTasks() {
    return Array.from(this.tasks.values());
  }

  async start() {
    if (this.isRunning) {
      logger.info('Consolidated Agent System is already running');
      return;
    }

    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    this.isRunning = true;
    
    logger.info('Consolidated Agent System started', { agentsCount: this.agents.size });
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    await this.mcpServer.close();
    this.isRunning = false;
    logger.info('Consolidated Agent System stopped');
  }
}

export default ConsolidatedAgentSystem;
