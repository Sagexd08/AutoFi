# @celo-ai/risk-engine

Hybrid ML + rule-based risk evaluation engine for the Celo AI agentic automation stack. The risk engine analyses intended blockchain actions, applies deterministic guardrails, and produces a normalized 0 – 1 risk score with human-readable explanations and recommendations.

## Features

- Rule-based analysis (spending limits, address reputation, contract allowlists, gas heuristics)
- Extensible architecture for ML-driven risk scoring and anomaly detection
- Deterministic guardrails enforcing spending caps and policy compliance
- Rich risk assessment manifest including recommendations and approval requirements

## Usage

```typescript
import { RiskEngine, defaultRiskRules } from '@celo-ai/risk-engine';

const engine = new RiskEngine({
  approvalThreshold: 0.6,
  blockThreshold: 0.85,
  defaultRules: defaultRiskRules,
});

const assessment = await engine.scoreTransaction({
  transaction: {
    to: '0xabc...',
    value: '1000000000000000000', // 1 CELO
    chainId: 42220,
  },
  agent: {
    id: 'agent-1',
    dailyLimit: '5000000000000000000',
    perTxLimit: '2000000000000000000',
    whitelist: ['0xabc...'],
  },
  context: {
    knownContracts: ['0xabc...'],
    historicalAverageValue: '250000000000000000',
  },
});

console.log(assessment.normalizedRisk); // => e.g. 0.32
console.log(assessment.classification); // => "medium"
console.log(assessment.recommendations);
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT © Celo AI Agents Team
# @celo-ai/risk-engine

Hybrid machine learning and rule-based risk engine for the Celo AI agentic automation platform. Provides deterministic guardrails, adaptive scoring, and transaction validation utilities to ensure safe autonomous execution.

## Features

- 0–1 risk scoring model with configurable weighting
- Deterministic rule checks for limits, address reputation, and contract allowlists
- Extensible ML hooks for integrating external risk predictors
- Transaction simulation metadata support
- Guardrail enforcement with actionable recommendations

## Usage

```typescript
import { RiskEngine } from '@celo-ai/risk-engine';

const engine = new RiskEngine({
  rules: {
    maxRiskScore: 0.6,
    spendingLimits: {
      daily: '1000',
      perTransaction: '250'
    }
  }
});

const result = await engine.evaluateTransaction({
  agentId: 'agent_123',
  to: '0xabc...',
  value: '100',
  type: 'transfer',
  metadata: { protocol: 'moola' }
});

console.log(result.score); // 0.42
console.log(result.recommendations);
```

## Concepts

- **Signals** – features extracted from transaction context and historical data
- **Rules** – deterministic checks returning penalties and remediation guidance
- **Pipelines** – configurable ordering of rule evaluation and ML models

## Documentation

Refer to the platform documentation for configuration examples, ML integration guides, and API usage.

