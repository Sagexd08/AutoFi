import express from 'express';
import { LangChainAgent } from '@celo-automator/langchain-agent';
import { CeloClient } from '@celo-automator/celo-functions';
import { WorkflowOrchestrator } from '@celo-automator/langchain-agent';
import { validateWorkflow } from '@celo-automator/core';
import type { Workflow, WorkflowExecution } from '@celo-automator/types';
import { generateId } from '@celo-automator/core';

const router = express.Router();

// In-memory storage (replace with database in production)
const workflows: Map<string, Workflow> = new Map();
const executions: Map<string, WorkflowExecution> = new Map();

// Initialize Celo client and agent
let celoClient: CeloClient | undefined;
let agent: LangChainAgent | undefined;
let orchestrator: WorkflowOrchestrator | undefined;

// Initialize asynchronously
(async () => {
  if (process.env.CELO_PRIVATE_KEY) {
    celoClient = new CeloClient({
      privateKey: process.env.CELO_PRIVATE_KEY,
      network: (process.env.CELO_NETWORK as 'alfajores' | 'mainnet') || 'alfajores',
      rpcUrl: process.env.CELO_RPC_URL,
    });

    agent = await LangChainAgent.create({
      id: 'main',
      type: 'langchain',
      name: 'Celo Automator Agent',
      model: process.env.AI_MODEL || 'gemini-1.5-flash',
      geminiApiKey: process.env.GEMINI_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      celoClient,
    });

    orchestrator = new WorkflowOrchestrator(agent);
  }
})().catch((error) => {
  console.error('Failed to initialize agent:', error);
});

// Create workflow from natural language
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

    res.json({
      success: true,
      workflow: result.workflow,
      explanation: result.explanation,
    });
  } catch (error) {
    next(error);
  }
});

// Create workflow
router.post('/', async (req, res, next) => {
  try {
    const workflow = req.body as Workflow;

    if (!validateWorkflow(workflow)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow format',
      });
    }

    const id = workflow.id || generateId('workflow');
    workflow.id = id;
    workflows.set(id, workflow);

    res.status(201).json({
      success: true,
      workflow,
    });
  } catch (error) {
    next(error);
  }
});

// Get all workflows
router.get('/', async (req, res) => {
  const workflowList = Array.from(workflows.values());
  res.json({
    success: true,
    workflows: workflowList,
  });
});

// Get workflow by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const workflow = workflows.get(id);

  if (!workflow) {
    return res.status(404).json({
      success: false,
      error: 'Workflow not found',
    });
  }

  res.json({
    success: true,
    workflow,
  });
});

// Update workflow
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workflow = req.body as Workflow;

    if (!workflows.has(id)) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    if (!validateWorkflow(workflow)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow format',
      });
    }

    workflow.id = id;
    workflows.set(id, workflow);

    res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    next(error);
  }
});

// Execute workflow
router.post('/:id/execute', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workflow = workflows.get(id);

    if (!workflow) {
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

    const executionId = generateId('exec');
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: id,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    executions.set(executionId, execution);

    // Execute asynchronously
    orchestrator
      .executeWorkflow(workflow)
      .then((result) => {
        execution.status = result.success ? 'completed' : 'failed';
        execution.completedAt = new Date().toISOString();
        execution.results = result.results;
        execution.transactionHashes = result.transactionHashes;
        if (result.error) {
          execution.error = result.error;
        }
        executions.set(executionId, execution);
      })
      .catch((error) => {
        execution.status = 'failed';
        execution.completedAt = new Date().toISOString();
        execution.error = error.message;
        executions.set(executionId, execution);
      });

    res.json({
      success: true,
      executionId,
      execution,
    });
  } catch (error) {
    next(error);
  }
});

// Get execution status
router.get('/executions/:executionId', async (req, res) => {
  const { executionId } = req.params;
  const execution = executions.get(executionId);

  if (!execution) {
    return res.status(404).json({
      success: false,
      error: 'Execution not found',
    });
  }

  res.json({
    success: true,
    execution,
  });
});

// Explain workflow
router.post('/:id/explain', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workflow = workflows.get(id);

    if (!workflow) {
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

    const explanation = await orchestrator.explainWorkflow(workflow);

    res.json({
      success: true,
      explanation,
    });
  } catch (error) {
    next(error);
  }
});

export { router as workflowRoutes };
