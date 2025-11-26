import { pino } from 'pino';
import {
  SimulationConfig,
  SimulationRequest,
  SimulationResult,
  StepSimulationResult,
  BalanceChange,
  EmittedEvent,
  TenderlySimulationRequest,
  TenderlySimulationResponse,
  TenderlyBundleRequest,
  TenderlyBundleResponse,
} from './types.js';

const logger = pino({ name: 'tenderly-simulator' });

/**
 * Tenderly Simulation Client
 * Provides fork-based transaction simulation via Tenderly API
 */
export class TenderlySimulator {
  private accessKey: string;
  private accountSlug: string;
  private projectSlug: string;
  private baseUrl: string;

  constructor(config: SimulationConfig) {
    if (!config.tenderlyAccessKey) {
      throw new Error('Tenderly access key is required');
    }
    if (!config.tenderlyAccountSlug || !config.tenderlyProjectSlug) {
      throw new Error('Tenderly account and project slugs are required');
    }

    this.accessKey = config.tenderlyAccessKey;
    this.accountSlug = config.tenderlyAccountSlug;
    this.projectSlug = config.tenderlyProjectSlug;
    this.baseUrl = 'https://api.tenderly.co/api/v1';
  }

  /**
   * Simulate a single transaction
   */
  async simulateSingle(request: SimulationRequest): Promise<SimulationResult> {
    const step = request.steps[0];
    if (!step) {
      return this.emptyResult('No transaction to simulate');
    }

    try {
      logger.info({ chainId: request.chainId, from: request.fromAddress }, 'Starting single simulation');

      const tenderlyRequest: TenderlySimulationRequest = {
        network_id: request.chainId.toString(),
        from: step.transaction.from,
        to: step.transaction.to,
        input: step.transaction.data || '0x',
        value: step.transaction.value || '0',
        gas: parseInt(step.transaction.gasLimit || '8000000'),
        save: request.saveSimulation,
        save_if_fails: true,
        simulation_type: 'full',
        block_number: request.blockNumber,
      };

      const response = await this.callApi<TenderlySimulationResponse>(
        `/account/${this.accountSlug}/project/${this.projectSlug}/simulate`,
        tenderlyRequest
      );

      return this.parseSimulationResponse([response]);
    } catch (error) {
      logger.error({ error }, 'Simulation failed');
      return this.emptyResult(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Simulate multiple transactions as a bundle (maintains state between)
   */
  async simulateBundle(request: SimulationRequest): Promise<SimulationResult> {
    if (request.steps.length === 0) {
      return this.emptyResult('No transactions to simulate');
    }

    try {
      logger.info({ 
        chainId: request.chainId, 
        stepCount: request.steps.length 
      }, 'Starting bundle simulation');

      const bundleRequest: TenderlyBundleRequest = {
        network_id: request.chainId.toString(),
        block_number: request.blockNumber,
        from: request.fromAddress,
        save: request.saveSimulation,
        simulations: request.steps.map(step => ({
          from: step.transaction.from,
          to: step.transaction.to,
          input: step.transaction.data || '0x',
          value: step.transaction.value || '0',
          gas: parseInt(step.transaction.gasLimit || '8000000'),
        })),
      };

      const response = await this.callApi<TenderlyBundleResponse>(
        `/account/${this.accountSlug}/project/${this.projectSlug}/simulate-bundle`,
        bundleRequest
      );

      return this.parseSimulationResponse(response.simulation_results);
    } catch (error) {
      logger.error({ error }, 'Bundle simulation failed');
      return this.emptyResult(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Create a fork for interactive simulation
   */
  async createFork(chainId: number, blockNumber?: number): Promise<{
    forkId: string;
    rpcUrl: string;
  }> {
    try {
      const response = await this.callApi<{
        simulation_fork: {
          id: string;
          head_simulation_id: string;
        };
      }>(
        `/account/${this.accountSlug}/project/${this.projectSlug}/fork`,
        {
          network_id: chainId.toString(),
          block_number: blockNumber,
        }
      );

      const forkId = response.simulation_fork.id;
      const rpcUrl = `https://rpc.tenderly.co/fork/${forkId}`;

      logger.info({ forkId, chainId }, 'Fork created');

      return { forkId, rpcUrl };
    } catch (error) {
      logger.error({ error }, 'Fork creation failed');
      throw error;
    }
  }

  /**
   * Delete a fork
   */
  async deleteFork(forkId: string): Promise<void> {
    try {
      await fetch(
        `${this.baseUrl}/account/${this.accountSlug}/project/${this.projectSlug}/fork/${forkId}`,
        {
          method: 'DELETE',
          headers: {
            'X-Access-Key': this.accessKey,
          },
        }
      );
      logger.info({ forkId }, 'Fork deleted');
    } catch (error) {
      logger.error({ error, forkId }, 'Fork deletion failed');
    }
  }

  /**
   * Get share URL for a simulation
   */
  getShareUrl(simulationId: string): string {
    return `https://dashboard.tenderly.co/${this.accountSlug}/${this.projectSlug}/simulator/${simulationId}`;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async callApi<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': this.accessKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Tenderly API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private parseSimulationResponse(
    responses: TenderlySimulationResponse[]
  ): SimulationResult {
    const steps: StepSimulationResult[] = [];
    const allBalanceChanges: BalanceChange[] = [];
    const allEvents: EmittedEvent[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    let totalGasUsed = BigInt(0);
    let overallSuccess = true;

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const simulation = response.simulation;
      const success = simulation.status;

      if (!success) {
        overallSuccess = false;
        errors.push(`Step ${i + 1}: ${simulation.error_message || 'Transaction reverted'}`);
      }

      const gasUsed = BigInt(simulation.gas_used);
      totalGasUsed += gasUsed;

      // Parse logs
      const logs: EmittedEvent[] = (response.logs || []).map(log => ({
        address: log.address,
        name: log.name || 'Unknown',
        args: {},
        topics: log.topics,
        data: log.data,
      }));

      allEvents.push(...logs);

      steps.push({
        stepIndex: i,
        success,
        gasUsed: gasUsed.toString(),
        gasLimit: simulation.gas.toString(),
        returnData: response.transaction?.input,
        error: simulation.error_message,
        revertReason: simulation.error_message,
        logs,
        balanceChanges: [], // Would parse from asset_changes in full response
      });
    }

    // Get first simulation ID for share URL
    const firstSimId = responses[0]?.simulation?.id;

    return {
      success: overallSuccess,
      steps,
      totalGasUsed: totalGasUsed.toString(),
      allBalanceChanges,
      allEvents,
      warnings,
      errors,
      simulatedAt: new Date().toISOString(),
      blockNumber: responses[0]?.simulation?.block_number || 0,
      simulationUrl: firstSimId ? this.getShareUrl(firstSimId) : undefined,
    };
  }

  private emptyResult(error: string): SimulationResult {
    return {
      success: false,
      steps: [],
      totalGasUsed: '0',
      allBalanceChanges: [],
      allEvents: [],
      warnings: [],
      errors: [error],
      simulatedAt: new Date().toISOString(),
      blockNumber: 0,
    };
  }
}

/**
 * Create a Tenderly simulator instance
 */
export function createTenderlySimulator(config: SimulationConfig): TenderlySimulator {
  return new TenderlySimulator(config);
}
