export interface AgentType {
  readonly name: string;
  readonly description: string;
  readonly capabilities: readonly string[];
}
export interface AgentCapability {
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly string[];
  readonly returns: string;
}
export interface AgentContext {
  readonly sessionId: string;
  readonly userId?: string;
  readonly walletAddress?: string;
  readonly network: string;
  readonly preferences: Record<string, unknown>;
  readonly history: readonly AgentHistoryEntry[];
}
export interface AgentHistoryEntry {
  readonly type: 'user_input' | 'agent_response' | 'error';
  readonly content: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}
export interface AgentPerformance {
  readonly successRate: number;
  readonly totalExecutions: number;
  readonly averageExecutionTime: number;
}
