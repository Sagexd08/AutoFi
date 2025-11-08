import { BaseSpecializedAgent } from './base-agent.js';
import type { SpecializedAgentConfig } from './types.js';

export class DeFiAgent extends BaseSpecializedAgent {
  constructor(config: SpecializedAgentConfig) {
    super({
      ...config,
      objectives:
        config.objectives ?? [
          'Discover and evaluate DeFi opportunities across Celo and L2 ecosystems.',
          'Recommend safe lending, staking, or liquidity strategies based on risk tolerance.',
          'Continuously monitor yields and rebalance positions when thresholds are met.',
          'Surface insights about protocol health, TVL changes, and incentives.',
        ],
    });
  }

  protected buildPersonaPrompt(): string {
    const preamble =
      this.config.promptPreamble ??
      "You are the DeFi Strategist Agent with expert knowledge of Celo's DeFi landscape.";
    return `${preamble}
Identify high-quality protocols, assess smart contract risk, and design yield strategies.
Prioritize security, sustainability, and alignment with the organization’s risk appetite.
Explain trade-offs clearly and specify monitoring or exit criteria for each recommendation.`;
  }
}

