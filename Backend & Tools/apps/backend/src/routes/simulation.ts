import express, { Router } from 'express';
import { z } from 'zod';
import { CeloClient } from '@autofi/celo-functions';
import { RiskEngine } from '@autofi/risk-engine';
import { logger } from '../utils/logger.js';
import type { Address } from 'viem';

const router: Router = express.Router();

// Simple ID generator
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Simulation result types
interface SimulationResult {
  id: string;
  success: boolean;
  chainId: number;
  
  // Transaction details
  from?: string;
  to: string;
  value?: string;
  data?: string;
  
  // Gas estimation
  gasEstimate?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  totalCost?: string;
  
  // Risk assessment
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
  recommendations: string[];
  requiresApproval: boolean;
  
  // Execution simulation
  wouldSucceed: boolean;
  revertReason?: string;
  returnData?: string;
  logs?: SimulatedLog[];
  stateChanges?: StateChange[];
  
  // Timestamps
  simulatedAt: Date;
  
  // Metadata
  metadata?: Record<string, unknown>;
}

interface SimulatedLog {
  address: string;
  topics: string[];
  data: string;
  decoded?: {
    eventName: string;
    args: Record<string, unknown>;
  };
}

interface StateChange {
  address: string;
  slot?: string;
  before?: string;
  after?: string;
  type: 'balance' | 'storage' | 'nonce';
  description?: string;
}

// In-memory simulation cache
const simulations = new Map<string, SimulationResult>();

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

// Schemas
const simulateSchema = z.object({
  to: z.string().min(1),
  value: z.string().optional(),
  data: z.string().optional(),
  from: z.string().optional(),
  gasLimit: z.string().optional(),
  gasPrice: z.string().optional(),
  maxFeePerGas: z.string().optional(),
  maxPriorityFeePerGas: z.string().optional(),
  chainId: z.union([z.number(), z.string()]).optional(),
  agentId: z.string().optional(),
  includeStateChanges: z.boolean().optional(),
  includeLogs: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const batchSimulateSchema = z.object({
  transactions: z.array(simulateSchema).min(1).max(10),
  sequential: z.boolean().optional(), // If true, simulate as if they execute in order
});

// Helper functions
function getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (riskScore >= 0.85) return 'critical';
  if (riskScore >= 0.7) return 'high';
  if (riskScore >= 0.5) return 'medium';
  return 'low';
}

// Simulate a single transaction
router.post('/', async (req, res, next) => {
  try {
    ensureDependencies();
    
    const parsed = simulateSchema.parse(req.body);
    const simulationId = generateId('sim');
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
    
    // Gas estimation
    let gasEstimate = parsed.gasLimit || '21000';
    let gasPrice = parsed.gasPrice || '20000000000'; // 20 Gwei default
    let wouldSucceed = true;
    let revertReason: string | undefined;
    let returnData: string | undefined;
    const logs: SimulatedLog[] = [];
    const stateChanges: StateChange[] = [];
    
    // If we have a Celo client, try to actually simulate
    if (celoClient && chainId === 42220) {
      try {
        const publicClient = celoClient.getPublicClient();
        
        // Estimate gas
        try {
          const estimatedGas = await publicClient.estimateGas({
            to: parsed.to as Address,
            value: parsed.value ? BigInt(parsed.value) : undefined,
            data: parsed.data as `0x${string}` | undefined,
            account: parsed.from as Address | undefined,
          });
          gasEstimate = estimatedGas.toString();
        } catch (gasError: unknown) {
          // Gas estimation failed, transaction would likely revert
          wouldSucceed = false;
          revertReason = gasError instanceof Error ? gasError.message : 'Gas estimation failed';
        }
        
        // Get current gas price
        try {
          const currentGasPrice = await publicClient.getGasPrice();
          gasPrice = currentGasPrice.toString();
        } catch {
          // Use default
        }
        
        // Try to simulate the call if it's a contract call
        if (parsed.data && parsed.data !== '0x' && wouldSucceed) {
          try {
            const callResult = await publicClient.call({
              to: parsed.to as Address,
              value: parsed.value ? BigInt(parsed.value) : undefined,
              data: parsed.data as `0x${string}`,
              account: parsed.from as Address | undefined,
            });
            returnData = callResult.data;
          } catch (callError: unknown) {
            wouldSucceed = false;
            revertReason = callError instanceof Error ? callError.message : 'Call simulation failed';
          }
        }
        
        // Simulate state changes for balance transfers
        if (parsed.includeStateChanges && parsed.value) {
          const value = BigInt(parsed.value);
          if (parsed.from) {
            stateChanges.push({
              address: parsed.from,
              type: 'balance',
              description: `Decrease balance by ${value.toString()} wei`,
            });
          }
          stateChanges.push({
            address: parsed.to,
            type: 'balance',
            description: `Increase balance by ${value.toString()} wei`,
          });
        }
      } catch (error) {
        logger.warn({ error }, 'Simulation with live client failed, using estimates');
      }
    }
    
    // Calculate total cost
    const totalCost = (BigInt(gasEstimate) * BigInt(gasPrice)).toString();
    
    const simulation: SimulationResult = {
      id: simulationId,
      success: true,
      chainId,
      from: parsed.from,
      to: parsed.to,
      value: parsed.value,
      data: parsed.data,
      gasEstimate,
      gasPrice,
      maxFeePerGas: parsed.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: parsed.maxPriorityFeePerGas || '1000000000',
      totalCost,
      riskScore: riskResult.riskScore,
      riskLevel,
      warnings: riskResult.warnings,
      recommendations: riskResult.recommendations,
      requiresApproval,
      wouldSucceed,
      revertReason,
      returnData,
      logs: parsed.includeLogs ? logs : undefined,
      stateChanges: parsed.includeStateChanges ? stateChanges : undefined,
      simulatedAt: new Date(),
      metadata: parsed.metadata,
    };
    
    simulations.set(simulationId, simulation);
    
    logger.info({
      simulationId,
      chainId,
      to: parsed.to,
      wouldSucceed,
      riskScore: riskResult.riskScore,
    }, 'Transaction simulated');
    
    return res.json({
      success: true,
      simulation,
    });
  } catch (error) {
    return next(error);
  }
});

// Batch simulate multiple transactions
router.post('/batch', async (req, res, next) => {
  try {
    ensureDependencies();
    
    const parsed = batchSimulateSchema.parse(req.body);
    const batchId = generateId('batch');
    const results: SimulationResult[] = [];
    
    for (const tx of parsed.transactions) {
      const simulationId = generateId('sim');
      const chainId = tx.chainId ? Number(tx.chainId) : 42220;
      
      // Risk assessment
      const riskContext = {
        agentId: tx.agentId || 'unknown',
        type: (tx.data && tx.data !== '0x' ? 'contract_call' : 'transfer') as 'transfer' | 'contract_call' | 'deployment',
        to: tx.to as Address,
        value: tx.value ? BigInt(tx.value) : undefined,
      };
      
      const riskResult = await riskEngine!.validateTransaction(riskContext);
      const riskLevel = getRiskLevel(riskResult.riskScore);
      const requiresApproval = riskResult.riskScore >= 0.6;
      
      const gasEstimate = tx.gasLimit || '21000';
      const gasPrice = tx.gasPrice || '20000000000';
      const totalCost = (BigInt(gasEstimate) * BigInt(gasPrice)).toString();
      
      const simulation: SimulationResult = {
        id: simulationId,
        success: true,
        chainId,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        data: tx.data,
        gasEstimate,
        gasPrice,
        totalCost,
        riskScore: riskResult.riskScore,
        riskLevel,
        warnings: riskResult.warnings,
        recommendations: riskResult.recommendations,
        requiresApproval,
        wouldSucceed: true,
        simulatedAt: new Date(),
        metadata: tx.metadata,
      };
      
      simulations.set(simulationId, simulation);
      results.push(simulation);
    }
    
    // Aggregate risk
    const maxRiskScore = Math.max(...results.map(r => r.riskScore));
    const totalGasCost = results.reduce((sum, r) => sum + BigInt(r.totalCost || '0'), BigInt(0));
    const anyRequiresApproval = results.some(r => r.requiresApproval);
    const allWouldSucceed = results.every(r => r.wouldSucceed);
    
    logger.info({
      batchId,
      count: results.length,
      maxRiskScore,
      allWouldSucceed,
    }, 'Batch simulation completed');
    
    return res.json({
      success: true,
      batchId,
      simulations: results,
      summary: {
        count: results.length,
        maxRiskScore,
        aggregateRiskLevel: getRiskLevel(maxRiskScore),
        totalGasCost: totalGasCost.toString(),
        requiresApproval: anyRequiresApproval,
        allWouldSucceed,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Get simulation result by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const simulation = simulations.get(id);
  
  if (!simulation) {
    return res.status(404).json({
      success: false,
      error: 'Simulation not found',
    });
  }
  
  return res.json({
    success: true,
    simulation,
  });
});

// Estimate gas for a transaction
router.post('/estimate-gas', async (req, res, next) => {
  try {
    ensureDependencies();
    
    const parsed = simulateSchema.parse(req.body);
    const chainId = parsed.chainId ? Number(parsed.chainId) : 42220;
    
    let gasEstimate = '21000';
    let gasPrice = '20000000000';
    let baseFee: string | undefined;
    let priorityFee = '1000000000';
    
    if (celoClient && chainId === 42220) {
      try {
        const publicClient = celoClient.getPublicClient();
        
        const estimatedGas = await publicClient.estimateGas({
          to: parsed.to as Address,
          value: parsed.value ? BigInt(parsed.value) : undefined,
          data: parsed.data as `0x${string}` | undefined,
          account: parsed.from as Address | undefined,
        });
        gasEstimate = estimatedGas.toString();
        
        const currentGasPrice = await publicClient.getGasPrice();
        gasPrice = currentGasPrice.toString();
        
        // Try to get fee history for better estimates
        try {
          const block = await publicClient.getBlock({ blockTag: 'latest' });
          if (block.baseFeePerGas) {
            baseFee = block.baseFeePerGas.toString();
          }
        } catch {
          // Ignore
        }
      } catch (error: unknown) {
        return res.status(400).json({
          success: false,
          error: 'Gas estimation failed',
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    // Calculate costs at different priority levels
    const calculateCost = (gas: string, price: string) => 
      (BigInt(gas) * BigInt(price)).toString();
    
    const lowPriorityGasPrice = (BigInt(gasPrice) * BigInt(80) / BigInt(100)).toString();
    const highPriorityGasPrice = (BigInt(gasPrice) * BigInt(120) / BigInt(100)).toString();
    
    return res.json({
      success: true,
      estimation: {
        gasLimit: gasEstimate,
        gasPrice,
        baseFee,
        priorityFee,
        costs: {
          low: {
            gasPrice: lowPriorityGasPrice,
            total: calculateCost(gasEstimate, lowPriorityGasPrice),
            waitTime: '~60 seconds',
          },
          medium: {
            gasPrice,
            total: calculateCost(gasEstimate, gasPrice),
            waitTime: '~15 seconds',
          },
          high: {
            gasPrice: highPriorityGasPrice,
            total: calculateCost(gasEstimate, highPriorityGasPrice),
            waitTime: '~5 seconds',
          },
        },
        chainId,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Decode transaction data
router.post('/decode', async (req, res, next) => {
  try {
    const { data, abi } = req.body;
    
    if (!data || typeof data !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Transaction data required',
      });
    }
    
    // Basic decoding without ABI
    const selector = data.slice(0, 10);
    const params = data.slice(10);
    
    // Common function selectors
    const knownSelectors: Record<string, string> = {
      '0xa9059cbb': 'transfer(address,uint256)',
      '0x23b872dd': 'transferFrom(address,address,uint256)',
      '0x095ea7b3': 'approve(address,uint256)',
      '0x70a08231': 'balanceOf(address)',
      '0x18160ddd': 'totalSupply()',
      '0xdd62ed3e': 'allowance(address,address)',
      '0x40c10f19': 'mint(address,uint256)',
      '0x42966c68': 'burn(uint256)',
      '0x79cc6790': 'burnFrom(address,uint256)',
      '0xa457c2d7': 'decreaseAllowance(address,uint256)',
      '0x39509351': 'increaseAllowance(address,uint256)',
    };
    
    const decoded = {
      selector,
      functionSignature: knownSelectors[selector] || 'unknown',
      rawParams: params,
      paramCount: params.length / 64, // Each param is 32 bytes = 64 hex chars
    };
    
    return res.json({
      success: true,
      decoded,
      hasAbi: !!abi,
    });
  } catch (error) {
    return next(error);
  }
});

export { router as simulationRoutes };
