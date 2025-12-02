import { EventEmitter } from 'events';
import { 
  AgentMessage, 
  SwarmAgentId, 
  SwarmEvent, 
  SwarmTask, 
  SwarmConfig 
} from '@celo-automator/types';

export class SwarmCoordinator extends EventEmitter {
  private agents: Map<SwarmAgentId, { role: string; status: 'active' | 'busy' | 'offline' }> = new Map();
  private tasks: Map<string, SwarmTask> = new Map();
  private messageLog: AgentMessage[] = [];
  private config: SwarmConfig;

  constructor(config: SwarmConfig) {
    super();
    this.config = config;
  }

  public registerAgent(agentId: SwarmAgentId, role: string): void {
    if (this.agents.has(agentId)) {
      throw new Error(`Agent ${agentId} already registered`);
    }
    if (this.config.maxAgents && this.agents.size >= this.config.maxAgents) {
      throw new Error(`Swarm full. Max agents: ${this.config.maxAgents}`);
    }
    this.agents.set(agentId, { role, status: 'active' });
    this.emitEvent('agent_joined', { agentId, role });
  }

  public unregisterAgent(agentId: SwarmAgentId): void {
    if (this.agents.delete(agentId)) {
      this.emitEvent('agent_left', { agentId });
    }
  }

  public async sendMessage(message: AgentMessage): Promise<void> {
    this.messageLog.push(message);
    this.emitEvent('message', message);

    // If direct message
    if (message.to !== 'broadcast') {
      const target = this.agents.get(message.to);
      if (!target) {
        console.warn(`Target agent ${message.to} not found`);
        return;
      }
      // In a real distributed system, we would push to a queue here.
      // For now, we emit a specific event that the agent instance should listen to.
      this.emit(`message:${message.to}`, message);
    } else {
      // Broadcast
      this.handleBroadcast(message);
    }
  }

  private handleBroadcast(message: AgentMessage): void {
    if (message.scope === 'role' && message.role) {
      for (const [id, agent] of this.agents.entries()) {
        if (agent.role === message.role && id !== message.from) {
          this.emit(`message:${id}`, message);
        }
      }
    } else {
      // Global broadcast
      for (const [id] of this.agents.entries()) {
        if (id !== message.from) {
          this.emit(`message:${id}`, message);
        }
      }
    }
  }

  public createTask(description: string, priority: SwarmTask['priority'] = 'medium'): SwarmTask {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const task: SwarmTask = {
      id,
      description,
      status: 'pending',
      priority,
      created_at: Date.now(),
      updated_at: Date.now()
    };
    this.tasks.set(id, task);
    this.emitEvent('task_assigned', { taskId: id, status: 'pending' }); // Actually just created
    return task;
  }

  public assignTask(taskId: string, agentId: SwarmAgentId): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    if (!this.agents.has(agentId)) throw new Error('Agent not found');

    task.assignedTo = agentId;
    task.status = 'in_progress';
    task.updated_at = Date.now();
    
    this.tasks.set(taskId, task);
    this.emitEvent('task_assigned', { taskId, agentId });
    
    // Notify agent
    this.emit(`task:${agentId}`, task);
  }

  public completeTask(taskId: string, result: any): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    task.status = 'completed';
    task.result = result;
    task.updated_at = Date.now();
    
    this.tasks.set(taskId, task);
    this.emitEvent('task_completed', { taskId, result });
  }

  public failTask(taskId: string, error: any): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    task.status = 'failed';
    task.result = error;
    task.updated_at = Date.now();
    
    this.tasks.set(taskId, task);
    this.emitEvent('task_failed', { taskId, error });
  }

  public getAgentStatus(agentId: SwarmAgentId) {
    return this.agents.get(agentId);
  }

  public getActiveAgents() {
    return Array.from(this.agents.entries()).map(([id, data]) => ({ id, ...data }));
  }

  private emitEvent(type: SwarmEvent['type'], payload: any) {
    const event: SwarmEvent = {
      type,
      payload,
      timestamp: Date.now()
    };
    this.emit('swarm_event', event);
  }
}
