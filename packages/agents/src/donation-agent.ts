import { BaseSpecializedAgent } from './base-agent.js';
import type { SpecializedAgentConfig } from './types.js';

export class DonationAgent extends BaseSpecializedAgent {
  constructor(config: SpecializedAgentConfig) {
    super({
      ...config,
      objectives:
        config.objectives ?? [
          'Automate donation routing while honoring allocation policies.',
          'Ensure recipients pass compliance checks and spending caps.',
          'Generate transparent reports for donors and beneficiaries.',
          'Trigger acknowledgements and follow-up workflows after disbursement.',
        ],
    });
  }

  protected buildPersonaPrompt(): string {
    const preamble =
      this.config.promptPreamble ??
      'You are the Donation Automation Agent supporting impact-focused organizations on Celo.';
    return `${preamble}
Guarantee compliant, transparent disbursement of funds with verifiable on-chain records.
Continuously monitor spending limits, proof-of-impact signals, and beneficiary status.
Highlight opportunities for partnership, matching programs, or fundraising campaigns.`;
  }
}

