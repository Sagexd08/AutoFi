import type { ParsedIntent } from '@autofi/ai-engine';

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentType =
  | 'intent'
  | 'planner'
  | 'defi'
  | 'treasury'
  | 'risk'
  | 'simulation'
  | 'execution'
  | 'monitoring';

export interface AgentContext {
  userId: string;
  walletAddress: string;
  chainId?: number;
  balances?: Record<string, string>;
  previousIntents?: ParsedIntent[];
}

export interface AgentResult<T = unknown> {
  success: boolean;
  agentType: AgentType;
  data?: T;
  error?: string;
  processingTimeMs: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// INTENT AGENT
// ============================================================================

export interface IntentAgentInput {
  prompt: string;
  context: AgentContext;
}

export interface IntentAgentOutput {
  intent: ParsedIntent;
  confidence: number;
  requiresClarification: boolean;
  clarificationQuestions?: string[];
}

// ============================================================================
// PLANNER AGENT
// ============================================================================

export interface PlannerAgentInput {
  intent: ParsedIntent;
  context: AgentContext;
}

export interface ExecutionPlan {
  id: string;
  steps: PlannedStep[];
  estimatedGas: string;
  estimatedTime: number; // in seconds
  crossChainRequired: boolean;
  bridgeSteps?: BridgeStep[];
}

export interface PlannedStep {
  id: string;
  index: number;
  chainId: number;
  type: string;
  description: string;
  contract?: string;
  functionName: string;
  params: Record<string, unknown>;
  dependencies: string[]; // IDs of steps this depends on
  estimatedGas: string;
  parallelizable: boolean;
}

export interface BridgeStep {
  fromChain: number;
  toChain: number;
  token: string;
  amount: string;
  bridge: string; // Bridge protocol to use
  estimatedTime: number;
}

// ============================================================================
// DEFI AGENT
// ============================================================================

export interface DeFiAgentInput {
  action: 'swap' | 'addLiquidity' | 'removeLiquidity' | 'stake' | 'unstake' | 'deposit' | 'withdraw';
  params: Record<string, unknown>;
  context: AgentContext;
}

export interface DeFiAgentOutput {
  protocol: string;
  route?: SwapRoute;
  pool?: PoolInfo;
  vault?: VaultInfo;
  expectedOutput: string;
  priceImpact: number;
  slippage: number;
  gasEstimate: string;
}

export interface SwapRoute {
  path: string[];
  protocols: string[];
  expectedOutput: string;
  priceImpact: number;
  gasCost: string;
}

export interface PoolInfo {
  address: string;
  protocol: string;
  tokens: string[];
  tvl: string;
  apy: number;
  fees: number;
}

export interface VaultInfo {
  address: string;
  protocol: string;
  token: string;
  tvl: string;
  apy: number;
  strategy: string;
}

// ============================================================================
// TREASURY AGENT
// ============================================================================

export interface TreasuryAgentInput {
  action: 'transfer' | 'batchTransfer' | 'createStream' | 'recurringPayment';
  params: Record<string, unknown>;
  context: AgentContext;
}

export interface TreasuryAgentOutput {
  transactions: TreasuryTransaction[];
  totalAmount: string;
  totalGas: string;
  batched: boolean;
  streamInfo?: StreamInfo;
}

export interface TreasuryTransaction {
  to: string;
  token: string;
  amount: string;
  memo?: string;
}

export interface StreamInfo {
  protocol: string;
  recipient: string;
  token: string;
  amountPerSecond: string;
  duration?: number;
  startTime?: number;
}

// ============================================================================
// RISK AGENT
// ============================================================================

export interface RiskAgentInput {
  plan: ExecutionPlan;
  context: AgentContext;
}

export interface RiskAgentOutput {
  overallScore: number; // 0.0 - 1.0
  classification: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  blockExecution: boolean;
  factors: RiskFactor[];
  recommendations: string[];
}

export interface RiskFactor {
  id: string;
  name: string;
  score: number;
  weight: number;
  description: string;
  triggered: boolean;
}

// ============================================================================
// SIMULATION AGENT
// ============================================================================

export interface SimulationAgentInput {
  plan: ExecutionPlan;
  context: AgentContext;
}

export interface SimulationAgentOutput {
  success: boolean;
  steps: SimulatedStep[];
  totalGasUsed: string;
  balanceChanges: BalanceChange[];
  events: SimulatedEvent[];
  warnings: string[];
  errors: string[];
}

export interface SimulatedStep {
  stepId: string;
  success: boolean;
  gasUsed: string;
  returnData?: string;
  error?: string;
  logs: SimulatedEvent[];
}

export interface BalanceChange {
  token: string;
  before: string;
  after: string;
  delta: string;
}

export interface SimulatedEvent {
  address: string;
  name: string;
  args: Record<string, unknown>;
}

// ============================================================================
// EXECUTION AGENT
// ============================================================================

export interface ExecutionAgentInput {
  plan: ExecutionPlan;
  simulation: SimulationAgentOutput;
  approved: boolean;
  context: AgentContext;
}

export interface ExecutionAgentOutput {
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'partial';
  executedSteps: ExecutedStep[];
  pendingSteps: string[];
  failedSteps: FailedStep[];
  totalGasUsed: string;
  totalCost: string;
}

export interface ExecutedStep {
  stepId: string;
  txHash?: string;
  jobId?: string;
  blockNumber?: number;
  gasUsed?: string;
  status: 'confirmed' | 'pending' | 'queued';
}

export interface FailedStep {
  stepId: string;
  error: string;
  retryable: boolean;
  retryCount: number;
}

// ============================================================================
// MONITORING AGENT
// ============================================================================

export interface MonitoringAgentInput {
  planId: string;
  txHashes: string[];
  context: AgentContext;
}

export interface MonitoringAgentOutput {
  status: 'watching' | 'confirmed' | 'failed' | 'reverted';
  confirmations: TxConfirmation[];
  alerts: MonitoringAlert[];
  mempoolStatus?: MempoolStatus;
}

export interface TxConfirmation {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed' | 'reverted';
  confirmations: number;
  blockNumber?: number;
}

export interface MonitoringAlert {
  type: 'gas_spike' | 'mempool_congestion' | 'frontrun_detected' | 'reorg_detected';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
}

export interface MempoolStatus {
  pendingCount: number;
  baseFee: string;
  priorityFee: string;
  congestionLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// AGENT ORCHESTRATOR
// ============================================================================

export interface AgentOrchestrator {
  processIntent(prompt: string, context: AgentContext): Promise<AgentResult<IntentAgentOutput>>;
  createPlan(intent: ParsedIntent, context: AgentContext): Promise<AgentResult<ExecutionPlan>>;
  assessRisk(plan: ExecutionPlan, context: AgentContext): Promise<AgentResult<RiskAgentOutput>>;
  simulate(plan: ExecutionPlan, context: AgentContext): Promise<AgentResult<SimulationAgentOutput>>;
  execute(plan: ExecutionPlan, simulation: SimulationAgentOutput, context: AgentContext): Promise<AgentResult<ExecutionAgentOutput>>;
  monitor(planId: string, txHashes: string[], context: AgentContext): Promise<AgentResult<MonitoringAgentOutput>>;
}

export interface OrchestratorConfig {
  aiEngineApiKey: string;
  riskEngineConfig?: RiskEngineConfig;
  simulationConfig?: SimulationConfig;
  executionConfig?: ExecutionConfig;
  walletConfig?: {
    type: 'local' | 'privy' | 'fireblocks';
    privateKey?: string;
    privyAppId?: string;
    privyAppSecret?: string;
    fireblocksApiKey?: string;
    fireblocksSecretKey?: string;
  };
}

export interface RiskEngineConfig {
  approvalThreshold: number;
  blockThreshold: number;
  customRules?: RiskFactor[];
}

export interface SimulationConfig {
  provider: 'tenderly' | 'anvil';
  apiKey?: string;
  forkBlockNumber?: number;
}

export interface ExecutionConfig {
  maxRetries: number;
  retryDelayMs: number;
  gasMultiplier: number;
  priorityFeeMultiplier: number;
}
