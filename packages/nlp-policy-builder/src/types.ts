import { z } from 'zod';

/**
 * Trigger types for automation policies
 */
export enum TriggerType {
    PRICE_ABOVE = 'price_above',
    PRICE_BELOW = 'price_below',
    PRICE_CHANGE_PERCENT = 'price_change_percent',
    GAS_BELOW = 'gas_below',
    TIME_SCHEDULE = 'time_schedule',
    BALANCE_ABOVE = 'balance_above',
    BALANCE_BELOW = 'balance_below',
    APY_CHANGE = 'apy_change',
    HEALTH_FACTOR_BELOW = 'health_factor_below',
    YIELD_THRESHOLD = 'yield_threshold',
    CUSTOM = 'custom',
}

/**
 * Action types for automation policies
 */
export enum PolicyActionType {
    SWAP = 'swap',
    STAKE = 'stake',
    UNSTAKE = 'unstake',
    CLAIM = 'claim',
    COMPOUND = 'compound',
    TRANSFER = 'transfer',
    PROVIDE_LIQUIDITY = 'provide_liquidity',
    REMOVE_LIQUIDITY = 'remove_liquidity',
    REBALANCE = 'rebalance',
    BRIDGE = 'bridge',
    NOTIFY = 'notify',
    CUSTOM = 'custom',
}

/**
 * Comparison operators for conditions
 */
export enum ComparisonOperator {
    EQUALS = 'equals',
    NOT_EQUALS = 'not_equals',
    GREATER_THAN = 'greater_than',
    LESS_THAN = 'less_than',
    GREATER_OR_EQUAL = 'greater_or_equal',
    LESS_OR_EQUAL = 'less_or_equal',
    CONTAINS = 'contains',
    NOT_CONTAINS = 'not_contains',
}

/**
 * Trigger definition
 */
export interface PolicyTrigger {
    type: TriggerType;
    asset?: string;
    threshold?: number;
    direction?: 'above' | 'below';
    schedule?: string; // cron expression
    percentage?: number;
    protocol?: string;
    customExpression?: string;
}

/**
 * Action definition
 */
export interface PolicyAction {
    type: PolicyActionType;
    fromAsset?: string;
    toAsset?: string;
    amount?: string; // Can be number, percentage "50%", or "max"
    protocol?: string;
    recipient?: string;
    chain?: string;
    customParams?: Record<string, any>;
}

/**
 * Condition definition
 */
export interface PolicyCondition {
    field: string;
    operator: ComparisonOperator;
    value: any;
    description?: string;
}

/**
 * Full automation policy
 */
export interface AutomationPolicy {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    userId: string;
    createdAt: number;
    updatedAt: number;
    trigger: PolicyTrigger;
    action: PolicyAction;
    conditions: PolicyCondition[];
    cooldown?: number; // Minimum time between executions in seconds
    maxExecutions?: number; // Maximum number of times to execute
    executionCount: number;
    lastExecutedAt?: number;
    priority: number; // Higher = more important
    riskLevel: 'low' | 'medium' | 'high';
    originalText?: string; // Original natural language input
}

/**
 * Parse result from NLP
 */
export interface PolicyParseResult {
    success: boolean;
    policy?: Omit<AutomationPolicy, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'executionCount'>;
    error?: string;
    confidence: number;
    suggestions?: string[];
    clarificationNeeded?: string[];
}

/**
 * Validation result
 */
export interface PolicyValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    riskAssessment: {
        level: 'low' | 'medium' | 'high';
        factors: string[];
    };
}

/**
 * Policy execution result
 */
export interface PolicyExecutionResult {
    policyId: string;
    success: boolean;
    timestamp: number;
    transactionHash?: string;
    gasUsed?: string;
    error?: string;
    details?: Record<string, any>;
}

/**
 * Configuration for policy builder
 * Uses custom LSTM-based NLP parsing instead of external LLM providers
 */
export const PolicyBuilderConfigSchema = z.object({
    lstmUnits: z.number().default(64), // LSTM hidden units for intent classification
    embeddingDimensions: z.number().default(128), // Token embedding dimensions
    maxPoliciesPerUser: z.number().default(50),
    defaultCooldown: z.number().default(3600), // 1 hour
    supportedAssets: z.array(z.string()).default([
        'ETH', 'USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'UNI', 'LINK', 'AAVE', 'CRV'
    ]),
    supportedProtocols: z.array(z.string()).default([
        'uniswap', 'aave', 'compound', 'curve', 'lido', 'yearn'
    ]),
    confidenceThreshold: z.number().default(0.6), // Minimum confidence for auto-parsing
});

export type PolicyBuilderConfig = z.infer<typeof PolicyBuilderConfigSchema>;

/**
 * Example policies for few-shot learning
 */
export interface ExamplePolicy {
    input: string;
    output: AutomationPolicy;
}
