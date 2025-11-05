/**
 * Gas Estimation Service
 * Integrates Alchemy and Etherscan APIs for accurate gas estimation
 */

import fetch from 'node-fetch';

export class GasEstimationService {
  constructor(config = {}) {
    this.alchemyApiKey = config.alchemyApiKey || process.env.ALCHEMY_API_KEY;
    this.etherscanApiKey = config.etherscanApiKey || process.env.ETHERSCAN_API_KEY;
    this.network = config.network || 'alfajores';
    this.rpcUrl = config.rpcUrl || process.env.RPC_URL;
    
    // API endpoints
    this.alchemyUrl = this.getAlchemyUrl();
    this.etherscanUrl = this.getEtherscanUrl();
  }

  getAlchemyUrl() {
    const networkMap = {
      'mainnet': 'https://eth-mainnet.g.alchemy.com/v2/',
      'alfajores': 'https://celo-alfajores.g.alchemy.com/v2/',
      'celo': 'https://celo-mainnet.g.alchemy.com/v2/'
    };
    return networkMap[this.network] || networkMap['alfajores'];
  }

  getEtherscanUrl() {
    const networkMap = {
      'mainnet': 'https://api.etherscan.io/api',
      'alfajores': 'https://alfajores-blockscout.celo-testnet.org/api',
      'celo': 'https://explorer.celo.org/api'
    };
    return networkMap[this.network] || networkMap['alfajores'];
  }

  /**
   * Estimate gas using Alchemy
   */
  async estimateGasAlchemy(to, value = '0', data = '0x') {
    try {
      // Skip if no API key
      if (!this.alchemyApiKey || this.alchemyApiKey === 'demo') {
        return null;
      }

      // Ensure value is a valid integer string for BigInt conversion
      let hexValue = '0x0';
      if (value && value !== '0') {
        try {
          // Convert decimal string to BigInt directly (handles large numbers without precision loss)
          hexValue = `0x${BigInt(value).toString(16)}`;
        } catch (err) {
          hexValue = '0x0';
        }
      }

      const response = await fetch(`${this.alchemyUrl}${this.alchemyApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_estimateGas',
          params: [{
            to,
            value: hexValue,
            data: data || '0x'
          }],
          id: 1
        })
      });

      const result = await response.json();
      if (result.result) {
        return BigInt(result.result).toString();
      }
      throw new Error(result.error?.message || 'Gas estimation failed');
    } catch (error) {
      console.error('Alchemy gas estimation error:', error);
      return null;
    }
  }

  /**
   * Get gas price from Alchemy
   */
  async getGasPriceAlchemy() {
    try {
      // Skip if no API key
      if (!this.alchemyApiKey || this.alchemyApiKey === 'demo') {
        return null;
      }

      const response = await fetch(`${this.alchemyUrl}${this.alchemyApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1
        })
      });

      const result = await response.json();
      if (result.result) {
        const gasPrice = BigInt(result.result);
        const gweiPrice = Number(gasPrice) / 1e9;
        return {
          standard: gweiPrice.toFixed(2),
          fast: (gweiPrice * 1.25).toFixed(2),
          instant: (gweiPrice * 1.5).toFixed(2)
        };
      }
      throw new Error(result.error?.message || 'Gas price fetch failed');
    } catch (error) {
      console.error('Alchemy gas price error:', error);
      return null;
    }
  }

  /**
   * Get gas tracker from Etherscan
   */
  async getGasTrackerEtherscan() {
    try {
      // Skip if no API key
      if (!this.etherscanApiKey || this.etherscanApiKey === 'demo') {
        return null;
      }

      const response = await fetch(
        `${this.etherscanUrl}?module=gastracker&action=gasoracle&apikey=${this.etherscanApiKey}`
      );

      const result = await response.json();
      if (result.status === '1' && result.result) {
        return {
          standard: result.result.SafeGasPrice,
          fast: result.result.StandardGasPrice,
          instant: result.result.FastGasPrice,
          baseFee: result.result.suggestBaseFee
        };
      }
      throw new Error(result.message || 'Gas tracker fetch failed');
    } catch (error) {
      console.error('Etherscan gas tracker error:', error);
      return null;
    }
  }

  /**
   * Estimate transaction cost
   */
  async estimateTransactionCost(to, value = '0', data = '0x') {
    try {
      const gasEstimate = await this.estimateGasAlchemy(to, value, data);
      const gasPrice = await this.getGasPriceAlchemy();

      if (!gasEstimate || !gasPrice) {
        return this.getDefaultEstimate();
      }

      const gasBigInt = BigInt(gasEstimate);
      const gasPriceBigInt = BigInt(Math.floor(Number(gasPrice.standard) * 1e9));

      return {
        gasLimit: gasEstimate,
        gasPrice: gasPrice.standard,
        gasPriceWei: gasPriceBigInt.toString(),
        estimatedCost: (gasBigInt * gasPriceBigInt / BigInt(1e18)).toString(),
        estimatedCostGwei: (gasBigInt * gasPriceBigInt / BigInt(1e9)).toString(),
        breakdown: {
          safe: {
            gasPrice: gasPrice.standard,
            estimatedCost: (gasBigInt * BigInt(Math.floor(Number(gasPrice.standard) * 1e9)) / BigInt(1e18)).toString()
          },
          fast: {
            gasPrice: gasPrice.fast,
            estimatedCost: (gasBigInt * BigInt(Math.floor(Number(gasPrice.fast) * 1e9)) / BigInt(1e18)).toString()
          },
          instant: {
            gasPrice: gasPrice.instant,
            estimatedCost: (gasBigInt * BigInt(Math.floor(Number(gasPrice.instant) * 1e9)) / BigInt(1e18)).toString()
          }
        }
      };
    } catch (error) {
      console.error('Transaction cost estimation error:', error);
      return this.getDefaultEstimate();
    }
  }

  /**
   * Get default estimate (fallback)
   */
  getDefaultEstimate() {
    const baseGasPrice = 0.5; // gwei
    const gasLimit = 21000;
    const estimatedCostWei = gasLimit * baseGasPrice * 1e9;
    const estimatedCostEth = estimatedCostWei / 1e18;

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: baseGasPrice.toString(),
      gasPriceWei: (baseGasPrice * 1e9).toString(),
      estimatedCost: estimatedCostEth.toFixed(6),
      estimatedCostGwei: (estimatedCostWei / 1e9).toFixed(0),
      breakdown: {
        safe: {
          gasPrice: baseGasPrice.toString(),
          estimatedCost: estimatedCostEth.toFixed(6)
        },
        fast: {
          gasPrice: (baseGasPrice * 1.25).toString(),
          estimatedCost: (estimatedCostEth * 1.25).toFixed(6)
        },
        instant: {
          gasPrice: (baseGasPrice * 1.5).toString(),
          estimatedCost: (estimatedCostEth * 1.5).toFixed(6)
        }
      }
    };
  }

  /**
   * Get comprehensive gas data
   */
  async getComprehensiveGasData(to, value = '0', data = '0x') {
    const [transactionCost, gasTracker] = await Promise.all([
      this.estimateTransactionCost(to, value, data),
      this.getGasTrackerEtherscan()
    ]);

    return {
      transaction: transactionCost,
      tracker: gasTracker || {
        standard: transactionCost.gasPrice,
        fast: (Number(transactionCost.gasPrice) * 1.25).toString(),
        instant: (Number(transactionCost.gasPrice) * 1.5).toString()
      },
      timestamp: new Date().toISOString()
    };
  }
}

