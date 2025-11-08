import type { Address, Hash } from 'viem';
import { parseUnits } from 'viem';

export interface GasOptimizationResult {
  optimizedGasLimit: bigint;
  optimizedGasPrice?: bigint;
  optimizedMaxFeePerGas?: bigint;
  optimizedMaxPriorityFeePerGas?: bigint;
  estimatedSavings?: bigint;
  confidence: number;
}

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

const GAS_BUFFER_MULTIPLIER = 120n; // 120% = 1.2x
const MIN_GAS_LIMIT = 21000n;
const MAX_GAS_LIMIT = 30000000n;

export class GasOptimizer {
  /**
   * Optimizes gas parameters for a transaction
   */
  optimizeGas(
    estimate: GasEstimate,
    options?: {
      maxGasPrice?: bigint;
      priority?: 'low' | 'normal' | 'high';
      useEIP1559?: boolean;
    }
  ): GasOptimizationResult {
    const {
      gasLimit,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
    } = estimate;

    // Optimize gas limit with buffer
    let optimizedGasLimit = gasLimit;
    if (optimizedGasLimit < MIN_GAS_LIMIT) {
      optimizedGasLimit = MIN_GAS_LIMIT;
    }
    if (optimizedGasLimit > MAX_GAS_LIMIT) {
      optimizedGasLimit = MAX_GAS_LIMIT;
    }
    optimizedGasLimit = (optimizedGasLimit * GAS_BUFFER_MULTIPLIER) / 100n;

    const priority = options?.priority || 'normal';
    const useEIP1559 = options?.useEIP1559 ?? true;

    if (useEIP1559 && (maxFeePerGas || maxPriorityFeePerGas)) {
      // EIP-1559 optimization
      const baseFee = maxFeePerGas ? maxFeePerGas - (maxPriorityFeePerGas || 0n) : 0n;
      let optimizedMaxPriorityFeePerGas = maxPriorityFeePerGas || parseUnits('2', 'gwei');

      // Adjust based on priority
      if (priority === 'low') {
        optimizedMaxPriorityFeePerGas = parseUnits('1', 'gwei');
      } else if (priority === 'high') {
        optimizedMaxPriorityFeePerGas = parseUnits('5', 'gwei');
      }

      const optimizedMaxFeePerGas = baseFee + optimizedMaxPriorityFeePerGas;

      if (options?.maxGasPrice && optimizedMaxFeePerGas > options.maxGasPrice) {
        return {
          optimizedGasLimit,
          optimizedMaxFeePerGas: options.maxGasPrice,
          optimizedMaxPriorityFeePerGas: optimizedMaxPriorityFeePerGas,
          estimatedSavings: optimizedMaxFeePerGas - options.maxGasPrice,
          confidence: 0.8,
        };
      }

      return {
        optimizedGasLimit,
        optimizedMaxFeePerGas,
        optimizedMaxPriorityFeePerGas,
        confidence: 0.95,
      };
    } else {
      // Legacy gas price optimization
      let optimizedGasPrice = gasPrice || parseUnits('20', 'gwei');

      if (priority === 'low') {
        optimizedGasPrice = parseUnits('15', 'gwei');
      } else if (priority === 'high') {
        optimizedGasPrice = parseUnits('30', 'gwei');
      }

      if (options?.maxGasPrice && optimizedGasPrice > options.maxGasPrice) {
        optimizedGasPrice = options.maxGasPrice;
      }

      return {
        optimizedGasLimit,
        optimizedGasPrice,
        confidence: 0.9,
      };
    }
  }

  /**
   * Estimates total gas cost
   */
  estimateTotalCost(optimized: GasOptimizationResult): bigint {
    const gasPrice = optimized.optimizedGasPrice || optimized.optimizedMaxFeePerGas || 0n;
    return optimized.optimizedGasLimit * gasPrice;
  }
}

export const gasOptimizer = new GasOptimizer();

