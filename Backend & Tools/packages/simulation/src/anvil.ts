import { createPublicClient, http, PublicClient } from 'viem';
import { mainnet, polygon, arbitrum, optimism, base, avalanche, bsc, celo, scroll, zkSync, linea, mantle } from 'viem/chains';
import { pino } from 'pino';
import {
  SimulationConfig,
  SimulationRequest,
  SimulationResult,
  StepSimulationResult,
  BalanceChange,
  EmittedEvent,
} from './types.js';

const logger = pino({ name: 'anvil-simulator' });

/**
 * Chain configuration mapping
 */
const CHAIN_CONFIG = {
  1: mainnet,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  8453: base,
  43114: avalanche,
  56: bsc,
  42220: celo,
  534352: scroll,
  324: zkSync,
  59144: linea,
  5000: mantle,
};

/**
 * Anvil/Hardhat Fork Simulator
 * Uses local Anvil instance for transaction simulation
 */
export class AnvilSimulator {
  private rpcUrl: string;
  private client: PublicClient | null = null;

  constructor(config: SimulationConfig) {
    this.rpcUrl = config.anvilRpcUrl || 'http://127.0.0.1:8545';
  }

  /**
   * Initialize connection to Anvil
   */
  async initialize(chainId: number = 1): Promise<void> {
    const chain = CHAIN_CONFIG[chainId as keyof typeof CHAIN_CONFIG] || mainnet;
    
    this.client = createPublicClient({
      chain,
      transport: http(this.rpcUrl),
    }) as PublicClient;

    try {
      const blockNumber = await this.client!.getBlockNumber();
      logger.info({ chainId, blockNumber }, 'Connected to Anvil');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Anvil');
      throw new Error('Could not connect to Anvil instance');
    }
  }

  /**
   * Create a fork from mainnet at specific block
   */
  async createFork(chainId: number, rpcUrl: string, blockNumber?: bigint): Promise<void> {
    try {
      // Use anvil_reset RPC call to fork from mainnet
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'anvil_reset',
          params: [{
            forking: {
              jsonRpcUrl: rpcUrl,
              blockNumber: blockNumber ? Number(blockNumber) : undefined,
            },
          }],
        }),
      });

      const result = await response.json() as { result?: boolean; error?: { message: string } };
      if (result.error) {
        throw new Error(result.error.message);
      }

      logger.info({ chainId, blockNumber }, 'Fork created');
      await this.initialize(chainId);
    } catch (error) {
      logger.error({ error }, 'Fork creation failed');
      throw error;
    }
  }

  /**
   * Simulate a single transaction using eth_call
   */
  async simulateSingle(request: SimulationRequest): Promise<SimulationResult> {
    const step = request.steps[0];
    if (!step) {
      return this.emptyResult('No transaction to simulate');
    }

    if (!this.client) {
      await this.initialize(request.chainId);
    }

    try {
      logger.info({ chainId: request.chainId }, 'Starting simulation');

      const tx = step.transaction;
      
      // Use eth_call for simulation
      const result = await this.client!.call({
        account: tx.from as `0x${string}`,
        to: tx.to as `0x${string}`,
        data: (tx.data || '0x') as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : undefined,
        gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
      });

      // Estimate gas
      let gasUsed = '21000';
      try {
        const gasEstimate = await this.client!.estimateGas({
          account: tx.from as `0x${string}`,
          to: tx.to as `0x${string}`,
          data: (tx.data || '0x') as `0x${string}`,
          value: tx.value ? BigInt(tx.value) : undefined,
        });
        gasUsed = gasEstimate.toString();
      } catch {
        // Use default if estimation fails
      }

      const stepResult: StepSimulationResult = {
        stepIndex: 0,
        success: true,
        gasUsed,
        gasLimit: tx.gasLimit || '8000000',
        returnData: result.data || '0x',
        logs: [],
        balanceChanges: [],
      };

      return {
        success: true,
        steps: [stepResult],
        totalGasUsed: gasUsed,
        allBalanceChanges: [],
        allEvents: [],
        warnings: [],
        errors: [],
        simulatedAt: new Date().toISOString(),
        blockNumber: Number(await this.client!.getBlockNumber()),
      };
    } catch (error) {
      logger.error({ error }, 'Simulation failed');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        steps: [{
          stepIndex: 0,
          success: false,
          gasUsed: '0',
          gasLimit: step.transaction.gasLimit || '8000000',
          error: errorMessage,
          revertReason: this.parseRevertReason(errorMessage),
          logs: [],
          balanceChanges: [],
        }],
        totalGasUsed: '0',
        allBalanceChanges: [],
        allEvents: [],
        warnings: [],
        errors: [errorMessage],
        simulatedAt: new Date().toISOString(),
        blockNumber: 0,
      };
    }
  }

  /**
   * Simulate multiple transactions (stateful)
   */
  async simulateBundle(request: SimulationRequest): Promise<SimulationResult> {
    if (!this.client) {
      await this.initialize(request.chainId);
    }

    const steps: StepSimulationResult[] = [];
    const allBalanceChanges: BalanceChange[] = [];
    const allEvents: EmittedEvent[] = [];
    const errors: string[] = [];
    let totalGasUsed = BigInt(0);
    let overallSuccess = true;

    // Snapshot current state
    const snapshotId = await this.snapshot();

    try {
      for (let i = 0; i < request.steps.length; i++) {
        const step = request.steps[i];
        const tx = step.transaction;

        try {
          // Impersonate the from address
          await this.impersonateAccount(tx.from);

          // Send the transaction
          const hash = await this.sendTransaction(tx);

          // Wait for receipt
          const receipt = await this.client!.waitForTransactionReceipt({ 
            hash: hash as `0x${string}`,
          });

          const gasUsed = receipt.gasUsed;
          totalGasUsed += gasUsed;

          // Parse logs
          const logs: EmittedEvent[] = receipt.logs.map(log => ({
            address: log.address,
            name: 'Unknown',
            args: {},
            topics: log.topics as string[],
            data: log.data,
          }));

          allEvents.push(...logs);

          steps.push({
            stepIndex: i,
            success: receipt.status === 'success',
            gasUsed: gasUsed.toString(),
            gasLimit: tx.gasLimit || '8000000',
            logs,
            balanceChanges: [],
          });

          if (receipt.status !== 'success') {
            overallSuccess = false;
            errors.push(`Step ${i + 1}: Transaction reverted`);
          }

          // Stop impersonating
          await this.stopImpersonating(tx.from);
        } catch (error) {
          overallSuccess = false;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Step ${i + 1}: ${errorMessage}`);

          steps.push({
            stepIndex: i,
            success: false,
            gasUsed: '0',
            gasLimit: tx.gasLimit || '8000000',
            error: errorMessage,
            revertReason: this.parseRevertReason(errorMessage),
            logs: [],
            balanceChanges: [],
          });

          // Stop on first failure
          break;
        }
      }
    } finally {
      // Revert to snapshot
      await this.revert(snapshotId);
    }

    return {
      success: overallSuccess,
      steps,
      totalGasUsed: totalGasUsed.toString(),
      allBalanceChanges,
      allEvents,
      warnings: [],
      errors,
      simulatedAt: new Date().toISOString(),
      blockNumber: Number(await this.client!.getBlockNumber()),
    };
  }

  /**
   * Set account balance
   */
  async setBalance(address: string, balance: bigint): Promise<void> {
    await this.rpcCall('anvil_setBalance', [address, `0x${balance.toString(16)}`]);
  }

  /**
   * Mine a block
   */
  async mine(blocks: number = 1): Promise<void> {
    await this.rpcCall('anvil_mine', [blocks]);
  }

  /**
   * Set block timestamp
   */
  async setBlockTimestamp(timestamp: number): Promise<void> {
    await this.rpcCall('evm_setNextBlockTimestamp', [timestamp]);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async snapshot(): Promise<string> {
    const result = await this.rpcCall<string>('evm_snapshot', []);
    return result;
  }

  private async revert(snapshotId: string): Promise<void> {
    await this.rpcCall('evm_revert', [snapshotId]);
  }

  private async impersonateAccount(address: string): Promise<void> {
    await this.rpcCall('anvil_impersonateAccount', [address]);
  }

  private async stopImpersonating(address: string): Promise<void> {
    await this.rpcCall('anvil_stopImpersonatingAccount', [address]);
  }

  private async sendTransaction(tx: {
    from: string;
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
  }): Promise<string> {
    const result = await this.rpcCall<string>('eth_sendTransaction', [{
      from: tx.from,
      to: tx.to,
      value: tx.value ? `0x${BigInt(tx.value).toString(16)}` : '0x0',
      data: tx.data || '0x',
      gas: tx.gasLimit ? `0x${BigInt(tx.gasLimit).toString(16)}` : undefined,
    }]);
    return result;
  }

  private async rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    const json = await response.json() as { result?: T; error?: { message: string } };
    if (json.error) {
      throw new Error(json.error.message);
    }
    return json.result as T;
  }

  private parseRevertReason(error: string): string {
    // Try to extract revert reason from error message
    const match = error.match(/reverted with reason string '([^']+)'/);
    if (match) {
      return match[1];
    }
    
    const panicMatch = error.match(/Panic\((\d+)\)/);
    if (panicMatch) {
      const code = parseInt(panicMatch[1]);
      const panicReasons: Record<number, string> = {
        0x01: 'Assertion failed',
        0x11: 'Arithmetic overflow/underflow',
        0x12: 'Division by zero',
        0x21: 'Invalid enum value',
        0x22: 'Storage access out of bounds',
        0x31: 'Pop on empty array',
        0x32: 'Array index out of bounds',
        0x41: 'Excessive memory allocation',
        0x51: 'Zero-initialized function pointer',
      };
      return panicReasons[code] || `Panic code ${code}`;
    }

    return 'Unknown revert reason';
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
 * Create an Anvil simulator instance
 */
export function createAnvilSimulator(config: SimulationConfig): AnvilSimulator {
  return new AnvilSimulator(config);
}
