import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentConfig, AgentMemory } from '@celo-automator/types';
import { BufferMemory } from './memory.js';
import { createTools } from './tools.js';
import type { CeloClient } from '@celo-automator/celo-functions';

export interface LangChainAgentConfig extends AgentConfig {
  geminiApiKey?: string;
  openaiApiKey?: string;
  celoClient?: CeloClient;
}

export class LangChainAgent {
  private llm: BaseChatModel;
  private memory: BufferMemory;
  private tools: ReturnType<typeof createTools>;
  private config: LangChainAgentConfig;

  constructor(config: LangChainAgentConfig) {
    this.config = config;
    this.llm = this.initializeLLM(config);
    this.memory = new BufferMemory();
    this.tools = createTools(config.celoClient);
  }

  private initializeLLM(config: LangChainAgentConfig): BaseChatModel {
    if (config.model.startsWith('gemini')) {
      if (!config.geminiApiKey && !process.env.GEMINI_API_KEY) {
        throw new Error('Gemini API key is required for Gemini models');
      }
      return new ChatGoogleGenerativeAI({
        model: config.model,
        apiKey: config.geminiApiKey || process.env.GEMINI_API_KEY,
        temperature: config.temperature || 0.7,
        maxOutputTokens: config.maxTokens || 2000,
      });
    } else if (config.model.startsWith('gpt')) {
      if (!config.openaiApiKey && !process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is required for GPT models');
      }
      return new ChatOpenAI({
        model: config.model,
        apiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 2000,
      });
    } else {
      throw new Error(`Unsupported model: ${config.model}`);
    }
  }

  getLLM(): BaseChatModel {
    return this.llm;
  }

  getMemory(): BufferMemory {
    return this.memory;
  }

  getTools() {
    return this.tools;
  }

  updateCeloClient(client: CeloClient) {
    this.tools = createTools(client);
  }

  getConfig(): LangChainAgentConfig {
    return this.config;
  }
}
