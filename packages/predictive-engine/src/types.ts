import { z } from 'zod';

/**
 * Supported action types that the engine can predict
 */
export enum ActionType {
    SWAP = 'swap',
    STAKE = 'stake',
    UNSTAKE = 'unstake',
    CLAIM_REWARDS = 'claim_rewards',
    PROVIDE_LIQUIDITY = 'provide_liquidity',
    REMOVE_LIQUIDITY = 'remove_liquidity',
    BRIDGE = 'bridge',
    APPROVE = 'approve',
    TRANSFER = 'transfer',
    COMPOUND = 'compound',
    REBALANCE = 'rebalance',
}

/**
 * Time patterns for user behavior
 */
export enum TimePattern {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    BI_WEEKLY = 'bi_weekly',
    MONTHLY = 'monthly',
    IRREGULAR = 'irregular',
}

/**
 * User action record for training/inference
 */
export interface UserAction {
    userId: string;
    timestamp: number;
    actionType: ActionType;
    chainId: number;
    contractAddress: string;
    tokenIn?: string;
    tokenOut?: string;
    amountUsd?: number;
    gasPrice?: number;
    dayOfWeek: number; // 0-6
    hourOfDay: number; // 0-23
    marketCondition?: MarketCondition;
}

/**
 * Market condition at time of action
 */
export interface MarketCondition {
    ethPrice: number;
    gasPrice: number; // in gwei
    volatilityIndex: number; // 0-100
    marketTrend: 'bullish' | 'bearish' | 'neutral';
}

/**
 * Predicted intent result
 */
export interface PredictedIntent {
    actionType: ActionType;
    confidence: number; // 0-1
    reasoning: string;
    suggestedParameters?: {
        tokenIn?: string;
        tokenOut?: string;
        amount?: string;
        protocol?: string;
    };
    optimalTimeWindow?: {
        start: number;
        end: number;
        reason: string;
    };
    estimatedSavings?: {
        gasUsd: number;
        slippageUsd: number;
    };
}

/**
 * User behavior pattern
 */
export interface BehaviorPattern {
    userId: string;
    actionType: ActionType;
    frequency: TimePattern;
    avgIntervalMs: number;
    preferredTimeSlots: number[]; // Hours of day
    preferredDays: number[]; // Days of week
    avgGasPrice: number;
    avgAmountUsd: number;
    successRate: number;
    lastOccurrence: number;
    occurrenceCount: number;
}

/**
 * Model training data point
 */
export interface TrainingDataPoint {
    features: number[];
    label: number; // ActionType index
}

/**
 * Prediction engine configuration
 */
export const PredictiveEngineConfigSchema = z.object({
    minHistoryLength: z.number().default(10),
    confidenceThreshold: z.number().default(0.6),
    maxPredictions: z.number().default(5),
    enableOnlineTraining: z.boolean().default(true),
    modelPath: z.string().optional(),
    cachePredictions: z.boolean().default(true),
    cacheDuration: z.number().default(300), // 5 minutes
});

export type PredictiveEngineConfig = z.infer<typeof PredictiveEngineConfigSchema>;

/**
 * Model metadata
 */
export interface ModelMetadata {
    version: string;
    trainedAt: number;
    dataPoints: number;
    accuracy: number;
    actionTypes: ActionType[];
}
