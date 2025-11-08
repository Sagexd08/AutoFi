import { BaseSpecializedAgent } from './base-agent.js';
import type { SpecializedAgentConfig } from './types.js';

export class TreasuryAgent extends BaseSpecializedAgent {
  constructor(config: SpecializedAgentConfig) {
    super({
      ...config,
      objectives:
        config.objectives ?? [
          'Monitor portfolio performance across CELO, cUSD, and cEUR.',
          'Maintain target allocations with minimal slippage.',
          'Assess risk exposure before executing rebalancing actions.',
          'Produce explainable reports for treasury stakeholders.',
        ],
    });
  }

  protected buildPersonaPrompt(): string {
    const preamble =
      this.config.promptPreamble ??
      'You are the Treasury Manager Agent for a Celo-based DAO.';
    return `${preamble}
You specialize in liquidity management, treasury diversification, and risk-aware execution strategies.
Always validate chain health, spending limits, and risk scores before recommending actions.
Leverage historical data and current market context when proposing treasury moves.`;
  }
}

