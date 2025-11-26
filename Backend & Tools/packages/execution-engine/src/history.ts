import { db as prisma } from '@autofi/database/client';
import { ExecutionResult, ExecutionRequest } from './types.js';
import { pino } from 'pino';

const logger = pino({ name: 'transaction-history' });

export class TransactionHistory {
  async recordSubmission(request: ExecutionRequest, result: ExecutionResult, userId: string) {
    try {
      await prisma.transaction.create({
        data: {
          id: result.id, // Use the execution ID as transaction ID if possible, or let DB generate
          userId: userId,
          chainId: request.chainId,
          to: request.to,
          from: result.from || 'UNKNOWN',
          value: request.value ? request.value.toString() : '0',
          data: request.data,
          hash: result.txHash,
          status: 'PENDING',
          gasLimit: request.gasLimit ? request.gasLimit.toString() : null,
        }
      });
      logger.info({ id: result.id }, 'Recorded transaction submission');
    } catch (error) {
      logger.error({ error, id: result.id }, 'Failed to record transaction submission');
    }
  }

  async updateStatus(txHash: string, status: 'CONFIRMED' | 'FAILED', receipt?: any) {
    try {
      await prisma.transaction.update({
        where: { hash: txHash },
        data: {
          status: status === 'CONFIRMED' ? 'CONFIRMED' : 'FAILED',
          blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : undefined,
          blockHash: receipt?.blockHash,
          gasUsed: receipt?.gasUsed ? receipt.gasUsed.toString() : undefined,
        }
      });
      logger.info({ txHash, status }, 'Updated transaction status');
    } catch (error) {
      logger.error({ error, txHash }, 'Failed to update transaction status');
    }
  }
}
