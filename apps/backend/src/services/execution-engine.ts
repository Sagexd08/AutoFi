import { v4 as uuidv4 } from 'uuid';
import { CeloClient, sendCELO, sendToken } from '@celo-automator/celo-functions';
import { RiskEngine, RiskRuleResult, RiskEvaluationInput } from '@celo-ai/risk-engine';
import { logger } from '../utils/logger.js';
import { getBackendEnv } from '../env.js';
import type { Address } from 'viem';

export interface ExecutionInput {
  automationId: string;
  userId: string;
  workflowConfig: any;
  parameters?: Record<string, any>;
}

export interface ExecutionResult {
  executionId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'blocked';
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  riskAssessment?: {
    score: number;
    level: string;
    requiresApproval: boolean;
    blockExecution: boolean;
  };
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

class ExecutionEngine {
  private celoClient: CeloClient | null = null;
  private riskEngine: RiskEngine;
  private executions: Map<string, ExecutionResult> = new Map();

  constructor() {
    this.riskEngine = new RiskEngine({
      approvalThreshold: 0.6,
      blockThreshold: 0.85,
    });

    this.initializeRiskRules();
  }

  private initializeRiskRules() {
    this.riskEngine.registerRule({
      id: 'value_threshold',
      label: 'High Value Transfer',
      description: 'Checks if transaction value exceeds threshold',
      weight: 0.3,
      evaluate: async (input: RiskEvaluationInput): Promise<RiskRuleResult> => {
        const value = parseFloat(input.transaction.value || '0');
        const threshold = 1000; // 1000 CELO threshold
        const passed = value < threshold;
        return {
          id: 'value_threshold',
          label: 'High Value Transfer',
          weight: 0.3,
          normalizedScore: passed ? 0 : Math.min(value / threshold, 1),
          level: passed ? 'low' : 'high',
          triggered: !passed,
          requiresApproval: !passed,
          blockExecution: false,
          reasons: passed ? [] : [`Value ${value} exceeds threshold ${threshold}`],
          recommendations: [],
          metadata: { value, threshold },
        };
      },
    });

    this.riskEngine.registerRule({
      id: 'contract_verification',
      label: 'Contract Verification',
      description: 'Verifies contract status',
      weight: 0.4,
      evaluate: async (_input: RiskEvaluationInput): Promise<RiskRuleResult> => {
        return {
          id: 'contract_verification',
          label: 'Contract Verification',
          weight: 0.4,
          normalizedScore: 0,
          level: 'low',
          triggered: false,
          requiresApproval: false,
          blockExecution: false,
          reasons: [],
          recommendations: [],
          metadata: { verified: true },
        };
      },
    });

    this.riskEngine.registerRule({
      id: 'execution_frequency',
      label: 'Execution Frequency',
      description: 'Checks execution frequency',
      weight: 0.3,
      evaluate: async (_input: RiskEvaluationInput): Promise<RiskRuleResult> => {
        const executionCount = this.executions.size;
        const threshold = 100;
        const passed = executionCount < threshold;
        return {
          id: 'execution_frequency',
          label: 'Execution Frequency',
          weight: 0.3,
          normalizedScore: passed ? 0 : Math.min(executionCount / threshold, 1),
          level: passed ? 'low' : 'medium',
          triggered: !passed,
          requiresApproval: false,
          blockExecution: false,
          reasons: passed ? [] : [`Execution count ${executionCount} exceeds threshold ${threshold}`],
          recommendations: [],
          metadata: { count: executionCount, threshold },
        };
      },
    });
  }

  private ensureCeloClient() {
    if (!this.celoClient) {
      const env = getBackendEnv();
      if (!env.CELO_PRIVATE_KEY) {
        throw new Error('CELO_PRIVATE_KEY not configured');
      }

      this.celoClient = new CeloClient({
        privateKey: env.CELO_PRIVATE_KEY,
        network: (env.CELO_NETWORK as 'alfajores' | 'mainnet') || 'alfajores',
        rpcUrl: env.CELO_RPC_URL,
      });
    }
  }

  async execute(input: ExecutionInput): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const startTime = Date.now();

    const result: ExecutionResult = {
      executionId,
      status: 'pending',
      startedAt: new Date().toISOString(),
    };

    try {
      logger.info('Starting risk assessment', { executionId, automationId: input.automationId });

      const riskAssessment = await this.riskEngine.scoreTransaction({
        transaction: {
          value: input.parameters?.value || '0',
          to: input.parameters?.to,
          data: input.parameters?.data,
        },
      });

      result.riskAssessment = {
        score: riskAssessment.normalizedRisk,
        level: riskAssessment.classification,
        requiresApproval: riskAssessment.requiresApproval,
        blockExecution: riskAssessment.blockExecution,
      };

      if (riskAssessment.blockExecution) {
        result.status = 'blocked';
        result.error = `Execution blocked due to high risk: ${riskAssessment.classification}`;
        logger.warn('Execution blocked by risk engine', { executionId, risk: riskAssessment });
        this.executions.set(executionId, result);
        return result;
      }

      if (riskAssessment.requiresApproval) {
        result.status = 'pending';
        result.error = 'Approval required before execution';
        logger.info('Approval required', { executionId, automationId: input.automationId });
        this.executions.set(executionId, result);
        return result;
      }

      result.status = 'running';
      this.executions.set(executionId, result);

      logger.info('Executing automation', {
        executionId,
        automationId: input.automationId,
        workflowConfig: input.workflowConfig,
      });

      const executionResult = await this.executeWorkflow(
        input.workflowConfig,
        input.parameters || {}
      );

      result.status = 'success';
      result.transactionHash = executionResult.txHash;
      result.blockNumber = executionResult.blockNumber;
      result.gasUsed = executionResult.gasUsed;

      logger.info('Automation executed successfully', {
        executionId,
        txHash: result.transactionHash,
      });
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);

      logger.error('Automation execution failed', {
        executionId,
        error: result.error,
      });
    } finally {
      result.completedAt = new Date().toISOString();
      result.durationMs = Date.now() - startTime;
      this.executions.set(executionId, result);
    }

    return result;
  }

  private async executeWorkflow(
    config: any,
    parameters: Record<string, any>
  ): Promise<{
    txHash?: string;
    blockNumber?: number;
    gasUsed?: string;
  }> {
    this.ensureCeloClient();

    if (!this.celoClient) {
      throw new Error('Celo client not initialized');
    }

    const workflowType = config.type || 'transaction';

    switch (workflowType) {
      case 'transfer':
        return this.executeTransfer(config, parameters);

      case 'swap':
        return this.executeSwap(config, parameters);

      case 'contract_call':
        return this.executeContractCall(config, parameters);

      default:
        throw new Error(`Unknown workflow type: ${workflowType}`);
    }
  }

  private async executeTransfer(
    config: any,
    parameters: Record<string, any>
  ): Promise<{ txHash?: string; blockNumber?: number; gasUsed?: string }> {
    if (!this.celoClient) {
      throw new Error('Celo client not initialized');
    }

    const to = (parameters.to || config.to) as Address;
    const value = (parameters.value || config.value || '0').toString();
    const tokenAddress = parameters.tokenAddress || config.tokenAddress;

    logger.info('Executing transfer', { to, value, tokenAddress });

    let result;
    if (tokenAddress) {
      result = await sendToken(this.celoClient, tokenAddress as Address, to, value);
    } else {
      result = await sendCELO(this.celoClient, to, value);
    }

    if (!result.success) {
      throw new Error(result.error || 'Transfer failed');
    }

    return {
      txHash: result.transactionHash,
      blockNumber: result.blockNumber ? Number(result.blockNumber) : undefined,
      gasUsed: result.gasUsed?.toString(),
    };
  }

  private async executeSwap(
    config: any,
    parameters: Record<string, any>
  ): Promise<{ txHash?: string; blockNumber?: number; gasUsed?: string }> {
    logger.info('Swap execution placeholder', { config, parameters });
    throw new Error('Swap functionality not yet implemented');
  }

  private async executeContractCall(
    config: any,
    parameters: Record<string, any>
  ): Promise<{ txHash?: string; blockNumber?: number; gasUsed?: string }> {
    logger.info('Contract call execution placeholder', { config, parameters });
    throw new Error('Contract call functionality not yet implemented');
  }

  getExecution(executionId: string): ExecutionResult | undefined {
    return this.executions.get(executionId);
  }

  getAutomationExecutions(automationId: string): ExecutionResult[] {
    return Array.from(this.executions.values()).filter(
      (e) => e.executionId.includes(automationId) || e.status === 'running'
    );
  }
}

export const executionEngine = new ExecutionEngine();
