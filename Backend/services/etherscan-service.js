

import fetch from 'node-fetch';
import logger from '../utils/logger.js';

export class EtherscanService {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ETHERSCAN_API_KEY;
    this.network = config.network || 'alfajores';
    this.baseUrl = this.getBaseUrl();
  }

  getBaseUrl() {
    const map = {
      mainnet: 'https://api.celoscan.io/api',
      celo: 'https://api.celoscan.io/api',
      alfajores: 'https://api-alfajores.celoscan.io/api',
    };
    return map[this.network] || map.alfajores;
  }

  async getBalance(address) {
    try {
      const response = await fetch(
        `${this.baseUrl}?module=account&action=balance&address=${address}&tag=latest&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1') {
        return result.result;
      }
      throw new Error(result.message || 'Failed to get balance');
    } catch (error) {
      logger.error('Etherscan balance error', { error: error.message, address, stack: error.stack });
      return null;
    }
  }

  async getTransactions(address, startBlock = 0, endBlock = 99999999, sort = 'desc') {
    try {
      const response = await fetch(
        `${this.baseUrl}?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=${endBlock}&sort=${sort}&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1') {
        return result.result;
      }
      return [];
    } catch (error) {
      logger.error('Etherscan transactions error', { error: error.message, address, stack: error.stack });
      return [];
    }
  }

  async getInternalTransactions(address) {
    try {
      const response = await fetch(
        `${this.baseUrl}?module=account&action=txlistinternal&address=${address}&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1') {
        return result.result;
      }
      return [];
    } catch (error) {
      logger.error('Etherscan internal transactions error', { error: error.message, address, stack: error.stack });
      return [];
    }
  }

  async getTokenTransfers(address, contractAddress = null) {
    try {
      let url = `${this.baseUrl}?module=account&action=tokentx&address=${address}`;
      if (contractAddress) {
        url += `&contractaddress=${contractAddress}`;
      }
      url += `&apikey=${this.apiKey}`;

      const response = await fetch(url);
      const result = await response.json();
      if (result.status === '1') {
        return result.result;
      }
      return [];
    } catch (error) {
      logger.error('Etherscan token transfers error', { error: error.message, address, stack: error.stack });
      return [];
    }
  }

  async getTransactionStatus(txHash) {
    try {
      const response = await fetch(
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
      logger.error('Etherscan transaction status error', { error: error.message, txHash, stack: error.stack });
      return null;
    }
  }

  async getContractABI(contractAddress) {
    try {
      const response = await fetch(
        `${this.baseUrl}?module=contract&action=getabi&address=${contractAddress}&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1') {
        return JSON.parse(result.result);
      }
      throw new Error(result.message || 'Failed to get ABI');
    } catch (error) {
      logger.error('Etherscan ABI error', { error: error.message, contractAddress, stack: error.stack });
      return null;
    }
  }

  async getContractSourceCode(contractAddress) {
    try {
      const response = await fetch(
        `${this.baseUrl}?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1' && result.result.length > 0) {
        return result.result[0];
      }
      return null;
    } catch (error) {
      logger.error('Etherscan source code error', { error: error.message, contractAddress, stack: error.stack });
      return null;
    }
  }

  async getGasTracker() {
    try {
      const response = await fetch(
        `${this.baseUrl}?module=gastracker&action=gasoracle&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.status === '1') {
        return result.result;
      }
      return null;
    } catch (error) {
      logger.error('Etherscan gas tracker error', { error: error.message, stack: error.stack });
      return null;
    }
  }

  async getBlockInfo(blockNumber) {
    try {
      const response = await fetch(
        `${this.baseUrl}?module=proxy&action=eth_getBlockByNumber&tag=${blockNumber}&boolean=true&apikey=${this.apiKey}`
      );
      const result = await response.json();
      if (result.result) {
        return result.result;
      }
      return null;
    } catch (error) {
      logger.error('Etherscan block info error', { error: error.message, blockNumber, stack: error.stack });
      return null;
    }
  }

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
      logger.error('Etherscan analytics error', { error: error.message, stack: error.stack });
      return null;
    }
  }
}

