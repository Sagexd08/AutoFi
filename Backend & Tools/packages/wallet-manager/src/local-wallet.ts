import { type Account } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { WalletProvider, TransactionRequest } from './types.js';

export class LocalWalletProvider implements WalletProvider {
  private account: Account;
  
  constructor(privateKey: string) {
    if (!privateKey.startsWith('0x')) {
      privateKey = `0x${privateKey}`;
    }
    this.account = privateKeyToAccount(privateKey as `0x${string}`);
  }

  async getAddress(): Promise<string> {
    return this.account.address;
  }

  async signTransaction(tx: TransactionRequest): Promise<string> {
    if (!this.account.signTransaction) {
      throw new Error('Account does not support signing transactions');
    }
    
    return this.account.signTransaction({
      to: tx.to as `0x${string}`,
      value: tx.value ? BigInt(tx.value) : undefined,
      data: tx.data as `0x${string}` || '0x',
      gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
      maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
      chainId: tx.chainId,
    });
  }

  async signMessage(message: string): Promise<string> {
    if (!this.account.signMessage) {
      throw new Error('Account does not support signing messages');
    }
    return this.account.signMessage({ message });
  }
}
