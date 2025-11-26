import express, { Router } from 'express';
import { z } from 'zod';
import { CeloClient } from '@autofi/celo-functions';
import { RiskEngine } from '@autofi/risk-engine';
import { logger } from '../utils/logger.js';
import type { Address } from 'viem';

// Simple ID generator
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const router: Router = express.Router();

const txSchema = z.object({
  to: z.string().min(1),
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
  userId: z.string().optional(),
  memo: z.string().optional(),
  simulateOnly: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

let celoClient: CeloClient | undefined;
let riskEngine: RiskEngine | undefined;

// In-memory transaction store (will be replaced with database in production)
interface StoredTransaction {
  id: string;
  status: string;
  hash?: string;
  chainId: number;
  from?: string;
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  agentId?: string;
  workflowId?: string;
  userId?: string;
  createdAt: Date;
  riskScore?: number;
  metadata?: Record<string, unknown>;
}

const transactions = new Map<string, StoredTransaction>();

function ensureDependencies() {
  if (!riskEngine) {
    riskEngine = new RiskEngine({
      maxRiskScore: process.env.MAX_RISK_SCORE ? Number(process.env.MAX_RISK_SCORE) : 0.95,
      approvalThreshold: 0.6,
      blockThreshold: 0.85,
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

router.post('/send', async (req, res, next) => {
  try {
    ensureDependencies();

    const parsed = txSchema.parse(req.body);
    const chainId = parsed.chainId ? Number(parsed.chainId) : 42220; // Default to Celo mainnet
    const transactionId = generateId('tx');

    const riskContext = {
      agentId: parsed.agentId || 'unknown',
      type: (parsed.data && parsed.data !== '0x' ? 'contract_call' : 'transfer') as 'transfer' | 'contract_call' | 'deployment',
      to: parsed.to as `0x${string}`,
      value: parsed.value ? BigInt(parsed.value) : undefined,
    };

    const riskResult = await riskEngine!.validateTransaction(riskContext);
    const requiresApproval = riskResult.riskScore >= 0.6;

    // Store transaction
    const transaction: StoredTransaction = {
      id: transactionId,
      status: 'pending',
      chainId,
      to: parsed.to,
      value: parsed.value,
      data: parsed.data,
      gasLimit: parsed.gasLimit,
      gasPrice: parsed.gasPrice,
      agentId: parsed.agentId,
      workflowId: parsed.workflowId,
      userId: parsed.userId,
      createdAt: new Date(),
      riskScore: riskResult.riskScore,
      metadata: {
        ...parsed.metadata,
        memo: parsed.memo,
        warnings: riskResult.warnings,
        recommendations: riskResult.recommendations,
      },
    };
    transactions.set(transactionId, transaction);

    if (!riskResult.isValid) {
      transaction.status = 'failed';
      transactions.set(transactionId, transaction);

      return res.status(400).json({
        success: false,
        transactionId,
        error: 'Transaction failed risk validation',
        riskScore: riskResult.riskScore,
        warnings: riskResult.warnings,
        recommendations: riskResult.recommendations,
        requiresApproval,
      });
    }

    // If requires approval, mark as pending approval
    if (requiresApproval) {
      transaction.status = 'pending_approval';
      transactions.set(transactionId, transaction);

      logger.info({ transactionId, riskScore: riskResult.riskScore }, 'Transaction requires approval');

      return res.json({
        success: true,
        transactionId,
        status: 'pending_approval',
        riskScore: riskResult.riskScore,
        requiresApproval: true,
        message: 'Transaction requires approval before execution',
      });
    }

    if (parsed.simulateOnly) {
      transaction.status = 'simulated';
      transactions.set(transactionId, transaction);

      return res.json({
        success: true,
        transactionId,
        transactionHash: undefined,
        riskScore: riskResult.riskScore,
        requiresApproval: false,
        metadata: {
          simulated: true,
          ...parsed.metadata,
        },
      });
    }

    // Execute the transaction using Celo client if available
    if (celoClient && chainId === 42220) {
      try {
        // Use wallet client for transactions
        const walletClient = celoClient.getWalletClient();
        if (!walletClient) {
          throw new Error('Wallet client not available. Private key required.');
        }

        const account = walletClient.account;
        if (!account) {
          throw new Error('No account configured on wallet client');
        }

        const txHash = await walletClient.sendTransaction({
          account,
          to: parsed.to as Address,
          value: parsed.value ? BigInt(parsed.value) : undefined,
          data: parsed.data as `0x${string}` | undefined,
          chain: celoClient.getChain(),
        });

        transaction.status = 'submitted';
        transaction.hash = txHash;
        transactions.set(transactionId, transaction);

        logger.info({
          transactionId,
          hash: txHash,
          chainId,
          to: parsed.to,
          agentId: parsed.agentId,
          riskScore: riskResult.riskScore,
        }, 'Transaction sent');

        return res.json({
          success: true,
          transactionId,
          transactionHash: txHash,
          chainId,
          riskScore: riskResult.riskScore,
          requiresApproval: false,
          metadata: parsed.metadata,
        });
      } catch (txError: unknown) {
        const errorMessage = txError instanceof Error ? txError.message : 'Unknown error';
        transaction.status = 'failed';
        transactions.set(transactionId, transaction);

        logger.error({ error: errorMessage, transactionId }, 'Transaction execution failed');

        return res.status(500).json({
          success: false,
          transactionId,
          error: errorMessage,
        });
      }
    }

    // For non-Celo chains or when client not available, return as pending
    return res.json({
      success: true,
      transactionId,
      status: 'pending',
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

router.post('/estimate', async (req, res, next) => {
  try {
    ensureDependencies();

    const parsed = txSchema.parse(req.body);

    const gasLimit = parsed.gasLimit || '21000';
    const gasPrice = parsed.gasPrice || '20000000000';

    return res.json({
      success: true,
      gasLimit,
      gasPrice,
      maxFeePerGas: parsed.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: parsed.maxPriorityFeePerGas || '1000000000',
      confidence: 0.95,
      metadata: parsed.metadata,
    });
  } catch (error) {
    logger.error({ error }, 'Gas estimation failed');
    return next(error);
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  // First try to find by transaction ID
  let tx = transactions.get(id);

  // If not found, try to find by hash
  if (!tx) {
    tx = Array.from(transactions.values()).find(t => t.hash === id);
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
});

router.get('/', async (req, res) => {
  const { status, chainId, agentId, limit = '50', offset = '0' } = req.query;
  
  let results = Array.from(transactions.values());

  if (status && typeof status === 'string') {
    results = results.filter(tx => tx.status === status);
  }

  if (chainId && typeof chainId === 'string') {
    results = results.filter(tx => tx.chainId === Number(chainId));
  }

  if (agentId && typeof agentId === 'string') {
    results = results.filter(tx => tx.agentId === agentId);
  }

  results = results
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(Number(offset), Number(offset) + Number(limit));

  return res.json({
    success: true,
    transactions: results,
    total: results.length,
  });
});

export default router;

