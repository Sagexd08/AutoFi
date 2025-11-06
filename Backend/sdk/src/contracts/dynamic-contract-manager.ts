import { EventEmitter } from 'events';
import { ContractFactory } from './contract-factory';
export class DynamicContractManager extends EventEmitter {
  private readonly contractFactory: ContractFactory;
  private readonly deployedContracts: Map<string, any> = new Map();
  constructor(contractFactory: ContractFactory) {
    super();
    this.contractFactory = contractFactory;
  }
  async deployContract(config: any, chainId: string): Promise<any> {
    const deployment = await this.contractFactory.deployContract(config, chainId);
    if (deployment.success && deployment.contractAddress) {
      this.deployedContracts.set(deployment.contractAddress, {
        ...deployment,
        chainId,
        deployedAt: new Date(),
      });
      this.emit('contractDeployed', deployment);
    }
    return deployment;
  }
  async updateContract(address: string, updates: any): Promise<void> {
    const contract = this.deployedContracts.get(address);
    if (contract) {
      Object.assign(contract, updates);
      this.emit('contractUpdated', { address, updates });
    }
  }
  async getContract(address: string): Promise<any> {
    return this.deployedContracts.get(address);
  }
  async getAllContracts(): Promise<any[]> {
    return Array.from(this.deployedContracts.values());
  }
}
