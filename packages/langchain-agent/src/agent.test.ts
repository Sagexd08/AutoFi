import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LangChainAgent } from '../src/agent.js';
import { CeloClient } from '@celo-automator/celo-functions';

describe('LangChainAgent', () => {
  let celoClient: CeloClient;

  beforeEach(() => {
    celoClient = new CeloClient({
      network: 'alfajores',
    });
  });

  it('should create an agent with valid config', () => {
    const agent = new LangChainAgent({
      id: 'test-agent',
      type: 'langchain',
      name: 'Test Agent',
      model: 'gemini-1.5-flash',
      geminiApiKey: 'test-key',
      celoClient,
    });

    expect(agent).toBeDefined();
  });

  it('should throw error when Gemini API key is missing for Gemini models', () => {
    expect(() => {
      new LangChainAgent({
        id: 'test-agent',
        type: 'langchain',
        name: 'Test Agent',
        model: 'gemini-1.5-flash',
        celoClient,
      });
    }).toThrow('Gemini API key is required');
  });

  it('should throw error for unsupported models', () => {
    expect(() => {
      new LangChainAgent({
        id: 'test-agent',
        type: 'langchain',
        name: 'Test Agent',
        model: 'gpt-4',
        celoClient,
      });
    }).toThrow('Unsupported model');
  });

  it('should have getTools method', () => {
    const agent = new LangChainAgent({
      id: 'test-agent',
      type: 'langchain',
      name: 'Test Agent',
      model: 'gemini-1.5-flash',
      geminiApiKey: 'test-key',
      celoClient,
    });

    expect(typeof agent.getTools).toBe('function');
    const tools = agent.getTools();
    expect(Array.isArray(tools)).toBe(true);
  });

  it('should have getMemory method', () => {
    const agent = new LangChainAgent({
      id: 'test-agent',
      type: 'langchain',
      name: 'Test Agent',
      model: 'gemini-1.5-flash',
      geminiApiKey: 'test-key',
      celoClient,
    });

    expect(typeof agent.getMemory).toBe('function');
    const memory = agent.getMemory();
    expect(memory).toBeDefined();
  });
});

