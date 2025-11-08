import type { Workflow } from '@celo-automator/types';

export interface SDKConfig {
  /**
   * Base URL of the Celo AI backend API, e.g. https://api.celo-ai.dev.
   */
  apiBaseUrl: string;
  /**
   * Optional API key sent via the Authorization header.
   */
  apiKey?: string;
  /**
   * Default agent identifier used by processPrompt when one is not provided.
   */
  defaultAgentId?: string;
  /**
   * Optional default request timeout in milliseconds.
   */
  timeoutMs?: number;
  /**
   * Additional headers that should be sent with every request.
   */
  defaultHeaders?: Record<string, string>;
}

export interface InternalRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface SDKErrorObject {
  code?: string;
  status?: number;
  reason?: string;
  details?: unknown;
  requestId?: string;
}

export interface AgentCreateRequest {
  type: string;
  name: string;
  description?: string;
  model?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface AgentRecord {
  id: string;
  type: string;
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'error';
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentListResponse {
  success: boolean;
  agents: AgentRecord[];
}

export interface AgentCreateResponse {
  success: boolean;
  agent: AgentRecord;
}

export interface AgentQueryRequest {
  prompt: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  streaming?: boolean;
  intentOnly?: boolean;
}

export interface AgentToolExecution {
  name: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  transactionHash?: string;
  riskScore?: number;
}

export interface AgentQueryResponse {
  success: boolean;
  output?: string;
  reasoning?: string;
  workflow?: Workflow;
  toolsExecuted?: AgentToolExecution[];
  transactions?: Array<{
    hash: string;
    status?: 'pending' | 'confirmed' | 'failed';
    chainId?: number | string;
    riskScore?: number;
  }>;
  riskScore?: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface ContractDeploymentRequest {
  contractName: string;
  abi?: unknown;
  bytecode?: string;
  args?: unknown[];
  source?: string;
  tags?: string[];
  agentId?: string;
  network?: string;
  gasLimit?: string;
  gasPrice?: string;
  metadata?: Record<string, unknown>;
}

export interface ContractDeploymentResponse {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  gasUsed?: string;
  deploymentId?: string;
  riskScore?: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId?: number | string;
  nonce?: number;
  agentId?: string;
  memo?: string;
  simulateOnly?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TransactionResponse {
  success: boolean;
  transactionHash?: string;
  riskScore?: number;
  requiresApproval?: boolean;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface GasEstimateResponse {
  success: boolean;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface HealthResponse {
  success: boolean;
  uptime?: number;
  cpu?: number;
  memory?: number;
  agentCount?: number;
  chainStatus?: Record<string, { healthy: boolean; latencyMs?: number; blockNumber?: number }>;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface SpendingLimitConfig {
  agentId: string;
  dailyLimit: string;
  perTxLimit: string;
  currency?: string;
  effectiveFrom?: string;
  metadata?: Record<string, unknown>;
}

export interface SpendingLimitResponse {
  success: boolean;
  agentId: string;
  dailyLimit: string;
  perTxLimit: string;
  currency?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface NormalizeErrorOptions {
  fallbackMessage?: string;
  defaultCode?: string;
}
