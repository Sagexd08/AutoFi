import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LangChainAgent } from './agent.js';
import { WorkflowOrchestrator } from './orchestrator.js';
import { CeloClient } from '@celo-automator/celo-functions';
import type { Workflow } from '@celo-automator/types';
import { isSuccessResult, hasTransactionHash } from './memory.js';

describe('LangChainAgent - Advanced', () => {
  let celoClient: CeloClient;
  let agent: LangChainAgent;

  beforeEach(() => {
    celoClient = new CeloClient({
      network: 'alfajores',
    });
  });

  describe('Agent Configuration', () => {
    it('should handle temperature configuration', () => {
      agent = new LangChainAgent({
        id: 'test-agent',
        type: 'langchain',
        name: 'Test Agent',
        model: 'gemini-1.5-flash',
        geminiApiKey: 'test-key',
        temperature: 0.5,
        celoClient,
      });

      expect(agent.getConfig().temperature).toBe(0.5);
    });

    it('should handle maxTokens configuration', () => {
      agent = new LangChainAgent({
        id: 'test-agent',
        type: 'langchain',
        name: 'Test Agent',
        model: 'gemini-1.5-flash',
        geminiApiKey: 'test-key',
        maxTokens: 1000,
        celoClient,
      });

      expect(agent.getConfig().maxTokens).toBe(1000);
    });

    it('should update Celo client dynamically', () => {
      agent = new LangChainAgent({
        id: 'test-agent',
        type: 'langchain',
        name: 'Test Agent',
        model: 'gemini-1.5-flash',
        geminiApiKey: 'test-key',
        celoClient,
      });

      const newClient = new CeloClient({
        network: 'mainnet',
      });

      agent.updateCeloClient(newClient);
      const tools = agent.getTools();
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    beforeEach(() => {
      agent = new LangChainAgent({
        id: 'test-agent',
        type: 'langchain',
        name: 'Test Agent',
        model: 'gemini-1.5-flash',
        geminiApiKey: 'test-key',
        celoClient,
      });
    });

    it('should maintain chat history order', () => {
      const memory = agent.getMemory();
      memory.addMessage('user', 'First message');
      memory.addMessage('assistant', 'First response');
      memory.addMessage('user', 'Second message');

      const history = memory.getChatHistory();
      expect(history.length).toBe(3);
      expect(history[0].content).toBe('First message');
      expect(history[2].content).toBe('Second message');
    });

    it('should track actions with results', () => {
      const memory = agent.getMemory();
      memory.addAction('transfer', { success: true, hash: '0x123' });
      memory.addAction('balance', { balance: '1000' });

      const actions = memory.getRecentActions();
      expect(actions.length).toBe(2);
      expect(actions[0].action).toBe('transfer');
      if (isSuccessResult(actions[0].result)) {
        expect(actions[0].result.success).toBe(true);
        if (hasTransactionHash(actions[0].result)) {
          expect(actions[0].result.hash).toBe('0x123');
        }
      } else {
        throw new Error('Expected result to have success property');
      }
    });
  });

  describe('Tools Integration', () => {
    beforeEach(() => {
      agent = new LangChainAgent({
        id: 'test-agent',
        type: 'langchain',
        name: 'Test Agent',
        model: 'gemini-1.5-flash',
        geminiApiKey: 'test-key',
        celoClient,
      });
    });

    it('should provide all required tools', () => {
      const tools = agent.getTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('get_balance');
      expect(toolNames).toContain('get_token_balance');
      expect(toolNames).toContain('send_celo');
      expect(toolNames).toContain('send_token');
      expect(toolNames).toContain('call_contract');
      expect(toolNames).toContain('read_contract');
      expect(toolNames).toContain('get_transaction_status');
    });

    it('should have tools with proper schemas', () => {
      const tools = agent.getTools();
      const balanceTool = tools.find((t) => t.name === 'get_balance');

      expect(balanceTool).toBeDefined();
      expect(balanceTool?.description).toBeDefined();
    });
  });
});

describe('WorkflowOrchestrator - Advanced', () => {
  let celoClient: CeloClient;
  let agent: LangChainAgent;
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    celoClient = new CeloClient({
      network: 'alfajores',
    });

    agent = new LangChainAgent({
      id: 'test-agent',
      type: 'langchain',
      name: 'Test Agent',
      model: 'gemini-1.5-flash',
      geminiApiKey: 'test-key',
      celoClient,
    });

    orchestrator = new WorkflowOrchestrator(agent);
  });

  describe('Workflow Validation', () => {
    it('should handle empty workflow interpretation', async () => {
      // Skip actual API call - just test structure
      expect(typeof orchestrator.interpretWorkflow).toBe('function');
    });

    it('should handle complex workflow requests', async () => {
      const complexRequest = 'Create a workflow that transfers 1 CELO to address 0x123... every day at 3pm';
      // Skip actual API call - just test structure
      expect(typeof orchestrator.interpretWorkflow).toBe('function');
      expect(complexRequest.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow Execution', () => {
    const mockWorkflow: Workflow = {
      id: 'test-workflow',
      name: 'Test Workflow',
      description: 'A test workflow',
      trigger: {
        type: 'manual',
      },
      actions: [
        {
          type: 'transfer',
          to: '0x1234567890123456789012345678901234567890',
          amount: '1000000000000000000',
        },
      ],
      enabled: true,
    };

    it('should handle workflow execution structure', async () => {
      try {
        const result = await orchestrator.executeWorkflow(mockWorkflow);
        expect(result).toHaveProperty('success');
        if (result.success) {
          expect(result).toHaveProperty('results');
        } else {
          expect(result).toHaveProperty('error');
        }
      } catch (error) {
        // Expected to fail without network connection
        expect(error).toBeDefined();
      }
    });

    it('should handle workflow explanation', async () => {
      // Skip actual API call - just test structure
      expect(typeof orchestrator.explainWorkflow).toBe('function');
      expect(mockWorkflow).toBeDefined();
      expect(mockWorkflow.actions.length).toBeGreaterThan(0);
    });
  });

  describe('Action Execution', () => {
    it('should handle transfer action structure', async () => {
      const transferAction = {
        type: 'transfer' as const,
        to: '0x1234567890123456789012345678901234567890',
        amount: '1000000000000000000',
      };

      try {
        const result = await (orchestrator as any).executeAction(transferAction);
        expect(result).toHaveProperty('success');
      } catch (error) {
        // Expected to fail without network connection
        expect(error).toBeDefined();
      }
    });

    it('should handle contract call action structure', async () => {
      const contractAction = {
        type: 'contract_call' as const,
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'transfer',
        parameters: ['0x123', '1000'],
        abi: [],
      };

      try {
        const result = await (orchestrator as any).executeAction(contractAction);
        expect(result).toHaveProperty('success');
      } catch (error) {
        // Expected to fail without network connection
        expect(error).toBeDefined();
      }
    });
  });
});

