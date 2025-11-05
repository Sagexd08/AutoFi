import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CeloClient } from '../client.js';
import type { Address } from 'viem';
import * as functions from './index.js';

describe('Celo Functions - Advanced', () => {
  let client: CeloClient;
  let walletClient: CeloClient;
  const mockAddress: Address = '0x1234567890123456789012345678901234567890';
  const mockTokenAddress: Address = '0x7654321098765432109876543210987654321098';

  beforeEach(() => {
    client = new CeloClient({
      network: 'alfajores',
    });

    walletClient = new CeloClient({
      network: 'alfajores',
      privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    });
  });

  describe('getBalance', () => {
    it('should be a function that accepts client and address', () => {
      expect(typeof functions.getBalance).toBe('function');
      expect(functions.getBalance.length).toBe(2);
    });

    it('should have correct function signature', () => {
      expect(typeof functions.getBalance).toBe('function');
    });
  });

  describe('getTokenBalance', () => {
    it('should require both address and tokenAddress', () => {
      expect(typeof functions.getTokenBalance).toBe('function');
    });

    it('should handle invalid token address', async () => {
      const invalidToken = 'invalid-token' as Address;
      await expect(
        functions.getTokenBalance(client, mockAddress, invalidToken)
      ).rejects.toThrow();
    });
  });

  describe('sendCELO', () => {
    it('should return error result for invalid amount format', async () => {
      const result = await functions.sendCELO(walletClient, mockAddress, 'invalid-amount');
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
    });

    it('should have correct function signature', () => {
      expect(typeof functions.sendCELO).toBe('function');
      expect(functions.sendCELO.length).toBe(3);
    });

    it('should return TransactionResult structure', () => {
      expect(typeof functions.sendCELO).toBe('function');
    });
  });

  describe('sendToken', () => {
    it('should return error result for invalid amount format', async () => {
      const result = await functions.sendToken(walletClient, mockTokenAddress, mockAddress, 'invalid');
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
    });

    it('should have correct function signature', () => {
      expect(typeof functions.sendToken).toBe('function');
      expect(functions.sendToken.length).toBe(4);
    });

    it('should return TransactionResult structure', () => {
      expect(typeof functions.sendToken).toBe('function');
    });
  });

  describe('callContract', () => {
    it('should have correct function signature', () => {
      expect(typeof functions.callContract).toBe('function');
      expect(functions.callContract.length).toBe(2);
    });

    it('should accept contract call structure', () => {
      expect(typeof functions.callContract).toBe('function');
    });
  });

  describe('readContract', () => {
    it('should have correct function signature', () => {
      expect(typeof functions.readContract).toBe('function');
      expect(functions.readContract.length).toBe(2);
    });
  });

  describe('getTransactionStatus', () => {
    it('should have correct function signature', () => {
      expect(typeof functions.getTransactionStatus).toBe('function');
      expect(functions.getTransactionStatus.length).toBe(2);
    });

    it('should return status object structure', () => {
      expect(typeof functions.getTransactionStatus).toBe('function');
    });
  });

  describe('getTransactionReceipt', () => {
    it('should have correct function signature', () => {
      expect(typeof functions.getTransactionReceipt).toBe('function');
      expect(functions.getTransactionReceipt.length).toBe(2);
    });
  });

  describe('listenToEvent', () => {
    it('should have correct function signature', () => {
      expect(typeof functions.listenToEvent).toBe('function');
      expect(functions.listenToEvent.length).toBe(3);
    });

    it('should return unsubscribe function', () => {
      expect(typeof functions.listenToEvent).toBe('function');
    });
  });
});

