import {
    AutomationPolicy,
    PolicyExecutionResult,
    PolicyTrigger,
    PolicyAction,
    PolicyCondition,
    TriggerType,
    ComparisonOperator,
    PolicyBuilderConfig,
} from './types';

/**
 * External data providers for policy evaluation
 */
export interface MarketDataProvider {
    getPrice(asset: string): Promise<number>;
    getGasPrice(): Promise<number>;
}

export interface WalletDataProvider {
    getBalance(asset: string): Promise<number>;
    getHealthFactor(protocol: string): Promise<number>;
}

/**
 * PolicyExecutor - Evaluates and executes automation policies
 */
export class PolicyExecutor {
    private marketData: MarketDataProvider;
    private walletData: WalletDataProvider;

    constructor(
        _config: PolicyBuilderConfig,
        marketData?: MarketDataProvider,
        walletData?: WalletDataProvider
    ) {
        this.marketData = marketData || this.createMockMarketProvider();
        this.walletData = walletData || this.createMockWalletProvider();
    }

    /**
     * Check if a policy should trigger
     */
    async shouldTrigger(policy: AutomationPolicy): Promise<{ should: boolean; reason?: string }> {
        // Check if enabled
        if (!policy.enabled) {
            return { should: false, reason: 'Policy is disabled' };
        }

        // Check cooldown
        if (policy.lastExecutedAt && policy.cooldown) {
            const timeSinceExecution = Date.now() - policy.lastExecutedAt;
            if (timeSinceExecution < policy.cooldown * 1000) {
                return { 
                    should: false, 
                    reason: `Cooldown active (${Math.ceil((policy.cooldown * 1000 - timeSinceExecution) / 1000)}s remaining)` 
                };
            }
        }

        // Check max executions
        if (policy.maxExecutions && policy.executionCount >= policy.maxExecutions) {
            return { should: false, reason: 'Maximum executions reached' };
        }

        // Evaluate trigger
        const triggerResult = await this.evaluateTrigger(policy.trigger);
        if (!triggerResult.triggered) {
            return { should: false, reason: triggerResult.reason };
        }

        // Evaluate conditions
        for (const condition of policy.conditions) {
            const conditionResult = await this.evaluateCondition(condition);
            if (!conditionResult.met) {
                return { should: false, reason: `Condition not met: ${conditionResult.reason}` };
            }
        }

        return { should: true };
    }

    /**
     * Evaluate a trigger condition
     */
    private async evaluateTrigger(trigger: PolicyTrigger): Promise<{ triggered: boolean; reason: string }> {
        switch (trigger.type) {
            case TriggerType.PRICE_BELOW:
                const priceBelowCurrent = await this.marketData.getPrice(trigger.asset!);
                if (priceBelowCurrent < trigger.threshold!) {
                    return { triggered: true, reason: `${trigger.asset} price (${priceBelowCurrent}) is below ${trigger.threshold}` };
                }
                return { triggered: false, reason: `${trigger.asset} price (${priceBelowCurrent}) is above ${trigger.threshold}` };

            case TriggerType.PRICE_ABOVE:
                const priceAboveCurrent = await this.marketData.getPrice(trigger.asset!);
                if (priceAboveCurrent > trigger.threshold!) {
                    return { triggered: true, reason: `${trigger.asset} price (${priceAboveCurrent}) is above ${trigger.threshold}` };
                }
                return { triggered: false, reason: `${trigger.asset} price (${priceAboveCurrent}) is below ${trigger.threshold}` };

            case TriggerType.GAS_BELOW:
                const gasPrice = await this.marketData.getGasPrice();
                if (gasPrice < trigger.threshold!) {
                    return { triggered: true, reason: `Gas price (${gasPrice}) is below ${trigger.threshold}` };
                }
                return { triggered: false, reason: `Gas price (${gasPrice}) is above ${trigger.threshold}` };

            case TriggerType.TIME_SCHEDULE:
                // Schedule evaluation would typically be handled by a cron scheduler
                // Here we just return true for demo
                return { triggered: true, reason: 'Scheduled execution' };

            case TriggerType.BALANCE_ABOVE:
                const balance = await this.walletData.getBalance(trigger.asset!);
                if (balance > trigger.threshold!) {
                    return { triggered: true, reason: `${trigger.asset} balance (${balance}) is above ${trigger.threshold}` };
                }
                return { triggered: false, reason: `${trigger.asset} balance (${balance}) is below ${trigger.threshold}` };

            case TriggerType.HEALTH_FACTOR_BELOW:
                const healthFactor = await this.walletData.getHealthFactor(trigger.protocol || 'aave');
                if (healthFactor < trigger.threshold!) {
                    return { triggered: true, reason: `Health factor (${healthFactor}) is below ${trigger.threshold}` };
                }
                return { triggered: false, reason: `Health factor (${healthFactor}) is above ${trigger.threshold}` };

            default:
                return { triggered: false, reason: 'Unknown trigger type' };
        }
    }

    /**
     * Evaluate a condition
     */
    private async evaluateCondition(condition: PolicyCondition): Promise<{ met: boolean; reason: string }> {
        let currentValue: any;

        // Get current value based on field
        switch (condition.field) {
            case 'gasPrice':
                currentValue = await this.marketData.getGasPrice();
                break;
            case 'isWeekend':
                const day = new Date().getDay();
                currentValue = day === 0 || day === 6;
                break;
            case 'hour':
                currentValue = new Date().getHours();
                break;
            default:
                currentValue = null;
        }

        if (currentValue === null) {
            return { met: true, reason: 'Could not evaluate condition (assuming true)' };
        }

        // Compare values
        const result = this.compare(currentValue, condition.operator, condition.value);
        return {
            met: result,
            reason: result
                ? `${condition.field} (${currentValue}) ${condition.operator} ${condition.value}`
                : `${condition.field} (${currentValue}) does not satisfy ${condition.operator} ${condition.value}`,
        };
    }

    /**
     * Compare values using operator
     */
    private compare(actual: any, operator: ComparisonOperator, expected: any): boolean {
        switch (operator) {
            case ComparisonOperator.EQUALS:
                return actual === expected;
            case ComparisonOperator.NOT_EQUALS:
                return actual !== expected;
            case ComparisonOperator.GREATER_THAN:
                return actual > expected;
            case ComparisonOperator.LESS_THAN:
                return actual < expected;
            case ComparisonOperator.GREATER_OR_EQUAL:
                return actual >= expected;
            case ComparisonOperator.LESS_OR_EQUAL:
                return actual <= expected;
            case ComparisonOperator.CONTAINS:
                return String(actual).includes(String(expected));
            case ComparisonOperator.NOT_CONTAINS:
                return !String(actual).includes(String(expected));
            default:
                return false;
        }
    }

    /**
     * Execute a policy action (simulation only - actual execution would integrate with wallet)
     */
    async execute(policy: AutomationPolicy): Promise<PolicyExecutionResult> {
        const timestamp = Date.now();

        // Check if should trigger
        const triggerCheck = await this.shouldTrigger(policy);
        if (!triggerCheck.should) {
            return {
                policyId: policy.id,
                success: false,
                timestamp,
                error: triggerCheck.reason,
            };
        }

        // Execute action (mock for now - would integrate with actual execution engine)
        const result = await this.executeAction(policy.action, policy.id);

        return {
            policyId: policy.id,
            success: result.success,
            timestamp,
            transactionHash: result.transactionHash,
            gasUsed: result.gasUsed,
            error: result.error,
            details: result.details,
        };
    }

    /**
     * Execute a specific action
     */
    private async executeAction(
        action: PolicyAction,
        _policyId: string
    ): Promise<{ success: boolean; transactionHash?: string; gasUsed?: string; error?: string; details?: any }> {
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            success: true,
            transactionHash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
            gasUsed: '150000',
            details: {
                action: action.type,
                fromAsset: action.fromAsset,
                toAsset: action.toAsset,
                amount: action.amount,
            },
        };
    }

    /**
     * Create mock market data provider
     */
    private createMockMarketProvider(): MarketDataProvider {
        return {
            getPrice: async (asset: string) => {
                const prices: Record<string, number> = {
                    ETH: 2500,
                    BTC: 42000,
                    USDC: 1,
                    USDT: 1,
                    DAI: 1,
                    LINK: 15,
                    UNI: 6,
                    AAVE: 90,
                };
                return prices[asset.toUpperCase()] || 1;
            },
            getGasPrice: async () => {
                return 25 + Math.random() * 50; // 25-75 gwei
            },
        };
    }

    /**
     * Create mock wallet data provider
     */
    private createMockWalletProvider(): WalletDataProvider {
        return {
            getBalance: async (_asset: string) => {
                return 1000 + Math.random() * 9000;
            },
            getHealthFactor: async (_protocol: string) => {
                return 1.5 + Math.random() * 2;
            },
        };
    }
}
