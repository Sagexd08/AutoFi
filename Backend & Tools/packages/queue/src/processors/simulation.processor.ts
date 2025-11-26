import { Job } from 'bullmq';
import type { SimulationJobData, SimulationJobResult } from '../queues/simulation.queue.js';

/**
 * Simulation processor - dry runs transactions to predict outcomes
 * 
 * This processor:
 * 1. Connects to simulation provider (Tenderly, Alchemy, local fork)
 * 2. Executes transaction simulation
 * 3. Analyzes state changes and balance changes
 * 4. Returns detailed simulation results
 */
export class SimulationProcessor {
  async process(job: Job<SimulationJobData>): Promise<SimulationJobResult> {
    const { transactionId, chainId, from, to, value, data } = job.data;
    const simulationId = `sim_${Date.now()}`;

    console.log(`[SimulationProcessor] Simulating transaction on chain ${chainId}`);

    try {
      await job.updateProgress({ percentage: 0, message: 'Preparing simulation' });

      // Step 1: Get current block number for simulation
      const blockNumber = job.data.blockNumber ?? await this.getLatestBlock(chainId);
      await job.updateProgress({ percentage: 20, message: 'Fetched block state' });

      // Step 2: Run simulation
      await job.updateProgress({ percentage: 40, message: 'Running simulation' });
      const simResult = await this.runSimulation({
        chainId,
        from,
        to,
        value,
        data,
        blockNumber,
        stateOverrides: job.data.stateOverrides,
      });
      await job.updateProgress({ percentage: 80, message: 'Simulation complete' });

      // Step 3: Analyze results
      await job.updateProgress({ percentage: 90, message: 'Analyzing results' });
      const analysis = this.analyzeSimulation(simResult);
      await job.updateProgress({ percentage: 100, message: 'Analysis complete' });

      return {
        success: true,
        transactionId,
        simulationId,
        gasUsed: simResult.gasUsed,
        gasLimit: simResult.gasLimit,
        wouldSucceed: simResult.success,
        returnValue: simResult.returnValue,
        revertReason: simResult.revertReason,
        logs: simResult.logs,
        stateChanges: simResult.stateChanges,
        balanceChanges: simResult.balanceChanges,
        warnings: analysis.warnings,
        message: simResult.success 
          ? 'Transaction would succeed' 
          : `Transaction would fail: ${simResult.revertReason}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('[SimulationProcessor] Simulation failed:', error);

      return {
        success: false,
        transactionId,
        simulationId,
        gasUsed: '0',
        gasLimit: '0',
        wouldSucceed: false,
        error: errorMessage,
        message: `Simulation error: ${errorMessage}`,
      };
    }
  }

  private async getLatestBlock(_chainId: number): Promise<number> {
    // TODO: Get from chain adapter
    return 12345678;
  }

  private async runSimulation(params: {
    chainId: number;
    from: string;
    to: string;
    value?: string;
    data?: string;
    blockNumber: number;
    stateOverrides?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    gasUsed: string;
    gasLimit: string;
    returnValue?: string;
    revertReason?: string;
    logs: SimulationJobResult['logs'];
    stateChanges: SimulationJobResult['stateChanges'];
    balanceChanges: SimulationJobResult['balanceChanges'];
  }> {
    // TODO: Implement actual simulation via Tenderly/Alchemy/local fork
    console.log('[SimulationProcessor] Running simulation for:', params);

    // Placeholder simulation result
    return {
      success: true,
      gasUsed: '21000',
      gasLimit: '30000',
      returnValue: '0x',
      logs: [],
      stateChanges: [],
      balanceChanges: [
        {
          address: params.from,
          before: '1000000000000000000',
          after: '999000000000000000',
          change: '-1000000000000000',
        },
        {
          address: params.to,
          before: '0',
          after: '1000000000000000',
          change: '1000000000000000',
        },
      ],
    };
  }

  private analyzeSimulation(simResult: {
    success: boolean;
    gasUsed: string;
    gasLimit: string;
    balanceChanges?: SimulationJobResult['balanceChanges'];
  }): { warnings: string[] } {
    const warnings: string[] = [];

    // Check gas usage
    const gasUsed = BigInt(simResult.gasUsed);
    const gasLimit = BigInt(simResult.gasLimit);
    const gasUsagePercent = Number((gasUsed * 100n) / gasLimit);

    if (gasUsagePercent > 90) {
      warnings.push(`High gas usage: ${gasUsagePercent}% of gas limit`);
    }

    // Check for large balance changes
    if (simResult.balanceChanges) {
      for (const change of simResult.balanceChanges) {
        const changeAmount = BigInt(change.change.replace('-', ''));
        // Warn if change is more than 100 ETH equivalent
        if (changeAmount > BigInt('100000000000000000000')) {
          warnings.push(`Large balance change detected: ${change.change} for ${change.address}`);
        }
      }
    }

    return { warnings };
  }
}

export const simulationProcessor = new SimulationProcessor();
