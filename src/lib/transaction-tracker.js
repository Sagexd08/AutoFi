/**
 * Real-time Transaction Tracker
 * Monitors and broadcasts transaction status updates to connected clients
 */

export class TransactionTracker {
  constructor(broadcastFn) {
    this.broadcastFn = broadcastFn;
    this.transactions = new Map(); // Track all transactions
    this.transactionSubscribers = new Map(); // Track subscribers per tx
    this.pollInterval = 5000; // Poll every 5 seconds
    this.maxRetries = 60; // Max 5 minutes of polling
    this.pollingIntervals = new Map();
  }

  /**
   * Register a new transaction for tracking
   */
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
    
    // Start polling for this transaction
    this.startPollingTransaction(txHash);
    
    return transaction;
  }

  /**
   * Start polling for transaction status
   */
  startPollingTransaction(txHash) {
    if (this.pollingIntervals.has(txHash)) {
      return; // Already polling
    }

    const pollFn = async () => {
      const tx = this.transactions.get(txHash);
      if (!tx) return;

      try {
        // Simulate transaction status check
        const updated = await this.checkTransactionStatus(txHash);
        
        if (updated.status !== tx.status) {
          this.transactions.set(txHash, updated);
          this.broadcastTransactionUpdate(txHash, updated);
        }

        // Stop polling if transaction is confirmed or failed
        if (updated.status === 'success' || updated.status === 'failed') {
          this.stopPollingTransaction(txHash);
        }

        tx.retries++;
        if (tx.retries >= this.maxRetries) {
          this.stopPollingTransaction(txHash);
          console.warn(`⚠️ Transaction ${txHash} polling timeout after ${this.maxRetries} retries`);
        }
      } catch (error) {
        console.error(`Error polling transaction ${txHash}:`, error);
      }
    };

    const interval = setInterval(pollFn, this.pollInterval);
    this.pollingIntervals.set(txHash, interval);
    
    // Initial check
    pollFn();
  }

  /**
   * Stop polling for a transaction
   */
  stopPollingTransaction(txHash) {
    const interval = this.pollingIntervals.get(txHash);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(txHash);
    }
  }

  /**
   * Check transaction status (simulated)
   */
  async checkTransactionStatus(txHash) {
    const tx = this.transactions.get(txHash);
    if (!tx) return null;

    // Simulate transaction progression
    const timeSinceCreation = Date.now() - tx.createdAt;
    
    let status = 'pending';
    let confirmations = 0;
    let blockNumber = null;

    if (timeSinceCreation > 10000) {
      // After 10 seconds, mark as success
      status = 'success';
      confirmations = Math.floor(timeSinceCreation / 5000);
      blockNumber = Math.floor(Math.random() * 100000) + 1000000;
    } else if (timeSinceCreation > 3000) {
      // After 3 seconds, show as pending with confirmations
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

  /**
   * Broadcast transaction update to all subscribers
   */
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

    // Notify specific subscribers
    const subscribers = this.transactionSubscribers.get(txHash) || [];
    subscribers.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in transaction subscriber:', error);
      }
    });
  }

  /**
   * Subscribe to transaction updates
   */
  subscribeToTransaction(txHash, callback) {
    if (!this.transactionSubscribers.has(txHash)) {
      this.transactionSubscribers.set(txHash, []);
    }
    this.transactionSubscribers.get(txHash).push(callback);

    // Return unsubscribe function
    return () => {
      const subscribers = this.transactionSubscribers.get(txHash) || [];
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Get transaction by hash
   */
  getTransaction(txHash) {
    return this.transactions.get(txHash);
  }

  /**
   * Get all pending transactions
   */
  getPendingTransactions() {
    return Array.from(this.transactions.values()).filter(tx => tx.status === 'pending');
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(limit = 50) {
    return Array.from(this.transactions.values())
      .sort((a, b) => b.lastUpdate - a.lastUpdate)
      .slice(0, limit);
  }

  /**
   * Clear old transactions
   */
  clearOldTransactions(maxAge = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [hash, tx] of this.transactions.entries()) {
      if (now - tx.lastUpdate > maxAge && tx.status !== 'pending') {
        this.stopPollingTransaction(hash);
        this.transactions.delete(hash);
        this.transactionSubscribers.delete(hash);
      }
    }
  }

  /**
   * Get transaction statistics
   */
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

  /**
   * Cleanup on shutdown
   */
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

