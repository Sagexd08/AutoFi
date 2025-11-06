import { describe, it, expect, beforeEach, vi } from 'vitest';
import RebalancerSystem from './rebalancer-system.js';
import logger from '../utils/logger.js';

vi.mock('../utils/logger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

describe('RebalancerSystem - Transaction Amount Validation', () => {
  let rebalancerSystem;
  let mockAutomationSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAutomationSystem = {
      processNaturalLanguage: vi.fn().mockResolvedValue({
        result: {
          balances: { CELO: 600, cUSD: 300, cEUR: 100 },
          totalValue: 1000
        }
      })
    };

    rebalancerSystem = new RebalancerSystem({
      enableAutoRebalancing: true,
      rebalanceThreshold: 0.05,
      minRebalanceAmount: 0.01,
      maxSlippage: 0.01,
      defaultProtocolFee: 0.003,
      defaultLiquidityProviderFee: 0.003,
      defaultGasPrice: 0.00001
    });
    rebalancerSystem.setAutomationSystem(mockAutomationSystem);
  });

  describe('Malformed and missing amount cases', () => {
    it('should skip cost calculations and log warning when tx.amount is undefined', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const targetAllocation = { CELO: 0.5, cUSD: 0.3, cEUR: 0.2 };

      const originalCalculate = rebalancerSystem.calculateRebalancingTransactions.bind(rebalancerSystem);
      rebalancerSystem.calculateRebalancingTransactions = vi.fn().mockReturnValue({
        transactions: [
          {
            type: 'swap',
            from: 'CELO',
            to: 'cUSD',
            amount: undefined,
            estimatedGas: 0.001
          }
        ],
        rebalancingRequired: true
      });

      const result = await rebalancerSystem.rebalancePortfolio({
        walletAddress,
        targetAllocation,
        execute: false
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Transaction amount validation failed - skipping cost calculations',
        expect.objectContaining({
          transaction: 'CELO -> cUSD',
          rawAmount: undefined,
          reason: 'tx.amount is undefined'
        })
      );

      expect(result.plan.costBreakdown.missingComponents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transaction: 'CELO -> cUSD',
            missing: ['amount'],
            reason: 'tx.amount is undefined',
            rawAmount: undefined
          })
        ])
      );

      expect(result.plan.estimatedCost).toBeDefined();
    });

    it('should skip cost calculations and log warning when tx.amount is null', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const targetAllocation = { CELO: 0.5, cUSD: 0.3, cEUR: 0.2 };

      rebalancerSystem.calculateRebalancingTransactions = vi.fn().mockReturnValue({
        transactions: [
          {
            type: 'swap',
            from: 'CELO',
            to: 'cUSD',
            amount: null, // Null amount
            estimatedGas: 0.001
          }
        ],
        rebalancingRequired: true
      });

      const result = await rebalancerSystem.rebalancePortfolio({
        walletAddress,
        targetAllocation,
        execute: false
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Transaction amount validation failed - skipping cost calculations',
        expect.objectContaining({
          transaction: 'CELO -> cUSD',
          rawAmount: null,
          reason: 'tx.amount is null'
        })
      );

      expect(result.plan.costBreakdown.missingComponents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transaction: 'CELO -> cUSD',
            missing: ['amount'],
            reason: 'tx.amount is null',
            rawAmount: null
          })
        ])
      );
    });

    it('should skip cost calculations and log warning when tx.amount is not a finite number (NaN)', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const targetAllocation = { CELO: 0.5, cUSD: 0.3, cEUR: 0.2 };

      rebalancerSystem.calculateRebalancingTransactions = vi.fn().mockReturnValue({
        transactions: [
          {
            type: 'swap',
            from: 'CELO',
            to: 'cUSD',
            amount: 'not-a-number', // Invalid string
            estimatedGas: 0.001
          }
        ],
        rebalancingRequired: true
      });

      const result = await rebalancerSystem.rebalancePortfolio({
        walletAddress,
        targetAllocation,
        execute: false
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Transaction amount validation failed - skipping cost calculations',
        expect.objectContaining({
          transaction: 'CELO -> cUSD',
          rawAmount: 'not-a-number',
          reason: expect.stringContaining('cannot be parsed as a finite number')
        })
      );

      expect(result.plan.costBreakdown.missingComponents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transaction: 'CELO -> cUSD',
            missing: ['amount'],
            reason: expect.stringContaining('cannot be parsed as a finite number'),
            rawAmount: 'not-a-number'
          })
        ])
      );
    });

    it('should skip cost calculations and log warning when tx.amount is Infinity', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const targetAllocation = { CELO: 0.5, cUSD: 0.3, cEUR: 0.2 };

      rebalancerSystem.calculateRebalancingTransactions = vi.fn().mockReturnValue({
        transactions: [
          {
            type: 'swap',
            from: 'CELO',
            to: 'cUSD',
            amount: 'Infinity', // Infinity string
            estimatedGas: 0.001
          }
        ],
        rebalancingRequired: true
      });

      const result = await rebalancerSystem.rebalancePortfolio({
        walletAddress,
        targetAllocation,
        execute: false
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Transaction amount validation failed - skipping cost calculations',
        expect.objectContaining({
          transaction: 'CELO -> cUSD',
          rawAmount: 'Infinity',
          reason: expect.stringContaining('cannot be parsed as a finite number')
        })
      );
    });

    it('should skip cost calculations and log warning when tx.amount is zero', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const targetAllocation = { CELO: 0.5, cUSD: 0.3, cEUR: 0.2 };

      rebalancerSystem.calculateRebalancingTransactions = vi.fn().mockReturnValue({
        transactions: [
          {
            type: 'swap',
            from: 'CELO',
            to: 'cUSD',
            amount: '0', // Zero amount
            estimatedGas: 0.001
          }
        ],
        rebalancingRequired: true
      });

      const result = await rebalancerSystem.rebalancePortfolio({
        walletAddress,
        targetAllocation,
        execute: false
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Transaction amount validation failed - skipping cost calculations',
        expect.objectContaining({
          transaction: 'CELO -> cUSD',
          rawAmount: '0',
          reason: 'tx.amount 0 is not positive (must be > 0)'
        })
      );

      expect(result.plan.costBreakdown.missingComponents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transaction: 'CELO -> cUSD',
            missing: ['amount'],
            reason: 'tx.amount 0 is not positive (must be > 0)',
            rawAmount: '0'
          })
        ])
      );
    });

    it('should skip cost calculations and log warning when tx.amount is negative', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const targetAllocation = { CELO: 0.5, cUSD: 0.3, cEUR: 0.2 };

      rebalancerSystem.calculateRebalancingTransactions = vi.fn().mockReturnValue({
        transactions: [
          {
            type: 'swap',
            from: 'CELO',
            to: 'cUSD',
            amount: '-100', // Negative amount
            estimatedGas: 0.001
          }
        ],
        rebalancingRequired: true
      });

      const result = await rebalancerSystem.rebalancePortfolio({
        walletAddress,
        targetAllocation,
        execute: false
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Transaction amount validation failed - skipping cost calculations',
        expect.objectContaining({
          transaction: 'CELO -> cUSD',
          rawAmount: '-100',
          reason: 'tx.amount -100 is not positive (must be > 0)'
        })
      );
    });

    it('should process valid amounts correctly and use validated numeric amount in calculations', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const targetAllocation = { CELO: 0.5, cUSD: 0.3, cEUR: 0.2 };

      rebalancerSystem.calculateRebalancingTransactions = vi.fn().mockReturnValue({
        transactions: [
          {
            type: 'swap',
            from: 'CELO',
            to: 'cUSD',
            amount: '100.5', // Valid positive amount
            estimatedGas: 0.001,
            gasPrice: 0.00001
          }
        ],
        rebalancingRequired: true
      });

      const result = await rebalancerSystem.rebalancePortfolio({
        walletAddress,
        targetAllocation,
        execute: false
      });

      expect(logger.warn).not.toHaveBeenCalledWith(
        'Transaction amount validation failed - skipping cost calculations',
        expect.anything()
      );

      expect(result.plan.estimatedCost).toBeGreaterThan(0);
      expect(result.plan.costBreakdown.protocolFees).toBeCloseTo(100.5 * 0.003, 5);
      expect(result.plan.costBreakdown.liquidityProviderFees).toBeCloseTo(100.5 * 0.003, 5);
      expect(result.plan.costBreakdown.slippageImpact).toBeCloseTo(100.5 * 0.01, 5);
    });

    it('should handle mixed valid and invalid amounts in transaction array', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const targetAllocation = { CELO: 0.5, cUSD: 0.3, cEUR: 0.2 };

      rebalancerSystem.calculateRebalancingTransactions = vi.fn().mockReturnValue({
        transactions: [
          {
            type: 'swap',
            from: 'CELO',
            to: 'cUSD',
            amount: '100', // Valid
            estimatedGas: 0.001,
            gasPrice: 0.00001
          },
          {
            type: 'swap',
            from: 'cUSD',
            to: 'cEUR',
            amount: undefined, // Invalid
            estimatedGas: 0.001
          },
          {
            type: 'swap',
            from: 'cEUR',
            to: 'CELO',
            amount: '50.25', // Valid
            estimatedGas: 0.001,
            gasPrice: 0.00001
          }
        ],
        rebalancingRequired: true
      });

      const result = await rebalancerSystem.rebalancePortfolio({
        walletAddress,
        targetAllocation,
        execute: false
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Transaction amount validation failed - skipping cost calculations',
        expect.objectContaining({
          transaction: 'cUSD -> cEUR',
          rawAmount: undefined
        })
      );

      const missingAmountEntry = result.plan.costBreakdown.missingComponents.find(
        entry => entry.transaction === 'cUSD -> cEUR' && entry.missing.includes('amount')
      );
      expect(missingAmountEntry).toBeDefined();

      expect(result.plan.estimatedCost).toBeGreaterThan(0);
    });

    it('should handle empty string amount', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const targetAllocation = { CELO: 0.5, cUSD: 0.3, cEUR: 0.2 };

      rebalancerSystem.calculateRebalancingTransactions = vi.fn().mockReturnValue({
        transactions: [
          {
            type: 'swap',
            from: 'CELO',
            to: 'cUSD',
            amount: '', // Empty string
            estimatedGas: 0.001
          }
        ],
        rebalancingRequired: true
      });

      const result = await rebalancerSystem.rebalancePortfolio({
        walletAddress,
        targetAllocation,
        execute: false
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Transaction amount validation failed - skipping cost calculations',
        expect.objectContaining({
          transaction: 'CELO -> cUSD',
          rawAmount: '',
          reason: expect.stringContaining('cannot be parsed as a finite number')
        })
      );
    });

    it('should handle numeric string with whitespace', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const targetAllocation = { CELO: 0.5, cUSD: 0.3, cEUR: 0.2 };

      rebalancerSystem.calculateRebalancingTransactions = vi.fn().mockReturnValue({
        transactions: [
          {
            type: 'swap',
            from: 'CELO',
            to: 'cUSD',
            amount: '  100  ', // String with whitespace (parseFloat handles this)
            estimatedGas: 0.001,
            gasPrice: 0.00001
          }
        ],
        rebalancingRequired: true
      });

      const result = await rebalancerSystem.rebalancePortfolio({
        walletAddress,
        targetAllocation,
        execute: false
      });

      expect(logger.warn).not.toHaveBeenCalledWith(
        'Transaction amount validation failed - skipping cost calculations',
        expect.anything()
      );

      expect(result.plan.estimatedCost).toBeGreaterThan(0);
    });
  });
});

