import { pino } from 'pino';
import { WalletConfig, WalletProvider } from './types.js';
import { LocalWalletProvider } from './local-wallet.js';
import { PrivyWalletProvider } from './privy-wallet.js';
import { FireblocksWalletProvider } from './fireblocks-wallet.js';

const logger = pino({ name: 'wallet-manager' });

export class WalletManager {
  private provider: WalletProvider;

  constructor(config: WalletConfig) {
    if (config.type === 'local') {
      if (!config.privateKey) throw new Error('Private key required for local wallet');
      this.provider = new LocalWalletProvider(config.privateKey);
    } else if (config.type === 'privy') {
      if (!config.privyAppId || !config.privyAppSecret) throw new Error('Privy credentials required');
      this.provider = new PrivyWalletProvider(config.privyAppId, config.privyAppSecret);
    } else if (config.type === 'fireblocks') {
      if (!config.fireblocksApiKey || !config.fireblocksSecretKey) throw new Error('Fireblocks credentials required');
      this.provider = new FireblocksWalletProvider(config.fireblocksApiKey, config.fireblocksSecretKey);
    } else {
      throw new Error(`Wallet type ${config.type} not yet implemented`);
    }
  }

  async getAddress(): Promise<string> {
    return this.provider.getAddress();
  }

  async signTransaction(tx: any): Promise<string> {
    logger.info({ to: tx.to, chainId: tx.chainId }, 'Signing transaction');
    return this.provider.signTransaction(tx);
  }
}

export function createWalletManager(config: WalletConfig): WalletManager {
  return new WalletManager(config);
}
