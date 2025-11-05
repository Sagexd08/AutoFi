import { describe, it, expect } from 'vitest';
import { CeloClient } from './client.js';

describe('CeloClient', () => {
  it('should create a client with public access only', () => {
    const client = new CeloClient({
      network: 'alfajores',
    });

    expect(client.getPublicClient()).toBeDefined();
    expect(client.getWalletClient()).toBeUndefined();
    expect(client.getChain()).toBeDefined();
    expect(client.getNetworkConfig().network).toBe('alfajores');
  });

  it('should create a client with wallet access when private key provided', () => {
    const client = new CeloClient({
      network: 'alfajores',
      privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    });

    expect(client.getPublicClient()).toBeDefined();
    expect(client.getWalletClient()).toBeDefined();
  });

  it('should use custom RPC URL when provided', () => {
    const customRpc = 'https://custom-rpc.example.com';
    const client = new CeloClient({
      network: 'alfajores',
      rpcUrl: customRpc,
    });

    expect(client.getNetworkConfig().rpcUrl).toBe(customRpc);
  });

  it('should use default RPC URL for alfajores', () => {
    const client = new CeloClient({
      network: 'alfajores',
    });

    expect(client.getNetworkConfig().rpcUrl).toBeUndefined();
  });

  it('should use default RPC URL for mainnet', () => {
    const client = new CeloClient({
      network: 'mainnet',
    });

    expect(client.getNetworkConfig().rpcUrl).toBeUndefined();
  });
});

