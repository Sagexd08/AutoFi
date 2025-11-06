import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/**
 * Known result shapes for Action results
 */
export type ActionResult =
  | { success: true; transactionHash?: string; hash?: string; error?: never }
  | { success: true; balance: string; balanceFormatted?: string; address?: string; error?: never }
  | { success: true; result?: unknown; error?: never }
  | { success: false; error: string; transactionHash?: never; hash?: never; balance?: never; result?: never }
  | { success: boolean; [key: string]: unknown }
  | Record<string, unknown>
  | unknown;

export interface Action {
  action: string;
  result: ActionResult;
  timestamp: string;
}

/**
 * Type guard to check if result has a success property
 */
export function hasSuccess(result: ActionResult): result is { success: boolean; [key: string]: unknown } {
  return typeof result === 'object' && result !== null && 'success' in result;
}

/**
 * Type guard to check if result is a success result
 */
export function isSuccessResult(result: ActionResult): result is { success: true; [key: string]: unknown } {
  return hasSuccess(result) && result.success === true;
}

/**
 * Type guard to check if result is an error result
 */
export function isErrorResult(result: ActionResult): result is { success: false; error: string } {
  return hasSuccess(result) && result.success === false && typeof result.error === 'string';
}

/**
 * Type guard to check if result has a transaction hash
 */
export function hasTransactionHash(result: ActionResult): result is { transactionHash?: string; hash?: string; [key: string]: unknown } {
  if (typeof result !== 'object' || result === null) return false;
  return 'transactionHash' in result || 'hash' in result;
}

/**
 * Type guard to check if result has a balance
 */
export function hasBalance(result: ActionResult): result is { balance: string; [key: string]: unknown } {
  return typeof result === 'object' && result !== null && 'balance' in result && typeof (result as { balance: unknown }).balance === 'string';
}

export interface MemorySnapshot {
  chatHistory: ChatMessage[];
  recentActions: Action[];
}

export class BufferMemory {
  private chatHistory: ChatMessage[] = [];

  private recentActions: Action[] = [];

  addMessage(role: 'user' | 'assistant' | 'system', content: string) {
    this.chatHistory.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 50 messages
    if (this.chatHistory.length > 50) {
      this.chatHistory = this.chatHistory.slice(-50);
    }
  }

  addAction(action: string, result: ActionResult) {
    this.recentActions.push({
      action,
      result,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 20 actions
    if (this.recentActions.length > 20) {
      this.recentActions = this.recentActions.slice(-20);
    }
  }
  getChatHistory(): Array<HumanMessage | AIMessage | SystemMessage> {
    return this.chatHistory.map((msg) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'system') {
        return new SystemMessage(msg.content);
      } else {
        return new AIMessage(msg.content);
      }
    });
  }

  getRecentActions() {
    return this.recentActions;
  }

  clear() {
    this.chatHistory = [];
    this.recentActions = [];
  }
  toMemory(): MemorySnapshot {
    return {
      chatHistory: this.chatHistory,
      recentActions: this.recentActions,
    };
  }
}
