/**
 * Custom ML-based Agent
 * No external LLM dependencies (Gemini, OpenAI, Anthropic, etc.)
 * Uses heuristic-based decision making with contextual memory
 */

import type { AgentConfig } from '@celo-automator/types';
import { BufferMemory } from './memory.js';
import { createTools } from './tools.js';
import type { CeloClient } from '@celo-automator/celo-functions';

export interface LangChainAgentConfig extends AgentConfig {
  celoClient?: CeloClient;
}

/**
 * Custom ML model for decision making
 * Uses pattern matching and heuristic scoring
 */
class CustomMLModel {
  private name: string = 'custom-ml-v1';

  /**
   * Make decision based on input and context
   * Uses internal heuristics instead of external LLM
   */
  async decide(prompt: string, context: Record<string, any> = {}): Promise<string> {
    // Score-based decision making using contextual analysis
    const scores = this.scoreDecision(prompt, context);
    const decision = this.selectBestOption(scores);
    return decision;
  }

  private scoreDecision(prompt: string, context: Record<string, any>): Record<string, number> {
    const scores: Record<string, number> = {
      approve: 0,
      deny: 0,
      review: 0,
    };

    const normalizedPrompt = prompt.toLowerCase();

    // Pattern matching for approval signals
    if (/approve|confirm|execute|proceed|yes|continue/i.test(normalizedPrompt)) {
      scores.approve += 0.7;
    }

    // Pattern matching for denial signals
    if (/deny|reject|cancel|stop|no|block|disable/i.test(normalizedPrompt)) {
      scores.deny += 0.7;
    }

    // Context-based scoring
    if (context.riskLevel === 'low') scores.approve += 0.3;
    if (context.riskLevel === 'medium') scores.review += 0.4;
    if (context.riskLevel === 'high') scores.deny += 0.4;
    if (context.riskLevel === 'critical') scores.deny += 0.8;

    // Historical context
    if (context.userTrustScore && context.userTrustScore > 0.7) {
      scores.approve += 0.2;
    }

    return scores;
  }

  private selectBestOption(scores: Record<string, number>): string {
    const maxScore = Math.max(...Object.values(scores));
    const decision = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'review';
    return decision;
  }

  getName(): string {
    return this.name;
  }
}

export class LangChainAgent {
  private llm: CustomMLModel;
  private memory: BufferMemory;
  private tools: ReturnType<typeof createTools>;
  private config: LangChainAgentConfig;

  constructor(config: LangChainAgentConfig) {
    this.config = config;
    this.llm = new CustomMLModel();
    this.memory = new BufferMemory();
    this.tools = createTools(config.celoClient);
  }

  getLLM(): CustomMLModel {
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
