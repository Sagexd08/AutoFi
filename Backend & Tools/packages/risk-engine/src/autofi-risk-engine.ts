import { pino } from 'pino';
import type { RiskLevel } from './types.js';

const logger = pino({ name: 'autofi-risk-engine' });

// ============================================================================
// AUTOFI RISK ENGINE - PRD SPECIFICATION
// ============================================================================

/**
 * Risk Factor Definition
 * Based on PRD Section 5.5: Risk Engine Scoring (0.0 – 1.0)
 */
export interface AutofiRiskFactor {
  id: string;
  name: string;
  description: string;
  baseScore: number;
  weight: number;
  evaluate: (context: AutofiRiskContext) => Promise<RiskFactorResult> | RiskFactorResult;
}

export interface RiskFactorResult {
  triggered: boolean;
  score: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AutofiRiskContext {
  // Transaction details
  transactionValue: bigint;
  tokenAddress?: string;
  toAddress: string;
  fromAddress: string;
  chainId: number;
  
  // Token/protocol info
  isNewToken: boolean; // Token age < 30 days
  tokenAge?: number; // In days
  isFirstInteraction: boolean; // First time interacting with this contract
  
  // Bridge info
  isCrossChain: boolean;
  bridgeProtocol?: string;
  
  // Swap info
  slippageTolerance?: number;
  priceImpact?: number;
  
  // Simulation
  simulationSuccess: boolean;
  simulationError?: string;
  
  // Security
  dustAttackPattern: boolean;
  approvalRemovalMissing: boolean;
  
  // User history
  userTotalTransactions: number;
  userAccountAge: number; // In days
}

export interface AutofiRiskAssessment {
  overallScore: number; // 0.0 - 1.0
  level: RiskLevel;
  requiresApproval: boolean;
  blockExecution: boolean;
  factors: TriggeredFactor[];
  recommendations: string[];
  timestamp: string;
}

export interface TriggeredFactor {
  id: string;
  name: string;
  score: number;
  reason: string;
}

// ============================================================================
// PRD RISK FACTORS
// ============================================================================

/**
 * All risk factors as defined in PRD Section 5.5
 */
export const AUTOFI_RISK_FACTORS: AutofiRiskFactor[] = [
  {
    id: 'large_transfer_50k',
    name: 'Large Transfer (>$50k)',
    description: 'Transfer exceeds $50,000 threshold',
    baseScore: 0.25,
    weight: 1,
    evaluate: (ctx) => {
      // Assuming 1 ETH = ~$2500 for estimation, convert value to USD
      const valueInEth = Number(ctx.transactionValue) / 1e18;
      const estimatedUSD = valueInEth * 2500; // Would use oracle in production
      const triggered = estimatedUSD > 50000;
      return {
        triggered,
        score: triggered ? 0.25 : 0,
        reason: triggered ? `Transfer value estimated at $${estimatedUSD.toLocaleString()}` : undefined,
      };
    },
  },
  {
    id: 'large_transfer_500k',
    name: 'Very Large Transfer (>$500k)',
    description: 'Transfer exceeds $500,000 threshold',
    baseScore: 0.45,
    weight: 1.5,
    evaluate: (ctx) => {
      const valueInEth = Number(ctx.transactionValue) / 1e18;
      const estimatedUSD = valueInEth * 2500;
      const triggered = estimatedUSD > 500000;
      return {
        triggered,
        score: triggered ? 0.45 : 0,
        reason: triggered ? `Transfer value estimated at $${estimatedUSD.toLocaleString()} (critical threshold)` : undefined,
      };
    },
  },
  {
    id: 'first_interaction',
    name: 'First-time Contract Interaction',
    description: 'User has never interacted with this contract before',
    baseScore: 0.20,
    weight: 1,
    evaluate: (ctx) => ({
      triggered: ctx.isFirstInteraction,
      score: ctx.isFirstInteraction ? 0.20 : 0,
      reason: ctx.isFirstInteraction ? 'First time interacting with this contract' : undefined,
    }),
  },
  {
    id: 'cross_chain_bridge',
    name: 'Cross-chain Bridge',
    description: 'Transaction involves cross-chain bridging',
    baseScore: 0.15,
    weight: 1,
    evaluate: (ctx) => ({
      triggered: ctx.isCrossChain,
      score: ctx.isCrossChain ? 0.15 : 0,
      reason: ctx.isCrossChain ? `Cross-chain bridge via ${ctx.bridgeProtocol || 'unknown'}` : undefined,
    }),
  },
  {
    id: 'high_slippage',
    name: 'High Slippage (>3%)',
    description: 'Slippage tolerance exceeds 3%',
    baseScore: 0.18,
    weight: 1,
    evaluate: (ctx) => {
      const triggered = (ctx.slippageTolerance || 0) > 3;
      return {
        triggered,
        score: triggered ? 0.18 : 0,
        reason: triggered ? `Slippage tolerance is ${ctx.slippageTolerance}%` : undefined,
      };
    },
  },
  {
    id: 'new_token',
    name: 'New Token (<30 days)',
    description: 'Token was created less than 30 days ago',
    baseScore: 0.30,
    weight: 1.2,
    evaluate: (ctx) => ({
      triggered: ctx.isNewToken,
      score: ctx.isNewToken ? 0.30 : 0,
      reason: ctx.isNewToken ? `Token is only ${ctx.tokenAge || 'unknown'} days old` : undefined,
    }),
  },
  {
    id: 'approval_removal_missing',
    name: 'Revoked Approvals Missing',
    description: 'Unnecessary token approvals not revoked',
    baseScore: 0.22,
    weight: 1,
    evaluate: (ctx) => ({
      triggered: ctx.approvalRemovalMissing,
      score: ctx.approvalRemovalMissing ? 0.22 : 0,
      reason: ctx.approvalRemovalMissing ? 'Token approvals should be revoked after use' : undefined,
    }),
  },
  {
    id: 'simulation_failed',
    name: 'Simulation Failed',
    description: 'Transaction simulation did not succeed',
    baseScore: 0.80,
    weight: 2,
    evaluate: (ctx) => ({
      triggered: !ctx.simulationSuccess,
      score: !ctx.simulationSuccess ? 0.80 : 0,
      reason: !ctx.simulationSuccess ? `Simulation failed: ${ctx.simulationError || 'unknown error'}` : undefined,
    }),
  },
  {
    id: 'dust_attack',
    name: 'Dust Attack Pattern',
    description: 'Transaction pattern matches known dust attacks',
    baseScore: 0.90,
    weight: 2.5,
    evaluate: (ctx) => ({
      triggered: ctx.dustAttackPattern,
      score: ctx.dustAttackPattern ? 0.90 : 0,
      reason: ctx.dustAttackPattern ? 'Transaction matches dust attack pattern' : undefined,
    }),
  },
];

// ============================================================================
// THRESHOLDS (from PRD)
// ============================================================================

export const RISK_THRESHOLDS = {
  autoExecute: 0.35,      // < 0.35 → Auto-execute
  notify: 0.35,           // 0.35–0.65 → Notify + optional approval
  requireApproval: 0.65,  // > 0.65 → Mandatory human approval + 2FA
};

// ============================================================================
// AUTOFI RISK ENGINE
// ============================================================================

export class AutofiRiskEngine {
  private factors: AutofiRiskFactor[];
  private thresholds: typeof RISK_THRESHOLDS;

  constructor(
    customFactors?: AutofiRiskFactor[],
    customThresholds?: Partial<typeof RISK_THRESHOLDS>
  ) {
    this.factors = customFactors || AUTOFI_RISK_FACTORS;
    this.thresholds = { ...RISK_THRESHOLDS, ...customThresholds };
  }

  /**
   * Assess risk of a transaction context
   */
  async assessRisk(context: AutofiRiskContext): Promise<AutofiRiskAssessment> {
    const triggeredFactors: TriggeredFactor[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    logger.info({ context: { toAddress: context.toAddress, chainId: context.chainId } }, 'Assessing risk');

    // Evaluate all risk factors
    for (const factor of this.factors) {
      try {
        const result = await factor.evaluate(context);
        
        if (result.triggered) {
          triggeredFactors.push({
            id: factor.id,
            name: factor.name,
            score: result.score,
            reason: result.reason || factor.description,
          });
          
          totalScore += result.score * factor.weight;
          totalWeight += factor.weight;
        }
      } catch (error) {
        logger.error({ factorId: factor.id, error }, 'Risk factor evaluation failed');
      }
    }

    // Normalize score to 0-1 range
    const normalizedScore = totalWeight > 0 ? Math.min(totalScore / Math.max(totalWeight, 1), 1) : 0;

    // Determine risk level
    let level: RiskLevel;
    if (normalizedScore >= 0.85) level = 'critical';
    else if (normalizedScore >= 0.65) level = 'high';
    else if (normalizedScore >= 0.35) level = 'medium';
    else level = 'low';

    // Determine action requirements
    const requiresApproval = normalizedScore >= this.thresholds.notify;
    const blockExecution = normalizedScore >= this.thresholds.requireApproval;

    // Generate recommendations
    const recommendations = this.generateRecommendations(triggeredFactors, normalizedScore);

    const assessment: AutofiRiskAssessment = {
      overallScore: normalizedScore,
      level,
      requiresApproval,
      blockExecution,
      factors: triggeredFactors,
      recommendations,
      timestamp: new Date().toISOString(),
    };

    logger.info({ 
      score: normalizedScore, 
      level, 
      factorCount: triggeredFactors.length,
      requiresApproval,
      blockExecution,
    }, 'Risk assessment complete');

    return assessment;
  }

  /**
   * Quick risk check for simple transactions
   */
  quickCheck(context: Partial<AutofiRiskContext>): {
    estimatedRisk: 'low' | 'medium' | 'high';
    shouldSimulate: boolean;
  } {
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let shouldSimulate = false;

    if (context.isCrossChain) {
      riskLevel = 'medium';
      shouldSimulate = true;
    }

    if (context.isFirstInteraction) {
      riskLevel = 'medium';
      shouldSimulate = true;
    }

    if (context.isNewToken) {
      riskLevel = 'high';
      shouldSimulate = true;
    }

    if (context.transactionValue && context.transactionValue > BigInt(50000 * 1e18 / 2500)) {
      riskLevel = 'high';
      shouldSimulate = true;
    }

    return { estimatedRisk: riskLevel, shouldSimulate };
  }

  /**
   * Add a custom risk factor
   */
  addFactor(factor: AutofiRiskFactor): void {
    const existing = this.factors.findIndex(f => f.id === factor.id);
    if (existing >= 0) {
      this.factors[existing] = factor;
    } else {
      this.factors.push(factor);
    }
  }

  /**
   * Remove a risk factor
   */
  removeFactor(factorId: string): void {
    this.factors = this.factors.filter(f => f.id !== factorId);
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<typeof RISK_THRESHOLDS>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Generate human-readable recommendations
   */
  private generateRecommendations(factors: TriggeredFactor[], score: number): string[] {
    const recommendations: string[] = [];

    // General recommendations based on score
    if (score >= 0.85) {
      recommendations.push('🚫 CRITICAL: Transaction blocked. Manual review required by security team.');
      recommendations.push('Consider breaking this into smaller transactions.');
    } else if (score >= 0.65) {
      recommendations.push('⚠️ HIGH RISK: Manual approval with 2FA verification required.');
    } else if (score >= 0.35) {
      recommendations.push('📋 Review the transaction details before proceeding.');
    }

    // Factor-specific recommendations
    for (const factor of factors) {
      switch (factor.id) {
        case 'large_transfer_500k':
          recommendations.push('Consider using a multi-sig wallet for transfers of this size.');
          recommendations.push('Verify the recipient address through multiple channels.');
          break;
        case 'large_transfer_50k':
          recommendations.push('Double-check the recipient address.');
          break;
        case 'first_interaction':
          recommendations.push('Verify this contract on a block explorer before proceeding.');
          break;
        case 'cross_chain_bridge':
          recommendations.push('Cross-chain transactions may take longer and have additional risks.');
          recommendations.push('Verify bridge liquidity before proceeding.');
          break;
        case 'high_slippage':
          recommendations.push('Consider reducing slippage tolerance or splitting into smaller trades.');
          break;
        case 'new_token':
          recommendations.push('New tokens carry higher risk. Verify the token contract thoroughly.');
          recommendations.push('Check for common scam patterns (honeypot, high tax, etc.).');
          break;
        case 'simulation_failed':
          recommendations.push('DO NOT proceed until simulation passes.');
          recommendations.push('Check contract conditions and your wallet balance.');
          break;
        case 'dust_attack':
          recommendations.push('🚨 Potential scam detected. Do not interact with unknown tokens.');
          break;
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }
}

/**
 * Create Autofi Risk Engine with default configuration
 */
export function createAutofiRiskEngine(
  customFactors?: AutofiRiskFactor[],
  customThresholds?: Partial<typeof RISK_THRESHOLDS>
): AutofiRiskEngine {
  return new AutofiRiskEngine(customFactors, customThresholds);
}
