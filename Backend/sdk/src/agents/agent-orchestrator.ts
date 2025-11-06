import { EventEmitter } from 'events';
import { AIAgentSystem } from './ai-agent-system';
export class AgentOrchestrator extends EventEmitter {
  private readonly aiAgentSystem: AIAgentSystem;
  constructor(aiAgentSystem: AIAgentSystem) {
    super();
    this.aiAgentSystem = aiAgentSystem;
  }
  async orchestrateAgents(task: string, agentIds: string[]): Promise<any> {
    const results = [];
    for (const agentId of agentIds) {
      try {
        const result = await this.aiAgentSystem.processWithAgent(agentId, task);
        results.push({ agentId, result });
      } catch (error) {
        results.push({ agentId, error: (error instanceof Error ? error.message : String(error)) });
      }
    }
    return results;
  }
}
