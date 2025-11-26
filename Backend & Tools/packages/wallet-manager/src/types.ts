// import { z } from 'zod';

export type WalletType = 'local' | 'privy' | 'fireblocks';

export interface WalletConfig {
  type: WalletType;
  // Local
  privateKey?: string;
  // Privy
  privyAppId?: string;
  privyAppSecret?: string;
  // Fireblocks
  fireblocksApiKey?: string;
  fireblocksSecretKey?: string;
}

export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  chainId: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface SignedTransaction {
  raw: string;
  hash: string;
}

export interface WalletProvider {
  getAddress(): Promise<string>;
  signTransaction(tx: TransactionRequest): Promise<string>;
  signMessage(message: string): Promise<string>;
}
