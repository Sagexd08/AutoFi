import express, { Router } from 'express';
import { LangChainAgent } from '@celo-automator/langchain-agent';
import { CeloClient } from '@celo-automator/celo-functions';
import { WorkflowOrchestrator } from '@celo-automator/langchain-agent';
import { validateWorkflow } from '@celo-automator/core';
import type { Workflow, WorkflowExecution } from '@celo-automator/types';
import { generateId } from '@celo-automator/core';

const router: Router = express.Router();
const workflows: Map<string, Workflow> = new Map();
const executions: Map<string, WorkflowExecution> = new Map();

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
      type: 'custom',
      name: 'Celo Automator Agent',
      model: process.env.AI_MODEL || 'custom-ml-v1',
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
    const workflow = req.body as Workflow;

    if (!validateWorkflow(workflow)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow format',
      });
    }

    let id: string;

    if (workflow.id) {
      if (workflows.has(workflow.id)) {
        return res.status(409).json({
          success: false,
          error: 'Workflow ID already exists',
        });
      }
      id = workflow.id;
    } else {
      let attempts = 0;
      const maxAttempts = 100;
      do {
        id = generateId('workflow');
        attempts++;
        if (attempts >= maxAttempts) {
          return res.status(500).json({
            success: false,
            error: 'Failed to generate unique workflow ID',
          });
        }
      } while (workflows.has(id));
    }

    workflow.id = id;
    workflows.set(id, workflow);

    return res.status(201).json({
      success: true,
      workflow,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (_req, res) => {
  const workflowList = Array.from(workflows.values());
  return res.json({
    success: true,
    workflows: workflowList,
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
    workflow,
  });
});

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

    return res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    return next(error);
  }
});

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

    orchestrator
      .executeWorkflow(workflow)
      .then((result: any) => {
        execution.status = result.success ? 'completed' : 'failed';
        execution.completedAt = new Date().toISOString();
        execution.results = result.results;
        execution.transactionHashes = result.transactionHashes;
        if (result.error) {
          execution.error = result.error;
        }
        executions.set(executionId, execution);
      })
      .catch((error: any) => {
        execution.status = 'failed';
        execution.completedAt = new Date().toISOString();
        execution.error = error.message;
        executions.set(executionId, execution);
      });

    return res.json({
      success: true,
      executionId,
      execution,
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
      execution,
    });
});

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

    return res.json({
      success: true,
      explanation,
    });
  } catch (error) {
    return next(error);
  }
});

export { router as workflowRoutes };
