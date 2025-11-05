import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { AgentMemory } from '@celo-automator/types';

export class BufferMemory {
  private chatHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }> = [];

  private recentActions: Array<{
    action: string;
    result: any;
    timestamp: string;
  }> = [];

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

  addAction(action: string, result: any) {
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

  getChatHistory(): Array<HumanMessage | AIMessage> {
    return this.chatHistory.map((msg) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
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

  toMemory(): AgentMemory {
    return {
      chatHistory: this.chatHistory,
      recentActions: this.recentActions,
    };
  }
}
