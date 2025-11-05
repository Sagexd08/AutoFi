import 'dotenv/config';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import logger from '../utils/logger.js';

// Configure LangSmith with proper API key
if (!process.env.LANGCHAIN_API_KEY && !process.env.LANGSMITH_API_KEY) {
  logger.warn('LangSmith API key not found in environment variables');
}
process.env.LANGCHAIN_API_KEY = process.env.LANGCHAIN_API_KEY || process.env.LANGSMITH_API_KEY;
process.env.LANGCHAIN_TRACING_V2 = "true";
process.env.LANGCHAIN_PROJECT = process.env.LANGCHAIN_PROJECT || process.env.LANGSMITH_PROJECT || "celo-automation";

export class LangChainAgent {
  constructor(config = {}) {
    this.config = {
      geminiApiKey: config.geminiApiKey || process.env.GEMINI_API_KEY,
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      model: config.model || 'gemini-1.5-flash',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
      ...config
    };

    this.llm = this.initializeLLM();
    this.tools = this.createTools();
    this.conversationHistory = [];
  }

  initializeLLM() {
    if (this.config.model.startsWith('gemini')) {
      if (!this.config.geminiApiKey) {
        throw new Error('Gemini API key is required for Gemini models');
      }
      return new ChatGoogleGenerativeAI({
        model: this.config.model,
        apiKey: this.config.geminiApiKey,
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
      });
    } else if (this.config.model.startsWith('gpt')) {
      if (!this.config.openaiApiKey) {
        throw new Error('OpenAI API key is required for GPT models');
      }
      return new ChatOpenAI({
        model: this.config.model,
        apiKey: this.config.openaiApiKey,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });
    } else {
      throw new Error(`Unsupported model: ${this.config.model}`);
    }
  }

  createTools() {
    return [
      new DynamicStructuredTool({
        name: "get_wallet_balance",
        description: "Get the balance of a wallet address for a specific token",
        schema: z.object({
          address: z.string().describe("The wallet address to check"),
          tokenAddress: z.string().optional().describe("The token contract address (optional, defaults to CELO)")
        }),
        func: async ({ address, tokenAddress }) => {
          // This would integrate with your blockchain interface
          return `Balance check for ${address} - Token: ${tokenAddress || 'CELO'}`;
        }
      }),
      new DynamicStructuredTool({
        name: "execute_transaction",
        description: "Execute a blockchain transaction",
        schema: z.object({
          to: z.string().describe("Recipient address"),
          value: z.string().describe("Amount to send"),
          tokenAddress: z.string().optional().describe("Token contract address (optional for CELO)"),
          data: z.string().optional().describe("Transaction data (optional)")
        }),
        func: async ({ to, value, tokenAddress, data }) => {
          // This would integrate with your transaction execution logic
          return `Transaction prepared: Send ${value} to ${to}`;
        }
      }),
      new DynamicStructuredTool({
        name: "get_token_info",
        description: "Get information about a specific token",
        schema: z.object({
          tokenAddress: z.string().describe("The token contract address")
        }),
        func: async ({ tokenAddress }) => {
          // This would fetch token metadata
          return `Token info for ${tokenAddress}`;
        }
      })
    ];
  }

  async processMessage(message, context = {}) {
    try {
      // Add message to conversation history
      this.conversationHistory.push(new HumanMessage(message));

      // Create prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        new SystemMessage(`You are an AI agent specialized in Celo blockchain operations. 
        You can help users with wallet management, token operations, and transaction execution.
        Always provide accurate and helpful responses about blockchain operations.
        
        Available tools: ${this.tools.map(tool => tool.name).join(', ')}
        
        Context: ${JSON.stringify(context, null, 2)}`),
        new MessagesPlaceholder("chat_history"),
        new HumanMessage("{input}")
      ]);

      // Create chain
      const chain = prompt.pipe(this.llm);

      // Invoke with tools
      const response = await chain.invoke({
        input: message,
        chat_history: this.conversationHistory.slice(-10) // Keep last 10 messages
      });

      // Add response to history
      this.conversationHistory.push(new AIMessage(response.content));

      return {
        success: true,
        response: response.content,
        tools: this.tools.map(tool => ({
          name: tool.name,
          description: tool.description
        }))
      };

    } catch (error) {
      console.error('Error processing message:', error);
      return {
        success: false,
        error: error.message,
        response: "I encountered an error processing your request. Please try again."
      };
    }
  }

  async executeTool(toolName, parameters) {
    try {
      const tool = this.tools.find(t => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      const result = await tool.func(parameters);
      return {
        success: true,
        result: result
      };
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getConversationHistory() {
    return this.conversationHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  getAvailableTools() {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      schema: tool.schema
    }));
  }
}

export default LangChainAgent;
