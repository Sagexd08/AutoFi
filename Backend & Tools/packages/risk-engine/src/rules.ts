import { RiskRule, RiskRuleResult, RiskEvaluationInput, RiskLevel } from './types.js';

const BIGINT_ZERO = 0n;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max);
}

function toBigInt(value?: string): bigint | undefined {
  if (!value) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function determineLevel(score: number): RiskLevel {
  if (score >= 0.85) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

function createResult(
  id: string,
  label: string,
  weight: number,
  normalizedScore: number,
  reasons: string[],
  recommendations: string[],
  overrides?: Partial<Pick<RiskRuleResult, 'requiresApproval' | 'blockExecution' | 'metadata'>>
): RiskRuleResult {
  const level = determineLevel(normalizedScore);
  const triggered = normalizedScore > 0;

  return {
    id,
    label,
    weight,
    normalizedScore,
    level,
    triggered,
    requiresApproval: overrides?.requiresApproval ?? (level === 'high' || level === 'critical'),
    blockExecution: overrides?.blockExecution ?? (level === 'critical'),
    reasons,
    recommendations,
    metadata: overrides?.metadata,
  };
}

export const spendingLimitRule: RiskRule = {
  id: 'spending_limits',
  label: 'Spending Limit Enforcement',
  description: 'Ensures agent spending remains within configured per-transaction and daily limits.',
  weight: 0.35,
  evaluate(input: RiskEvaluationInput): RiskRuleResult {
    if (!input.agent) {
      return createResult(
        this.id,
        this.label,
        this.weight,
        0,
        [],
        []
      );
    }

    const reasons: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    const value = toBigInt(input.transaction.value);
    const perTxLimit = toBigInt(input.agent.perTxLimit);
    const dailyLimit = toBigInt(input.agent.dailyLimit);
    const cumulative = toBigInt(input.agent.cumulative24h) ?? BIGINT_ZERO;

    if (value && perTxLimit && value > perTxLimit) {
      const ratio = Number(value) / Number(perTxLimit);
      score = clamp(ratio, 0, 1);
      reasons.push(
        `Transaction value ${value.toString()} exceeds per-transaction limit ${perTxLimit.toString()}.`
      );
      recommendations.push('Lower the requested amount or request updated limits.');
    }

    if (value && dailyLimit) {
      const projected = value + cumulative;
      if (projected > dailyLimit) {
        const overflow = Number(projected - dailyLimit) / Number(dailyLimit);
        score = Math.max(score, clamp(overflow, 0, 1));
        reasons.push(
          `Projected daily spending ${projected.toString()} exceeds limit ${dailyLimit.toString()}.`
        );
        recommendations.push('Delay the transaction or increase the daily spending allowance.');
      }
    }

    return createResult(this.id, this.label, this.weight, clamp(score), reasons, recommendations);
  },
};

export const addressReputationRule: RiskRule = {
  id: 'address_reputation',
  label: 'Address Reputation',
  description: 'Evaluates whether the recipient is trusted, unknown, or sanctioned.',
  weight: 0.2,
  evaluate(input: RiskEvaluationInput): RiskRuleResult {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    const to = input.transaction.to?.toLowerCase();
    const whitelist = input.agent?.whitelist?.map((addr) => addr.toLowerCase()) ?? [];
    const blacklist = input.agent?.blacklist?.map((addr) => addr.toLowerCase()) ?? [];
    const sanctioned =
      input.context?.sanctionedAddresses?.map((addr) => addr.toLowerCase()) ?? [];
    const trusted =
      input.context?.knownContracts?.map((addr) => addr.toLowerCase()) ??
      input.context?.trustedProtocols?.map((addr) => addr.toLowerCase()) ??
      [];

    if (to && blacklist.includes(to)) {
      score = 1;
      reasons.push('Recipient address is explicitly blacklisted.');
      recommendations.push('Abort the transaction and escalate to security team.');
    } else if (to && sanctioned.includes(to)) {
      score = 1;
      reasons.push('Recipient address matches sanctioned address list.');
      recommendations.push('Reject the transaction; address is sanctioned.');
    } else if (to && whitelist.length > 0 && !whitelist.includes(to)) {
      score = Math.max(score, 0.65);
      reasons.push('Recipient is not present in the agent whitelist.');
      recommendations.push('Confirm recipient identity or add to whitelist.');
    } else if (to && trusted.length > 0 && !trusted.includes(to)) {
      score = Math.max(score, 0.35);
      reasons.push('Recipient address is not in the known contracts registry.');
      recommendations.push('Review the contract source or run a simulation.');
    }

    return createResult(this.id, this.label, this.weight, score, reasons, recommendations);
  },
};

export const anomalyDetectionRule: RiskRule = {
  id: 'historical_anomaly',
  label: 'Historical Anomaly Detection',
  description: 'Flags transactions that deviate substantially from recent activity.',
  weight: 0.25,
  evaluate(input: RiskEvaluationInput): RiskRuleResult {
    if (!input.history) {
      return createResult(this.id, this.label, this.weight, 0, [], []);
    }

    const reasons: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    const value = toBigInt(input.transaction.value);
    const average = toBigInt(input.history.averageValue);
    const deviation = toBigInt(input.history.standardDeviation);

    if (value && average && deviation) {
      const delta = value > average ? value - average : average - value;
      if (delta > deviation * 3n) {
        score = 0.8;
        reasons.push('Transaction value is >3σ from historical mean.');
        recommendations.push('Route to manual review for anomaly confirmation.');
      } else if (delta > deviation * 2n) {
        score = 0.55;
        reasons.push('Transaction value is >2σ from historical mean.');
        recommendations.push('Ensure the initiating context justifies the deviation.');
      }
    } else if (value && average) {
      const ratio = Number(value) / Math.max(Number(average), 1);
      if (ratio >= 5 || ratio <= 0.2) {
        score = 0.6;
        reasons.push('Transaction size diverges significantly from historical norm.');
        recommendations.push('Add contextual justification to the audit log.');
      }
    }

    if (input.history?.last24hCount && input.history.last24hCount > 50) {
      score = Math.max(score, 0.4);
      reasons.push('High transaction velocity in the last 24 hours.');
      recommendations.push('Increase monitoring frequency and check for automation loops.');
    }

    return createResult(this.id, this.label, this.weight, clamp(score), reasons, recommendations);
  },
};

export const gasHeuristicsRule: RiskRule = {
  id: 'gas_heuristics',
  label: 'Gas Price Heuristics',
  description: 'Detects abnormal gas configuration that may indicate malicious behavior.',
  weight: 0.1,
  evaluate(input: RiskEvaluationInput): RiskRuleResult {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    const gasPrice = toBigInt(input.transaction.gasPrice ?? input.transaction.maxFeePerGas);
    const maxPriority = toBigInt(input.transaction.maxPriorityFeePerGas);

    if (gasPrice && gasPrice > 50_000_000_000n) {
      score = 0.45;
      reasons.push('Gas price exceeds 50 gwei.');
      recommendations.push('Confirm urgency; otherwise cap gas price.');
    }

    if (maxPriority && maxPriority > 5_000_000_000n) {
      score = Math.max(score, 0.4);
      reasons.push('Priority fee exceeds 5 gwei.');
      recommendations.push('Verify the transaction is not frontrunning or spam.');
    }

    return createResult(this.id, this.label, this.weight, score, reasons, recommendations);
  },
};

export const chainHealthRule: RiskRule = {
  id: 'chain_health',
  label: 'Chain Health Status',
  description: 'Incorporates chain health telemetry into the risk score.',
  weight: 0.1,
  evaluate(input: RiskEvaluationInput): RiskRuleResult {
    if (!input.context?.chainHealth) {
      return createResult(this.id, this.label, this.weight, 0, [], []);
    }

    const reasons: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    const chainId = String(input.transaction.chainId ?? 'unknown');
    const health = input.context.chainHealth[chainId];

    if (health && !health.healthy) {
      score = 0.7;
      reasons.push('Target chain reported degraded health status.');
      recommendations.push('Pause automatic execution until chain recovers.');
    } else if (health?.latencyMs && health.latencyMs > 5000) {
      score = 0.3;
      reasons.push('Chain RPC latency is elevated.');
      recommendations.push('Enable simulation mode or reduce transaction volume.');
    }

    return createResult(this.id, this.label, this.weight, score, reasons, recommendations);
  },
};

export const defaultRiskRules: RiskRule[] = [
  spendingLimitRule,
  addressReputationRule,
  anomalyDetectionRule,
  gasHeuristicsRule,
  chainHealthRule,
];
