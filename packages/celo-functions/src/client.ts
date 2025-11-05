import {
  createPublicClient,
  createWalletClient,
  http,
  Address,
  Hash,
  PublicClient,
  WalletClient,
} from 'viem';
import { celo, celoAlfajores } from 'viem/chains';
import type {
  TransactionResult,
  TokenBalance,
  TransactionRequest,
  EventFilter,
  ContractCall,
  DeploymentResult,
} from '@celo-automator/types';

const CELO_CHAINS = {
  alfajores: celoAlfajores,
  mainnet: celo,
} as const;

export interface CeloClientConfig {
  privateKey?: string;
  network: 'alfajores' | 'mainnet';
  rpcUrl?: string;
}

export class CeloClient {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private chain: typeof celo | typeof celoAlfajores;
  private networkConfig: CeloClientConfig;

  constructor(config: CeloClientConfig) {
    this.networkConfig = config;
    this.chain = CELO_CHAINS[config.network];
    const rpcUrl = config.rpcUrl || this.getDefaultRpcUrl(config.network);

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(rpcUrl),
    });

    if (config.privateKey) {
      this.walletClient = createWalletClient({
        chain: this.chain,
        transport: http(rpcUrl),
        account: config.privateKey as Address,
      });
    }
  }

  private getDefaultRpcUrl(network: 'alfajores' | 'mainnet'): string {
    return network === 'alfajores'
      ? 'https://alfajores-forno.celo-testnet.org'
      : 'https://forno.celo.org';
  }

  getPublicClient(): PublicClient {
    return this.publicClient;
  }

  getWalletClient(): WalletClient | undefined {
    return this.walletClient;
  }

  getChain() {
    return this.chain;
  }

  getNetworkConfig(): CeloClientConfig {
    return this.networkConfig;
  }
}
