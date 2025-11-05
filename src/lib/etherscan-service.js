/**
 * Etherscan Integration Service
 * Provides comprehensive blockchain data from Etherscan/Blockscout APIs
 */

import fetch from 'node-fetch';

export class EtherscanService {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ETHERSCAN_API_KEY;
    this.network = config.network || 'alfajores';
    this.baseUrl = this.getBaseUrl();
    this.timeout = config.timeout || 10000; // Default 10 seconds
  }

  getBaseUrl() {
    const networkMap = {
      'mainnet': 'https://api.etherscan.io/api',
      'alfajores': 'https://alfajores-blockscout.celo-testnet.org/api',
      'celo': 'https://explorer.celo.org/api'
    };
    return networkMap[this.network] || networkMap['alfajores'];
  }

  /**
   * Fetch with timeout using AbortController
   */
  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Validate and normalize Ethereum address
   * @param {string} address - Address to validate and normalize
   * @returns {string} - Normalized address (lowercase, with 0x prefix)
   * @throws {Error} - If address is invalid
   */
  validateAndNormalizeAddress(address) {
    if (!address || typeof address !== 'string') {
      throw new Error('Address must be a non-empty string');
    }

    const trimmed = address.trim();
    const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;

    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(withPrefix)) {
      throw new Error(`Invalid address format: "${address}". Expected 0x followed by 40 hexadecimal characters.`);
    }

    return withPrefix.toLowerCase();
  }

  /**
   * Get account balance
   */
  async getBalance(address) {
    try {
      const normalizedAddress = this.validateAndNormalizeAddress(address);

      const response = await this.fetchWithTimeout(
        `${this.baseUrl}?module=account&action=balance&address=${normalizedAddress}&tag=latest&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1') {
        return result.result;
      }
      throw new Error(result.message || 'Failed to get balance');
    } catch (error) {
      if (error.message.includes('Invalid address format') || error.message.includes('must be a non-empty string')) {
        console.warn(`Etherscan balance validation error: ${error.message}`);
        return null;
      }
      console.error('Etherscan balance error:', error);
      return null;
    }
  }

  /**
   * Get account transactions
   */
  async getTransactions(address, startBlock = 0, endBlock = 99999999, sort = 'desc') {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=${endBlock}&sort=${sort}&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1') {
        return result.result;
      }
      return [];
    } catch (error) {
      console.error('Etherscan transactions error:', error);
      return [];
    }
  }

  /**
   * Get internal transactions
   */
  async getInternalTransactions(address) {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}?module=account&action=txlistinternal&address=${address}&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1') {
        return result.result;
      }
      return [];
    } catch (error) {
      console.error('Etherscan internal transactions error:', error);
      return [];
    }
  }

  /**
   * Get token transfers
   */
  async getTokenTransfers(address, contractAddress = null) {
    try {
      let url = `${this.baseUrl}?module=account&action=tokentx&address=${address}`;
      if (contractAddress) {
        url += `&contractaddress=${contractAddress}`;
      }
      url += `&apikey=${this.apiKey}`;

      const response = await this.fetchWithTimeout(url);
      const result = await response.json();
      if (result.status === '1') {
        return result.result;
      }
      return [];
    } catch (error) {
      console.error('Etherscan token transfers error:', error);
      return [];
    }
  }

  /**
   * Get transaction receipt status
   */
  async getTransactionStatus(txHash) {
    if (!txHash || typeof txHash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      throw new Error('Invalid transaction hash format');
    }
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1') {
        return {
          status: result.result.status === '1' ? 'success' : 'failed',
          isError: result.result.isError === '1'
        };
      }
      return null;
    } catch (error) {
      console.error('Etherscan transaction status error:', error);
      return null;
    }
  }
  /**
   * Get contract ABI
   */
  async getContractABI(contractAddress) {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}?module=contract&action=getabi&address=${contractAddress}&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1') {
        return JSON.parse(result.result);
      }
      throw new Error(result.message || 'Failed to get ABI');
    } catch (error) {
      console.error('Etherscan ABI error:', error);
      return null;
    }
  }

  /**
   * Get contract source code
   */
  async getContractSourceCode(contractAddress) {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1' && result.result.length > 0) {
        return result.result[0];
      }
      return null;
    } catch (error) {
      console.error('Etherscan source code error:', error);
      return null;
    }
  }

  /**
   * Get gas tracker
   */
  async getGasTracker() {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}?module=gastracker&action=gasoracle&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1') {
        return result.result;
      }
      return null;
    } catch (error) {
      console.error('Etherscan gas tracker error:', error);
      return null;
    }
  }

  /**
   * Get block information
   */
  async getBlockInfo(blockNumber) {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}?module=proxy&action=eth_getBlockByNumber&tag=${blockNumber}&boolean=true&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.result) {
        return result.result;
      }
      return null;
    } catch (error) {
      console.error('Etherscan block info error:', error);
      return null;
    }
  }

  /**
   * Get account analytics
   */
  async getAccountAnalytics(address) {
    try {
      const [balance, transactions, internalTxs, tokenTransfers] = await Promise.all([
        this.getBalance(address),
        this.getTransactions(address),
        this.getInternalTransactions(address),
        this.getTokenTransfers(address)
      ]);

      return {
        address,
        balance,
        transactionCount: transactions.length,
        internalTransactionCount: internalTxs.length,
        tokenTransferCount: tokenTransfers.length,
        totalTransactions: transactions.length + internalTxs.length + tokenTransfers.length,
        recentTransactions: transactions.slice(0, 10),
        recentTokenTransfers: tokenTransfers.slice(0, 10)
      };
    } catch (error) {
      console.error('Etherscan analytics error:', error);
      return null;
    }
  }
}

