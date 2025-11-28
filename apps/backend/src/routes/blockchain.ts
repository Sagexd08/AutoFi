/**
 * Blockchain API Routes
 * Handles /api/blockchain endpoints for frontend compatibility
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CeloClient } from '@celo-automator/celo-functions';
import { logger } from '../utils/logger.js';
import type { Hash } from 'viem';

const router: Router = express.Router();

// Request schemas
const sendTransactionSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  value: z.string().optional(),
  data: z.string().optional(),
  gasLimit: z.string().optional(),
  gasPrice: z.string().optional(),
});

const functionCallSchema = z.object({
  functionName: z.string().min(1),
  parameters: z.record(z.any()),
  context: z.record(z.any()).optional(),
});

// Transaction store for tracking
const transactions = new Map<string, {
  hash: Hash;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  createdAt: string;
}>();

let celoClient: CeloClient | undefined;

function ensureDependencies(): void {
  if (!celoClient && process.env.CELO_PRIVATE_KEY) {
    celoClient = new CeloClient({
      privateKey: process.env.CELO_PRIVATE_KEY,
      network: (process.env.CELO_NETWORK as 'alfajores' | 'mainnet') || 'alfajores',
      rpcUrl: process.env.CELO_RPC_URL,
    });
  }
}

/**
 * POST /api/blockchain/send-transaction
 * Send a blockchain transaction
 */
router.post('/send-transaction', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureDependencies();

    if (!celoClient) {
      res.status(503).json({
        success: false,
        error: 'Celo client not initialized. CELO_PRIVATE_KEY required.',
      });
      return;
    }

    const parsed = sendTransactionSchema.parse(req.body);

    logger.info('Sending transaction', { to: parsed.to });

    // For now, create a mock transaction hash
    // In production, this would call celoClient.sendTransaction()
    const txHash = `0x${Buffer.from(Date.now().toString() + Math.random().toString()).toString('hex').slice(0, 64)}` as Hash;

    transactions.set(txHash, {
      hash: txHash,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Simulate confirmation after a short delay
    setTimeout(() => {
      const tx = transactions.get(txHash);
      if (tx) {
        tx.status = 'confirmed';
        tx.blockNumber = Math.floor(Math.random() * 1000000) + 20000000;
      }
    }, 2000);

    res.json({
      success: true,
      txHash,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }
    logger.error('Send transaction failed', { error: String(error) });
    next(error);
  }
});

/**
 * POST /api/blockchain/function-call
 * Execute a blockchain function call
 */
router.post('/function-call', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureDependencies();

    if (!celoClient) {
      res.status(503).json({
        success: false,
        error: 'Celo client not initialized. CELO_PRIVATE_KEY required.',
      });
      return;
    }

    const parsed = functionCallSchema.parse(req.body);

    logger.info('Executing function call', { functionName: parsed.functionName });

    // Map function names to actions
    const result = await executeFunctionCall(parsed.functionName, parsed.parameters, parsed.context);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }
    logger.error('Function call failed', { error: String(error) });
    next(error);
  }
});

/**
 * GET /api/blockchain/transaction/:txHash
 * Get transaction status
 */
router.get('/transaction/:txHash', async (req: Request, res: Response): Promise<void> => {
  const { txHash } = req.params;

  const tx = transactions.get(txHash as Hash);

  if (!tx) {
    res.status(404).json({
      success: false,
      error: 'Transaction not found',
    });
    return;
  }

  res.json({
    success: true,
    status: tx.status,
    blockNumber: tx.blockNumber,
  });
});

/**
 * GET /api/blockchain/transactions/:address
 * Get transaction history for an address
 */
router.get('/transactions/:address', async (req: Request, res: Response): Promise<void> => {
  const { address } = req.params;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({
      success: false,
      error: 'Invalid address format',
    });
    return;
  }

  // Return mock transaction history
  // In production, this would query the blockchain or an indexer
  const mockHistory = Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
    hash: `0x${Buffer.from(`mock-tx-${i}-${address}`).toString('hex').slice(0, 64)}`,
    from: address,
    to: `0x${'0'.repeat(40)}`,
    value: '0',
    status: 'confirmed',
    blockNumber: 20000000 + i,
    timestamp: new Date(Date.now() - i * 3600000).toISOString(),
  }));

  res.json({
    success: true,
    data: mockHistory,
  });
});

/**
 * POST /api/blockchain/ai-execute
 * Execute blockchain function with AI assistance
 */
router.post('/ai-execute', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { prompt, context } = req.body;

    if (!prompt) {
      res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
      return;
    }

    logger.info('AI-powered execution', { prompt: prompt.slice(0, 50) });

    // Parse the prompt into function calls
    const functionCalls = parsePromptToFunctions(prompt);

    // Execute the function calls
    let txHash: string | undefined;
    for (const call of functionCalls) {
      const result = await executeFunctionCall(call.functionName, call.parameters, context);
      if (result.txHash) {
        txHash = result.txHash;
      }
    }

    res.json({
      success: true,
      functionCalls,
      response: `Executed ${functionCalls.length} function(s) based on your request.`,
      txHash,
    });
  } catch (error) {
    logger.error('AI execute failed', { error: String(error) });
    next(error);
  }
});

// Helper function to parse prompts into function calls
function parsePromptToFunctions(prompt: string): Array<{ functionName: string; parameters: Record<string, any> }> {
  const normalizedPrompt = prompt.toLowerCase();
  const functions: Array<{ functionName: string; parameters: Record<string, any> }> = [];

  // Extract amounts
  const amountMatch = normalizedPrompt.match(/(\d+(?:\.\d+)?)\s*(celo|cusd|ceur|eth|usdc)/i);
  const amount = amountMatch ? amountMatch[1] : '0';
  const token = amountMatch ? amountMatch[2].toUpperCase() : 'CELO';

  // Extract addresses
  const addressMatch = normalizedPrompt.match(/0x[a-fA-F0-9]{40}/);
  const address = addressMatch ? addressMatch[0] : '';

  if (/swap|exchange|trade|convert/.test(normalizedPrompt)) {
    functions.push({
      functionName: 'swap',
      parameters: { amount, fromToken: token, toToken: 'cUSD' },
    });
  } else if (/send|transfer|pay/.test(normalizedPrompt)) {
    functions.push({
      functionName: 'transfer',
      parameters: { amount, token, to: address },
    });
  } else if (/stake|lock/.test(normalizedPrompt)) {
    functions.push({
      functionName: 'stake',
      parameters: { amount, token },
    });
  } else if (/balance|check/.test(normalizedPrompt)) {
    functions.push({
      functionName: 'getBalance',
      parameters: { address: address || 'self' },
    });
  }

  return functions;
}

// Helper function to execute a function call
async function executeFunctionCall(
  functionName: string,
  parameters: Record<string, any>,
  _context?: Record<string, any>
): Promise<any> {
  switch (functionName) {
    case 'swap':
      return {
        action: 'swap',
        from: parameters.fromToken,
        to: parameters.toToken,
        amount: parameters.amount,
        status: 'simulated',
      };
    case 'transfer':
      const txHash = `0x${Buffer.from(Date.now().toString()).toString('hex').slice(0, 64)}`;
      return {
        action: 'transfer',
        to: parameters.to,
        amount: parameters.amount,
        token: parameters.token,
        txHash,
        status: 'pending',
      };
    case 'stake':
      return {
        action: 'stake',
        amount: parameters.amount,
        token: parameters.token,
        status: 'simulated',
      };
    case 'getBalance':
      return {
        action: 'getBalance',
        address: parameters.address,
        balance: '100.0',
        token: 'CELO',
      };
    default:
      return {
        action: functionName,
        parameters,
        status: 'unknown',
      };
  }
}

export { router as blockchainRoutes };
