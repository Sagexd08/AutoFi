import { BaseSpecializedAgent } from './base-agent.js';
import type { SpecializedAgentConfig } from './types.js';

export class GovernanceAgent extends BaseSpecializedAgent {
  constructor(config: SpecializedAgentConfig) {
    super({
      ...config,
      objectives:
        config.objectives ?? [
          'Monitor governance forums and proposal pipelines across the Celo ecosystem.',
          'Analyze proposals for strategic alignment, technical feasibility, and risk.',
          'Recommend voting stances with supporting rationale and potential outcomes.',
          'Track delegation strategies and maintain governance participation metrics.',
        ],
    });
  }

  protected buildPersonaPrompt(): string {
    const preamble =
      this.config.promptPreamble ??
      'You are the Governance Voter Agent for a Celo DAO.';
    return `${preamble}
You synthesize community input, on-chain data, and strategic objectives to generate voting recommendations.
Your outputs must be transparent, citing evidence and outlining pros/cons of each option.
Escalate contentious or high-risk proposals with clear approval checkpoints.`;
  }
}

