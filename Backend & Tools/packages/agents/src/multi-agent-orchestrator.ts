import { pino } from 'pino';
import { createAIEngine, type AIEngine, type ParsedIntent } from '@autofi/ai-engine';
import {
  AgentContext,
  AgentResult,
  AgentOrchestrator,
  OrchestratorConfig,
  IntentAgentOutput,
  ExecutionPlan,
  PlannedStep,
  RiskAgentOutput,
  RiskFactor,
  SimulationAgentOutput,
  SimulatedStep,
  BalanceChange,
  ExecutionAgentOutput,
  ExecutedStep,
  FailedStep,
  MonitoringAgentOutput,
  TxConfirmation,
} from './orchestrator-types.js';

const logger = pino({ name: 'agent-orchestrator' });

/**
 * Multi-Agent Orchestrator
 * Coordinates all specialized agents for end-to-end plan execution
 */
export class MultiAgentOrchestrator implements AgentOrchestrator {
  private aiEngine: AIEngine;
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.aiEngine = createAIEngine({
      anthropicApiKey: config.aiEngineApiKey,
    });
  }

  /**
   * Intent Agent - Parse natural language into structured intent
   */
  async processIntent(
    prompt: string,
    context: AgentContext
  ): Promise<AgentResult<IntentAgentOutput>> {
    const startTime = Date.now();

    try {
      logger.info({ userId: context.userId, promptLength: prompt.length }, 'Processing intent');

      const result = await this.aiEngine.process({
        prompt,
        userId: context.userId,
        walletAddress: context.walletAddress,
        context: {
          chainId: context.chainId,
          availableBalances: context.balances,
        },
      });

      if (!result.success || !result.intent) {
        return {
          success: false,
          agentType: 'intent',
          error: result.error || 'Failed to parse intent',
          processingTimeMs: Date.now() - startTime,
        };
      }

      const output: IntentAgentOutput = {
        intent: result.intent,
        confidence: result.intent.confidence,
        requiresClarification: result.intent.intentType === 'unclear',
        clarificationQuestions: result.intent.clarificationNeeded,
      };

      return {
        success: true,
        agentType: 'intent',
        data: output,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error }, 'Intent processing failed');
      return {
        success: false,
        agentType: 'intent',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Planner Agent - Convert intent into executable plan with steps
   */
  async createPlan(
    intent: ParsedIntent,
    context: AgentContext
  ): Promise<AgentResult<ExecutionPlan>> {
    const startTime = Date.now();

    try {
      logger.info({ 
        userId: context.userId, 
        intentType: intent.intentType,
        stepsCount: intent.steps.length,
      }, 'Creating execution plan');

      // Convert intent steps to planned steps
      const plannedSteps: PlannedStep[] = intent.steps.map((step, index) => {
        const chainId = this.resolveChainId(step.params.chain as string);
        
        return {
          id: `step-${index + 1}`,
          index,
          chainId,
          type: step.function,
          description: this.generateStepDescription(step),
          functionName: step.function,
          params: step.params,
          dependencies: index > 0 ? [`step-${index}`] : [],
          estimatedGas: this.estimateGas(step.function),
          parallelizable: this.canParallelize(step, intent.steps, index),
        };
      });

      // Detect cross-chain requirements
      const uniqueChains = [...new Set(plannedSteps.map(s => s.chainId))];
      const crossChainRequired = uniqueChains.length > 1;

      // Calculate total gas estimate
      const totalGas = plannedSteps.reduce(
        (sum, step) => sum + BigInt(step.estimatedGas),
        BigInt(0)
      ).toString();

      const plan: ExecutionPlan = {
        id: `plan-${Date.now()}`,
        steps: plannedSteps,
        estimatedGas: totalGas,
        estimatedTime: plannedSteps.length * 15, // ~15 seconds per step
        crossChainRequired,
        bridgeSteps: crossChainRequired ? this.generateBridgeSteps(intent, uniqueChains) : undefined,
      };

      return {
        success: true,
        agentType: 'planner',
        data: plan,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error }, 'Plan creation failed');
      return {
        success: false,
        agentType: 'planner',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Risk Agent - Assess risk of execution plan
   */
  async assessRisk(
    plan: ExecutionPlan,
    context: AgentContext
  ): Promise<AgentResult<RiskAgentOutput>> {
    const startTime = Date.now();

    try {
      logger.info({ 
        planId: plan.id, 
        stepsCount: plan.steps.length,
      }, 'Assessing risk');

      const factors: RiskFactor[] = [];
      let totalScore = 0;
      let totalWeight = 0;

      // Risk Factor: Large Transfer (> $50k)
      const hasLargeTransfer = plan.steps.some(step => {
        const amount = parseFloat(step.params.amount as string || '0');
        return amount > 50000;
      });
      if (hasLargeTransfer) {
        factors.push({
          id: 'large_transfer',
          name: 'Large Transfer',
          score: 0.25,
          weight: 1,
          description: 'Transfer exceeds $50,000',
          triggered: true,
        });
        totalScore += 0.25;
        totalWeight += 1;
      }

      // Risk Factor: Very Large Transfer (> $500k)
      const hasVeryLargeTransfer = plan.steps.some(step => {
        const amount = parseFloat(step.params.amount as string || '0');
        return amount > 500000;
      });
      if (hasVeryLargeTransfer) {
        factors.push({
          id: 'very_large_transfer',
          name: 'Very Large Transfer',
          score: 0.45,
          weight: 1.5,
          description: 'Transfer exceeds $500,000',
          triggered: true,
        });
        totalScore += 0.45 * 1.5;
        totalWeight += 1.5;
      }

      // Risk Factor: Cross-chain Bridge
      if (plan.crossChainRequired) {
        factors.push({
          id: 'cross_chain_bridge',
          name: 'Cross-chain Bridge',
          score: 0.15,
          weight: 1,
          description: 'Operation requires cross-chain bridging',
          triggered: true,
        });
        totalScore += 0.15;
        totalWeight += 1;
      }

      // Risk Factor: High Slippage
      const hasHighSlippage = plan.steps.some(step => {
        const slippage = parseFloat(step.params.slippage as string || '0');
        return slippage > 3;
      });
      if (hasHighSlippage) {
        factors.push({
          id: 'high_slippage',
          name: 'High Slippage',
          score: 0.18,
          weight: 1,
          description: 'Slippage tolerance exceeds 3%',
          triggered: true,
        });
        totalScore += 0.18;
        totalWeight += 1;
      }

      // Risk Factor: Multiple Steps
      if (plan.steps.length > 5) {
        factors.push({
          id: 'complex_plan',
          name: 'Complex Multi-step Plan',
          score: 0.12,
          weight: 0.8,
          description: 'Plan contains more than 5 steps',
          triggered: true,
        });
        totalScore += 0.12 * 0.8;
        totalWeight += 0.8;
      }

      // Calculate overall score
      const overallScore = totalWeight > 0 ? Math.min(totalScore / totalWeight, 1) : 0;

      // Determine classification
      let classification: 'low' | 'medium' | 'high' | 'critical';
      if (overallScore >= 0.85) classification = 'critical';
      else if (overallScore >= 0.65) classification = 'high';
      else if (overallScore >= 0.35) classification = 'medium';
      else classification = 'low';

      // Determine approval requirements
      const requiresApproval = overallScore >= 0.35 || factors.some(f => f.triggered && f.score >= 0.25);
      const blockExecution = overallScore >= 0.65;

      // Generate recommendations
      const recommendations: string[] = [];
      if (hasVeryLargeTransfer) {
        recommendations.push('Consider splitting large transfers into smaller batches');
      }
      if (hasHighSlippage) {
        recommendations.push('Review slippage settings - current tolerance is high');
      }
      if (plan.crossChainRequired) {
        recommendations.push('Cross-chain operations may take additional time');
      }
      if (blockExecution) {
        recommendations.push('Manual review required before execution');
      }

      const output: RiskAgentOutput = {
        overallScore,
        classification,
        requiresApproval,
        blockExecution,
        factors,
        recommendations,
      };

      return {
        success: true,
        agentType: 'risk',
        data: output,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error }, 'Risk assessment failed');
      return {
        success: false,
        agentType: 'risk',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Simulation Agent - Simulate plan execution
   */
  async simulate(
    plan: ExecutionPlan,
    context: AgentContext
  ): Promise<AgentResult<SimulationAgentOutput>> {
    const startTime = Date.now();

    try {
      logger.info({ planId: plan.id }, 'Simulating plan');

      // Simulate each step
      const simulatedSteps: SimulatedStep[] = [];
      const balanceChanges: BalanceChange[] = [];
      const warnings: string[] = [];
      const errors: string[] = [];
      let totalGas = BigInt(0);

      for (const step of plan.steps) {
        // For now, simulate success (real implementation would use Tenderly/Anvil)
        const gasUsed = BigInt(step.estimatedGas);
        totalGas += gasUsed;

        simulatedSteps.push({
          stepId: step.id,
          success: true,
          gasUsed: gasUsed.toString(),
          logs: [],
        });
      }

      // Add placeholder balance changes
      if (plan.steps.length > 0) {
        warnings.push('Simulation completed with estimated values. Live simulation pending.');
      }

      const output: SimulationAgentOutput = {
        success: errors.length === 0,
        steps: simulatedSteps,
        totalGasUsed: totalGas.toString(),
        balanceChanges,
        events: [],
        warnings,
        errors,
      };

      return {
        success: true,
        agentType: 'simulation',
        data: output,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error }, 'Simulation failed');
      return {
        success: false,
        agentType: 'simulation',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execution Agent - Execute the plan
   */
  async execute(
    plan: ExecutionPlan,
    simulation: SimulationAgentOutput,
    context: AgentContext
  ): Promise<AgentResult<ExecutionAgentOutput>> {
    const startTime = Date.now();

    try {
      logger.info({ planId: plan.id }, 'Executing plan');

      if (!simulation.success) {
        return {
          success: false,
          agentType: 'execution',
          error: 'Cannot execute plan - simulation failed',
          processingTimeMs: Date.now() - startTime,
        };
      }

      const executedSteps: ExecutedStep[] = [];
      const pendingSteps: string[] = [];
      const failedSteps: FailedStep[] = [];

      // For now, return pending status (real implementation would sign and broadcast)
      for (const step of plan.steps) {
        pendingSteps.push(step.id);
      }

      const output: ExecutionAgentOutput = {
        status: 'pending',
        executedSteps,
        pendingSteps,
        failedSteps,
        totalGasUsed: '0',
        totalCost: '0',
      };

      return {
        success: true,
        agentType: 'execution',
        data: output,
        processingTimeMs: Date.now() - startTime,
        metadata: {
          requiresWalletSignature: true,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Execution failed');
      return {
        success: false,
        agentType: 'execution',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Monitoring Agent - Monitor transaction status
   */
  async monitor(
    planId: string,
    txHashes: string[],
    context: AgentContext
  ): Promise<AgentResult<MonitoringAgentOutput>> {
    const startTime = Date.now();

    try {
      logger.info({ planId, txCount: txHashes.length }, 'Monitoring transactions');

      const confirmations: TxConfirmation[] = txHashes.map(hash => ({
        txHash: hash,
        status: 'pending' as const,
        confirmations: 0,
      }));

      const output: MonitoringAgentOutput = {
        status: 'watching',
        confirmations,
        alerts: [],
        mempoolStatus: {
          pendingCount: txHashes.length,
          baseFee: '30000000000', // 30 gwei placeholder
          priorityFee: '1500000000', // 1.5 gwei placeholder
          congestionLevel: 'low',
        },
      };

      return {
        success: true,
        agentType: 'monitoring',
        data: output,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error }, 'Monitoring failed');
      return {
        success: false,
        agentType: 'monitoring',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private resolveChainId(chain: string): number {
    const chainMap: Record<string, number> = {
      ethereum: 1,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      base: 8453,
      avalanche: 43114,
      bsc: 56,
      celo: 42220,
      scroll: 534352,
      zksync: 324,
      linea: 59144,
      mantle: 5000,
    };
    return chainMap[chain?.toLowerCase()] || 1;
  }

  private generateStepDescription(step: { function: string; params: Record<string, unknown> }): string {
    const fn = step.function;
    const params = step.params;

    switch (fn) {
      case 'transfer':
        return `Transfer ${params.amount} ${params.token} to ${params.to}`;
      case 'swap':
        return `Swap ${params.amount} ${params.tokenIn} for ${params.tokenOut}`;
      case 'stake':
        return `Stake ${params.amount} ${params.token} on ${params.protocol}`;
      case 'unstake':
        return `Unstake ${params.amount} ${params.token} from ${params.protocol}`;
      case 'addLiquidity':
        return `Add liquidity to ${params.pool}`;
      case 'removeLiquidity':
        return `Remove ${params.percentage}% liquidity from ${params.pool}`;
      case 'deposit':
        return `Deposit ${params.amount} into ${params.vault}`;
      case 'withdraw':
        return `Withdraw ${params.amount} from ${params.vault}`;
      case 'vote':
        return `Vote ${params.choice} on proposal ${params.proposalId}`;
      default:
        return `Execute ${fn}`;
    }
  }

  private estimateGas(functionName: string): string {
    const gasEstimates: Record<string, string> = {
      transfer: '65000',
      swap: '250000',
      addLiquidity: '350000',
      removeLiquidity: '280000',
      stake: '200000',
      unstake: '180000',
      claimRewards: '120000',
      deposit: '200000',
      withdraw: '180000',
      createStream: '300000',
      vote: '100000',
      delegate: '80000',
      executeMulticall: '500000',
    };
    return gasEstimates[functionName] || '200000';
  }

  private canParallelize(
    step: { function: string; params: Record<string, unknown> },
    allSteps: Array<{ function: string; params: Record<string, unknown> }>,
    currentIndex: number
  ): boolean {
    // Steps on different chains can be parallelized
    if (currentIndex === 0) return true;

    const currentChain = step.params.chain;
    const previousStep = allSteps[currentIndex - 1];
    const previousChain = previousStep.params.chain;

    return currentChain !== previousChain;
  }

  private generateBridgeSteps(intent: ParsedIntent, chains: number[]): any[] {
    // Generate bridge steps for cross-chain operations
    if (chains.length <= 1) return [];

    const bridgeSteps = [];
    for (let i = 0; i < chains.length - 1; i++) {
      bridgeSteps.push({
        fromChain: chains[i],
        toChain: chains[i + 1],
        token: 'USDC', // Default to USDC for bridging
        amount: '0',
        bridge: 'across', // Default bridge protocol
        estimatedTime: 600, // 10 minutes
      });
    }
    return bridgeSteps;
  }
}

/**
 * Create a new multi-agent orchestrator
 */
export function createOrchestrator(config: OrchestratorConfig): MultiAgentOrchestrator {
  return new MultiAgentOrchestrator(config);
}
