import { describe, it, expect, beforeEach } from 'vitest';
import { BufferMemory } from '../src/memory.js';

describe('BufferMemory', () => {
  let memory: BufferMemory;

  beforeEach(() => {
    memory = new BufferMemory();
  });

  it('should initialize with empty chat history and actions', () => {
    expect(memory.getChatHistory()).toEqual([]);
    expect(memory.getRecentActions()).toEqual([]);
  });

  it('should add user messages', () => {
    memory.addMessage('user', 'Hello');
    const history = memory.getChatHistory();
    expect(history.length).toBe(1);
    expect(history[0].content).toBe('Hello');
  });

  it('should add assistant messages', () => {
    memory.addMessage('assistant', 'Hi there!');
    const history = memory.getChatHistory();
    expect(history.length).toBe(1);
    expect(history[0].content).toBe('Hi there!');
  });

  it('should add system messages', () => {
    memory.addMessage('system', 'System initialized');
    const history = memory.getChatHistory();
    expect(history.length).toBe(1);
    expect(history[0].content).toBe('System initialized');
  });

  it('should limit chat history to 50 messages', () => {
    for (let i = 0; i < 60; i++) {
      memory.addMessage('user', `Message ${i}`);
    }
    expect(memory.getChatHistory().length).toBe(50);
  });

  it('should add actions', () => {
    memory.addAction('transfer', { success: true });
    const actions = memory.getRecentActions();
    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe('transfer');
    expect(actions[0].result.success).toBe(true);
  });

  it('should limit recent actions to 20', () => {
    for (let i = 0; i < 25; i++) {
      memory.addAction(`action_${i}`, {});
    }
    expect(memory.getRecentActions().length).toBe(20);
  });

  it('should clear all memory', () => {
    memory.addMessage('user', 'Hello');
    memory.addAction('test', {});
    memory.clear();
    expect(memory.getChatHistory()).toEqual([]);
    expect(memory.getRecentActions()).toEqual([]);
  });

  it('should convert to memory format', () => {
    memory.addMessage('user', 'Hello');
    memory.addAction('test', { result: 'ok' });
    const mem = memory.toMemory();
    expect(mem.chatHistory.length).toBe(1);
    expect(mem.recentActions.length).toBe(1);
  });
});

