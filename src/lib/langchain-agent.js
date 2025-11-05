/**
 * LangChain AI Agent System for Blockchain Automation
 * Integrates LangChain with Gemini to provide intelligent blockchain operations
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createPublicClient, createWalletClient, http as viem_http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';

const DEFAULT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbb';

const CELO_TOKENS = {
  CELO: '0x0000000000000000000000000000000000000000',
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
  cREAL: '0x00Be915B9dCf56a3CBE739D9B9c202ca692409EC'
};

export class LangChainAgent {
  /**
   * Static factory method to create and initialize a LangChainAgent instance
   * @param {Object} config - Configuration object
   * @returns {Promise<LangChainAgent>} Fully initialized agent instance
   */
  static async create(config = {}) {
    const instance = new LangChainAgent(config);
    await instance.initialize();
    return instance;
  }

  constructor(config = {}) {
    this.config = {
      geminiApiKey: config.geminiApiKey || process.env.GEMINI_API_KEY,
      privateKey: config.privateKey || process.env.PRIVATE_KEY,
      network: config.network || process.env.NETWORK || 'alfajores',
      rpcUrl: config.rpcUrl || process.env.RPC_URL || 'https://alfajores-forno.celo-testnet.org',
      enableRealTransactions: process.env.ENABLE_REAL_TRANSACTIONS === 'true',
      ...config
    };

    this.conversationHistory = [];
    this.publicClient = null;
    this.walletClient = null;
    this.llm = null;
    this.agent = null;
  }

  async initialize() {
    this.initializeBlockchainClients();
    this.initializeLLM();
    this.createTools();
    await this.createAgent();
  }

  initializeBlockchainClients() {
    try {
      // Create Viem clients for Celo network
      this.publicClient = createPublicClient({
        chain: celo,
        transport: viem_http(this.config.rpcUrl)
      });

      // Create wallet client if private key is provided
      if (this.config.privateKey && this.config.privateKey !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        try {
          // Validate private key format
          if (!this.config.privateKey.startsWith('0x')) {
            throw new Error('Private key must start with 0x');
          }
          if (this.config.privateKey.length !== 66) {
            throw new Error('Private key must be 66 characters long (0x + 64 hex characters)');
          }

          // Convert private key to account object
          const account = privateKeyToAccount(this.config.privateKey);
          
          this.walletClient = createWalletClient({
            chain: celo,
            transport: viem_http(this.config.rpcUrl),
            account
          });
          console.log('✅ Wallet client initialized');
        } catch (accountError) {
          console.error('❌ Failed to create account from private key:', accountError.message);
          console.warn('⚠️ Invalid private key - transaction execution disabled');
          this.walletClient = null;
        }
      } else {
        console.warn('⚠️ No valid private key provided - transaction execution disabled');
      }

      console.log('✅ Blockchain clients initialized');
    } catch (error) {
      console.error('❌ Failed to initialize blockchain clients:', error);
    }
  }

  initializeLLM() {
    try {
      this.llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.0-flash-exp',
        temperature: 0.1,
        maxTokens: 2048,
        apiKey: this.config.geminiApiKey
      });
      console.log('✅ LangChain LLM initialized');
    } catch (error) {
      console.error('❌ Failed to initialize LLM:', error);
      throw error;
    }
  }

  createTools() {
    // Define blockchain operation tools using LangChain
    this.tools = [
      // Get CELO balance
      new DynamicStructuredTool({
        name: 'getCELOBalance',
        description: 'Get the native CELO token balance for an address',
        schema: z.object({
          address: z.string().describe('The wallet address to check')
        }),
        func: async ({ address }) => {
          try {
            const balance = await this.publicClient.getBalance({
              address
            });
            return `Balance: ${formatEther(balance)} CELO`;
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      // Get token balance
      new DynamicStructuredTool({
        name: 'getTokenBalance',
        description: 'Get the balance of a specific ERC20 token for an address',
        schema: z.object({
          address: z.string().describe('The wallet address'),
          tokenAddress: z.string().describe('The token contract address')
        }),
        func: async ({ address, tokenAddress }) => {
          try {
            // ERC20 balanceOf ABI
            const abi = [{
              constant: true,
              inputs: [{ name: '_owner', type: 'address' }],
              name: 'balanceOf',
              outputs: [{ name: 'balance', type: 'uint256' }],
              type: 'function'
            }];

            const balance = await this.publicClient.readContract({
              address: tokenAddress,
              abi,
              functionName: 'balanceOf',
              args: [address]
            });

            return `Balance: ${formatEther(balance)} tokens`;
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      // Send CELO
      new DynamicStructuredTool({
        name: 'sendCELO',
        description: 'Send CELO tokens to an address',
        schema: z.object({
          to: z.string().describe('Recipient address'),
          amount: z.string().describe('Amount in CELO (e.g., "1.5" for 1.5 CELO)')
        }),
        func: async ({ to, amount }) => {
          if (!this.walletClient) {
            return 'Error: Wallet not configured';
          }

          try {
            const value = parseEther(amount);
            const hash = await this.walletClient.sendTransaction({
              to,
              value
            });
            return `Transaction sent: ${hash}`;
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      // Send token
      new DynamicStructuredTool({
        name: 'sendToken',
        description: 'Send ERC20 tokens to an address',
        schema: z.object({
          tokenAddress: z.string().describe('Token contract address'),
          to: z.string().describe('Recipient address'),
          amount: z.string().describe('Amount in tokens')
        }),
        func: async ({ tokenAddress, to, amount }) => {
          if (!this.walletClient) {
            return 'Error: Wallet not configured';
          }

          try {
            // ERC20 transfer ABI
            const abi = [{
              name: 'transfer',
              type: 'function',
              inputs: [
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' }
              ],
              outputs: [{ name: '', type: 'bool' }],
              stateMutability: 'nonpayable'
            }];

            const value = parseEther(amount);
            const hash = await this.walletClient.writeContract({
              address: tokenAddress,
              abi,
              functionName: 'transfer',
              args: [to, value]
            });

            return `Transaction sent: ${hash}`;
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      // Estimate gas
      new DynamicStructuredTool({
        name: 'estimateGas',
        description: 'Estimate gas cost for a transaction',
        schema: z.object({
          to: z.string().describe('Recipient address'),
          value: z.string().describe('Amount in wei (optional)'),
          data: z.string().describe('Transaction data (optional)')
        }),
        func: async ({ to, value = '0', data = '0x' }) => {
          try {
            const gas = await this.publicClient.estimateGas({
              to,
              value: BigInt(value),
              data
            });
            return `Estimated gas: ${gas.toString()}`;
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      // Get transaction status
      new DynamicStructuredTool({
        name: 'getTransactionStatus',
        description: 'Get the status of a transaction',
        schema: z.object({
          hash: z.string().describe('Transaction hash')
        }),
        func: async ({ hash }) => {
          try {
            const receipt = await this.publicClient.getTransactionReceipt({
              hash
            });
            return `Status: ${receipt.status === 'success' ? 'Success' : 'Failed'}, Block: ${receipt.blockNumber}`;
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      // Get network info
      new DynamicStructuredTool({
        name: 'getNetworkInfo',
        description: 'Get current network information',
        schema: z.object({}),
        func: async () => {
          try {
            const block = await this.publicClient.getBlockNumber();
            const gasPrice = await this.publicClient.getGasPrice();
            return `Network: ${this.config.network}, Block: ${block}, Gas Price: ${formatEther(gasPrice)} CELO`;
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      })
    ];
  }

  async createAgent() {
    try {
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', `You are an AI agent specialized in blockchain operations on the Celo network.

Your capabilities:
- Check balances for CELO and tokens
- Send CELO and tokens
- Estimate gas costs
- Check transaction status
- Get network information

Available tokens on Celo:
- CELO (native token)
- cUSD: ${CELO_TOKENS.cUSD}
- cEUR: ${CELO_TOKENS.cEUR}
- cREAL: ${CELO_TOKENS.cREAL}

Always validate addresses (must start with 0x and be 42 characters).
Use the appropriate tool for each operation.
Report results clearly to the user.`],
        ['human', '{input}'],
        new MessagesPlaceholder('agent_scratchpad')
      ]);

      this.agent = await createOpenAIFunctionsAgent({
        llm: this.llm,
        tools: this.tools,
        prompt
      });

      console.log('✅ LangChain agent created');
    } catch (error) {
      console.error('❌ Failed to create agent:', error);
      throw error;
    }
  }

  async process(input) {
    try {
      // Ensure agent is initialized before processing
      if (!this.agent) {
        // If agent is null, try to initialize it
        if (!this._initializationPromise) {
          this._initializationPromise = this.initialize();
        }
        await this._initializationPromise;
      }

      if (!this.agent) {
        throw new Error('Agent failed to initialize. Please check your configuration.');
      }

      const executor = new AgentExecutor({
        agent: this.agent,
        tools: this.tools,
        verbose: this.config.debug || false
      });

      const result = await executor.invoke({
        input,
        chat_history: this.conversationHistory
      });

      // Store in conversation history
      this.conversationHistory.push({
        role: 'human',
        content: input
      });
      this.conversationHistory.push({
        role: 'ai',
        content: result.output
      });

      // Keep history manageable
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      return {
        success: true,
        output: result.output,
        steps: result.steps || []
      };
    } catch (error) {
      console.error('Agent execution error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  getTools() {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description
    }));
  }
}

export default LangChainAgent;
