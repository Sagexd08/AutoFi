import { pino } from 'pino';
import { TenderlySimulator, createTenderlySimulator } from './tenderly.js';
import { AnvilSimulator, createAnvilSimulator } from './anvil.js';
import {
  SimulationConfig,
  SimulationProvider,
  SimulationRequest,
  SimulationResult,
  TransactionToSimulate,
  SimulationStep,
} from './types.js';

const logger = pino({ name: 'simulation-engine' });

/**
 * Unified Simulation Engine
 * Supports both Tenderly (cloud) and Anvil (local) simulation
 */
export class SimulationEngine {
  private provider: SimulationProvider;
  private tenderly?: TenderlySimulator;
  private anvil?: AnvilSimulator;
  private config: SimulationConfig;

  constructor(config: SimulationConfig) {
    this.config = config;
    this.provider = config.provider;

    if (this.provider === 'tenderly') {
      this.tenderly = createTenderlySimulator(config);
    } else if (this.provider === 'anvil' || this.provider === 'hardhat') {
      this.anvil = createAnvilSimulator(config);
    }

    logger.info({ provider: this.provider }, 'Simulation engine initialized');
  }

  /**
   * Simulate a single transaction
   */
  async simulate(transaction: TransactionToSimulate, saveSimulation = false): Promise<SimulationResult> {
    const request: SimulationRequest = {
      steps: [{
        index: 0,
        transaction,
      }],
      fromAddress: transaction.from,
      chainId: transaction.chainId,
      saveSimulation,
    };

    return this.simulateSteps(request);
  }

  /**
   * Simulate multiple transactions as a bundle
   */
  async simulateBundle(
    transactions: TransactionToSimulate[],
    fromAddress: string,
    chainId: number,
    saveSimulation = false
  ): Promise<SimulationResult> {
    const steps: SimulationStep[] = transactions.map((tx, index) => ({
      index,
      transaction: tx,
    }));

    const request: SimulationRequest = {
      steps,
      fromAddress,
      chainId,
      saveSimulation,
    };

    return this.simulateSteps(request);
  }

  /**
   * Simulate steps with proper provider
   */
  async simulateSteps(request: SimulationRequest): Promise<SimulationResult> {
    const startTime = Date.now();

    try {
      logger.info({
        provider: this.provider,
        chainId: request.chainId,
        stepCount: request.steps.length,
      }, 'Starting simulation');

      let result: SimulationResult;

      if (this.provider === 'tenderly' && this.tenderly) {
        if (request.steps.length === 1) {
          result = await this.tenderly.simulateSingle(request);
        } else {
          result = await this.tenderly.simulateBundle(request);
        }
      } else if ((this.provider === 'anvil' || this.provider === 'hardhat') && this.anvil) {
        if (request.steps.length === 1) {
          result = await this.anvil.simulateSingle(request);
        } else {
          result = await this.anvil.simulateBundle(request);
        }
      } else {
        throw new Error(`Unknown simulation provider: ${this.provider}`);
      }

      const processingTime = Date.now() - startTime;
      logger.info({
        success: result.success,
        stepCount: result.steps.length,
        totalGasUsed: result.totalGasUsed,
        processingTimeMs: processingTime,
      }, 'Simulation complete');

      return result;
    } catch (error) {
      logger.error({ error }, 'Simulation engine error');
      
      return {
        success: false,
        steps: [],
        totalGasUsed: '0',
        allBalanceChanges: [],
        allEvents: [],
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        simulatedAt: new Date().toISOString(),
        blockNumber: 0,
      };
    }
  }

  /**
   * Create a fork for interactive testing
   */
  async createFork(chainId: number, blockNumber?: number): Promise<{
    forkId?: string;
    rpcUrl: string;
  }> {
    if (this.provider === 'tenderly' && this.tenderly) {
      return this.tenderly.createFork(chainId, blockNumber);
    } else if (this.anvil) {
      // For Anvil, we need an upstream RPC URL
      const rpcUrls: Record<number, string> = {
        1: 'https://eth.llamarpc.com',
        137: 'https://polygon.llamarpc.com',
        42161: 'https://arbitrum.llamarpc.com',
        10: 'https://optimism.llamarpc.com',
        8453: 'https://base.llamarpc.com',
        43114: 'https://avalanche.llamarpc.com',
        56: 'https://bsc.llamarpc.com',
        42220: 'https://forno.celo.org',
      };
      
      const upstreamRpc = rpcUrls[chainId];
      if (!upstreamRpc) {
        throw new Error(`No RPC URL configured for chain ${chainId}`);
      }

      await this.anvil.createFork(chainId, upstreamRpc, blockNumber ? BigInt(blockNumber) : undefined);
      return { rpcUrl: this.config.anvilRpcUrl || 'http://127.0.0.1:8545' };
    }

    throw new Error('No simulator available');
  }

  /**
   * Delete a Tenderly fork (no-op for Anvil)
   */
  async deleteFork(forkId: string): Promise<void> {
    if (this.provider === 'tenderly' && this.tenderly) {
      await this.tenderly.deleteFork(forkId);
    }
    // Anvil forks are reset automatically
  }

  /**
   * Get the current provider
   */
  getProvider(): SimulationProvider {
    return this.provider;
  }

  /**
   * Switch provider at runtime
   */
  switchProvider(config: SimulationConfig): void {
    this.config = config;
    this.provider = config.provider;

    if (this.provider === 'tenderly') {
      this.tenderly = createTenderlySimulator(config);
      this.anvil = undefined;
    } else {
      this.anvil = createAnvilSimulator(config);
      this.tenderly = undefined;
    }

    logger.info({ provider: this.provider }, 'Switched simulation provider');
  }
}

/**
 * Create a simulation engine with given configuration
 */
export function createSimulationEngine(config: SimulationConfig): SimulationEngine {
  return new SimulationEngine(config);
}

/**
 * Create simulation engine from environment variables
 */
export function createSimulationEngineFromEnv(): SimulationEngine {
  const provider = (process.env.SIMULATION_PROVIDER || 'tenderly') as SimulationProvider;

  const config: SimulationConfig = {
    provider,
    tenderlyAccessKey: process.env.TENDERLY_ACCESS_KEY,
    tenderlyAccountSlug: process.env.TENDERLY_ACCOUNT_SLUG,
    tenderlyProjectSlug: process.env.TENDERLY_PROJECT_SLUG,
    anvilRpcUrl: process.env.ANVIL_RPC_URL || 'http://127.0.0.1:8545',
  };

  return new SimulationEngine(config);
}
