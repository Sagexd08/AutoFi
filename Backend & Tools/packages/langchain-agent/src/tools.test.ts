import { describe, it, expect, beforeEach } from 'vitest';
import { createTools } from '../src/tools.js';
import { CeloClient } from '@celo-automator/celo-functions';

describe('createTools', () => {
  it('should return empty array when client is not provided', () => {
    const tools = createTools();
    expect(tools).toEqual([]);
  });

  it('should return empty array when client is undefined', () => {
    const tools = createTools(undefined);
    expect(tools).toEqual([]);
  });

  it('should create tools when client is provided', () => {
    const client = new CeloClient({
      network: 'alfajores',
    });
    const tools = createTools(client);
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should include get_balance tool', () => {
    const client = new CeloClient({
      network: 'alfajores',
    });
    const tools = createTools(client);
    const balanceTool = tools.find((t) => t.name === 'get_balance');
    expect(balanceTool).toBeDefined();
  });

  it('should include get_token_balance tool', () => {
    const client = new CeloClient({
      network: 'alfajores',
    });
    const tools = createTools(client);
    const tokenBalanceTool = tools.find((t) => t.name === 'get_token_balance');
    expect(tokenBalanceTool).toBeDefined();
  });

  it('should include send_celo tool', () => {
    const client = new CeloClient({
      network: 'alfajores',
    });
    const tools = createTools(client);
    const sendCeloTool = tools.find((t) => t.name === 'send_celo');
    expect(sendCeloTool).toBeDefined();
  });

  it('should include send_token tool', () => {
    const client = new CeloClient({
      network: 'alfajores',
    });
    const tools = createTools(client);
    const sendTokenTool = tools.find((t) => t.name === 'send_token');
    expect(sendTokenTool).toBeDefined();
  });

  it('should include call_contract tool', () => {
    const client = new CeloClient({
      network: 'alfajores',
    });
    const tools = createTools(client);
    const callContractTool = tools.find((t) => t.name === 'call_contract');
    expect(callContractTool).toBeDefined();
  });

  it('should include read_contract tool', () => {
    const client = new CeloClient({
      network: 'alfajores',
    });
    const tools = createTools(client);
    const readContractTool = tools.find((t) => t.name === 'read_contract');
    expect(readContractTool).toBeDefined();
  });

  it('should include get_transaction_status tool', () => {
    const client = new CeloClient({
      network: 'alfajores',
    });
    const tools = createTools(client);
    const txStatusTool = tools.find((t) => t.name === 'get_transaction_status');
    expect(txStatusTool).toBeDefined();
  });
});

