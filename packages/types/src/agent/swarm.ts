export type SwarmAgentId = string;
export type SwarmBroadcastScope = 'global' | 'role' | 'direct';

export interface AgentMessage {
  id: string;
  from: SwarmAgentId;
  to: SwarmAgentId | 'broadcast';
  scope?: SwarmBroadcastScope;
  role?: string; // If scope is 'role'
  type: 'proposal' | 'query' | 'response' | 'alert' | 'heartbeat';
  content: any;
  timestamp: number;
  correlationId?: string;
}

export interface SwarmEvent {
  type: 'agent_joined' | 'agent_left' | 'message' | 'task_assigned' | 'task_completed' | 'task_failed';
  payload: any;
  timestamp: number;
}

export interface SwarmConfig {
  id: string;
  name: string;
  maxAgents?: number;
  messageTTL?: number;
}

export interface SwarmTask {
  id: string;
  description: string;
  assignedTo?: SwarmAgentId;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: number;
  updated_at: number;
}
