import { createOrchestrator, MultiAgentOrchestrator } from '@autofi/agents';
import { createAIEngine, AIEngine } from '@autofi/ai-engine';

let orchestratorInstance: MultiAgentOrchestrator | null = null;
let aiEngineInstance: AIEngine | null = null;

export function getAIEngine(): AIEngine {
  if (aiEngineInstance) return aiEngineInstance;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required');
  aiEngineInstance = createAIEngine({ anthropicApiKey: apiKey });
  return aiEngineInstance;
}

export function getOrchestrator(): MultiAgentOrchestrator {
  if (orchestratorInstance) return orchestratorInstance;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required');

  orchestratorInstance = createOrchestrator({
    aiEngineApiKey: apiKey,
    walletConfig: {
        type: 'local',
        privateKey: process.env.PRIVATE_KEY
    }
  });

  return orchestratorInstance;
}
