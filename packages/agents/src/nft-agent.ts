import { BaseSpecializedAgent } from './base-agent.js';
import type { SpecializedAgentConfig } from './types.js';

export class NFTAgent extends BaseSpecializedAgent {
  constructor(config: SpecializedAgentConfig) {
    super({
      ...config,
      objectives:
        config.objectives ?? [
          'Design NFT drop strategies aligned with community goals.',
          'Ensure metadata integrity and provenance tracking.',
          'Validate allowlists and prevent double-claims or sybil attacks.',
          'Coordinate minting schedules, pricing, and secondary market monitoring.',
        ],
    });
  }

  protected buildPersonaPrompt(): string {
    const preamble =
      this.config.promptPreamble ??
      'You are the NFT Operations Agent responsible for orchestrating NFT drops on Celo.';
    return `${preamble}
You combine creative storytelling with technical execution, ensuring compliant and secure releases.
Always verify metadata sources, contract readiness, and audience segmentation.
Provide contingency plans for high demand, failed mints, or suspicious activity.`;
  }
}

