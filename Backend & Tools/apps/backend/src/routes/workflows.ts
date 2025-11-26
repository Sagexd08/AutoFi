import express, { Router } from 'express';
import { LangChainAgent } from '@autofi/langchain-agent';
import { CeloClient } from '@autofi/celo-functions';
import { WorkflowOrchestrator } from '@autofi/langchain-agent';
import { validateWorkflow, generateId } from '@autofi/core';
import type { Workflow } from '@autofi/types';
import { logger } from '../utils/logger.js';

const router: Router = express.Router();

// In-memory storage (will be replaced with database in production)
interface StoredWorkflow {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  workflow: Workflow;
  userId?: string;
}

interface StoredExecution {
  id: string;
  workflowId: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  results?: unknown;
  error?: string;
  transactionHashes?: string[];
}

const workflows = new Map<string, StoredWorkflow>();
const executions = new Map<string, StoredExecution>();

let celoClient: CeloClient | undefined;
let agent: LangChainAgent | undefined;
let orchestrator: WorkflowOrchestrator | undefined;

if (process.env.CELO_PRIVATE_KEY) {
  try {
    celoClient = new CeloClient({
      privateKey: process.env.CELO_PRIVATE_KEY,
      network: (process.env.CELO_NETWORK as 'alfajores' | 'mainnet') || 'alfajores',
      rpcUrl: process.env.CELO_RPC_URL,
    });

    agent = new LangChainAgent({
      id: 'main',
      type: 'langchain',
      name: 'Celo Automator Agent',
      model: process.env.AI_MODEL || 'gemini-1.5-flash',
      geminiApiKey: process.env.GEMINI_API_KEY,
      celoClient,
    });

    orchestrator = new WorkflowOrchestrator(agent);
    console.log('✅ Workflow orchestrator initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize workflow orchestrator:', error);
  }
}

router.post('/interpret', async (req, res, next) => {
  try {
    const { input, context } = req.body;

    if (!input) {
      return res.status(400).json({
        success: false,
        error: 'Input is required',
      });
    }

    if (!orchestrator) {
      return res.status(503).json({
        success: false,
        error: 'Workflow orchestrator not initialized',
      });
    }

    const result = await orchestrator.interpretWorkflow(input, context);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({
      success: true,
      workflow: result.workflow,
      explanation: result.explanation,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const workflowData = req.body as Workflow & { userId?: string };

    if (!validateWorkflow(workflowData)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow format',
      });
    }

    // Check if workflow with same ID already exists
    const workflowId = workflowData.id || generateId('wf');
    if (workflows.has(workflowId)) {
      return res.status(409).json({
        success: false,
        error: 'Workflow ID already exists',
      });
    }

    // Store workflow
    const storedWorkflow: StoredWorkflow = {
      id: workflowId,
      name: workflowData.name || 'Untitled Workflow',
      description: workflowData.description,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      workflow: workflowData,
      userId: workflowData.userId,
    };
    workflows.set(workflowId, storedWorkflow);

    logger.info({ workflowId, name: storedWorkflow.name }, 'Workflow created');

    return res.status(201).json({
      success: true,
      workflow: {
        ...workflowData,
        id: workflowId,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res) => {
  const { userId, status, limit = '50', offset = '0' } = req.query;

  let results = Array.from(workflows.values());

  if (userId && typeof userId === 'string') {
    results = results.filter(w => w.userId === userId);
  }

  if (status && typeof status === 'string') {
    results = results.filter(w => w.status === status);
  }

  results = results
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(Number(offset), Number(offset) + Number(limit));

  return res.json({
    success: true,
    workflows: results.map((w) => ({
      ...w.workflow,
      id: w.id,
      name: w.name,
      description: w.description,
      status: w.status,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    })),
  });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const workflow = workflows.get(id);

  if (!workflow) {
    return res.status(404).json({
      success: false,
      error: 'Workflow not found',
    });
  }

  return res.json({
    success: true,
    workflow: {
      ...workflow.workflow,
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    },
  });
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workflowData = req.body as Workflow & { userId?: string };

    const existing = workflows.get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    if (!validateWorkflow(workflowData)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow format',
      });
    }

    const updated: StoredWorkflow = {
      ...existing,
      name: workflowData.name || existing.name,
      description: workflowData.description ?? existing.description,
      workflow: workflowData,
      updatedAt: new Date(),
    };
    workflows.set(id, updated);

    logger.info({ workflowId: id, name: updated.name }, 'Workflow updated');

    return res.json({
      success: true,
      workflow: {
        ...workflowData,
        id,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/execute', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { context: _context } = req.body;
    
    const workflowRecord = workflows.get(id);

    if (!workflowRecord) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    if (!orchestrator) {
      return res.status(503).json({
        success: false,
        error: 'Workflow orchestrator not initialized',
      });
    }

    // Create execution record
    const executionId = generateId('exec');
    const execution: StoredExecution = {
      id: executionId,
      workflowId: id,
      status: 'running',
      startedAt: new Date(),
    };
    executions.set(executionId, execution);

    logger.info({ executionId, workflowId: id }, 'Workflow execution started');

    // Get the workflow definition
    const workflow = workflowRecord.workflow;

    // Execute asynchronously
    orchestrator
      .executeWorkflow(workflow)
      .then((result: { success: boolean; results?: unknown; transactionHashes?: string[]; error?: string }) => {
        const exec = executions.get(executionId);
        if (exec) {
          exec.status = result.success ? 'completed' : 'failed';
          exec.results = result.results;
          exec.transactionHashes = result.transactionHashes;
          exec.error = result.error;
          exec.completedAt = new Date();
          executions.set(executionId, exec);
        }
        logger.info({ executionId, success: result.success }, 'Workflow execution finished');
      })
      .catch((error: Error) => {
        const exec = executions.get(executionId);
        if (exec) {
          exec.status = 'failed';
          exec.error = error.message;
          exec.completedAt = new Date();
          executions.set(executionId, exec);
        }
        logger.error({ executionId, error: error.message }, 'Workflow execution failed');
      });

    return res.json({
      success: true,
      executionId: execution.id,
      execution: {
        id: execution.id,
        workflowId: id,
        status: 'running',
        startedAt: execution.startedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/executions/:executionId', async (req, res) => {
  const { executionId } = req.params;
  const execution = executions.get(executionId);

  if (!execution) {
    return res.status(404).json({
      success: false,
      error: 'Execution not found',
    });
  }

  return res.json({
    success: true,
    execution: {
      id: execution.id,
      workflowId: execution.workflowId,
      status: execution.status,
      error: execution.error,
      transactionHashes: execution.transactionHashes,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
    },
  });
});

// Get executions for a workflow
router.get('/:id/executions', async (req, res) => {
  const { id } = req.params;
  const { limit = '50', offset = '0', status } = req.query;

  const workflow = workflows.get(id);
  if (!workflow) {
    return res.status(404).json({
      success: false,
      error: 'Workflow not found',
    });
  }

  let results = Array.from(executions.values())
    .filter(e => e.workflowId === id);

  if (status && typeof status === 'string') {
    results = results.filter(e => e.status === status);
  }

  results = results
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(Number(offset), Number(offset) + Number(limit));

  return res.json({
    success: true,
    executions: results.map((e) => ({
      id: e.id,
      workflowId: e.workflowId,
      status: e.status,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
    })),
  });
});

router.post('/:id/explain', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workflowRecord = workflows.get(id);

    if (!workflowRecord) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    if (!orchestrator) {
      return res.status(503).json({
        success: false,
        error: 'Workflow orchestrator not initialized',
      });
    }

    const workflow = workflowRecord.workflow;
    const explanation = await orchestrator.explainWorkflow(workflow);

    return res.json({
      success: true,
      explanation,
    });
  } catch (error) {
    return next(error);
  }
});

// Delete a workflow
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const workflow = workflows.get(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    workflows.delete(id);

    logger.info({ workflowId: id, name: workflow.name }, 'Workflow deleted');

    return res.json({
      success: true,
      message: 'Workflow deleted',
    });
  } catch (error) {
    return next(error);
  }
});

export { router as workflowRoutes };
