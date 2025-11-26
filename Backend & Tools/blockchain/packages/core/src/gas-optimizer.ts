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

const GAS_BUFFER_MULTIPLIER = 120n;
const MIN_GAS_LIMIT = 21000n;
const MAX_GAS_LIMIT = 30000000n;

export class GasOptimizer {

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

    let optimizedGasLimit = (gasLimit * GAS_BUFFER_MULTIPLIER) / 100n;

    if (optimizedGasLimit < MIN_GAS_LIMIT) {
      optimizedGasLimit = MIN_GAS_LIMIT;
    }
    if (optimizedGasLimit > MAX_GAS_LIMIT) {
      optimizedGasLimit = MAX_GAS_LIMIT;
    }

    const priority = options?.priority || 'normal';
    const useEIP1559 = options?.useEIP1559 ?? true;

    if (useEIP1559 && (maxFeePerGas || maxPriorityFeePerGas)) {

      const priorityMultiplier = priority === 'low' ? 0.8 : priority === 'high' ? 1.2 : 1.0;

      const defaultMaxPriorityFeePerGas = parseUnits('2', 9);
      const defaultMaxFeePerGas = parseUnits('30', 9);

      const estimatedMaxPriorityFeePerGas = maxPriorityFeePerGas || defaultMaxPriorityFeePerGas;
      const estimatedMaxFeePerGas = maxFeePerGas || defaultMaxFeePerGas;

      let optimizedMaxPriorityFeePerGas = BigInt(
        Math.floor(Number(estimatedMaxPriorityFeePerGas) * priorityMultiplier)
      );

      let optimizedMaxFeePerGas = BigInt(
        Math.floor(Number(estimatedMaxFeePerGas) * priorityMultiplier)
      );

      if (options?.maxGasPrice && optimizedMaxFeePerGas > options.maxGasPrice) {

        const cappedMaxFee = options.maxGasPrice;

        const estimatedBaseFee = estimatedMaxFeePerGas > estimatedMaxPriorityFeePerGas
          ? estimatedMaxFeePerGas - estimatedMaxPriorityFeePerGas
          : 0n;

        const availableForPriority = cappedMaxFee - estimatedBaseFee;

        optimizedMaxPriorityFeePerGas = optimizedMaxPriorityFeePerGas < availableForPriority
          ? optimizedMaxPriorityFeePerGas
          : availableForPriority;

        if (optimizedMaxPriorityFeePerGas < 0n) {
          optimizedMaxPriorityFeePerGas = 0n;
        }

        const estimatedSavings = optimizedMaxFeePerGas - cappedMaxFee;

        return {
          optimizedGasLimit,
          optimizedMaxFeePerGas: cappedMaxFee,
          optimizedMaxPriorityFeePerGas,
          estimatedSavings,
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

      let optimizedGasPrice = gasPrice || parseUnits('20', 9);

      if (priority === 'low') {
        optimizedGasPrice = parseUnits('15', 9);
      } else if (priority === 'high') {
        optimizedGasPrice = parseUnits('30', 9);
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

  estimateTotalCost(optimized: GasOptimizationResult): bigint {
    const gasPrice = optimized.optimizedGasPrice || optimized.optimizedMaxFeePerGas || 0n;
    return optimized.optimizedGasLimit * gasPrice;
  }
}

export const gasOptimizer = new GasOptimizer();

