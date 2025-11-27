import type { LangChainAgent } from '@celo-automator/langchain-agent';
import type { RiskEngine, TransactionContext, ValidationResult } from '@celo-ai/risk-engine';
import type {
  SpecializedAgent,
  SpecializedAgentConfig,
  ProcessPromptOptions,
  AgentResponse,
} from './types.js';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';

export abstract class BaseAgent implements SpecializedAgent {
  protected config: SpecializedAgentConfig;
  protected riskEngine: RiskEngine;
  protected langchainAgent: LangChainAgent;

  constructor(config: SpecializedAgentConfig) {
    this.config = config;
    this.riskEngine = config.riskEngine;
    this.langchainAgent = config.langchainAgent;
  }

  getConfig(): SpecializedAgentConfig {
    return this.config;
  }

  async processPrompt(
    prompt: string,
    options?: ProcessPromptOptions
  ): Promise<AgentResponse> {
    const fullPrompt = this.buildPrompt(prompt, options?.context);
    const llm = this.langchainAgent.getLLM();

    const systemPrompt = SystemMessagePromptTemplate.fromTemplate(
      this.getSystemPrompt()
    );
    const humanPrompt = HumanMessagePromptTemplate.fromTemplate('{input}');

    const chatPrompt = ChatPromptTemplate.fromMessages([
      systemPrompt,
      humanPrompt,
    ]);

    const chain = chatPrompt.pipe(llm);
    const response = await chain.invoke({ input: fullPrompt });

    const reasoning = response.content as string;
    const plan = this.parsePlan(reasoning);
    const riskSummary = await this.assessRisk(
      options?.proposedTransactions || []
    );

    return {
      agentId: this.config.id,
      type: this.config.type,
      reasoning,
      plan,
      riskSummary: {
        aggregateScore: riskSummary.aggregateScore,
        evaluations: riskSummary.evaluations,
      },
      recommendations: riskSummary.recommendations,
      telemetry: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  protected abstract getSystemPrompt(): string;

  protected buildPrompt(prompt: string, context?: Record<string, unknown>): string {
    let fullPrompt = prompt;

    if (this.config.promptPreamble) {
      fullPrompt = `${this.config.promptPreamble}\n\n${fullPrompt}`;
    }

    if (context) {
      fullPrompt = `${fullPrompt}\n\nContext: ${JSON.stringify(context, null, 2)}`;
    }

    if (this.config.objectives && this.config.objectives.length > 0) {
      fullPrompt = `${fullPrompt}\n\nObjectives:\n${this.config.objectives
        .map((obj, i) => `${i + 1}. ${obj}`)
        .join('\n')}`;
    }

    return fullPrompt;
  }

  protected parsePlan(reasoning: string): Record<string, unknown> {
    try {
      const jsonMatch = reasoning.match(/```json\n([\s\S]*?)\n```/) || reasoning.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      const directJson = JSON.parse(reasoning);
      return directJson;
    } catch {
      return {
        reasoning,
        steps: reasoning.split('\n').filter((line) => line.trim().length > 0),
      };
    }
  }

  protected async assessRisk(
    transactions: TransactionContext[]
  ): Promise<{
    aggregateScore: number;
    evaluations: ValidationResult[];
    recommendations: string[];
  }> {
    if (transactions.length === 0) {
      return {
        aggregateScore: 0,
        evaluations: [],
        recommendations: [],
      };
    }

    const evaluations: ValidationResult[] = [];
    const recommendations: string[] = [];

    for (const tx of transactions) {
      const result = await this.riskEngine.validateTransaction(tx);
      evaluations.push(result);

      if (!result.isValid) {
        recommendations.push(...result.recommendations);
      }

      if (result.warnings.length > 0) {
        recommendations.push(...result.warnings);
      }
    }

    const aggregateScore =
      evaluations.reduce((sum, evaluation) => sum + evaluation.riskScore, 0) /
      evaluations.length;

    return {
      aggregateScore,
      evaluations,
      recommendations: [...new Set(recommendations)],
    };
  }
}
