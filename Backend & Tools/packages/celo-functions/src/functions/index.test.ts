import { describe, it, expect, beforeEach } from 'vitest';
import { CeloClient } from '../client.js';
import type { Address } from 'viem';
import * as functions from './index.js';

describe('Celo Functions', () => {
  let client: CeloClient;
  const mockAddress: Address = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    client = new CeloClient({
      network: 'alfajores',
    });
  });

  describe('getBalance', () => {
    it('should be a function', () => {
      expect(typeof functions.getBalance).toBe('function');
    });

    it('should throw error if client is invalid', async () => {
      const invalidClient = {} as CeloClient;
      await expect(functions.getBalance(invalidClient, mockAddress)).rejects.toThrow();
    });
  });

  describe('getTokenBalance', () => {
    it('should be a function', () => {
      expect(typeof functions.getTokenBalance).toBe('function');
    });
  });

  describe('sendCELO', () => {
    it('should be a function', () => {
      expect(typeof functions.sendCELO).toBe('function');
    });

    it('should throw error if wallet client is not available', async () => {
      await expect(
        functions.sendCELO(client, mockAddress, '1000000000000000000')
      ).rejects.toThrow('Private key required');
    });
  });

  describe('sendToken', () => {
    it('should be a function', () => {
      expect(typeof functions.sendToken).toBe('function');
    });

    it('should throw error if wallet client is not available', async () => {
      await expect(
        functions.sendToken(client, mockAddress, mockAddress, '1000000000000000000')
      ).rejects.toThrow('Private key required');
    });
  });

  describe('callContract', () => {
    it('should be a function', () => {
      expect(typeof functions.callContract).toBe('function');
    });

    it('should throw error if wallet client is not available', async () => {
      await expect(
        functions.callContract(client, {
          address: mockAddress,
          abi: [],
          functionName: 'test',
        })
      ).rejects.toThrow('Private key required');
    });
  });

  describe('readContract', () => {
    it('should be a function', () => {
      expect(typeof functions.readContract).toBe('function');
    });
  });

  describe('getTransactionStatus', () => {
    it('should be a function', () => {
      expect(typeof functions.getTransactionStatus).toBe('function');
    });
  });

  describe('getTransactionReceipt', () => {
    it('should be a function', () => {
      expect(typeof functions.getTransactionReceipt).toBe('function');
    });
  });

  describe('listenToEvent', () => {
    it('should be a function', () => {
      expect(typeof functions.listenToEvent).toBe('function');
    });
  });
});

