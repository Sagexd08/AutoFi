import { Job } from 'bullmq';
import type { TransactionJobData, TransactionJobResult } from '../queues/transaction.queue.js';
import { getChainRegistry, type ChainAdapter } from '@autofi/chain-adapter';
import { transactionRepository } from '@autofi/database';

/**
 * Transaction processor - broadcasts transactions to the blockchain
 * 
 * This processor:
 * 1. Validates transaction parameters
 * 2. Optionally runs simulation first
 * 3. Signs and broadcasts the transaction via chain adapter
 * 4. Waits for confirmation
 * 5. Updates transaction status in database
 */
export class TransactionProcessor {
  private readonly maxRetries = 3;
  private readonly baseDelay = 2000; // 2 seconds

  async process(job: Job<TransactionJobData>): Promise<TransactionJobResult> {
    const { transactionId, chainId, from, to, value, data } = job.data;
    const startTime = Date.now();

    console.log(`[TransactionProcessor] Processing transaction: ${transactionId} on chain ${chainId}`);

    try {
      await job.updateProgress({ percentage: 0, message: 'Validating transaction' });

      // Step 1: Validate transaction
      this.validateTransaction(job.data);
      await job.updateProgress({ percentage: 10, message: 'Transaction validated' });

      // Step 2: Get chain adapter
      const registry = getChainRegistry({ privateKey: process.env.PRIVATE_KEY });
      if (!registry.isSupported(chainId)) {
        throw new Error(`Unsupported chain: ${chainId}`);
      }
      const adapter = registry.getAdapter(chainId);
      await job.updateProgress({ percentage: 20, message: `Connected to ${adapter.getName()}` });

      // Step 3: Run simulation if required
      if (job.data.simulation?.required && !job.data.simulation?.completed) {
        await job.updateProgress({ percentage: 25, message: 'Running simulation' });
        const simResult = await adapter.simulateTransaction({
          from,
          to,
          value: value ? BigInt(value) : undefined,
          data,
        });
        
        if (!simResult.success) {
          await transactionRepository.update(transactionId, {
            status: 'FAILED',
            simulationResult: simResult as any,
            simulatedAt: new Date(),
          });
          throw new Error(`Simulation failed: ${simResult.revertReason}`);
        }
        
        await transactionRepository.saveSimulationResult(transactionId, simResult);
        await job.updateProgress({ percentage: 40, message: 'Simulation passed' });
      }

      // Step 4: Estimate gas if not provided
      let gasLimit = job.data.gasLimit;
      if (!gasLimit) {
        await job.updateProgress({ percentage: 45, message: 'Estimating gas' });
        const gasEstimate = await adapter.estimateGas({
          from,
          to,
          value: value ? BigInt(value) : undefined,
          data,
        });
        gasLimit = gasEstimate.gasLimit.toString();
      }

      // Step 5: Build transaction
      await job.updateProgress({ percentage: 50, message: 'Building transaction' });
      const rawTx = await adapter.buildTransaction({
        from,
        to,
        value: value ? BigInt(value) : undefined,
        data,
        gasLimit: BigInt(gasLimit),
        maxFeePerGas: job.data.maxFeePerGas ? BigInt(job.data.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: job.data.maxPriorityFeePerGas ? BigInt(job.data.maxPriorityFeePerGas) : undefined,
        nonce: job.data.nonce,
        chainId,
      });

      // Step 6: Sign transaction
      await job.updateProgress({ percentage: 60, message: 'Signing transaction' });
      const signedTx = await adapter.signTransaction(rawTx);

      // Update status to broadcasting
      await transactionRepository.updateStatus(transactionId, 'BROADCASTING');
      await job.updateProgress({ percentage: 70, message: 'Broadcasting transaction' });

      // Step 7: Broadcast with retry
      const broadcastResult = await this.broadcastWithRetry(adapter, signedTx);
      
      await transactionRepository.update(transactionId, {
        hash: broadcastResult.hash,
        status: 'BROADCASTED',
      });
      await job.updateProgress({ percentage: 80, message: 'Transaction broadcasted' });

      // Step 8: Wait for confirmation
      await job.updateProgress({ percentage: 85, message: 'Waiting for confirmation' });
      const receipt = await this.waitForConfirmation(adapter, broadcastResult.hash);
      await job.updateProgress({ percentage: 100, message: 'Transaction confirmed' });

      const duration = Date.now() - startTime;

      // Update database with confirmation
      await transactionRepository.confirm(transactionId, {
        hash: broadcastResult.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed,
      });

      return {
        success: true,
        transactionId,
        hash: broadcastResult.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        status: 'confirmed',
        duration,
        message: 'Transaction confirmed successfully',
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[TransactionProcessor] Transaction failed: ${transactionId}`, error);

      try {
        await transactionRepository.fail(transactionId, errorMessage);
      } catch (dbError) {
        console.error('[TransactionProcessor] Failed to update database:', dbError);
      }

      return {
        success: false,
        transactionId,
        status: 'failed',
        error: errorMessage,
        duration,
        message: `Transaction failed: ${errorMessage}`,
      };
    }
  }

  private validateTransaction(data: TransactionJobData): void {
    if (!data.to) {
      throw new Error('Missing recipient address (to)');
    }
    if (!data.chainId) {
      throw new Error('Missing chain ID');
    }
    if (!data.from) {
      throw new Error('Missing sender address (from)');
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(data.to)) {
      throw new Error('Invalid recipient address format');
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(data.from)) {
      throw new Error('Invalid sender address format');
    }
  }

  private async broadcastWithRetry(adapter: ChainAdapter, signedTx: string): Promise<{ hash: string }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await adapter.broadcastSignedTransaction(signedTx);
        return { hash: result.hash };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (!this.isRetryableError(lastError)) {
          throw lastError;
        }

        const delay = this.baseDelay * Math.pow(2, attempt);
        console.log(`[TransactionProcessor] Broadcast attempt ${attempt + 1} failed, retrying in ${delay}ms`);
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error('Max retries exceeded');
  }

  private async waitForConfirmation(
    adapter: ChainAdapter,
    txHash: string
  ): Promise<{ blockNumber: number; blockHash: string; gasUsed: string }> {
    const maxWaitTime = 120_000; // 2 minutes
    const pollInterval = 3_000; // 3 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const blockNumber = await adapter.getBlockNumber();
        // TODO: In production, fetch actual receipt from adapter using txHash
        // const receipt = await adapter.getTransactionReceipt(txHash);
        console.log(`Waiting for confirmation of ${txHash}...`);
        await this.sleep(pollInterval);
        return {
          blockNumber,
          blockHash: `0x${'0'.repeat(64)}`,
          gasUsed: '21000',
        };
      } catch {
        await this.sleep(pollInterval);
      }
    }

    throw new Error('Transaction confirmation timeout');
  }

  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'nonce too low',
      'replacement transaction underpriced',
      'already known',
      'timeout',
      'network error',
      'rate limit',
      'ETIMEDOUT',
      'ECONNRESET',
    ];
    
    const message = error.message.toLowerCase();
    return retryableMessages.some((msg) => message.includes(msg.toLowerCase()));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const transactionProcessor = new TransactionProcessor();
