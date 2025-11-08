import {
  RiskAssessment,
  RiskEngineConfig,
  RiskEvaluationInput,
  RiskLevel,
  RiskRule,
  RiskRuleResult,
  RiskOverride,
  TransactionContext,
  ValidationResult,
} from './types.js';
import {
  combineValidationResults,
  validateSpendingLimits,
  validateTransactionStructure,
  type ValidationResultWithFindings,
} from './validators.js';

const DEFAULT_APPROVAL_THRESHOLD = 0.6;
const DEFAULT_BLOCK_THRESHOLD = 0.85;
const VALIDATION_RULE_WEIGHT = 0.2;

const severityScores: Record<RiskLevel, number> = {
  low: 0.1,
  medium: 0.3,
  high: 0.75,
  critical: 1,
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max);
}

function levelFromScore(score: number): RiskLevel {
  if (score >= 0.85) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

function buildValidationRuleResult(
  highestSeverity: RiskLevel,
  reasons: string[],
  metadata?: Record<string, unknown>
): RiskRuleResult {
  const normalizedScore = severityScores[highestSeverity];
  const recommendations =
    highestSeverity === 'critical'
      ? ['Reject transaction and escalate to security operations.']
      : highestSeverity === 'high'
      ? ['Require manual approval before execution.']
      : ['Review transaction context for completeness.'];

  return {
    id: 'transaction_validation',
    label: 'Transaction Validation',
    weight: VALIDATION_RULE_WEIGHT,
    normalizedScore,
    level: levelFromScore(normalizedScore),
    triggered: normalizedScore > 0,
    requiresApproval: highestSeverity === 'high' || highestSeverity === 'critical',
    blockExecution: highestSeverity === 'critical',
    reasons,
    recommendations,
    metadata,
  };
}

export class RiskEngine {
  private readonly config: RiskEngineConfig;
  private readonly rules: Map<string, RiskRule>;

  constructor(config?: Partial<RiskEngineConfig>) {
    this.config = {
      approvalThreshold: config?.approvalThreshold ?? DEFAULT_APPROVAL_THRESHOLD,
      blockThreshold: config?.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD,
      maxRiskScore: config?.maxRiskScore ?? 0.95,
      runRulesInParallel: config?.runRulesInParallel ?? false,
      defaultRules: config?.defaultRules ?? [],
    };

    this.rules = new Map();

    for (const rule of this.config.defaultRules ?? []) {
      this.registerRule(rule);
    }
  }

  registerRule(rule: RiskRule): void {
    this.rules.set(rule.id, rule);
  }

  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  listRules(): RiskRule[] {
    return Array.from(this.rules.values());
  }

  async scoreTransaction(input: RiskEvaluationInput): Promise<RiskAssessment> {
    const ruleResults: RiskRuleResult[] = [];

    const validation = combineValidationResults(
      validateTransactionStructure(input),
      validateSpendingLimits(input)
    );

    if (validation.findings && validation.findings.length > 0) {
      const highestSeverity = validation.findings.reduce<RiskLevel>((acc, finding) => {
        const order: Record<RiskLevel, number> = {
          low: 0,
          medium: 1,
          high: 2,
          critical: 3,
        };
        return order[finding.level] > order[acc] ? finding.level : acc;
      }, 'low');

      const reasons = validation.findings.map((finding) => finding.message);

      ruleResults.push(
        buildValidationRuleResult(highestSeverity, reasons, {
          findings: validation.findings,
        })
      );
    }

    const riskRuleResults = await this.evaluateRules(input);
    ruleResults.push(...riskRuleResults);

    const totalWeight = ruleResults.reduce((sum, result) => sum + result.weight, 0);
    const weightedScore = ruleResults.reduce(
      (sum, result) => sum + result.weight * result.normalizedScore,
      0
    );

    let normalizedRisk = totalWeight > 0 ? clamp(weightedScore / totalWeight) : 0;
    let requiresApproval =
      normalizedRisk >= (this.config.approvalThreshold ?? DEFAULT_APPROVAL_THRESHOLD) ||
      ruleResults.some((result) => result.requiresApproval);
    let blockExecution =
      normalizedRisk >= (this.config.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD) ||
      ruleResults.some((result) => result.blockExecution);

    const overridesApplied = this.applyOverrides(
      input.overrides,
      {
        normalizedRisk,
        requiresApproval,
        blockExecution,
      },
      ruleResults
    );

    normalizedRisk = overridesApplied.normalizedRisk;
    requiresApproval = overridesApplied.requiresApproval;
    blockExecution = overridesApplied.blockExecution;

    const classification = levelFromScore(normalizedRisk);

    const reasons = ruleResults
      .filter((result) => result.triggered)
      .flatMap((result) => result.reasons);
    const recommendations = ruleResults
      .filter((result) => result.triggered)
      .flatMap((result) => result.recommendations);

    return {
      normalizedRisk,
      classification,
      requiresApproval,
      blockExecution,
      reasons,
      recommendations,
      ruleResults,
      overridesApplied: input.overrides,
      timestamp: new Date().toISOString(),
    };
  }

  async validateTransaction(context: TransactionContext): Promise<ValidationResult> {
    const input: RiskEvaluationInput = {
      transaction: {
        to: context.to!,
        from: context.owner,
        value: context.value?.toString(),
        data: undefined,
        operationType: context.type,
      },
      agent: context.agentId ? {
        id: context.agentId,
        owner: context.owner,
      } : undefined,
    };

    const assessment = await this.scoreTransaction(input);
    
    return {
      isValid: !assessment.blockExecution,
      riskScore: assessment.normalizedRisk,
      warnings: assessment.reasons.slice(0, -1),
      recommendations: assessment.recommendations,
      errors: assessment.blockExecution ? ['Transaction blocked by risk engine'] : undefined,
    };
  }

  private async evaluateRules(
    input: RiskEvaluationInput
  ): Promise<RiskRuleResult[]> {
    const rules = this.listRules();
    if (rules.length === 0) {
      return [];
    }

    if (this.config.runRulesInParallel) {
      return Promise.all(
        rules.map(async (rule) => {
          const result = await rule.evaluate(input);
          return this.normalizeRuleResult(rule, result);
        })
      );
    }

    const results: RiskRuleResult[] = [];
    for (const rule of rules) {
      const result = await rule.evaluate(input);
      results.push(this.normalizeRuleResult(rule, result));
    }
    return results;
  }

  private normalizeRuleResult(rule: RiskRule, result: RiskRuleResult): RiskRuleResult {
    const score = result.normalizedScore ?? 0;
    const normalizedScore = clamp(score);
    const computedLevel = result.level ?? levelFromScore(normalizedScore);
    const triggersApproval = computedLevel === 'high' || computedLevel === 'critical';
    const triggersBlock = computedLevel === 'critical';

    return {
      ...result,
      id: result.id ?? rule.id,
      label: result.label ?? rule.label,
      weight: result.weight ?? rule.weight,
      normalizedScore,
      level: computedLevel,
      triggered: result.triggered ?? normalizedScore > 0,
      requiresApproval: result.requiresApproval ?? triggersApproval,
      blockExecution: result.blockExecution ?? triggersBlock,
      reasons: result.reasons ?? [],
      recommendations: result.recommendations ?? [],
    };
  }

  private applyOverrides(
    overrides: RiskOverride | undefined,
    state: {
      normalizedRisk: number;
      requiresApproval: boolean;
      blockExecution: boolean;
    },
    ruleResults: RiskRuleResult[]
  ) {
    if (!overrides) {
      return state;
    }

    let { normalizedRisk, requiresApproval, blockExecution } = state;

    if (overrides.forceAllow) {
      normalizedRisk = 0;
      requiresApproval = false;
      blockExecution = false;
    }

    if (overrides.forceBlock) {
      normalizedRisk = 1;
      requiresApproval = true;
      blockExecution = true;
      ruleResults.push({
        id: 'manual_override',
        label: 'Manual Override (Block)',
        weight: 1,
        normalizedScore: 1,
        level: 'critical',
        triggered: true,
        requiresApproval: true,
        blockExecution: true,
        reasons: ['Manual override forced block.'],
        recommendations: ['Escalate to policy owners before clearing override.'],
      });
    }

    if (overrides.maxNormalizedRisk !== undefined) {
      normalizedRisk = Math.min(normalizedRisk, clamp(overrides.maxNormalizedRisk));
    }

    if (overrides.approvalOverride) {
      requiresApproval = false;
      ruleResults.push({
        id: 'manual_override',
        label: 'Manual Override (Approval)',
        weight: 1,
        normalizedScore: normalizedRisk,
        level: levelFromScore(normalizedRisk),
        triggered: true,
        requiresApproval: false,
        blockExecution,
        reasons: ['Manual override removed approval requirement.'],
        recommendations: ['Document override justification in audit log.'],
      });
    }

    return {
      normalizedRisk,
      requiresApproval,
      blockExecution,
    };
  }
}
