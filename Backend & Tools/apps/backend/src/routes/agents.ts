import express, { Router } from 'express';
import { z } from 'zod';
import { LangChainAgent } from '@celo-automator/langchain-agent';
import { CeloClient } from '@celo-automator/celo-functions';
import { AgentFactory, type SpecializedAgent, type SpecializedAgentType } from '@autofi/agents';
import { RiskEngine } from '@autofi/risk-engine';
import type { TransactionContext } from '@autofi/risk-engine';
import type { Address } from 'viem';
import { logger } from '../utils/logger.js';

const router: Router = express.Router();

const AGENT_TYPES = ['treasury', 'defi', 'nft', 'governance', 'donation'] as const;

const createAgentSchema = z.object({
  id: z.string().optional(),
  type: z.enum(AGENT_TYPES),
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

type AgentRecord = {
  config: z.infer<typeof createAgentSchema> & { id: string };
  instance: SpecializedAgent;
};

const registry = new Map<string, AgentRecord>();

let celoClient: CeloClient | undefined;
let baseAgent: LangChainAgent | undefined;
let factory: AgentFactory | undefined;
let riskEngine: RiskEngine | undefined;

function ensureDependencies() {
  if (!riskEngine) {
    riskEngine = new RiskEngine({
      maxRiskScore: process.env.MAX_RISK_SCORE ? Number(process.env.MAX_RISK_SCORE) : 0.95,
      approvalThreshold: process.env.APPROVAL_THRESHOLD ? parseFloat(process.env.APPROVAL_THRESHOLD) : 0.6,
      blockThreshold: process.env.BLOCK_THRESHOLD ? parseFloat(process.env.BLOCK_THRESHOLD) : 0.85,
    });
  }

  if (!celoClient && process.env.CELO_PRIVATE_KEY) {
    celoClient = new CeloClient({
      privateKey: process.env.CELO_PRIVATE_KEY,
      network: (process.env.CELO_NETWORK as 'alfajores' | 'mainnet') || 'alfajores',
      rpcUrl: process.env.CELO_RPC_URL,
    });
  }

  if (!baseAgent) {
    baseAgent = new LangChainAgent({
      id: 'agentic-core',
      type: 'langchain',
      name: 'Agentic Core',
      model: process.env.AI_MODEL || 'gemini-1.5-flash',
      geminiApiKey: process.env.GEMINI_API_KEY,
      celoClient,
    });
  }

  if (!factory) {
    factory = new AgentFactory({
      baseAgent,
      riskEngine: riskEngine!,
    });
  }
}

router.post('/', async (req, res, next) => {
  try {
    ensureDependencies();

    const parsed = createAgentSchema.parse(req.body);
    const id = parsed.id ?? `agent_${Date.now()}`;

    if (registry.has(id)) {
      return res.status(409).json({
        success: false,
        error: 'Agent with this ID already exists',
      });
    }

    const agent = factory!.create(parsed.type as SpecializedAgentType, {
      ...parsed,
      id,
      name: parsed.name,
      metadata: {
        ...parsed.metadata,
        createdAt: new Date().toISOString(),
      },
    });

    registry.set(id, {
      config: { ...parsed, id },
      instance: agent,
    });

    return res.status(201).json({
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
    logger.error({ error }, 'Failed to create agent');
    return next(error);
  }
});

router.get('/', (_req, res) => {
  const agents = Array.from(registry.values()).map(({ config }) => ({
    id: config.id,
    type: config.type,
    name: config.name,
    description: config.description,
    objectives: config.objectives,
    metadata: config.metadata,
  }));

  return res.json({
    success: true,
    agents,
  });
});

router.get('/:id', (req, res) => {
  const record = registry.get(req.params.id);
  if (!record) {
    return res.status(404).json({
      success: false,
      error: 'Agent not found',
    });
  }

  return res.json({
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

router.put('/:id', (req, res, next) => {
  try {
    ensureDependencies();

    const existing = registry.get(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    const parsed = updateAgentSchema.parse({ ...req.body, id: req.params.id });

    const updatedConfig = {
      ...existing.config,
      ...parsed,
    };

    const agent = factory!.create(updatedConfig.type as SpecializedAgentType, updatedConfig);

    registry.set(req.params.id, {
      config: updatedConfig,
      instance: agent,
    });

    return res.json({
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
    return next(error);
  }
});

router.delete('/:id', (req, res) => {
  if (!registry.has(req.params.id)) {
    return res.status(404).json({
      success: false,
      error: 'Agent not found',
    });
  }

  registry.delete(req.params.id);

  return res.json({
    success: true,
    message: 'Agent deleted',
  });
});

router.post('/:id/query', async (req, res, next) => {
  try {
    ensureDependencies();

    const record = registry.get(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    const parsed = querySchema.parse(req.body);
    const transactions = parsed.transactions?.map((tx) =>
      normalizeTransaction(req.params.id, tx)
    ) as TransactionContext[] | undefined;

    const result = await record.instance.processPrompt(parsed.prompt, {
      context: parsed.context,
      proposedTransactions: transactions,
    });

    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    return next(error);
  }
});

function normalizeTransaction(agentId: string, tx: NonNullable<z.infer<typeof querySchema>['transactions']>[number]): TransactionContext {
  return {
    agentId: tx.agentId ?? agentId,
    owner: tx.owner as Address | undefined,
    type: tx.type,
    to: tx.to as Address | undefined,
    value: tx.value ? BigInt(tx.value) : undefined,
    tokenAddress: tx.tokenAddress as Address | undefined,
    functionSignature: tx.functionSignature,
    protocol: tx.protocol,
    metadata: tx.metadata,
  };
}

export { router as agentRoutes };

