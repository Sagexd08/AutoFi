import { Address, Hash } from 'viem';

export interface TokenBalance {
  token: Address;
  balance: string;
  decimals: number;
  symbol: string;
  name?: string;
}

export interface TransactionRequest {
  to: Address;
  value?: bigint;
  data?: `0x${string}`;
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
}

export interface TransactionResult {
  success: boolean;
  transactionHash?: Hash;
  gasUsed?: bigint;
  blockNumber?: bigint;
  error?: string;
  receipt?: any;
}

export interface EventFilter {
  address?: Address | Address[];
  topics?: (string | string[])[];
  fromBlock?: bigint | 'latest' | 'earliest' | 'pending';
  toBlock?: bigint | 'latest' | 'earliest' | 'pending';
}

export interface ContractCall {
  address: Address;
  abi: any[];
  functionName: string;
  args?: any[];
  value?: bigint;
}

export interface DeploymentResult {
  contractAddress: Address;
  transactionHash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
  abi: any[];
  bytecode?: `0x${string}`;
}
