import { EventEmitter } from 'events';

/**
 * Rebalancer System - Portfolio rebalancing system
 * 
 * Handles portfolio analysis, rebalancing strategies, and execution
 * Extracted from agents.js to be a standalone component
 */
export class RebalancerSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableAutoRebalancing: config.enableAutoRebalancing !== false,
      rebalanceThreshold: config.rebalanceThreshold || 0.05,
      minRebalanceAmount: config.minRebalanceAmount || 0.01,
      maxSlippage: config.maxSlippage || 0.01,
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

  /**
   * Set automation system reference
   * @param {Object} automationSystem - Automation system instance
   */
  setAutomationSystem(automationSystem) {
    this.automationSystem = automationSystem;
    this.emit('automationSystemSet', { available: !!automationSystem });
  }

  /**
   * Analyze portfolio for a wallet
   * @param {Object} parameters - Analysis parameters
   * @param {string} parameters.walletAddress - Wallet address to analyze
   * @param {Object} parameters.targetAllocation - Target allocation percentages (optional)
   * @returns {Promise<Object>} Portfolio analysis result
   */
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
          console.warn('Failed to get real balances, using mock data:', error.message);
        }
      }
      
      if (Object.keys(currentBalances).length === 0) {
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
            percentage: target && target !== 0 ? (diff / target) * 100 : 0
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

  /**
   * Rebalance portfolio to target allocation
   * @param {Object} parameters - Rebalancing parameters
   * @param {string} parameters.walletAddress - Wallet address
   * @param {Object} parameters.targetAllocation - Target allocation percentages
   * @param {boolean} parameters.execute - Whether to execute transactions (default: false)
   * @returns {Promise<Object>} Rebalancing plan and result
   */
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
      
      if (!analysis.needsRebalancing) {
        return {
          success: true,
          message: 'Portfolio is already balanced',
          analysis,
          transactions: [],
          estimatedCost: 0
        };
      }
      
      const transactions = this.calculateRebalancingTransactions(
        analysis.currentBalances,
        analysis.currentAllocation,
        targetAllocation,
        analysis.totalValue
      );
      
      const estimatedCost = transactions.reduce((sum, tx) => {
        return sum + (tx.estimatedGas || 0);
      }, 0);
      
      const rebalancePlan = {
        walletAddress,
        targetAllocation,
        currentAllocation: analysis.currentAllocation,
        transactions,
        estimatedCost,
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
        timestamp: new Date().toISOString()
      };
      
      // Track execution attempt: execution is attempted when execute is true AND
      // automationSystem is available AND transactions exist
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
          action: difference > 0 ? 'buy' : 'sell'
        });
      }
    });
    
    adjustments.forEach(adj => {
      if (adj.action === 'buy') {
        const tokensToSell = adjustments.filter(a => a.action === 'sell' && a.token !== adj.token);
        if (tokensToSell.length > 0) {
          const sellToken = tokensToSell[0];
          const amountToSell = Math.min(Math.abs(sellToken.difference), adj.difference);
          
          transactions.push({
            type: 'swap',
            from: sellToken.token,
            to: adj.token,
            amount: amountToSell.toString(),
            estimatedGas: 0.001
          });
        }
      }
    });
    
    if (transactions.length === 0 && adjustments.length > 0) {
      transactions.push({
        type: 'swap',
        from: adjustments[0].token,
        to: adjustments[0].token,
        amount: '0',
        estimatedGas: 0.001,
        note: 'Rebalancing required but no transactions generated'
      });
    }
    
    return transactions;
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

  /**
   * Get portfolio for a wallet
   * @param {string} walletAddress - Wallet address
   * @returns {Object|null} Portfolio data or null
   */
  getPortfolio(walletAddress) {
    return this.portfolios.get(walletAddress) || null;
  }

  /**
   * Get rebalancing history
   * @param {string} walletAddress - Optional wallet address filter
   * @returns {Array} Rebalancing history
   */
  getRebalanceHistory(walletAddress = null) {
    if (walletAddress) {
      return this.rebalanceHistory.filter(h => h.plan?.walletAddress === walletAddress);
    }
    return [...this.rebalanceHistory];
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      portfolioCount: this.portfolios.size,
      historyCount: this.rebalanceHistory.length
    };
  }

  /**
   * Find yield opportunities for given tokens and amount
   * @param {Object} parameters - Search parameters
   * @param {string[]} [parameters.tokens] - Array of token symbols to filter by (optional)
   * @param {number} [parameters.amount] - Minimum amount to filter opportunities by (optional)
   * @param {string} [parameters.riskTolerance] - Risk tolerance level: 'low', 'medium', or 'high' (optional)
   * @returns {Promise<Object>} Object containing filtered opportunities and timestamp
   * @note Currently returns static/mock data for demonstration purposes
   */
  async findYieldOpportunities(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      throw new Error('Invalid parameters provided');
    }

    const { tokens, amount, riskTolerance } = parameters;
    
    // Validate tokens parameter if provided
    if (tokens !== undefined && (!Array.isArray(tokens) || tokens.some(t => typeof t !== 'string'))) {
      throw new Error('tokens parameter must be an array of strings');
    }
    
    // Validate amount parameter if provided
    if (amount !== undefined && (typeof amount !== 'number' || amount < 0 || !isFinite(amount))) {
      throw new Error('amount parameter must be a valid non-negative number');
    }
    
    // Static/mock yield opportunities data
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
    
    // Apply filters
    let filtered = opportunities;
    
    // Filter by tokens if provided
    if (tokens && tokens.length > 0) {
      const tokenSet = new Set(tokens.map(t => t.toUpperCase()));
      filtered = filtered.filter(opp => tokenSet.has(opp.token.toUpperCase()));
    }
    
    // Filter by amount if provided
    if (amount !== undefined) {
      filtered = filtered.filter(opp => opp.minAmount <= amount);
    }
    
    // Filter by risk tolerance if provided
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
