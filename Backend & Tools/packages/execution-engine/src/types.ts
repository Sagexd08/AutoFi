import { Address, Hash, TransactionReceipt } from 'viem';

export type ExecutionStatus = 'PENDING' | 'QUEUED' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';

export interface ExecutionRequest {
  id: string;
  chainId: number;
  to: Address;
  data?: Hash;
  value?: bigint;
  gasLimit?: bigint;
  useQueue?: boolean;
  // For now we assume simple transactions, but this can be extended for complex calls
}

export interface ExecutionResult {
  id: string;
  status: ExecutionStatus;
  txHash?: Hash;
  receipt?: TransactionReceipt;
  error?: string;
  timestamp: number;
  from?: string;
}

export interface IExecutionEngine {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  waitForConfirmation(txHash: Hash, chainId: number): Promise<TransactionReceipt>;
}
