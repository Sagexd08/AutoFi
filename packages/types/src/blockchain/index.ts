import { Address, Hash } from 'viem';

/**
 * Token Information for Frontend Integration
 */
export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  price?: number;
  value?: number;
}

/**
 * Blockchain Configuration
 */
export interface BlockchainConfig {
  network: 'mainnet' | 'testnet';
  rpcUrl: string;
  chainId: number;
  contracts: {
    agentRegistry: Address;
    agentTreasury: Address;
    donationSplitter: Address;
    yieldAggregator: Address;
    masterTrading: Address;
    attendanceNFT: Address;
  };
  tokens: {
    CELO: Address;
    cUSD: Address;
    cEUR: Address;
    cREAL: Address;
  };
}

/**
 * Transaction Information for tracking
 */
export interface TransactionInfo {
  hash: Hash;
  from: Address;
  to: Address;
  value: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: number;
  blockNumber?: bigint;
  gasUsed?: string;
  gasPrice?: string;
}

/**
 * Automation Execution Result
 */
export interface AutomationExecution {
  id: string;
  automationId: string;
  status: 'pending' | 'success' | 'failed';
  txHash?: Hash;
  error?: string;
  timestamp: number;
  gasUsed?: string;
  result?: any;
}

/**
 * Blockchain Event for real-time updates
 */
export interface BlockchainEvent {
  type: 'transaction' | 'automation' | 'price' | 'balance';
  data: any;
  timestamp: number;
}

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
