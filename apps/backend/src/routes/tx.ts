import express, { Router } from 'express';
import { z } from 'zod';
import { CeloClient } from '@celo-automator/celo-functions';
import { RiskEngine } from '@celo-ai/risk-engine';
import { logger } from '../utils/logger.js';
import type { Address, Hash } from 'viem';

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
let riskEngine: RiskEngine | undefined;

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

    if (!celoClient) {
      return res.status(503).json({
        success: false,
        error: 'Celo client not initialized. CELO_PRIVATE_KEY required.',
      });
    }

    const parsed = txSchema.parse(req.body);

    // Validate transaction with risk engine
    const riskContext = {
      agentId: parsed.agentId || 'unknown',
      type: parsed.data && parsed.data !== '0x' ? 'contract_call' : 'transfer',
      to: parsed.to as Address,
      value: parsed.value ? BigInt(parsed.value) : undefined,
    };

    const riskResult = await riskEngine!.validateTransaction(riskContext);

    if (!riskResult.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Transaction failed risk validation',
        riskScore: riskResult.riskScore,
        warnings: riskResult.warnings,
        recommendations: riskResult.recommendations,
        requiresApproval: riskResult.riskScore >= 0.6,
      });
    }

    if (parsed.simulateOnly) {
      return res.json({
        success: true,
        transactionHash: undefined,
        riskScore: riskResult.riskScore,
        requiresApproval: riskResult.riskScore >= 0.6,
        metadata: {
          simulated: true,
          ...parsed.metadata,
        },
      });
    }

    // TODO: Implement actual transaction sending
    // For now, return a mock response
    const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}` as Hash;

    transactions.set(mockTxHash, {
      hash: mockTxHash,
      status: 'pending',
      createdAt: new Date().toISOString(),
      riskScore: riskResult.riskScore,
      requiresApproval: riskResult.riskScore >= 0.6,
    });

    logger.info('Transaction sent', {
      hash: mockTxHash,
      to: parsed.to,
      agentId: parsed.agentId,
      riskScore: riskResult.riskScore,
    });

    return res.json({
      success: true,
      transactionHash: mockTxHash,
      riskScore: riskResult.riskScore,
      requiresApproval: riskResult.riskScore >= 0.6,
      metadata: parsed.metadata,
    });
  } catch (error) {
    logger.error('Transaction send failed', { error });
    return next(error);
  }
});

router.post('/estimate', async (req, res, next) => {
  try {
    ensureDependencies();

    if (!celoClient) {
      return res.status(503).json({
        success: false,
        error: 'Celo client not initialized. CELO_PRIVATE_KEY required.',
      });
    }

    const parsed = txSchema.parse(req.body);

    // TODO: Implement actual gas estimation
    // For now, return mock estimates
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
    logger.error('Gas estimation failed', { error });
    return next(error);
  }
});

router.get('/:hash', (req, res) => {
  const { hash } = req.params;
  const tx = transactions.get(hash as Hash);

  if (!tx) {
    return res.status(404).json({
      success: false,
      error: 'Transaction not found',
    });
  }

  return res.json({
    success: true,
    transactionHash: tx.hash,
    status: tx.status,
    createdAt: tx.createdAt,
    riskScore: tx.riskScore,
    requiresApproval: tx.requiresApproval,
  });
});

export { router as txRoutes };

