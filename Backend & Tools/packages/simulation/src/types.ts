import { z } from 'zod';

// ============================================================================
// SIMULATION TYPES
// ============================================================================

export const SimulationProviderSchema = z.enum(['tenderly', 'anvil', 'hardhat']);
export type SimulationProvider = z.infer<typeof SimulationProviderSchema>;

export interface SimulationConfig {
  provider: SimulationProvider;
  
  // Tenderly config
  tenderlyAccessKey?: string;
  tenderlyAccountSlug?: string;
  tenderlyProjectSlug?: string;
  
  // Anvil config
  anvilRpcUrl?: string;
  
  // Fork settings
  forkBlockNumber?: number;
  forkChainId?: number;
}

export interface TransactionToSimulate {
  from: string;
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId: number;
}

export interface SimulationStep {
  index: number;
  transaction: TransactionToSimulate;
  description?: string;
}

export interface SimulationRequest {
  steps: SimulationStep[];
  fromAddress: string;
  chainId: number;
  blockNumber?: number;
  saveSimulation?: boolean;
}

export interface BalanceChange {
  address: string;
  token: string;
  tokenAddress: string;
  before: string;
  after: string;
  delta: string;
  deltaUsd?: string;
}

export interface EmittedEvent {
  address: string;
  name: string;
  signature?: string;
  args: Record<string, unknown>;
  topics?: string[];
  data?: string;
}

export interface TraceCall {
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  input: string;
  output?: string;
  type: 'CALL' | 'DELEGATECALL' | 'STATICCALL' | 'CREATE' | 'CREATE2';
  error?: string;
}

export interface StepSimulationResult {
  stepIndex: number;
  success: boolean;
  gasUsed: string;
  gasLimit: string;
  returnData?: string;
  error?: string;
  revertReason?: string;
  logs: EmittedEvent[];
  trace?: TraceCall[];
  balanceChanges: BalanceChange[];
}

export interface SimulationResult {
  success: boolean;
  steps: StepSimulationResult[];
  totalGasUsed: string;
  allBalanceChanges: BalanceChange[];
  allEvents: EmittedEvent[];
  warnings: string[];
  errors: string[];
  simulatedAt: string;
  blockNumber: number;
  forkId?: string;
  
  // Tenderly-specific
  simulationUrl?: string;
  shareUrl?: string;
}

// ============================================================================
// TENDERLY API TYPES
// ============================================================================

export interface TenderlySimulationRequest {
  network_id: string;
  from: string;
  to: string;
  input: string;
  value: string;
  gas: number;
  gas_price?: string;
  save?: boolean;
  save_if_fails?: boolean;
  simulation_type?: 'quick' | 'full';
  block_number?: number;
  state_objects?: Record<string, TenderlyStateObject>;
}

export interface TenderlyStateObject {
  balance?: string;
  code?: string;
  storage?: Record<string, string>;
}

export interface TenderlySimulationResponse {
  simulation: {
    id: string;
    project_id: string;
    owner_id: string;
    network_id: string;
    block_number: number;
    transaction_index: number;
    from: string;
    to: string;
    input: string;
    gas: number;
    gas_price: string;
    gas_used: number;
    value: string;
    status: boolean;
    method?: string;
    error_message?: string;
    created_at: string;
  };
  transaction: {
    hash: string;
    block_hash: string;
    block_number: number;
    from: string;
    to: string;
    gas: number;
    gas_price: number;
    gas_fee_cap: number;
    gas_tip_cap: number;
    value: string;
    input: string;
    nonce: number;
    transaction_type: number;
    v: string;
    r: string;
    s: string;
    status: boolean;
    error_message?: string;
  };
  logs?: TenderlyLog[];
  trace?: TenderlyTrace[];
  contracts?: TenderlyContract[];
  generated_access_list?: TenderlyAccessListEntry[];
}

export interface TenderlyLog {
  address: string;
  topics: string[];
  data: string;
  name?: string;
  raw: {
    address: string;
    topics: string[];
    data: string;
  };
}

export interface TenderlyTrace {
  from: string;
  to: string;
  gas: number;
  gas_used: number;
  value: string;
  input: string;
  output: string;
  type: string;
  error?: string;
  decoded_input?: TenderlyDecodedInput[];
  decoded_output?: TenderlyDecodedOutput[];
}

export interface TenderlyDecodedInput {
  name: string;
  type: string;
  value: unknown;
}

export interface TenderlyDecodedOutput {
  name: string;
  type: string;
  value: unknown;
}

export interface TenderlyContract {
  address: string;
  contract_name?: string;
  token_data?: {
    symbol: string;
    name: string;
    decimals: number;
  };
}

export interface TenderlyAccessListEntry {
  address: string;
  storage_keys: string[];
}

export interface TenderlyBundleRequest {
  network_id: string;
  block_number?: number;
  from: string;
  simulations: TenderlyBundleSimulation[];
  save?: boolean;
}

export interface TenderlyBundleSimulation {
  from?: string;
  to: string;
  input: string;
  value?: string;
  gas?: number;
}

export interface TenderlyBundleResponse {
  simulation_results: TenderlySimulationResponse[];
}

// ============================================================================
// ANVIL TYPES
// ============================================================================

export interface AnvilForkConfig {
  rpcUrl: string;
  blockNumber?: number;
  chainId?: number;
}

export interface AnvilSimulationResult {
  success: boolean;
  gasUsed: string;
  returnData?: string;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
  error?: string;
}
