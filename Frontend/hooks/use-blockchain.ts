/**
 * useBlockchain Hook
 * Manages blockchain interactions and real-time updates
 */

'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from './use-toast';

export interface BlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  timestamp?: string;
  gasUsed?: string;
  gasPrice?: string;
}

export interface WalletBalance {
  balance: string;
  token: string;
  decimals: number;
  symbol: string;
}

export function useBlockchain() {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Get wallet balance
  const getBalance = useCallback(
    async (address: string, tokenAddress?: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.getBalance(address, tokenAddress);
        if (response.success && response.data) {
          setBalance(response.data);
          return response.data;
        } else {
          throw new Error(response.error || 'Failed to fetch balance');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        toast({
          title: 'Error',
          description: `Failed to fetch balance: ${message}`,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Get transaction history
  const getTransactionHistory = useCallback(
    async (address: string, limit?: number) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.getTransactions(address, limit);
        if (response.success && response.data) {
          setTransactions(response.data);
          return response.data;
        } else {
          throw new Error(response.error || 'Failed to fetch transactions');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        toast({
          title: 'Error',
          description: `Failed to fetch transactions: ${message}`,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Send transaction
  const sendTransaction = useCallback(
    async (to: string, value: string, tokenAddress?: string) => {
      setLoading(true);
      try {
        const response = await apiClient.sendTransaction({
          to,
          value,
          tokenAddress,
        });
        if (response.success && response.data) {
          toast({
            title: 'Success',
            description: `Transaction sent: ${response.data.txHash}`,
          });
          return response.data;
        } else {
          throw new Error(response.error || 'Failed to send transaction');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        toast({
          title: 'Error',
          description: `Failed to send transaction: ${message}`,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Get transaction status
  const getTransactionStatus = useCallback(
    async (txHash: string) => {
      try {
        const response = await apiClient.getTransactionStatus(txHash);
        if (response.success && response.data) {
          return response.data;
        } else {
          throw new Error(response.error || 'Failed to fetch transaction status');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast({
          title: 'Error',
          description: `Failed to fetch transaction status: ${message}`,
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  return {
    balance,
    transactions,
    loading,
    error,
    getBalance,
    getTransactionHistory,
    sendTransaction,
    getTransactionStatus,
  };
}
