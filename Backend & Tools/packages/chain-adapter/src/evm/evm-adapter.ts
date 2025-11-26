import type { ChainAdapter, AdapterConstructorOptions } from '../adapter.js';
import type { ChainId, TxBuildParams, GasEstimate, SimulationResult, BroadcastResult } from '../types.js';
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export class EvmAdapter implements ChainAdapter {
  private rpcUrl: string;
  private chainId: ChainId;
  private walletPrivateKey?: string;
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private account: ReturnType<typeof privateKeyToAccount> | null = null;

  constructor(options: AdapterConstructorOptions) {
    this.rpcUrl = options.rpcUrl || 'http://localhost:8545';
    this.chainId = options.chainId ?? 1;
    this.walletPrivateKey = options.privateKey;

    const chain = {
      id: this.chainId,
      name: 'custom',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [this.rpcUrl] },
      },
    } as const;

    this.publicClient = createPublicClient({ 
      transport: http(this.rpcUrl), 
      chain,
    }) as PublicClient;

    if (this.walletPrivateKey) {
      this.account = privateKeyToAccount(this.walletPrivateKey as `0x${string}`);
      this.walletClient = createWalletClient({ 
        transport: http(this.rpcUrl), 
        account: this.account, 
        chain,
      });
    }
  }

  getChainId(): ChainId {
    return this.chainId;
  }

  getName(): string {
    return `evm-${this.chainId}`;
  }

  async getBalance(address: string): Promise<bigint> {
    return this.publicClient.getBalance({ address: address as `0x${string}` });
  }

  async getBlockNumber(): Promise<number> {
    return Number(await this.publicClient.getBlockNumber());
  }

  async estimateGas(params: TxBuildParams): Promise<GasEstimate> {
    const estimate = await this.publicClient.estimateGas({
      to: params.to as `0x${string}`,
      account: params.from as `0x${string}`,
      data: params.data as `0x${string}` | undefined,
      value: params.value,
    });

    const gasPrice = await this.publicClient.getGasPrice();

    return {
      gasLimit: estimate,
      gasPrice,
    };
  }

  async simulateTransaction(params: TxBuildParams): Promise<SimulationResult> {
    try {
      const result = await this.publicClient.call({
        to: params.to as `0x${string}`,
        account: params.from as `0x${string}`,
        data: params.data as `0x${string}` | undefined,
        value: params.value,
      });

      const gasEstimate = await this.estimateGas(params);

      return {
        success: true,
        gasUsed: gasEstimate.gasLimit,
        returnValue: result.data,
        warnings: [],
      };
    } catch (error: any) {
      return {
        success: false,
        revertReason: error?.message ?? String(error),
        warnings: [],
      };
    }
  }

  async buildTransaction(params: TxBuildParams): Promise<string> {
    // For EVM, we return an encoded unsigned tx object as JSON string
    const raw = JSON.stringify({ ...params, chainId: this.chainId });
    return raw;
  }

  async signTransaction(_rawTx: string): Promise<string> {
    if (!this.walletClient) throw new Error('Wallet client not initialized');
    // Placeholder: in real implementation use walletClient to sign
    // Return base64 of rawTx as "signed"
    return Buffer.from(_rawTx).toString('base64');
  }

  async broadcastSignedTransaction(_signedTx: string): Promise<BroadcastResult> {
    // Placeholder broadcast - in real code decode signedTx, send via public client
    const mockHash = `0x${Date.now().toString(16)}${'0'.repeat(56)}`;
    return { hash: mockHash, status: 'pending' };
  }

  async callStatic(params: TxBuildParams): Promise<any> {
    const result = await this.publicClient.call({
      to: params.to as `0x${string}`,
      data: params.data as `0x${string}` | undefined,
      account: params.from as `0x${string}`,
    });
    return result.data;
  }
}

export default EvmAdapter;
