/**
 * Blockchain API Routes
 * Handles /api/blockchain endpoints for real blockchain interactions
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CeloClient, sendCELO, sendToken, getBalance, getTokenBalance, getTransactionStatus } from '@celo-automator/celo-functions';
import { logger } from '../utils/logger.js';
import type { Hash, Address } from 'viem';

const router: Router = express.Router();

// Request schemas
const sendTransactionSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  value: z.string().optional(),
  data: z.string().optional(),
  gasLimit: z.string().optional(),
  gasPrice: z.string().optional(),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(), // For token transfers
});

const functionCallSchema = z.object({
  functionName: z.string().min(1),
  parameters: z.record(z.any()),
  context: z.record(z.any()).optional(),
});

// Transaction store for tracking (persisted in memory for status tracking)
const transactions = new Map<string, {
  hash: Hash;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
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
    logger.info('CeloClient initialized', { 
      network: process.env.CELO_NETWORK || 'alfajores',
      hasPrivateKey: true 
    });
  }
}

/**
 * POST /api/blockchain/send-transaction
 * Send a real blockchain transaction
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
    const to = parsed.to as Address;
    const value = parsed.value || '0';

    logger.info('Sending real transaction', { to, value, tokenAddress: parsed.tokenAddress });

    let result;
    if (parsed.tokenAddress) {
      // Token transfer
      result = await sendToken(celoClient, parsed.tokenAddress as Address, to, value);
    } else {
      // Native CELO transfer
      result = await sendCELO(celoClient, to, value);
    }

    if (!result.success) {
      logger.error('Transaction failed', { error: result.error });
      res.status(400).json({
        success: false,
        error: result.error || 'Transaction failed',
      });
      return;
    }

    const txHash = result.transactionHash as Hash;

    // Store transaction for tracking
    transactions.set(txHash, {
      hash: txHash,
      status: 'confirmed',
      blockNumber: result.blockNumber ? Number(result.blockNumber) : undefined,
      gasUsed: result.gasUsed?.toString(),
      createdAt: new Date().toISOString(),
    });

    logger.info('Transaction confirmed', { 
      txHash, 
      blockNumber: result.blockNumber,
      gasUsed: result.gasUsed?.toString() 
    });

    res.json({
      success: true,
      txHash,
      blockNumber: result.blockNumber ? Number(result.blockNumber) : undefined,
      gasUsed: result.gasUsed?.toString(),
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
 * Get transaction status from the blockchain
 */
router.get('/transaction/:txHash', async (req: Request, res: Response): Promise<void> => {
  const { txHash } = req.params;

  // First check our local cache
  const cachedTx = transactions.get(txHash as Hash);
  if (cachedTx) {
    res.json({
      success: true,
      status: cachedTx.status,
      blockNumber: cachedTx.blockNumber,
      gasUsed: cachedTx.gasUsed,
    });
    return;
  }

  // If not in cache and we have a client, check the blockchain
  ensureDependencies();
  if (celoClient) {
    try {
      const status = await getTransactionStatus(celoClient, txHash as Hash);
      res.json({
        success: true,
        status: status.status,
        blockNumber: status.blockNumber ? Number(status.blockNumber) : undefined,
        gasUsed: status.gasUsed?.toString(),
      });
      return;
    } catch {
      // Transaction not found on chain
    }
  }

  res.status(404).json({
    success: false,
    error: 'Transaction not found',
  });
});

/**
 * GET /api/blockchain/balance/:address
 * Get balance for an address
 */
router.get('/balance/:address', async (req: Request, res: Response): Promise<void> => {
  const { address } = req.params;
  const tokenAddress = req.query.token as string | undefined;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({
      success: false,
      error: 'Invalid address format',
    });
    return;
  }

  ensureDependencies();
  if (!celoClient) {
    res.status(503).json({
      success: false,
      error: 'Celo client not initialized',
    });
    return;
  }

  try {
    if (tokenAddress && /^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      // Get token balance
      const balance = await getTokenBalance(celoClient, address as Address, tokenAddress as Address);
      res.json({
        success: true,
        data: balance,
      });
    } else {
      // Get native CELO balance
      const balance = await getBalance(celoClient, address as Address);
      res.json({
        success: true,
        data: {
          token: 'CELO',
          balance,
          decimals: 18,
          symbol: 'CELO',
        },
      });
    }
  } catch (error) {
    logger.error('Failed to get balance', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to get balance',
    });
  }
});

/**
 * GET /api/blockchain/transactions/:address
 * Get transaction history for an address using Etherscan V2 API (supports all chains including Celo)
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

  // Use Etherscan V2 API (supports Celo and other chains via unified endpoint)
  const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
  const network = process.env.CELO_NETWORK || 'alfajores';
  
  // Etherscan V2 uses chainid parameter for all chains
  // Celo Mainnet: 42220, Celo Alfajores: 44787
  const chainId = network === 'mainnet' ? 42220 : 44787;
  const baseUrl = 'https://api.etherscan.io/v2/api';

  try {
    if (etherscanApiKey) {
      const url = `${baseUrl}?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${etherscanApiKey}`;
      const response = await fetch(url);
      const data = await response.json() as { status: string; message: string; result: any[] };

      if (data.status === '1' && Array.isArray(data.result)) {
        const transactions = data.result.map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          status: tx.isError === '0' ? 'confirmed' : 'failed',
          blockNumber: parseInt(tx.blockNumber),
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice,
        }));

        res.json({
          success: true,
          data: transactions,
        });
        return;
      }
    }

    // Fallback: Return empty array if no API key or API fails
    logger.warn('Etherscan V2 API not available or failed, returning empty history');
    res.json({
      success: true,
      data: [],
      warning: 'Transaction history requires ETHERSCAN_API_KEY environment variable',
    });
  } catch (error) {
    logger.error('Failed to fetch transaction history', { error: String(error) });
    res.json({
      success: true,
      data: [],
      warning: 'Failed to fetch transaction history from Etherscan V2',
    });
  }
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

// Helper function to execute a function call with real blockchain transactions
async function executeFunctionCall(
  functionName: string,
  parameters: Record<string, any>,
  _context?: Record<string, any>
): Promise<any> {
  ensureDependencies();

  switch (functionName) {
    case 'swap':
      return {
        action: 'swap',
        from: parameters.fromToken,
        to: parameters.toToken,
        amount: parameters.amount,
        status: 'not_implemented',
        message: 'DEX integration required - use frontend for swaps',
      };
      
    case 'transfer':
      if (!celoClient) {
        return {
          action: 'transfer',
          status: 'error',
          error: 'Celo client not initialized. CELO_PRIVATE_KEY required.',
        };
      }
      
      if (!parameters.to || !/^0x[a-fA-F0-9]{40}$/.test(parameters.to)) {
        return {
          action: 'transfer',
          status: 'error',
          error: 'Invalid recipient address',
        };
      }
      
      try {
        // Convert amount to wei (assuming 18 decimals)
        const amountInWei = BigInt(Math.floor(parseFloat(parameters.amount || '0') * 1e18)).toString();
        
        let result;
        if (parameters.tokenAddress && /^0x[a-fA-F0-9]{40}$/.test(parameters.tokenAddress)) {
          result = await sendToken(
            celoClient, 
            parameters.tokenAddress as Address, 
            parameters.to as Address, 
            amountInWei
          );
        } else {
          result = await sendCELO(celoClient, parameters.to as Address, amountInWei);
        }
        
        if (result.success) {
          return {
            action: 'transfer',
            to: parameters.to,
            amount: parameters.amount,
            token: parameters.token || 'CELO',
            txHash: result.transactionHash,
            blockNumber: result.blockNumber ? Number(result.blockNumber) : undefined,
            gasUsed: result.gasUsed?.toString(),
            status: 'confirmed',
          };
        } else {
          return {
            action: 'transfer',
            status: 'failed',
            error: result.error,
          };
        }
      } catch (error) {
        return {
          action: 'transfer',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
      
    case 'stake':
      return {
        action: 'stake',
        amount: parameters.amount,
        token: parameters.token,
        status: 'not_implemented',
        message: 'Staking integration required',
      };
      
    case 'getBalance':
      if (!celoClient) {
        return {
          action: 'getBalance',
          status: 'error',
          error: 'Celo client not initialized',
        };
      }
      
      try {
        const address = parameters.address === 'self' 
          ? await celoClient.getWalletClient()?.getAddresses().then(addrs => addrs[0])
          : parameters.address as Address;
          
        if (!address) {
          return {
            action: 'getBalance',
            status: 'error',
            error: 'No address provided',
          };
        }
        
        const balance = await getBalance(celoClient, address);
        const balanceInCelo = (parseFloat(balance) / 1e18).toFixed(6);
        
        return {
          action: 'getBalance',
          address,
          balance: balanceInCelo,
          balanceWei: balance,
          token: 'CELO',
        };
      } catch (error) {
        return {
          action: 'getBalance',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
      
    default:
      return {
        action: functionName,
        parameters,
        status: 'unknown_function',
      };
  }
}

export { router as blockchainRoutes };
