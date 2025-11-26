export type ChainId = number;

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export interface SimulationResult {
  success: boolean;
  gasUsed?: bigint;
  returnValue?: string;
  revertReason?: string;
  logs?: Array<{ address: string; topics: string[]; data: string }>;
  warnings?: string[];
}

export interface BroadcastResult {
  hash: string;
  blockNumber?: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface TxBuildParams {
  from: string;
  to: string;
  value?: bigint;
  data?: string;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
  chainId?: ChainId;
}
