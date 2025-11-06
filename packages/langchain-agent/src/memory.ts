import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface Action {
  action: string;
  result: any;
  timestamp: string;
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
