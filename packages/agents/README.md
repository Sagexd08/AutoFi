# @celo-ai/agents

Collection of domain-specific LangChain agents used by the Celo AI automation backend. Agents extend a shared base with consistent reasoning, risk analysis, and tool invocation semantics.

## Available Agents

- **TreasuryAgent** – monitors and rebalances treasury portfolios, enforces spending limits, and produces treasury reports.
- **DeFiAgent** – orchestrates lending, staking, and liquidity strategies with protocol-specific tool calls.
- **NFTAgent** – handles NFT minting campaigns, drop scheduling, and metadata generation.
- **GovernanceAgent** – analyzes governance proposals, drafts rationales, and executes votes or delegations.
- **DonationAgent** – automates donation intake, splitting, and compliance logging.

## Usage

```typescript
import { TreasuryAgent } from '@celo-ai/agents';
import { CeloClient } from '@celo-automator/celo-functions';
import { RiskEngine, defaultRiskRules } from '@celo-ai/risk-engine';

const agent = new TreasuryAgent({
  id: 'treasury-1',
  name: 'Treasury Manager',
  model: 'gpt-4o',
  celoClient: new CeloClient({ /* ... */ }),
  riskEngine: new RiskEngine({ defaultRules: defaultRiskRules }),
});

const result = await agent.processPrompt('Rebalance CELO/cUSD to 60/40.');
console.log(result.intent, result.risk?.normalizedRisk);
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT © Celo AI Agents Team
# @celo-ai/agents

Collection of specialized LangChain-powered agents for the Celo AI automation platform. Each agent encapsulates domain expertise, predefined toolkits, and guardrails to safely execute on-chain operations.

## Included Agents

- **TreasuryAgent** – Portfolio monitoring, rebalancing, and risk mitigation
- **DeFiAgent** – Protocol discovery, staking, lending, and yield optimization
- **NFTAgent** – Dynamic NFT minting, drop management, and distribution workflows
- **GovernanceAgent** – Proposal analysis, voting, and delegation strategies
- **DonationAgent** – Automated donation routing, impact reporting, and compliance checks

## Usage

```typescript
import { AgentFactory } from '@celo-ai/agents';
import { LangChainAgent } from '@celo-automator/langchain-agent';

const orchestratorAgent = new LangChainAgent(/* ... */);

const factory = new AgentFactory({
  baseAgent: orchestratorAgent,
});

const treasuryAgent = factory.create('treasury', {
  portfolioTargets: { celo: 0.5, cusd: 0.5 },
});

const response = await treasuryAgent.processPrompt(
  'Rebalance treasury towards a 60/40 CELO/cUSD split.'
);
```

## Features

- Configurable personality and objective prompts
- Shared tool registry with risk-aware wrappers
- Spending limit and compliance enforcement
- Observability hooks for reasoning traces and outcomes

## Documentation

Refer to the main repository documentation for configuration guidance, prompting patterns, and integration examples.

