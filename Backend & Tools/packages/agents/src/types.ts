import type { RiskEngine } from '@celo-ai/risk-engine';
import type { LangChainAgent } from '@celo-automator/langchain-agent';
import type { TransactionContext, ValidationResult } from '@celo-ai/risk-engine';

export type SpecializedAgentType = 'treasury' | 'defi' | 'nft' | 'governance' | 'donation';

export interface SpecializedAgentConfig {
  id: string;
  type: SpecializedAgentType;
  name: string;
  description?: string;
  objectives?: string[];
  langchainAgent: LangChainAgent;
  riskEngine: RiskEngine;
  promptPreamble?: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessPromptOptions {
  context?: Record<string, unknown>;
  proposedTransactions?: TransactionContext[];
}

export interface AgentResponse {
  agentId: string;
  type: SpecializedAgentType;
  reasoning: string;
  plan: Record<string, unknown>;
  riskSummary: {
    aggregateScore: number;
    evaluations: ValidationResult[];
  };
  recommendations: string[];
  telemetry?: Record<string, unknown>;
}

export interface AgentFactoryConfig {
  baseAgent: LangChainAgent;
  riskEngine: RiskEngine;
  defaults?: Partial<Pick<SpecializedAgentConfig, 'description' | 'objectives' | 'metadata'>>;
  templates?: Partial<Record<SpecializedAgentType, AgentTemplateOverrides>>;
}

export interface AgentTemplateOverrides {
  promptPreamble?: string;
  objectives?: string[];
  metadata?: Record<string, unknown>;
}

export type SpecializedAgent = {
  getConfig(): SpecializedAgentConfig;
  processPrompt(prompt: string, options?: ProcessPromptOptions): Promise<AgentResponse>;
};

export interface AgentTemplate {
  type: SpecializedAgentType;
  name: string;
  description: string;
  promptPreamble: string;
  objectives: string[];
}
