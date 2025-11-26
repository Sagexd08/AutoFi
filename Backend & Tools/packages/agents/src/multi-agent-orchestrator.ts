import { pino } from 'pino';
import { createAIEngine, type AIEngine, type ParsedIntent } from '@autofi/ai-engine';
import { createAutofiRiskEngine, type AutofiRiskEngine, type AutofiRiskContext, type TriggeredFactor } from '@autofi/risk-engine';
import { createSimulationEngineFromEnv, type SimulationEngine, type TransactionToSimulate, type StepSimulationResult } from '@autofi/simulation';
import { ExecutionEngine } from '@autofi/execution-engine';
import { createWalletManager, WalletManager } from '@autofi/wallet-manager';
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
  ExecutionAgentOutput,
  ExecutedStep,
  FailedStep,
  MonitoringAgentOutput,
  TxConfirmation,
} from './orchestrator-types.js';

const logger = pino({ name: 'agent-orchestrator' });
export class MultiAgentOrchestrator implements AgentOrchestrator {
  private aiEngine: AIEngine;
  private riskEngine: AutofiRiskEngine;
  private simulationEngine: SimulationEngine;
  private executionEngine: ExecutionEngine;
  private walletManager: WalletManager;
  constructor(config: OrchestratorConfig) {
    // this.config = config;
    this.aiEngine = createAIEngine({
      anthropicApiKey: config.aiEngineApiKey,
    });
    this.riskEngine = createAutofiRiskEngine();
    this.simulationEngine = createSimulationEngineFromEnv();

    // Initialize Wallet Manager
    this.walletManager = createWalletManager(config.walletConfig || { 
      type: 'local', 
      privateKey: process.env.WALLET_PRIVATE_KEY || '' 
    });
    
    // Initialize Execution Engine
    const rpcUrl = process.env.RPC_URL || 'https://forno.celo.org';
    this.executionEngine = new ExecutionEngine(rpcUrl, this.walletManager);
  }

  /**
   * Run the full agent pipeline: Intent -> Plan -> Risk -> Simulation
   */
  async runPipeline(
    prompt: string,
    context: AgentContext
  ): Promise<{
    intent: AgentResult<IntentAgentOutput>;
    plan?: AgentResult<ExecutionPlan>;
    risk?: AgentResult<RiskAgentOutput>;
    simulation?: AgentResult<SimulationAgentOutput>;
    error?: string;
  }> {
    // 1. Intent
    const intentResult = await this.processIntent(prompt, context);
    if (!intentResult.success || !intentResult.data) {
      return { intent: intentResult, error: intentResult.error };
    }

    // 2. Plan
    const planResult = await this.createPlan(intentResult.data.intent, context);
    if (!planResult.success || !planResult.data) {
      return { intent: intentResult, plan: planResult, error: planResult.error };
    }

    // 3. Risk
    const riskResult = await this.assessRisk(planResult.data, context);
    if (!riskResult.success || !riskResult.data) {
      return { intent: intentResult, plan: planResult, risk: riskResult, error: riskResult.error };
    }

    // 4. Simulation
    const simulationResult = await this.simulate(planResult.data, context);
    
    return {
      intent: intentResult,
      plan: planResult,
      risk: riskResult,
      simulation: simulationResult
    };
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
      const plannedSteps: PlannedStep[] = intent.steps.map((step, index) => {
        const chainId = this.resolveChainId((step.params as any).chain as string);
        
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
      const uniqueChains = [...new Set(plannedSteps.map(s => s.chainId))];
      const crossChainRequired = uniqueChains.length > 1;
      const totalGas = plannedSteps.reduce(
        (sum, step) => sum + BigInt(step.estimatedGas),
        BigInt(0)
      ).toString();

      const plan: ExecutionPlan = {
        id: `plan-${Date.now()}`,
        steps: plannedSteps,
        estimatedGas: totalGas,
        estimatedTime: plannedSteps.length * 15, 
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

      const allFactors: RiskFactor[] = [];
      let maxScore = 0;
      const allRecommendations: string[] = [];

      for (const step of plan.steps) {
          const riskContext: AutofiRiskContext = {
          transactionValue: BigInt(Math.floor(parseFloat(String(step.params.amount || '0')) * 1e18)), // Simplified conversion
          toAddress: (step.params.to as string) || (step.params.router as string) || '0x0000000000000000000000000000000000000000',
          fromAddress: context.walletAddress,
          chainId: step.chainId,
          isNewToken: false, // Placeholder - would check token registry
          isFirstInteraction: false, // Placeholder - would check history
          isCrossChain: plan.crossChainRequired,
          userTotalTransactions: 10, // Placeholder
          userAccountAge: 30, // Placeholder
          simulationSuccess: true, // Assumed for pre-sim risk check
          dustAttackPattern: false,
          approvalRemovalMissing: false
        };

        const assessment = await this.riskEngine.assessRisk(riskContext);
        
        // Aggregate results
        maxScore = Math.max(maxScore, assessment.overallScore);
        
        const mappedFactors: RiskFactor[] = assessment.factors.map((f: TriggeredFactor) => ({
            id: f.id,
            name: f.name,
            score: f.score,
            weight: 1,
            description: f.reason,
            triggered: true
        }));
        
        allFactors.push(...mappedFactors);
        allRecommendations.push(...assessment.recommendations);
      }
      const uniqueFactors = Array.from(new Map(allFactors.map(f => [f.id, f])).values());
      const uniqueRecommendations = [...new Set(allRecommendations)]
      let classification: 'low' | 'medium' | 'high' | 'critical';
      if (maxScore >= 0.85) classification = 'critical';
      else if (maxScore >= 0.65) classification = 'high';
      else if (maxScore >= 0.35) classification = 'medium';
      else classification = 'low';

      const output: RiskAgentOutput = {
        overallScore: maxScore,
        classification,
        requiresApproval: maxScore >= 0.35,
        blockExecution: maxScore >= 0.85,
        factors: uniqueFactors,
        recommendations: uniqueRecommendations,
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

      // Convert plan steps to transactions
      // Note: In a full implementation, we would use the ChainAdapter to build actual calldata
      const transactions: TransactionToSimulate[] = plan.steps.map(step => ({
        from: context.walletAddress,
        to: (step.params.to as string) || '0x0000000000000000000000000000000000000000',
        value: step.functionName === 'transfer' && !step.params.token ? (step.params.amount as string) : '0', // Native transfer
        data: '0x', // Placeholder - would need ABI encoding
        chainId: step.chainId,
        gas: step.estimatedGas
      }));

      // Handle multi-chain simulation
      // For now, we simulate the primary chain of the plan
      const chainId = plan.steps[0]?.chainId || 1;
      
      const result = await this.simulationEngine.simulateBundle(
        transactions,
        context.walletAddress,
        chainId
      );

      const output: SimulationAgentOutput = {
        success: result.success,
        steps: result.steps.map((s: StepSimulationResult) => ({
            stepId: plan.steps[s.stepIndex]?.id || `step-${s.stepIndex}`,
            success: s.success,
            gasUsed: s.gasUsed,
            logs: s.logs,
            error: s.error
        })),
        totalGasUsed: result.totalGasUsed,
        balanceChanges: [], // Would map from simulation result
        events: [],
        warnings: result.warnings || [],
        errors: result.errors || []
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
   * Execute a plan after approval
   */
  async execute(
    plan: ExecutionPlan,
    _simulation: SimulationAgentOutput,
    _context: AgentContext
  ): Promise<AgentResult<ExecutionAgentOutput>> {
    const startTime = Date.now();
    const executedSteps: ExecutedStep[] = [];
    const failedSteps: FailedStep[] = [];
    const pendingSteps: string[] = [];

    try {
      logger.info({ planId: plan.id }, 'Executing plan');

      for (const step of plan.steps) {
        // Skip if not a transaction step
        if (step.type !== 'transaction' && step.functionName !== 'transfer' && step.functionName !== 'swap') {
          // For non-transaction steps, we might just mark them as executed or handle differently
          continue;
        }

        let retryCount = 0;
        const maxRetries = 3;
        let stepSuccess = false;

        while (retryCount <= maxRetries && !stepSuccess) {
          try {
            // Extract transaction details from params
            const to = (step.params.to as string) || (step.params.router as string) || '0x0000000000000000000000000000000000000000';
            const data = (step.params.data as string) || '0x';
            const value = step.params.value ? BigInt(step.params.value as string) : undefined;
            
            // If it's a transfer and no value specified in params.value, check params.amount
            const finalValue = value || (step.functionName === 'transfer' && !step.params.token ? BigInt(step.params.amount as string) : undefined);

            const result = await this.executionEngine.execute({
              id: step.id,
              chainId: step.chainId || 42220, // Default to Celo
              to: to as `0x${string}`,
              data: data as `0x${string}`,
              value: finalValue,
            });

            if (result.status === 'FAILED') {
              throw new Error(result.error || 'Execution failed');
            }

            // Wait for confirmation to get receipt details
            let gasUsed = '0';
            let blockNumber = 0;
            
            if (result.txHash) {
              try {
                const receipt = await this.executionEngine.waitForConfirmation(result.txHash, step.chainId || 42220);
                gasUsed = receipt.gasUsed.toString();
                blockNumber = Number(receipt.blockNumber);
              } catch (confirmError) {
                logger.warn({ txHash: result.txHash, error: confirmError }, 'Failed to wait for confirmation');
                // We still consider it submitted/executed, but maybe with a warning status?
                // For now, we'll proceed with 0 values but log the warning
              }
            }

            executedSteps.push({
              stepId: step.id,
              status: 'confirmed',
              txHash: result.txHash || '',
              gasUsed,
              blockNumber,
            });
            
            stepSuccess = true;

          } catch (error: any) {
            retryCount++;
            logger.warn({ stepId: step.id, retryCount, error: error.message }, 'Step execution failed, retrying...');
            
            if (retryCount > maxRetries) {
              failedSteps.push({
                stepId: step.id,
                error: error.message,
                retryable: true,
                retryCount: retryCount - 1
              });
              // Stop execution on failure
              break;
            } else {
              // Exponential backoff: 2s, 4s, 8s
              const delay = 2000 * Math.pow(2, retryCount - 1);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (!stepSuccess) break; // Stop plan execution if a step failed after retries
      }

      const success = failedSteps.length === 0;

      return {
        success,
        agentType: 'execution',
        data: {
          status: success ? 'completed' : 'failed',
          executedSteps,
          pendingSteps,
          failedSteps,
          totalGasUsed: '0',
          totalCost: '0'
        },
        processingTimeMs: Date.now() - startTime
      };

    } catch (error: any) {
      return {
        success: false,
        agentType: 'execution',
        error: error.message,
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Monitoring Agent - Monitor transaction status
   */
  async monitor(
    planId: string,
    txHashes: string[],
    _context: AgentContext
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
      case 'claimRewards':
        return `Claim rewards from ${params.protocol}`;
      case 'createStream':
        return `Create stream of ${params.amountPerSec} ${params.token}/sec to ${params.recipient}`;
      case 'deployContract':
        return `Deploy ${params.type} contract`;
      case 'delegate':
        return `Delegate voting power to ${params.votingPowerTo}`;
      case 'executeMulticall':
        return `Execute batch of ${(params.calls as any[])?.length || 0} calls`;
      case 'setAutoRebalance':
        return `Set auto-rebalance with ${(params.conditions as any[])?.length || 0} conditions`;
      case 'setRecurringPayment':
        return `Set recurring payment of ${params.amount} ${params.token} to ${params.recipient} every ${params.frequency}`;
      case 'hedgePosition':
        return `Hedge position with strategy ${params.strategy}`;
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
      deployContract: '2000000',
      setAutoRebalance: '400000',
      setRecurringPayment: '350000',
      hedgePosition: '450000',
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

  private generateBridgeSteps(_intent: ParsedIntent, chains: number[]): any[] {
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
