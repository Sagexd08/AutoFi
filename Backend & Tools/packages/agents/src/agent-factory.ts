import type { LangChainAgent } from '@celo-automator/langchain-agent';
import type { RiskEngine } from '@celo-ai/risk-engine';
import {
  TreasuryAgent,
  DeFiAgent,
  NFTAgent,
  GovernanceAgent,
  DonationAgent,
} from './specialized-agents.js';
import type {
  SpecializedAgent,
  SpecializedAgentConfig,
  SpecializedAgentType,
  AgentFactoryConfig,
} from './types.js';

const DEFAULT_TEMPLATES: Record<SpecializedAgentType, { promptPreamble: string; objectives: string[] }> = {
  treasury: {
    promptPreamble: 'You are a Treasury Manager Agent specialized in portfolio management and rebalancing.',
    objectives: [
      'Monitor multi-token balances',
      'Detect portfolio imbalances',
      'Propose safe rebalancing strategies',
      'Enforce spending limits',
    ],
  },
  defi: {
    promptPreamble: 'You are a DeFi Strategist Agent focused on yield optimization across protocols.',
    objectives: [
      'Analyze yield opportunities',
      'Optimize lending and staking',
      'Manage liquidity positions',
      'Claim and compound rewards',
    ],
  },
  nft: {
    promptPreamble: 'You are an NFT Manager Agent handling minting, transfers, and collection management.',
    objectives: [
      'Mint NFTs based on conditions',
      'Transfer NFTs securely',
      'Manage metadata',
      'Handle batch operations',
    ],
  },
  governance: {
    promptPreamble: 'You are a Governance Participation Agent for Celo protocol governance.',
    objectives: [
      'Monitor governance proposals',
      'Analyze proposal impact',
      'Vote according to principles',
      'Delegate voting power strategically',
    ],
  },
  donation: {
    promptPreamble: 'You are a Donation Splitter Agent for automated charity processing.',
    objectives: [
      'Detect incoming donations',
      'Split donations to recipients',
      'Calculate split amounts',
      'Send acknowledgments',
    ],
  },
};

export class AgentFactory {
  private baseAgent: LangChainAgent;
  private riskEngine: RiskEngine;
  private defaults?: Partial<Pick<SpecializedAgentConfig, 'description' | 'objectives' | 'metadata'>>;
  private templates: Record<SpecializedAgentType, { promptPreamble: string; objectives: string[] }>;

  constructor(config: AgentFactoryConfig) {
    this.baseAgent = config.baseAgent;
    this.riskEngine = config.riskEngine;
    this.defaults = config.defaults;
    // Merge custom templates with defaults, ensuring required properties
    const mergedTemplates: Record<SpecializedAgentType, { promptPreamble: string; objectives: string[] }> = 
      { ...DEFAULT_TEMPLATES };
    if (config.templates) {
      for (const key of Object.keys(config.templates) as SpecializedAgentType[]) {
        const override = config.templates[key];
        if (override) {
          mergedTemplates[key] = {
            promptPreamble: override.promptPreamble ?? DEFAULT_TEMPLATES[key].promptPreamble,
            objectives: override.objectives ?? DEFAULT_TEMPLATES[key].objectives,
          };
        }
      }
    }
    this.templates = mergedTemplates;
  }

  create(
    type: SpecializedAgentType,
    config: Partial<SpecializedAgentConfig> & { id: string; name: string }
  ): SpecializedAgent {
    const template = this.templates[type];
    const fullConfig: SpecializedAgentConfig = {
      id: config.id,
      type,
      name: config.name,
      description: config.description ?? this.defaults?.description,
      objectives: config.objectives ?? template.objectives,
      langchainAgent: this.baseAgent,
      riskEngine: this.riskEngine,
      promptPreamble: config.promptPreamble ?? template.promptPreamble,
      metadata: {
        ...this.defaults?.metadata,
        ...config.metadata,
        createdAt: new Date().toISOString(),
      },
    };

    switch (type) {
      case 'treasury':
        return new TreasuryAgent(fullConfig);
      case 'defi':
        return new DeFiAgent(fullConfig);
      case 'nft':
        return new NFTAgent(fullConfig);
      case 'governance':
        return new GovernanceAgent(fullConfig);
      case 'donation':
        return new DonationAgent(fullConfig);
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }
}

export * from './types.js';
export * from './base-agent.js';
export * from './specialized-agents.js';
