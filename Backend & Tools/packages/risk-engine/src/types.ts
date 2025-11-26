import type { Address } from 'viem';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskEngineConfig {
  maxRiskScore?: number;
  approvalThreshold?: number;
  blockThreshold?: number;
  rules?: Partial<RuleConfig>;
  enableMlModel?: boolean;
  mlModel?: RiskModel;
  defaultRules?: RiskRule[];
  runRulesInParallel?: boolean;
}

export interface RuleConfig {
  spendingLimits: {
    daily: bigint;
    perTransaction: bigint;
  };
  allowedContracts: Address[];
  blockedAddresses: Address[];
  suspiciousProtocols: string[];
  whitelistOverrides: Address[];
  riskThresholds: {
    notify: number;
    requireApproval: number;
    block: number;
  };
}

export interface TransactionContext {
  agentId: string;
  owner?: Address;
  type: 'transfer' | 'contract_call' | 'deployment';
  to?: Address;
  value?: bigint;
  tokenAddress?: Address;
  functionSignature?: string;
  protocol?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
  simulatedChanges?: Record<string, unknown>;
}

export interface RiskSignal {
  name: string;
  value: number;
  weight: number;
  description?: string;
}

export interface RuleViolation {
  rule: string;
  severity: RiskLevel;
  message: string;
  recommendation: string;
  penalty: number;
}

export interface RiskScore {
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
  violations: RuleViolation[];
  recommendations: string[];
  requiresApproval: boolean;
  blocked: boolean;
}

export interface RiskModelInput {
  signals: RiskSignal[];
  context: TransactionContext;
}

export interface RiskModel {
  predict(input: RiskModelInput): Promise<number> | number;
}

export interface GuardrailDecision {
  allowed: boolean;
  reason: string;
  approvalRequired: boolean;
  notifications: string[];
}

export interface ValidationResult {
  isValid: boolean;
  riskScore: number;
  warnings: string[];
  recommendations: string[];
  errors?: string[];
}

export interface RiskAssessment {
  normalizedRisk: number;
  classification: RiskLevel;
  requiresApproval: boolean;
  blockExecution: boolean;
  reasons: string[];
  recommendations: string[];
  timestamp: string;
  ruleResults?: RiskRuleResult[];
  overridesApplied?: RiskOverride;
}

export interface AgentRiskProfile {
  id: string;
  role?: string;
  owner?: Address;
  dailyLimit?: string;
  perTxLimit?: string;
  cumulative24h?: string;
  whitelist?: Address[];
  blacklist?: Address[];
  permissions?: string[];
  tags?: string[];
}

export interface TransactionRiskCandidate {
  hash?: string;
  to: Address;
  from?: Address;
  value?: string;
  tokenAddress?: Address;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId?: number;
}

export interface ChainHealthInfo {
  healthy: boolean;
  latencyMs?: number;
  blockNumber?: bigint;
}

export interface ChainHealthInfoDTO {
  healthy: boolean;
  latencyMs?: number;
  blockNumber?: bigint | number | string;
}

export interface RiskEvaluationInput {
  transaction: TransactionRiskCandidate & {
    operationType?: string;
  };
  agent?: AgentRiskProfile;
  history?: {
    averageValue?: string;
    standardDeviation?: string;
    last24hCount?: number;
    avgRiskScore?: number;
  };
  context?: {
    knownContracts?: Address[];
    trustedProtocols?: Address[];
    sanctionedAddresses?: Address[];
    chainHealth?: Record<string, ChainHealthInfo>;
  };
  overrides?: RiskOverride;
}

export interface RiskEvaluationInputDTO {
  transaction: TransactionRiskCandidate & {
    operationType?: string;
  };
  agent?: AgentRiskProfile;
  history?: {
    averageValue?: string;
    standardDeviation?: string;
    last24hCount?: number;
    avgRiskScore?: number;
  };
  context?: {
    knownContracts?: Address[];
    trustedProtocols?: Address[];
    sanctionedAddresses?: Address[];
    chainHealth?: Record<string, ChainHealthInfoDTO>;
  };
  overrides?: RiskOverride;
}

export interface RiskRule {
  id: string;
  label: string;
  description: string;
  weight: number;
  evaluate(input: RiskEvaluationInput): Promise<RiskRuleResult> | RiskRuleResult;
}

export interface RiskRuleResult {
  id: string;
  label: string;
  weight: number;
  normalizedScore: number;
  level: RiskLevel;
  triggered: boolean;
  requiresApproval: boolean;
  blockExecution: boolean;
  reasons: string[];
  recommendations: string[];
  metadata?: Record<string, unknown>;
}

export interface RiskOverride {
  forceAllow?: boolean;
  forceBlock?: boolean;
  approvalOverride?: boolean;
  maxNormalizedRisk?: number;
  notes?: string;
}

export interface ValidatorFinding {
  id: string;
  level: RiskLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  riskScore: number;
  warnings: string[];
  recommendations: string[];
  errors?: string[];
}

export function toBlockNumberBigInt(value: bigint | number | string | undefined | null): bigint | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string') {
    try {
      return BigInt(value);
    } catch (error) {
      throw new Error(`Invalid blockNumber format: "${value}". Expected a valid number string.`);
    }
  }
  throw new Error(`Invalid blockNumber type: ${typeof value}. Expected bigint, number, or string.`);
}

export function fromBlockNumberBigInt(value: bigint | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value.toString();
}

export function toChainHealthInfo(dto: ChainHealthInfoDTO): ChainHealthInfo {
  return {
    healthy: dto.healthy,
    latencyMs: dto.latencyMs,
    blockNumber: toBlockNumberBigInt(dto.blockNumber),
  };
}

export function fromChainHealthInfo(info: ChainHealthInfo): ChainHealthInfoDTO {
  return {
    healthy: info.healthy,
    latencyMs: info.latencyMs,
    blockNumber: fromBlockNumberBigInt(info.blockNumber),
  };
}

export function toRiskEvaluationInput(dto: RiskEvaluationInputDTO): RiskEvaluationInput {
  const result: RiskEvaluationInput = {
    transaction: dto.transaction,
    agent: dto.agent,
    history: dto.history,
    overrides: dto.overrides,
  };

  if (dto.context) {
    result.context = {
      knownContracts: dto.context.knownContracts,
      trustedProtocols: dto.context.trustedProtocols,
      sanctionedAddresses: dto.context.sanctionedAddresses,
    };

    if (dto.context.chainHealth) {
      result.context.chainHealth = {};
      for (const [chainId, healthDto] of Object.entries(dto.context.chainHealth)) {
        result.context.chainHealth[chainId] = toChainHealthInfo(healthDto);
      }
    }
  }

  return result;
}

export function fromRiskEvaluationInput(input: RiskEvaluationInput): RiskEvaluationInputDTO {
  const result: RiskEvaluationInputDTO = {
    transaction: input.transaction,
    agent: input.agent,
    history: input.history,
    overrides: input.overrides,
  };

  if (input.context) {
    result.context = {
      knownContracts: input.context.knownContracts,
      trustedProtocols: input.context.trustedProtocols,
      sanctionedAddresses: input.context.sanctionedAddresses,
    };

    if (input.context.chainHealth) {
      result.context.chainHealth = {};
      for (const [chainId, healthInfo] of Object.entries(input.context.chainHealth)) {
        result.context.chainHealth[chainId] = fromChainHealthInfo(healthInfo);
      }
    }
  }

  return result;
}
