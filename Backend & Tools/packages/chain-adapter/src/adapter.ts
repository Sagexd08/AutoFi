import type { ChainId, TxBuildParams, GasEstimate, SimulationResult, BroadcastResult } from './types.js';

export interface ChainAdapter {
  // Basic info
  getChainId(): ChainId;
  getName(): string;

  // Read helpers
  getBalance(address: string): Promise<bigint>;
  getBlockNumber(): Promise<number>;

  // Estimate & simulate
  estimateGas(params: TxBuildParams): Promise<GasEstimate>;
  simulateTransaction(params: TxBuildParams): Promise<SimulationResult>;

  // Build/sign/broadcast
  buildTransaction(params: TxBuildParams): Promise<string>; // returns raw unsigned tx or data
  signTransaction(rawTx: string): Promise<string>;
  broadcastSignedTransaction(signedTx: string): Promise<BroadcastResult>;

  // Convenience
  callStatic(params: TxBuildParams): Promise<any>;
}

export type AdapterConstructorOptions = {
  rpcUrl?: string;
  privateKey?: string;
  chainId?: ChainId;
  providerName?: string;
};
