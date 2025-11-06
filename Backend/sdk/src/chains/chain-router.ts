import { MultiChainManager } from './multi-chain-manager';
export class ChainRouter {
  constructor(private multiChainManager: MultiChainManager) {}
  async routeTransaction(request: any, preferences?: any): Promise<string> {
    const chains = await this.multiChainManager.getSupportedChains();
    const healthyChains = chains.filter(chain => 
      this.multiChainManager.getChainHealth(chain.id)
    );
    if (preferences?.chainId) {
      const preferredChain = healthyChains.find(c => c.id === preferences.chainId);
      if (preferredChain) return preferredChain.id;
    }
    return healthyChains[0]?.id || 'ethereum';
  }
}
