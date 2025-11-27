import express, { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CeloClient } from '@celo-automator/celo-functions';
import { logger } from '../utils/logger.js';
import type { Hash } from 'viem';

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
  memo: z.string().optional(),
  simulateOnly: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const transactions = new Map<string, {
  hash: Hash;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: string;
  riskScore?: number;
  requiresApproval?: boolean;
}>();

let celoClient: CeloClient | undefined;

// Simple risk scoring function
function calculateRiskScore(to: string, value?: string, data?: string): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 0.1; // Base score
  
  // High value transactions are riskier
  if (value) {
    const valueNum = parseFloat(value);
    if (valueNum > 1e18) { // More than 1 ETH/CELO
      score += 0.2;
      warnings.push('High value transaction');
    }
    if (valueNum > 10e18) { // More than 10 ETH/CELO
      score += 0.3;
      warnings.push('Very high value transaction');
    }
  }
  
  // Contract calls are slightly riskier
  if (data && data !== '0x') {
    score += 0.1;
    warnings.push('Contract interaction');
  }
  
  // Unknown addresses are riskier
  if (!to.match(/^0x[a-fA-F0-9]{40}$/)) {
    score += 0.3;
    warnings.push('Invalid address format');
  }
  
  return { score: Math.min(score, 1), warnings };
}

function ensureDependencies(): void {
  if (!celoClient && process.env.CELO_PRIVATE_KEY) {
    celoClient = new CeloClient({
      privateKey: process.env.CELO_PRIVATE_KEY,
      network: (process.env.CELO_NETWORK as 'alfajores' | 'mainnet') || 'alfajores',
      rpcUrl: process.env.CELO_RPC_URL,
    });
  }
}

router.post('/send', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureDependencies();

    if (!celoClient) {
      res.status(503).json({
        success: false,
        error: 'Celo client not initialized. CELO_PRIVATE_KEY required.',
      });
      return;
    }

    const parsed = txSchema.parse(req.body);

    const riskResult = calculateRiskScore(parsed.to, parsed.value, parsed.data);
    const requiresApproval = riskResult.score >= 0.6;

    if (riskResult.score >= 0.85) {
      res.status(400).json({
        success: false,
        error: 'Transaction failed risk validation',
        riskScore: riskResult.score,
        warnings: riskResult.warnings,
        recommendations: ['Review transaction parameters', 'Use a smaller amount'],
        requiresApproval,
      });
      return;
    }

    if (parsed.simulateOnly) {
      res.json({
        success: true,
        transactionHash: undefined,
        riskScore: riskResult.score,
        requiresApproval,
        metadata: {
          simulated: true,
          ...parsed.metadata,
        },
      });
      return;
    }

    const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}` as Hash;

    transactions.set(mockTxHash, {
      hash: mockTxHash,
      status: 'pending',
      createdAt: new Date().toISOString(),
      riskScore: riskResult.score,
      requiresApproval,
    });

    logger.info('Transaction sent', {
      hash: mockTxHash,
      to: parsed.to,
      agentId: parsed.agentId,
      riskScore: riskResult.score,
    });

    res.json({
      success: true,
      transactionHash: mockTxHash,
      riskScore: riskResult.score,
      requiresApproval,
      metadata: parsed.metadata,
    });
  } catch (error) {
    logger.error('Transaction send failed', { error: String(error) });
    next(error);
  }
});

router.post('/estimate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureDependencies();

    if (!celoClient) {
      res.status(503).json({
        success: false,
        error: 'Celo client not initialized. CELO_PRIVATE_KEY required.',
      });
      return;
    }

    const parsed = txSchema.parse(req.body);

    const gasLimit = parsed.gasLimit || '21000';
    const gasPrice = parsed.gasPrice || '20000000000';

    res.json({
      success: true,
      gasLimit,
      gasPrice,
      maxFeePerGas: parsed.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: parsed.maxPriorityFeePerGas || '1000000000',
      confidence: 0.95,
      metadata: parsed.metadata,
    });
  } catch (error) {
    logger.error('Gas estimation failed', { error: String(error) });
    next(error);
  }
});

router.get('/:hash', (req: Request, res: Response): void => {
  const { hash } = req.params;
  const tx = transactions.get(hash as Hash);

  if (!tx) {
    res.status(404).json({
      success: false,
      error: 'Transaction not found',
    });
    return;
  }

  res.json({
    success: true,
    transactionHash: tx.hash,
    status: tx.status,
    createdAt: tx.createdAt,
    riskScore: tx.riskScore,
    requiresApproval: tx.requiresApproval,
  });
});

export { router as txRoutes };

