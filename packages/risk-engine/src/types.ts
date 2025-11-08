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
  chainId?: number;
}

export interface RiskEvaluationInput {
  transaction: TransactionRiskCandidate & {
    operationType?: string;
  };
  agent?: AgentRiskProfile;
  history?: {
    averageValue?: string;
    last24hCount?: number;
    avgRiskScore?: number;
  };
  context?: {
    knownContracts?: Address[];
    chainHealth?: Record<string, { healthy: boolean }>;
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
