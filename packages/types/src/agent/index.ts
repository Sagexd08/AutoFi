export interface AgentConfig {
  id: string;
  type: 'custom'; // Custom ML engine - no external LLM dependencies
  name: string;
  description?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

export interface AgentMemory {
  chatHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }>;
  recentActions: Array<{
    action: string;
    result: any;
    timestamp: string;
  }>;
}

export interface AgentResponse {
  success: boolean;
  response: string;
  reasoning?: string;
  confidence?: number;
  functionCalls?: Array<{
    name: string;
    parameters: Record<string, any>;
    result?: any;
  }>;
  executionTime?: number;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: Record<string, any>) => Promise<any>;
}

export * from './swarm.js';
