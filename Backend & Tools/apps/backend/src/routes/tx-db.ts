import express, { Router } from 'express';
import { z } from 'zod';
import {
  transactionRepository,
  approvalRepository,
  auditRepository,
  type TransactionStatus,
  type RiskLevel,
} from '@autofi/database';
import { CeloClient } from '@autofi/celo-functions';
import { RiskEngine } from '@autofi/risk-engine';
import type { Address } from 'viem';
import { logger } from '../utils/logger.js';
import { notificationService } from '../services/notification.js';

const router: Router = express.Router();

// Schemas
const sendTxSchema = z.object({
  to: z.string().min(1),
  from: z.string().optional(), // Optional - defaults to configured wallet
  value: z.string().optional(),
  data: z.string().optional(),
  gasLimit: z.string().optional(),
  gasPrice: z.string().optional(),
  maxFeePerGas: z.string().optional(),
  maxPriorityFeePerGas: z.string().optional(),
  chainId: z.union([z.number(), z.string()]).optional(),
  nonce: z.number().optional(),
  agentId: z.string().optional(),
  workflowId: z.string().optional(),
  memo: z.string().optional(),
  simulateOnly: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

let celoClient: CeloClient | undefined;
let riskEngine: RiskEngine | undefined;

function ensureDependencies() {
  if (!riskEngine) {
    riskEngine = new RiskEngine({
      maxRiskScore: Number(process.env.MAX_RISK_SCORE) || 0.95,
      approvalThreshold: Number(process.env.APPROVAL_THRESHOLD) || 0.6,
      blockThreshold: Number(process.env.BLOCK_THRESHOLD) || 0.85,
    });
  }

  if (!celoClient && process.env.CELO_PRIVATE_KEY) {
    celoClient = new CeloClient({
      privateKey: process.env.CELO_PRIVATE_KEY,
      network: (process.env.CELO_NETWORK as 'alfajores' | 'mainnet') || 'alfajores',
      rpcUrl: process.env.CELO_RPC_URL,
    });
  }
}

function getUserId(req: express.Request): string {
  return (req as any).userId || 'system';
}

function getRiskLevel(riskScore: number): RiskLevel {
  if (riskScore >= 0.85) return 'CRITICAL';
  if (riskScore >= 0.7) return 'HIGH';
  if (riskScore >= 0.5) return 'MEDIUM';
  return 'LOW';
}

// Send transaction
router.post('/send', async (req, res, next) => {
  try {
    ensureDependencies();

    const userId = getUserId(req);
    const parsed = sendTxSchema.parse(req.body);
    const chainId = parsed.chainId ? Number(parsed.chainId) : 42220;

    // Risk assessment
    const riskContext = {
      agentId: parsed.agentId || 'unknown',
      type: (parsed.data && parsed.data !== '0x' ? 'contract_call' : 'transfer') as 'transfer' | 'contract_call' | 'deployment',
      to: parsed.to as Address,
      value: parsed.value ? BigInt(parsed.value) : undefined,
    };

    const riskResult = await riskEngine!.validateTransaction(riskContext);
    const riskLevel = getRiskLevel(riskResult.riskScore);
    const requiresApproval = riskResult.riskScore >= 0.6;

    // Get the from address (in production would come from wallet/user config)
    const fromAddress = parsed.from || process.env.DEFAULT_FROM_ADDRESS || '0x0000000000000000000000000000000000000000';

    // Create transaction record
    const transaction = await transactionRepository.create({
      chainId,
      from: fromAddress,
      to: parsed.to,
      value: parsed.value || '0',
      data: parsed.data,
      gasLimit: parsed.gasLimit,
      gasPrice: parsed.gasPrice,
      maxFeePerGas: parsed.maxFeePerGas,
      maxPriorityFeePerGas: parsed.maxPriorityFeePerGas,
      nonce: parsed.nonce,
      status: requiresApproval ? 'AWAITING_APPROVAL' : 'QUEUED',
      riskScore: riskResult.riskScore,
      riskLevel,
      requiresApproval,
      memo: parsed.memo,
      metadata: {
        ...parsed.metadata,
        warnings: riskResult.warnings,
        recommendations: riskResult.recommendations,
      } as object,
      user: { connect: { id: userId } },
      ...(parsed.agentId && { agent: { connect: { id: parsed.agentId } } }),
      ...(parsed.workflowId && { execution: { connect: { id: parsed.workflowId } } }),
    });

    // If blocked by risk
    if (!riskResult.isValid) {
      await transactionRepository.fail(transaction.id, 'Transaction failed risk validation');

      await auditRepository.create({
        userId,
        eventType: 'TRANSACTION',
        eventCode: 'TRANSACTION_BLOCKED',
        action: 'block',
        resourceType: 'transaction',
        resourceId: transaction.id,
        success: false,
        errorMessage: 'Failed risk validation',
        ipAddress: req.ip || 'unknown',
        metadata: { riskScore: riskResult.riskScore, warnings: riskResult.warnings },
      });

      return res.status(400).json({
        success: false,
        transactionId: transaction.id,
        error: 'Transaction failed risk validation',
        riskScore: riskResult.riskScore,
        warnings: riskResult.warnings,
        recommendations: riskResult.recommendations,
      });
    }

    // If requires approval, create approval request
    if (requiresApproval) {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Map risk level to approval priority (LOW, NORMAL, HIGH, URGENT)
      const getPriority = (level: string) => {
        if (level === 'CRITICAL') return 'URGENT' as const;
        if (level === 'HIGH') return 'HIGH' as const;
        return 'NORMAL' as const;
      };

      const approval = await approvalRepository.create({
        transaction: { connect: { id: transaction.id } },
        user: { connect: { id: userId } },
        ...(parsed.agentId && { agent: { connect: { id: parsed.agentId } } }),
        riskScore: riskResult.riskScore,
        riskLevel,
        priority: getPriority(riskLevel),
        expiresAt,
        requestedBy: userId,
        requestReason: `Risk score: ${riskResult.riskScore.toFixed(2)}`,
        metadata: {
          warnings: riskResult.warnings,
          recommendations: riskResult.recommendations,
        } as object,
      });

      // Notify
      await notificationService.notifyApprovalRequired({
        approvalId: approval.id,
        transactionId: transaction.id,
        riskScore: riskResult.riskScore,
        riskLevel,
        priority: approval.priority,
        expiresAt: expiresAt.toISOString(),
        userId,
        agentId: parsed.agentId,
      });

      logger.info({
        transactionId: transaction.id,
        approvalId: approval.id,
        riskScore: riskResult.riskScore,
      }, 'Transaction requires approval');

      return res.json({
        success: true,
        transactionId: transaction.id,
        approvalId: approval.id,
        status: 'pending_approval',
        riskScore: riskResult.riskScore,
        requiresApproval: true,
        message: 'Transaction requires approval before execution',
      });
    }

    // Simulation only
    if (parsed.simulateOnly) {
      await transactionRepository.update(transaction.id, { status: 'SIMULATED' as TransactionStatus });

      return res.json({
        success: true,
        transactionId: transaction.id,
        status: 'simulated',
        riskScore: riskResult.riskScore,
        requiresApproval: false,
        metadata: { simulated: true },
      });
    }

    // Execute transaction
    if (celoClient && chainId === 42220) {
      try {
        const walletClient = celoClient.getWalletClient();
        if (!walletClient) {
          throw new Error('Wallet client not available');
        }

        const account = walletClient.account;
        if (!account) {
          throw new Error('No account configured');
        }

        await transactionRepository.update(transaction.id, { status: 'BROADCASTING' });

        const txHash = await walletClient.sendTransaction({
          account,
          to: parsed.to as Address,
          value: parsed.value ? BigInt(parsed.value) : undefined,
          data: parsed.data as `0x${string}` | undefined,
          chain: celoClient.getChain(),
        });

        // Update with hash
        await transactionRepository.update(transaction.id, {
          hash: txHash,
          status: 'PENDING',
        });

        // Notify
        notificationService.notifyTransactionPending({
          transactionId: transaction.id,
          chainId,
          to: parsed.to,
          value: parsed.value,
          agentId: parsed.agentId,
          workflowId: parsed.workflowId,
          userId,
          riskScore: riskResult.riskScore,
        });

        await auditRepository.create({
          userId,
          eventType: 'TRANSACTION',
          eventCode: 'TRANSACTION_SENT',
          action: 'send',
          resourceType: 'transaction',
          resourceId: transaction.id,
          success: true,
          ipAddress: req.ip || 'unknown',
          metadata: { hash: txHash, chainId },
        });

        logger.info({
          transactionId: transaction.id,
          hash: txHash,
          chainId,
        }, 'Transaction sent');

        return res.json({
          success: true,
          transactionId: transaction.id,
          transactionHash: txHash,
          chainId,
          riskScore: riskResult.riskScore,
          requiresApproval: false,
        });
      } catch (txError: unknown) {
        const errorMessage = txError instanceof Error ? txError.message : 'Unknown error';
        await transactionRepository.fail(transaction.id, errorMessage);

        notificationService.notifyTransactionFailed({
          transactionId: transaction.id,
          error: errorMessage,
          agentId: parsed.agentId,
          userId,
        });

        logger.error({ error: errorMessage, transactionId: transaction.id }, 'Transaction failed');

        return res.status(500).json({
          success: false,
          transactionId: transaction.id,
          error: errorMessage,
        });
      }
    }

    // Non-Celo or no client - queue for later
    return res.json({
      success: true,
      transactionId: transaction.id,
      status: 'queued',
      chainId,
      riskScore: riskResult.riskScore,
      requiresApproval: false,
      message: 'Transaction queued for execution',
    });
  } catch (error) {
    logger.error({ error }, 'Transaction send failed');
    return next(error);
  }
});

// Estimate gas
router.post('/estimate', async (req, res, next) => {
  try {
    ensureDependencies();

    const parsed = sendTxSchema.parse(req.body);
    const chainId = parsed.chainId ? Number(parsed.chainId) : 42220;

    let gasLimit = '21000';
    let gasPrice = '20000000000';

    if (celoClient && chainId === 42220) {
      try {
        const publicClient = celoClient.getPublicClient();

        const estimatedGas = await publicClient.estimateGas({
          to: parsed.to as Address,
          value: parsed.value ? BigInt(parsed.value) : undefined,
          data: parsed.data as `0x${string}` | undefined,
        });
        gasLimit = estimatedGas.toString();

        const currentGasPrice = await publicClient.getGasPrice();
        gasPrice = currentGasPrice.toString();
      } catch (error) {
        logger.warn({ error }, 'Gas estimation failed, using defaults');
      }
    }

    return res.json({
      success: true,
      gasLimit,
      gasPrice,
      maxFeePerGas: parsed.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: parsed.maxPriorityFeePerGas || '1000000000',
      chainId,
    });
  } catch (error) {
    logger.error({ error }, 'Gas estimation failed');
    return next(error);
  }
});

// Get transaction by ID or hash
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Try by ID first, then by hash
    let tx = await transactionRepository.findById(id);
    if (!tx) {
      tx = await transactionRepository.findByHash(id);
    }

    if (!tx) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
    }

    return res.json({
      success: true,
      transaction: tx,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get transaction');
    return next(error);
  }
});

// List transactions
router.get('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { status, chainId, agentId, limit = '50', offset = '0' } = req.query;

    const result = await transactionRepository.listByUser(userId, {
      skip: Number(offset),
      take: Number(limit),
      status: status as TransactionStatus | undefined,
      chainId: chainId ? Number(chainId) : undefined,
      agentId: agentId as string | undefined,
    });

    return res.json({
      success: true,
      transactions: result.transactions,
      total: result.total,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list transactions');
    return next(error);
  }
});

// Get pending transactions
router.get('/pending/list', async (req, res, next) => {
  try {
    const { chainId, limit = '100' } = req.query;

    const transactions = await transactionRepository.listPending({
      chainId: chainId ? Number(chainId) : undefined,
      limit: Number(limit),
    });

    return res.json({
      success: true,
      transactions,
      total: transactions.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list pending transactions');
    return next(error);
  }
});

// Get awaiting approval
router.get('/awaiting-approval/list', async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const transactions = await transactionRepository.listAwaitingApproval(userId);

    return res.json({
      success: true,
      transactions,
      total: transactions.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list transactions awaiting approval');
    return next(error);
  }
});

// Get transaction stats
router.get('/stats/summary', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { chainId, fromDate, toDate } = req.query;

    const stats = await transactionRepository.getStats(userId, {
      chainId: chainId ? Number(chainId) : undefined,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
    });

    return res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get transaction stats');
    return next(error);
  }
});

// Cancel pending transaction
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const tx = await transactionRepository.findById(id);
    if (!tx) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
    }

    if (!['QUEUED', 'AWAITING_APPROVAL'].includes(tx.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel transaction with status ${tx.status}`,
      });
    }

    await transactionRepository.update(id, { status: 'CANCELLED' });

    await auditRepository.create({
      userId,
      eventType: 'TRANSACTION',
      eventCode: 'TRANSACTION_CANCELLED',
      action: 'cancel',
      resourceType: 'transaction',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
    });

    logger.info({ transactionId: id, userId }, 'Transaction cancelled');

    return res.json({
      success: true,
      message: 'Transaction cancelled',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to cancel transaction');
    return next(error);
  }
});

// Retry failed transaction
router.post('/:id/retry', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const tx = await transactionRepository.findById(id);
    if (!tx) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
    }

    if (tx.status !== 'FAILED') {
      return res.status(400).json({
        success: false,
        error: 'Can only retry failed transactions',
      });
    }

    await transactionRepository.update(id, {
      status: 'QUEUED',
    });

    await auditRepository.create({
      userId,
      eventType: 'TRANSACTION',
      eventCode: 'TRANSACTION_RETRY',
      action: 'retry',
      resourceType: 'transaction',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
    });

    logger.info({ transactionId: id, userId }, 'Transaction queued for retry');

    return res.json({
      success: true,
      message: 'Transaction queued for retry',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to retry transaction');
    return next(error);
  }
});

export default router;
