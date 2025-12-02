import { SwarmCoordinator, DeFiAgent, TreasuryAgent, SpecializedAgentConfig } from '@celo-ai/agents';
import { RiskEngine } from '@celo-ai/risk-engine';
import { LangChainAgent } from '@celo-automator/langchain-agent';
import { logger } from '../utils/logger.js';

class SwarmService {
  private coordinator: SwarmCoordinator;
  private initialized: boolean = false;
  private agents: Map<string, any> = new Map();

  constructor() {
    this.coordinator = new SwarmCoordinator({
      id: 'main-swarm',
      name: 'Celo AutoFi Swarm',
      maxAgents: 10
    });
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize shared resources
      const riskEngine = new RiskEngine(); // Assuming default config
      // Mock LangChain agent for now as we might not have API keys configured
      const mockLangChain = {
        getLLM: () => ({
          decide: async () => JSON.stringify({ steps: [] })
        })
      } as unknown as LangChainAgent;

      // Initialize Agents
      this.initializeAgents(riskEngine, mockLangChain);

      // Setup event logging
      this.coordinator.on('swarm_event', (event) => {
        logger.info(`[Swarm Event] ${event.type}:`, event.payload);
      });

      this.initialized = true;
      logger.info('Swarm Service initialized with agents');
    } catch (error) {
      logger.error('Failed to initialize Swarm Service', { error });
      throw error;
    }
  }

  private initializeAgents(riskEngine: RiskEngine, langchainAgent: LangChainAgent) {
    // Treasury Agent
    const treasuryConfig: SpecializedAgentConfig = {
      id: 'treasury-01',
      type: 'treasury',
      name: 'Main Treasury Manager',
      riskEngine,
      langchainAgent,
      swarmCoordinator: this.coordinator
    };
    const treasuryAgent = new TreasuryAgent(treasuryConfig);
    this.agents.set('treasury', treasuryAgent);

    // DeFi Agent
    const defiConfig: SpecializedAgentConfig = {
      id: 'defi-01',
      type: 'defi',
      name: 'DeFi Strategist',
      riskEngine,
      langchainAgent,
      swarmCoordinator: this.coordinator
    };
    const defiAgent = new DeFiAgent(defiConfig);
    this.agents.set('defi', defiAgent);
  }

  public getCoordinator() {
    return this.coordinator;
  }

  public async submitTask(description: string) {
    const task = this.coordinator.createTask(description);
    // Simple logic to assign to DeFi agent for now
    // In a real system, a "Manager Agent" would decide who gets the task
    this.coordinator.assignTask(task.id, 'defi-01');
    return task;
  }
}

export const swarmService = new SwarmService();
