import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

function sanitizeError(error) {
  if (!error) return null;
  
  const sanitized = {
    name: error.name || 'Error',
    message: error.message || String(error)
  };
  
  if (error.code) {
    sanitized.errorCode = error.code;
  }
  
  if (sanitized.message && sanitized.message.length > 500) {
    sanitized.message = sanitized.message.substring(0, 500) + '...';
  }
  
  return sanitized;
}

export class RebalancerSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      enableAutoRebalancing: config.enableAutoRebalancing !== false,
      rebalanceThreshold: config.rebalanceThreshold || 0.05,
      minRebalanceAmount: config.minRebalanceAmount || 0.01,
      maxSlippage: config.maxSlippage || 0.01,
      defaultProtocolFee: config.defaultProtocolFee || 0.003, // 0.3% default protocol fee
      defaultLiquidityProviderFee: config.defaultLiquidityProviderFee || 0.003, // 0.3% default LP fee
      defaultGasPrice: config.defaultGasPrice || 0.00001, // Default gas price in CELO
      ...config
    };
    this.automationSystem = config.automationSystem || null;
    this.portfolios = new Map();
    this.rebalanceHistory = [];
    this.stats = {
      totalRebalances: 0,
      successfulRebalances: 0,
      failedRebalances: 0,
      totalValueRebalanced: 0
    };
  }
  setAutomationSystem(automationSystem) {
    this.automationSystem = automationSystem;
    this.emit('automationSystemSet', { available: !!automationSystem });
  }
  async analyzePortfolio(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      throw new Error('Invalid parameters provided');
    }
    const { walletAddress, targetAllocation } = parameters;
    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new Error('Valid wallet address is required');
    }
    try {
      this.emit('portfolioAnalysisStarted', { walletAddress });
      let currentBalances = {};
      let totalValue = 0;
      let isMockData = false;
      let balanceError = null;
      if (this.automationSystem) {
        try {
          const balances = await this.automationSystem.processNaturalLanguage(
            `Get all token balances for wallet ${walletAddress}`,
            { sessionId: `rebalance_${Date.now()}` }
          );
          if (balances && balances.result) {
            currentBalances = balances.result.balances || {};
            totalValue = balances.result.totalValue || 0;
          }
        } catch (error) {
          balanceError = error;
          logger.warn('Failed to get real balances, using mock data', {
            error: error.message,
            stack: error.stack,
            errorObject: error instanceof Error ? {
              name: error.name,
              message: error.message,
              stack: error.stack
            } : error
          });
        }
      }
      if (Object.keys(currentBalances).length === 0) {
        isMockData = true;
        currentBalances = {
          CELO: 600,
          cUSD: 300,
          cEUR: 100
        };
        totalValue = 1000;
      }
      const currentAllocation = {};
      Object.keys(currentBalances).forEach(token => {
        if (totalValue > 0) {
          currentAllocation[token] = currentBalances[token] / totalValue;
        } else {
          currentAllocation[token] = 0;
        }
      });
      let deviation = {};
      let needsRebalancing = false;
      if (targetAllocation) {
        Object.keys(targetAllocation).forEach(token => {
          const target = targetAllocation[token];
          const current = currentAllocation[token] || 0;
          const diff = Math.abs(current - target);
          deviation[token] = {
            current,
            target,
            difference: diff,
            percentage: target !== 0 ? (diff / target) * 100 : 0
          };
          if (diff > this.config.rebalanceThreshold) {
            needsRebalancing = true;
          }
        });
      }
      const performance = {
        daily: 0.02,
        weekly: 0.05,
        monthly: 0.15
      };
      const recommendations = [];
      if (needsRebalancing && targetAllocation) {
        recommendations.push('Consider rebalancing to target allocation');
      }
      if (currentAllocation.cUSD && currentAllocation.cUSD < 0.2) {
        recommendations.push('Monitor cUSD position');
      }
      const analysis = {
        walletAddress,
        totalValue,
        currentBalances,
        currentAllocation,
        targetAllocation: targetAllocation || null,
        deviation: targetAllocation ? deviation : null,
        needsRebalancing,
        performance,
        recommendations,
        isMockData,
        balanceError: sanitizeError(balanceError),
        timestamp: new Date().toISOString()
      };
      this.portfolios.set(walletAddress, {
        ...analysis,
        lastUpdated: new Date().toISOString()
      });
      this.emit('portfolioAnalyzed', analysis);
      return analysis;
    } catch (error) {
      this.emit('portfolioAnalysisError', { walletAddress, error: error.message });
      throw error;
    }
  }
  async rebalancePortfolio(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      throw new Error('Invalid parameters provided');
    }
    const { walletAddress, targetAllocation, execute = false } = parameters;
    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new Error('Valid wallet address is required');
    }
    if (!targetAllocation || typeof targetAllocation !== 'object') {
      throw new Error('Valid target allocation object is required');
    }
    try {
      this.emit('rebalancingStarted', { walletAddress, targetAllocation });
      const analysis = await this.analyzePortfolio({ walletAddress, targetAllocation });
      
      if (analysis.isMockData) {
        logger.warn('Rebalancing attempted with mock data', {
          walletAddress,
          balanceError: analysis.balanceError
        });
        return {
          success: false,
          message: 'Cannot rebalance: portfolio analysis used mock data due to balance retrieval failure',
          analysis,
          transactions: [],
          estimatedCost: 0,
          error: 'Mock data detected - real balance data unavailable',
          balanceError: analysis.balanceError
        };
      }
      
      if (!analysis.needsRebalancing) {
        return {
          success: true,
          message: 'Portfolio is already balanced',
          analysis,
          transactions: [],
          estimatedCost: 0
        };
      }
      const transactionResult = this.calculateRebalancingTransactions(
        analysis.currentBalances,
        analysis.currentAllocation,
        targetAllocation,
        analysis.totalValue
      );
      const { transactions, rebalancingRequired } = transactionResult;
      
      const costBreakdown = {
        total: 0,
        gasCost: 0,
        protocolFees: 0,
        slippageImpact: 0,
        liquidityProviderFees: 0,
        missingComponents: []
      };
      
      transactions.forEach((tx) => {
        const parsedAmount = parseFloat(tx.amount);
        let amount = null;
        let amountValidationFailed = false;
        let validationReason = null;
        
        if (tx.amount === undefined || tx.amount === null) {
          amountValidationFailed = true;
          validationReason = `tx.amount is ${tx.amount === undefined ? 'undefined' : 'null'}`;
        } else if (!Number.isFinite(parsedAmount)) {
          amountValidationFailed = true;
          validationReason = `tx.amount "${tx.amount}" cannot be parsed as a finite number`;
        } else if (parsedAmount <= 0) {
          amountValidationFailed = true;
          validationReason = `tx.amount ${parsedAmount} is not positive (must be > 0)`;
        } else {
          amount = parsedAmount;
        }
        
        if (amountValidationFailed) {
          logger.warn('Transaction amount validation failed - skipping cost calculations', {
            transaction: `${tx.from} -> ${tx.to}`,
            rawAmount: tx.amount,
            reason: validationReason
          });
          costBreakdown.missingComponents.push({
            transaction: `${tx.from} -> ${tx.to}`,
            missing: ['amount'],
            reason: validationReason,
            rawAmount: tx.amount
          });
          return; // Skip this transaction's cost calculations
        }
        
        let txGasCost = 0;
        let txProtocolFee = 0;
        let txSlippageImpact = 0;
        let txLpFee = 0;
        const txMissingComponents = [];
        
        const gasEstimate = tx.gasUsed || tx.estimatedGas || 0;
        const gasPrice = tx.gasPrice || this.config.defaultGasPrice;
        if (gasEstimate > 0 && gasPrice > 0) {
          txGasCost = gasPrice * gasEstimate;
        } else {
          txMissingComponents.push('gasEstimate');
        }
        
        if (tx.quote && typeof tx.quote.protocolFee === 'number') {
          txProtocolFee = tx.quote.protocolFee;
        } else if (tx.protocolFee !== undefined) {
          txProtocolFee = tx.protocolFee;
        } else {
          txProtocolFee = amount * this.config.defaultProtocolFee;
          txMissingComponents.push('protocolFee');
        }
        
        if (tx.quote && tx.quote.expectedPrice && tx.quote.actualPrice) {
          const expectedValue = amount * tx.quote.expectedPrice;
          const actualValue = amount * tx.quote.actualPrice;
          txSlippageImpact = Math.abs(expectedValue - actualValue);
        } else if (tx.slippageImpact !== undefined) {
          txSlippageImpact = tx.slippageImpact;
        } else if (tx.quote && tx.quote.slippage !== undefined) {
          txSlippageImpact = amount * (tx.quote.slippage || 0);
        } else {
          txSlippageImpact = amount * this.config.maxSlippage;
          txMissingComponents.push('slippageImpact');
        }
        
        if (tx.quote && typeof tx.quote.liquidityProviderFee === 'number') {
          txLpFee = tx.quote.liquidityProviderFee;
        } else if (tx.liquidityProviderFee !== undefined) {
          txLpFee = tx.liquidityProviderFee;
        } else if (tx.spread !== undefined) {
          txLpFee = amount * tx.spread;
        } else {
          txLpFee = amount * this.config.defaultLiquidityProviderFee;
          txMissingComponents.push('liquidityProviderFee');
        }
        
        costBreakdown.gasCost += txGasCost;
        costBreakdown.protocolFees += txProtocolFee;
        costBreakdown.slippageImpact += txSlippageImpact;
        costBreakdown.liquidityProviderFees += txLpFee;
        
        if (txMissingComponents.length > 0) {
          costBreakdown.missingComponents.push({
            transaction: `${tx.from} -> ${tx.to}`,
            missing: txMissingComponents
          });
        }
      });
      
      costBreakdown.total = costBreakdown.gasCost + costBreakdown.protocolFees + 
                            costBreakdown.slippageImpact + costBreakdown.liquidityProviderFees;
      
      const estimatedCost = costBreakdown.total;
      const hasMissingComponents = costBreakdown.missingComponents.length > 0;
      if (hasMissingComponents) {
        logger.warn('Cost estimation incomplete - some components unavailable', {
          missingComponents: costBreakdown.missingComponents,
          costBreakdown: {
            total: costBreakdown.total,
            gasCost: costBreakdown.gasCost,
            protocolFees: costBreakdown.protocolFees,
            slippageImpact: costBreakdown.slippageImpact,
            liquidityProviderFees: costBreakdown.liquidityProviderFees
          }
        });
      }
      
      const rebalancePlan = {
        walletAddress,
        targetAllocation,
        currentAllocation: analysis.currentAllocation,
        transactions,
        estimatedCost,
        costBreakdown: {
          gasCost: costBreakdown.gasCost,
          protocolFees: costBreakdown.protocolFees,
          slippageImpact: costBreakdown.slippageImpact,
          liquidityProviderFees: costBreakdown.liquidityProviderFees,
          total: costBreakdown.total
        },
        costEstimateIncomplete: hasMissingComponents, // Flag indicating if estimate uses fallback defaults
        missingCostComponents: hasMissingComponents ? costBreakdown.missingComponents : [],
        rebalancingRequired: rebalancingRequired || false,
        timestamp: new Date().toISOString()
      };
      let executionResult = null;
      if (execute && this.automationSystem && transactions.length > 0) {
        executionResult = await this.executeRebalancingTransactions(
          walletAddress,
          transactions
        );
      }
      const result = {
        success: true,
        plan: rebalancePlan,
        executionResult,
        newAllocation: targetAllocation,
        rebalancingRequired: rebalancingRequired || false,
        timestamp: new Date().toISOString()
      };
      const executionAttempted = execute && this.automationSystem && transactions.length > 0;
      this.stats.totalRebalances++;
      if (executionAttempted && executionResult && executionResult.success) {
        this.stats.successfulRebalances++;
        this.stats.totalValueRebalanced += analysis.totalValue;
      } else if (executionAttempted && executionResult && executionResult.success === false) {
        this.stats.failedRebalances++;
      }
      this.rebalanceHistory.push({
        ...result,
        executed: execute
      });
      if (this.rebalanceHistory.length > 100) {
        this.rebalanceHistory.shift();
      }
      this.emit('rebalancingCompleted', result);
      return result;
    } catch (error) {
      this.stats.failedRebalances++;
      this.emit('rebalancingError', { walletAddress, error: error.message });
      throw error;
    }
  }
  calculateRebalancingTransactions(currentBalances, currentAllocation, targetAllocation, totalValue) {
    const transactions = [];
    const targetAmounts = {};
    Object.keys(targetAllocation).forEach(token => {
      targetAmounts[token] = totalValue * targetAllocation[token];
    });
    const adjustments = [];
    Object.keys(targetAllocation).forEach(token => {
      const current = currentBalances[token] || 0;
      const target = targetAmounts[token];
      const difference = target - current;
      if (Math.abs(difference) > this.config.minRebalanceAmount) {
        adjustments.push({
          token,
          current,
          target,
          difference,
          action: difference > 0 ? 'buy' : 'sell',
          remaining: Math.abs(difference)
        });
      }
    });
    
    const buyAdjustments = adjustments.filter(a => a.action === 'buy');
    const sellAdjustments = adjustments.filter(a => a.action === 'sell');
    
    const usedAdjustments = new Set();
    
    for (const buyAdj of buyAdjustments) {
      if (usedAdjustments.has(buyAdj.token)) continue;
      
      const availableSells = sellAdjustments.filter(
        sellAdj => !usedAdjustments.has(sellAdj.token) && sellAdj.token !== buyAdj.token && sellAdj.remaining > 0
      );
      
      if (availableSells.length === 0) continue;
      
      let buyRemaining = buyAdj.remaining;
      for (const sellAdj of availableSells) {
        if (buyRemaining <= 0) break;
        
        const amountToSwap = Math.min(buyRemaining, sellAdj.remaining);
        if (amountToSwap > 0) {
          transactions.push({
            type: 'swap',
            from: sellAdj.token,
            to: buyAdj.token,
            amount: amountToSwap.toString(),
            estimatedGas: 0.001
          });
          
          buyRemaining -= amountToSwap;
          sellAdj.remaining -= amountToSwap;
          
          if (sellAdj.remaining <= this.config.minRebalanceAmount) {
            usedAdjustments.add(sellAdj.token);
          }
        }
      }
      
      if (buyRemaining <= this.config.minRebalanceAmount) {
        usedAdjustments.add(buyAdj.token);
      } else {
        buyAdj.remaining = buyRemaining;
      }
    }
    
    const validTransactions = transactions.filter(tx => {
      const amount = parseFloat(tx.amount);
      return amount > 0 && tx.from !== tx.to && tx.estimatedGas > 0;
    });
    
    const rebalancingRequired = adjustments.length > 0;
    const canExecute = validTransactions.length > 0;
    
    return {
      transactions: validTransactions,
      rebalancingRequired: rebalancingRequired
    };
  }
  async executeRebalancingTransactions(walletAddress, transactions) {
    if (!this.automationSystem) {
      throw new Error('Automation system not available for execution');
    }
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        success: true,
        executed: 0,
        successful: 0,
        failed: 0,
        results: []
      };
    }
    const results = [];
    for (const tx of transactions) {
      try {
        if (!tx || typeof tx !== 'object') {
          throw new Error('Invalid transaction object');
        }
        const prompt = `Execute ${tx.type} transaction: from ${tx.from} to ${tx.to}, amount ${tx.amount}`;
        const result = await this.automationSystem.processNaturalLanguage(
          prompt,
          { sessionId: `rebalance_exec_${Date.now()}` }
        );
        results.push({
          transaction: tx,
          success: true,
          result
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          transaction: tx,
          success: false,
          error: errorMessage
        });
      }
    }
    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount === transactions.length,
      executed: results.length,
      successful: successCount,
      failed: results.length - successCount,
      results
    };
  }
  getPortfolio(walletAddress) {
    return this.portfolios.get(walletAddress) || null;
  }
  getRebalanceHistory(walletAddress = null) {
    if (walletAddress) {
      return this.rebalanceHistory.filter(h => h.plan?.walletAddress === walletAddress);
    }
    return [...this.rebalanceHistory];
  }
  getStats() {
    return {
      ...this.stats,
      portfolioCount: this.portfolios.size,
      historyCount: this.rebalanceHistory.length
    };
  }
  async findYieldOpportunities(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      throw new Error('Invalid parameters provided');
    }
    const { tokens, amount, riskTolerance } = parameters;
    if (tokens !== undefined && (!Array.isArray(tokens) || tokens.some(t => typeof t !== 'string'))) {
      throw new Error('tokens parameter must be an array of strings');
    }
    if (amount !== undefined && (typeof amount !== 'number' || amount < 0 || !isFinite(amount))) {
      throw new Error('amount parameter must be a valid non-negative number');
    }
    const opportunities = [
      {
        protocol: 'Moola',
        token: 'cUSD',
        apy: 0.08,
        risk: 'low',
        liquidity: 'high',
        minAmount: 10
      },
      {
        protocol: 'Ubeswap',
        token: 'CELO',
        apy: 0.12,
        risk: 'medium',
        liquidity: 'medium',
        minAmount: 50
      },
      {
        protocol: 'Curve',
        token: 'cEUR',
        apy: 0.06,
        risk: 'low',
        liquidity: 'high',
        minAmount: 20
      }
    ];
    let filtered = opportunities;
    if (tokens && tokens.length > 0) {
      const tokenSet = new Set(tokens.map(t => t.toUpperCase()));
      filtered = filtered.filter(opp => tokenSet.has(opp.token.toUpperCase()));
    }
    if (amount !== undefined) {
      filtered = filtered.filter(opp => opp.minAmount <= amount);
    }
    if (riskTolerance) {
      const riskLevels = { low: 0, medium: 1, high: 2 };
      const maxRisk = riskLevels[riskTolerance] || 2;
      filtered = filtered.filter(opp => riskLevels[opp.risk] <= maxRisk);
    }
    return {
      opportunities: filtered,
      timestamp: new Date().toISOString()
    };
  }
}
export default RebalancerSystem;
