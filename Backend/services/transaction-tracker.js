
import logger from '../utils/logger.js';

export class TransactionTracker {
  constructor(broadcastFn) {
    this.broadcastFn = broadcastFn;
    this.transactions = new Map();
    this.transactionSubscribers = new Map();
    this.pollInterval = 5000;
    this.maxRetries = 60;
    this.pollingIntervals = new Map();
  }

  registerTransaction(txHash, metadata = {}) {
    const transaction = {
      hash: txHash,
      status: 'pending',
      createdAt: Date.now(),
      lastUpdate: Date.now(),
      retries: 0,
      metadata,
      confirmations: 0,
      gasUsed: null,
      blockNumber: null,
      blockHash: null,
      nonce: null,
      transactionIndex: null,
      cumulativeGasUsed: null,
      gasPrice: null,
      effectiveGasPrice: null,
      logs: [],
      logsBloom: null,
      type: null,
      contractAddress: null,
      root: null,
      error: null
    };

    this.transactions.set(txHash, transaction);
    this.broadcastTransactionUpdate(txHash, transaction);

    this.startPollingTransaction(txHash);

    return transaction;
  }

  startPollingTransaction(txHash) {
    if (this.pollingIntervals.has(txHash)) {
      return;
    }

    const pollFn = async () => {
      const tx = this.transactions.get(txHash);
      if (!tx) return;

      try {

        const updated = await this.checkTransactionStatus(txHash);

        if (updated.status !== tx.status) {
          this.transactions.set(txHash, updated);
          this.broadcastTransactionUpdate(txHash, updated);
        }

        if (updated.status === 'success' || updated.status === 'failed') {
          this.stopPollingTransaction(txHash);
        }

        tx.retries++;
        if (tx.retries >= this.maxRetries) {
          this.stopPollingTransaction(txHash);
          logger.warn('Transaction polling timeout', { txHash, retries: this.maxRetries });
        }
      } catch (error) {
        logger.error('Error polling transaction', { txHash, error: error.message, stack: error.stack });
      }
    };

    const interval = setInterval(pollFn, this.pollInterval);
    this.pollingIntervals.set(txHash, interval);

    pollFn();
  }

  stopPollingTransaction(txHash) {
    const interval = this.pollingIntervals.get(txHash);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(txHash);
    }
  }

  async checkTransactionStatus(txHash) {
    const tx = this.transactions.get(txHash);
    if (!tx) return null;

    const timeSinceCreation = Date.now() - tx.createdAt;

    let status = 'pending';
    let confirmations = 0;
    let blockNumber = null;

    if (timeSinceCreation > 10000) {

      status = 'success';
      confirmations = Math.floor(timeSinceCreation / 5000);
      blockNumber = Math.floor(Math.random() * 100000) + 1000000;
    } else if (timeSinceCreation > 3000) {

      confirmations = 1;
    }

    return {
      ...tx,
      status,
      confirmations,
      blockNumber,
      lastUpdate: Date.now(),
      gasUsed: status === 'success' ? '21000' : null,
      gasPrice: '5000000000'
    };
  }

  broadcastTransactionUpdate(txHash, transaction) {
    const update = {
      type: 'transaction_update',
      payload: {
        txHash,
        ...transaction,
        timestamp: Date.now()
      }
    };

    this.broadcastFn(update);

    const subscribers = this.transactionSubscribers.get(txHash) || [];
    subscribers.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        logger.error('Error in transaction subscriber', { txHash, error: error.message, stack: error.stack });
      }
    });
  }

  subscribeToTransaction(txHash, callback) {
    if (!this.transactionSubscribers.has(txHash)) {
      this.transactionSubscribers.set(txHash, []);
    }
    this.transactionSubscribers.get(txHash).push(callback);

    return () => {
      const subscribers = this.transactionSubscribers.get(txHash) || [];
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  getTransaction(txHash) {
    return this.transactions.get(txHash);
  }

  getPendingTransactions() {
    return Array.from(this.transactions.values()).filter(tx => tx.status === 'pending');
  }

  getTransactionHistory(limit = 50) {
    return Array.from(this.transactions.values())
      .sort((a, b) => b.lastUpdate - a.lastUpdate)
      .slice(0, limit);
  }

  clearOldTransactions(maxAge = 3600000) {
    const now = Date.now();
    for (const [hash, tx] of this.transactions.entries()) {
      if (now - tx.lastUpdate > maxAge && tx.status !== 'pending') {
        this.stopPollingTransaction(hash);
        this.transactions.delete(hash);
        this.transactionSubscribers.delete(hash);
      }
    }
  }

  getStatistics() {
    const txs = Array.from(this.transactions.values());
    const gasUsedTxs = txs.filter(tx => tx.gasUsed);
    const avgGasUsed = gasUsedTxs.length > 0
      ? gasUsedTxs.reduce((sum, tx) => sum + parseInt(tx.gasUsed), 0) / gasUsedTxs.length
      : 0;

    return {
      total: txs.length,
      pending: txs.filter(tx => tx.status === 'pending').length,
      success: txs.filter(tx => tx.status === 'success').length,
      failed: txs.filter(tx => tx.status === 'failed').length,
      avgGasUsed: Math.round(avgGasUsed)
    };
  }

  shutdown() {
    for (const [hash] of this.pollingIntervals.entries()) {
      this.stopPollingTransaction(hash);
    }
    this.transactions.clear();
    this.transactionSubscribers.clear();
    this.pollingIntervals.clear();
  }
}

export default TransactionTracker;

