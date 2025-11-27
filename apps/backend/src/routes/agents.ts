import express, { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LangChainAgent } from '@celo-automator/langchain-agent';
import { CeloClient } from '@celo-automator/celo-functions';
import { logger } from '../utils/logger.js';

const router: Router = express.Router();

// Simplified agent types without external dependencies
type SpecializedAgentType = 'treasury' | 'defi' | 'nft' | 'governance' | 'donation';
const AGENT_TYPES: SpecializedAgentType[] = ['treasury', 'defi', 'nft', 'governance', 'donation'];

const createAgentSchema = z.object({
  id: z.string().optional(),
  type: z.enum(AGENT_TYPES as [string, ...string[]]),
  name: z.string().min(2),
  description: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  promptPreamble: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateAgentSchema = createAgentSchema.partial({
  type: true,
  name: true,
}).extend({
  id: z.string(),
});

const querySchema = z.object({
  prompt: z.string().min(4),
  context: z.record(z.unknown()).optional(),
  transactions: z
    .array(
      z.object({
        agentId: z.string().optional(),
        owner: z.string().optional(),
        type: z.enum(['transfer', 'contract_call', 'deployment']).default('transfer'),
        to: z.string().optional(),
        value: z.string().optional(),
        tokenAddress: z.string().optional(),
        functionSignature: z.string().optional(),
        protocol: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
});

interface AgentConfig {
  id: string;
  type: SpecializedAgentType;
  name: string;
  description?: string;
  objectives?: string[];
  promptPreamble?: string;
  metadata?: Record<string, unknown>;
}

type AgentRecord = {
  config: AgentConfig;
  instance: LangChainAgent | null;
};

const registry = new Map<string, AgentRecord>();

let celoClient: CeloClient | undefined;

function ensureDependencies(): void {
  if (!celoClient && process.env.CELO_PRIVATE_KEY) {
    celoClient = new CeloClient({
      privateKey: process.env.CELO_PRIVATE_KEY,
      network: (process.env.CELO_NETWORK as 'alfajores' | 'mainnet') || 'alfajores',
      rpcUrl: process.env.CELO_RPC_URL,
    });
  }
}

router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureDependencies();

    const parsed = createAgentSchema.parse(req.body);
    const id = parsed.id ?? `agent_${Date.now()}`;

    if (registry.has(id)) {
      res.status(409).json({
        success: false,
        error: 'Agent with this ID already exists',
      });
      return;
    }

    // Create a LangChain agent for this specialized agent
    const agent = new LangChainAgent({
      id,
      type: 'langchain',
      name: parsed.name,
      model: process.env.AI_MODEL || 'gemini-1.5-flash',
      geminiApiKey: process.env.GEMINI_API_KEY,
      celoClient,
      metadata: {
        ...(parsed.metadata || {}),
        agentType: parsed.type,
        description: parsed.description || '',
      },
    });

    registry.set(id, {
      config: {
        id,
        type: parsed.type as SpecializedAgentType,
        name: parsed.name,
        description: parsed.description,
        objectives: parsed.objectives,
        promptPreamble: parsed.promptPreamble,
        metadata: {
          ...parsed.metadata,
          createdAt: new Date().toISOString(),
        },
      },
      instance: agent,
    });

    res.status(201).json({
      success: true,
      agent: {
        id,
        type: parsed.type,
        name: parsed.name,
        description: parsed.description,
        objectives: parsed.objectives,
        metadata: parsed.metadata,
      },
    });
  } catch (error) {
    logger.error('Failed to create agent', { error: String(error) });
    next(error);
  }
});

router.get('/', (_req: Request, res: Response): void => {
  const agents = Array.from(registry.values()).map(({ config }) => ({
    id: config.id,
    type: config.type,
    name: config.name,
    description: config.description,
    objectives: config.objectives,
    metadata: config.metadata,
  }));

  res.json({
    success: true,
    agents,
  });
});

router.get('/:id', (req: Request, res: Response): void => {
  const record = registry.get(req.params.id);
  if (!record) {
    res.status(404).json({
      success: false,
      error: 'Agent not found',
    });
    return;
  }

  res.json({
    success: true,
    agent: {
      id: record.config.id,
      type: record.config.type,
      name: record.config.name,
      description: record.config.description,
      objectives: record.config.objectives,
      metadata: record.config.metadata,
    },
  });
});

router.put('/:id', (req: Request, res: Response, next: NextFunction): void => {
  try {
    ensureDependencies();

    const existing = registry.get(req.params.id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
      return;
    }

    const parsed = updateAgentSchema.parse({ ...req.body, id: req.params.id });

    const updatedConfig: AgentConfig = {
      ...existing.config,
      ...parsed,
      type: (parsed.type || existing.config.type) as SpecializedAgentType,
    };

    registry.set(req.params.id, {
      config: updatedConfig,
      instance: existing.instance,
    });

    res.json({
      success: true,
      agent: {
        id: updatedConfig.id,
        type: updatedConfig.type,
        name: updatedConfig.name,
        description: updatedConfig.description,
        objectives: updatedConfig.objectives,
        metadata: updatedConfig.metadata,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req: Request, res: Response): void => {
  if (!registry.has(req.params.id)) {
    res.status(404).json({
      success: false,
      error: 'Agent not found',
    });
    return;
  }

  registry.delete(req.params.id);

  res.json({
    success: true,
    message: 'Agent deleted',
  });
});

router.post('/:id/query', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureDependencies();

    const record = registry.get(req.params.id);
    if (!record) {
      res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
      return;
    }

    const parsed = querySchema.parse(req.body);

    // Simple prompt processing without full agent system
    const result = {
      agentId: req.params.id,
      type: record.config.type,
      prompt: parsed.prompt,
      context: parsed.context,
      transactions: parsed.transactions,
      recommendations: [
        'Review the transaction details carefully',
        'Ensure sufficient gas for the operation',
      ],
    };

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    next(error);
  }
});

export { router as agentRoutes };

