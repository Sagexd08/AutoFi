import express, { Router } from 'express';
import { z } from 'zod';
import {
  agentRepository,
  auditRepository,
  type AgentType,
  type ExecutionMode,
} from '@autofi/database';
import { LangChainAgent } from '@celo-automator/langchain-agent';
import { CeloClient } from '@celo-automator/celo-functions';
import { RiskEngine } from '@autofi/risk-engine';
import type { TransactionContext } from '@autofi/risk-engine';
import type { Address } from 'viem';
import { logger } from '../utils/logger.js';

const router: Router = express.Router();

const AGENT_TYPES = ['TREASURY', 'DEFI', 'NFT', 'GOVERNANCE', 'DONATION'] as const;
const EXECUTION_MODES = ['PROPOSE', 'EXECUTE', 'AUTONOMOUS'] as const;

// Schemas
const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(AGENT_TYPES),
  description: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  promptPreamble: z.string().optional(),
  executionMode: z.enum(EXECUTION_MODES).optional(),
  dailyLimit: z.string().optional(),
  perTxLimit: z.string().optional(),
  whitelist: z.array(z.string()).optional(),
  blacklist: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  promptPreamble: z.string().optional(),
  executionMode: z.enum(EXECUTION_MODES).optional(),
  isActive: z.boolean().optional(),
  dailyLimit: z.string().optional(),
  perTxLimit: z.string().optional(),
  whitelist: z.array(z.string()).optional(),
  blacklist: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const querySchema = z.object({
  query: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  transactions: z.array(z.object({
    agentId: z.string().optional(),
    owner: z.string().optional(),
    type: z.enum(['transfer', 'contract_call', 'deployment']),
    to: z.string().optional(),
    value: z.string().optional(),
    tokenAddress: z.string().optional(),
    functionSignature: z.string().optional(),
    protocol: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
});

// Runtime instances cache
const agentInstances = new Map<string, LangChainAgent>();
let riskEngine: RiskEngine | undefined;
let celoClient: CeloClient | undefined;

function ensureDependencies() {
  if (!riskEngine) {
    riskEngine = new RiskEngine({
      maxRiskScore: Number(process.env.MAX_RISK_SCORE) || 0.95,
      approvalThreshold: Number(process.env.APPROVAL_THRESHOLD) || 0.6,
      blockThreshold: Number(process.env.BLOCK_THRESHOLD) || 0.85,
    });
  }

  if (!celoClient && process.env.CELO_PRIVATE_KEY) {
    celoClient = new CeloClient({
      privateKey: process.env.CELO_PRIVATE_KEY,
      network: (process.env.CELO_NETWORK as 'alfajores' | 'mainnet') || 'alfajores',
      rpcUrl: process.env.CELO_RPC_URL,
    });
  }
}

function getUserId(req: express.Request): string {
  return (req as any).userId || 'system';
}

// Create agent
router.post('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const parsed = createAgentSchema.parse(req.body);

    const agent = await agentRepository.create({
      name: parsed.name,
      type: parsed.type as AgentType,
      description: parsed.description,
      objectives: parsed.objectives || [],
      promptPreamble: parsed.promptPreamble,
      executionMode: (parsed.executionMode || 'PROPOSE') as ExecutionMode,
      dailyLimit: parsed.dailyLimit || '0',
      perTxLimit: parsed.perTxLimit || '0',
      whitelist: parsed.whitelist || [],
      blacklist: parsed.blacklist || [],
      permissions: parsed.permissions || [],
      metadata: parsed.metadata as object | undefined,
      user: { connect: { id: userId } },
    });

    await auditRepository.create({
      userId,
      eventType: 'AGENT',
      eventCode: 'AGENT_CREATED',
      action: 'create',
      resourceType: 'agent',
      resourceId: agent.id,
      success: true,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent'),
      metadata: { name: parsed.name, type: parsed.type },
    });

    logger.info({ agentId: agent.id, type: parsed.type, userId }, 'Agent created');

    return res.status(201).json({
      success: true,
      agent,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create agent');
    return next(error);
  }
});

// List agents
router.get('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { type, isActive, limit = '50', offset = '0' } = req.query;

    const result = await agentRepository.listByUser(userId, {
      skip: Number(offset),
      take: Number(limit),
      type: type as AgentType | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    return res.json({
      success: true,
      agents: result.agents,
      total: result.total,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list agents');
    return next(error);
  }
});

// Get agent by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const includeRelations = req.query.includeRelations === 'true';

    const agent = includeRelations
      ? await agentRepository.findByIdWithRelations(id)
      : await agentRepository.findById(id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    return res.json({
      success: true,
      agent,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get agent');
    return next(error);
  }
});

// Update agent
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const parsed = updateAgentSchema.parse(req.body);

    const existing = await agentRepository.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    const agent = await agentRepository.update(id, {
      ...(parsed.name && { name: parsed.name }),
      ...(parsed.description !== undefined && { description: parsed.description }),
      ...(parsed.objectives && { objectives: parsed.objectives }),
      ...(parsed.promptPreamble !== undefined && { promptPreamble: parsed.promptPreamble }),
      ...(parsed.executionMode && { executionMode: parsed.executionMode as ExecutionMode }),
      ...(parsed.isActive !== undefined && { isActive: parsed.isActive }),
      ...(parsed.dailyLimit && { dailyLimit: parsed.dailyLimit }),
      ...(parsed.perTxLimit && { perTxLimit: parsed.perTxLimit }),
      ...(parsed.whitelist && { whitelist: parsed.whitelist }),
      ...(parsed.blacklist && { blacklist: parsed.blacklist }),
      ...(parsed.permissions && { permissions: parsed.permissions }),
      ...(parsed.metadata && { metadata: parsed.metadata as object }),
    });

    // Clear cached instance if config changed
    agentInstances.delete(id);

    await auditRepository.create({
      userId,
      eventType: 'AGENT',
      eventCode: 'AGENT_UPDATED',
      action: 'update',
      resourceType: 'agent',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
      changes: {
        before: { name: existing.name, isActive: existing.isActive },
        after: { name: agent.name, isActive: agent.isActive },
      },
    });

    logger.info({ agentId: id, userId }, 'Agent updated');

    return res.json({
      success: true,
      agent,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update agent');
    return next(error);
  }
});

// Delete agent
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const existing = await agentRepository.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    await agentRepository.delete(id);
    agentInstances.delete(id);

    await auditRepository.create({
      userId,
      eventType: 'AGENT',
      eventCode: 'AGENT_DELETED',
      action: 'delete',
      resourceType: 'agent',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
      metadata: { name: existing.name, type: existing.type },
    });

    logger.info({ agentId: id, userId }, 'Agent deleted');

    return res.json({
      success: true,
      message: 'Agent deleted',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to delete agent');
    return next(error);
  }
});

// Query agent with natural language
router.post('/:id/query', async (req, res, next) => {
  try {
    ensureDependencies();

    const { id } = req.params;
    const userId = getUserId(req);
    const parsed = querySchema.parse(req.body);

    const agent = await agentRepository.findById(id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    if (!agent.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Agent is not active',
      });
    }

    // Validate transactions against risk engine if provided
    if (parsed.transactions && parsed.transactions.length > 0) {
      const riskResults = await Promise.all(
        parsed.transactions.map(tx => 
          riskEngine!.validateTransaction(normalizeTransaction(id, tx))
        )
      );

      const hasBlockedTransaction = riskResults.some(r => !r.isValid);
      if (hasBlockedTransaction) {
        return res.status(400).json({
          success: false,
          error: 'One or more transactions failed risk validation',
          riskResults: riskResults.map(r => ({
            isValid: r.isValid,
            riskScore: r.riskScore,
            warnings: r.warnings,
          })),
        });
      }
    }

    // Get or create agent instance
    let langchainAgent = agentInstances.get(id);
    if (!langchainAgent) {
      langchainAgent = new LangChainAgent({
        id: agent.id,
        type: 'langchain',
        name: agent.name,
        model: 'gemini-1.5-flash',
        temperature: 0.7,
        celoClient,
      });
      agentInstances.set(id, langchainAgent);
    }

    // Get the LLM and process the query
    const llm = langchainAgent.getLLM();
    const response = await llm.invoke(parsed.query);
    const result = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    await auditRepository.create({
      userId,
      eventType: 'AGENT',
      eventCode: 'AGENT_QUERY',
      action: 'query',
      resourceType: 'agent',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
      input: { query: parsed.query },
      output: { responseLength: result?.length || 0 },
    });

    logger.info({ agentId: id, userId, queryLength: parsed.query.length }, 'Agent query processed');

    return res.json({
      success: true,
      agentId: id,
      result,
    });
  } catch (error) {
    logger.error({ error }, 'Agent query failed');
    return next(error);
  }
});

// Update agent whitelist
router.post('/:id/whitelist', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { addresses, action } = req.body;

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({
        success: false,
        error: 'addresses array required',
      });
    }

    let agent;
    if (action === 'remove') {
      agent = await agentRepository.removeFromWhitelist(id, addresses);
    } else {
      agent = await agentRepository.addToWhitelist(id, addresses);
    }

    return res.json({
      success: true,
      agent,
      message: `Whitelist ${action === 'remove' ? 'updated' : 'updated'}`,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update whitelist');
    return next(error);
  }
});

// Update agent blacklist
router.post('/:id/blacklist', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { addresses, action } = req.body;

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({
        success: false,
        error: 'addresses array required',
      });
    }

    let agent;
    if (action === 'remove') {
      // Would need to add removeFromBlacklist to repository
      const existing = await agentRepository.findById(id);
      if (!existing) throw new Error('Agent not found');
      const filtered = existing.blacklist.filter((a: string) => !addresses.includes(a));
      agent = await agentRepository.update(id, { blacklist: filtered });
    } else {
      agent = await agentRepository.addToBlacklist(id, addresses);
    }

    return res.json({
      success: true,
      agent,
      message: `Blacklist updated`,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update blacklist');
    return next(error);
  }
});

// Reset agent spending limits
router.post('/:id/reset-spending', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const agent = await agentRepository.resetDailySpending(id);

    await auditRepository.create({
      userId,
      eventType: 'AGENT',
      eventCode: 'AGENT_SPENDING_RESET',
      action: 'reset_spending',
      resourceType: 'agent',
      resourceId: id,
      success: true,
      ipAddress: req.ip || 'unknown',
    });

    return res.json({
      success: true,
      agent,
      message: 'Spending limits reset',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to reset spending');
    return next(error);
  }
});

// Helper function
function normalizeTransaction(
  agentId: string,
  tx: NonNullable<z.infer<typeof querySchema>['transactions']>[number]
): TransactionContext {
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
