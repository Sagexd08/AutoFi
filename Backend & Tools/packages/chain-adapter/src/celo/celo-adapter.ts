import type { ChainAdapter, AdapterConstructorOptions } from '../adapter.js';
import type { ChainId, TxBuildParams, GasEstimate, SimulationResult, BroadcastResult } from '../types.js';
import { 
  createPublicClient, 
  createWalletClient, 
  http,
  type PublicClient,
  type WalletClient,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo, celoAlfajores } from 'viem/chains';

const CELO_CHAINS = {
  42220: celo,
  44787: celoAlfajores,
} as const;

export class CeloAdapter implements ChainAdapter {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private account?: ReturnType<typeof privateKeyToAccount>;
  private chainId: ChainId;
  private chain: typeof celo | typeof celoAlfajores;

  constructor(options: AdapterConstructorOptions & { chainId?: ChainId }) {
    this.chainId = options.chainId ?? 42220;
    this.chain = CELO_CHAINS[this.chainId as keyof typeof CELO_CHAINS] ?? celo;
    
    const rpcUrl = options.rpcUrl || this.getDefaultRpcUrl();

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(rpcUrl),
    }) as PublicClient;

    if (options.privateKey) {
      this.account = privateKeyToAccount(options.privateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        chain: this.chain,
        transport: http(rpcUrl),
        account: this.account,
      });
    }
  }

  private getDefaultRpcUrl(): string {
    return this.chainId === 44787
      ? 'https://alfajores-forno.celo-testnet.org'
      : 'https://forno.celo.org';
  }

  getChainId(): ChainId {
    return this.chainId;
  }

  getName(): string {
    return this.chainId === 44787 ? 'celo-alfajores' : 'celo';
  }

  async getBalance(address: string): Promise<bigint> {
    return this.publicClient.getBalance({ address: address as `0x${string}` });
  }

  async getBlockNumber(): Promise<number> {
    const blockNumber = await this.publicClient.getBlockNumber();
    return Number(blockNumber);
  }

  async estimateGas(params: TxBuildParams): Promise<GasEstimate> {
    const gasLimit = await this.publicClient.estimateGas({
      account: params.from as `0x${string}`,
      to: params.to as `0x${string}`,
      data: params.data as `0x${string}` | undefined,
      value: params.value,
    });

    const gasPrice = await this.publicClient.getGasPrice();

    return {
      gasLimit,
      gasPrice,
    };
  }

  async simulateTransaction(params: TxBuildParams): Promise<SimulationResult> {
    try {
      const result = await this.publicClient.call({
        account: params.from as `0x${string}`,
        to: params.to as `0x${string}`,
        data: params.data as `0x${string}` | undefined,
        value: params.value,
      });

      const gasEstimate = await this.estimateGas(params);

      return {
        success: true,
        gasUsed: gasEstimate.gasLimit,
        returnValue: result.data,
      };
    } catch (error: any) {
      return {
        success: false,
        revertReason: error.message,
      };
    }
  }

  async buildTransaction(params: TxBuildParams): Promise<string> {
    // For Celo, we return a serialized transaction request
    const tx = {
      to: params.to,
      value: params.value?.toString(),
      data: params.data,
      gasLimit: params.gasLimit?.toString(),
      maxFeePerGas: params.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: params.maxPriorityFeePerGas?.toString(),
      nonce: params.nonce,
      chainId: this.chainId,
    };
    return JSON.stringify(tx);
  }

  async signTransaction(rawTx: string): Promise<string> {
    if (!this.walletClient || !this.account) {
      throw new Error('Wallet client not configured. Private key required.');
    }

    const tx = JSON.parse(rawTx);
    const signedTx = await this.walletClient.signTransaction({
      account: this.account,
      to: tx.to as `0x${string}`,
      value: tx.value ? BigInt(tx.value) : undefined,
      data: tx.data as `0x${string}` | undefined,
      gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
      maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
      nonce: tx.nonce,
      chain: this.chain,
    });

    return signedTx;
  }

  async broadcastSignedTransaction(signedTx: string): Promise<BroadcastResult> {
    const hash = await this.publicClient.sendRawTransaction({
      serializedTransaction: signedTx as `0x${string}`,
    });

    return {
      hash,
      status: 'pending',
    };
  }

  async callStatic(params: TxBuildParams): Promise<any> {
    const result = await this.publicClient.call({
      account: params.from as `0x${string}`,
      to: params.to as `0x${string}`,
      data: params.data as `0x${string}` | undefined,
      value: params.value,
    });
    return result.data;
  }

  // Convenience method for sending transaction directly
  async sendTransaction(params: TxBuildParams): Promise<Hash> {
    if (!this.walletClient || !this.account) {
      throw new Error('Wallet client not configured. Private key required.');
    }

    return this.walletClient.sendTransaction({
      account: this.account,
      to: params.to as `0x${string}`,
      value: params.value,
      data: params.data as `0x${string}` | undefined,
      gas: params.gasLimit,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      nonce: params.nonce,
      chain: this.chain,
    });
  }
}

export default CeloAdapter;
