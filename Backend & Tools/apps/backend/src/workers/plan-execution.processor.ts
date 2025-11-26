import { Job } from 'bullmq';
import { PlanJobData, PlanJobResult } from '@autofi/queue';
import { getOrchestrator } from '../utils/orchestrator.js';
import { logger } from '../utils/logger.js';

export class PlanExecutionProcessor {
  async process(job: Job<PlanJobData>): Promise<PlanJobResult> {
    const { planId, plan, userId } = job.data;
    
    logger.info({ planId }, 'Processing plan execution');
    const startTime = Date.now();

    try {
      const orchestrator = getOrchestrator();
      
      // Mock context for now
      const context = {
        userId: userId || 'unknown',
        walletAddress: '0x0000000000000000000000000000000000000000', // Should be fetched from user
        sessionId: 'worker-' + job.id
      };

      // Execute the plan
      // We pass empty simulation output as it's likely already simulated or not needed for execution if plan is approved
      const result = await orchestrator.execute(plan, {} as any, context as any);

      return {
        success: result.success,
        executionId: planId,
        transactionHashes: result.data?.executedSteps.map(s => s.txHash || '') || [],
        stepsCompleted: result.data?.executedSteps.length || 0,
        stepsFailed: result.data?.failedSteps.length || 0,
        duration: Date.now() - startTime,
        message: result.success ? 'Plan executed successfully' : result.error
      };

    } catch (error: any) {
      logger.error({ planId, error }, 'Plan execution failed');
      throw error;
    }
  }
}

export const planExecutionProcessor = new PlanExecutionProcessor();
