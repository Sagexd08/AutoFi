import {
    AutomationPolicy,
    PolicyValidationResult,
    PolicyTrigger,
    PolicyAction,
    PolicyCondition,
    TriggerType,
    PolicyActionType,
    PolicyBuilderConfig,
} from './types';

/**
 * PolicyValidator - Validates automation policies for safety and correctness
 */
export class PolicyValidator {
    private config: PolicyBuilderConfig;

    constructor(config: PolicyBuilderConfig) {
        this.config = config;
    }

    /**
     * Validate a complete policy
     */
    validate(policy: Partial<AutomationPolicy>): PolicyValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        const riskFactors: string[] = [];

        // Validate trigger
        if (!policy.trigger) {
            errors.push('Policy must have a trigger');
        } else {
            const triggerResult = this.validateTrigger(policy.trigger);
            errors.push(...triggerResult.errors);
            warnings.push(...triggerResult.warnings);
        }

        // Validate action
        if (!policy.action) {
            errors.push('Policy must have an action');
        } else {
            const actionResult = this.validateAction(policy.action);
            errors.push(...actionResult.errors);
            warnings.push(...actionResult.warnings);
            riskFactors.push(...actionResult.riskFactors);
        }

        // Validate conditions
        if (policy.conditions) {
            for (const condition of policy.conditions) {
                const conditionResult = this.validateCondition(condition);
                errors.push(...conditionResult.errors);
                warnings.push(...conditionResult.warnings);
            }
        }

        // Cross-validation
        if (policy.trigger && policy.action) {
            const crossResult = this.crossValidate(policy.trigger, policy.action, policy.conditions || []);
            errors.push(...crossResult.errors);
            warnings.push(...crossResult.warnings);
            riskFactors.push(...crossResult.riskFactors);
        }

        // Calculate risk level
        const riskLevel = this.calculateRiskLevel(policy, riskFactors);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            riskAssessment: {
                level: riskLevel,
                factors: riskFactors,
            },
        };
    }

    /**
     * Validate trigger configuration
     */
    private validateTrigger(trigger: PolicyTrigger): { errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate trigger type
        if (!Object.values(TriggerType).includes(trigger.type)) {
            errors.push(`Invalid trigger type: ${trigger.type}`);
        }

        // Type-specific validation
        switch (trigger.type) {
            case TriggerType.PRICE_ABOVE:
            case TriggerType.PRICE_BELOW:
                if (!trigger.asset) {
                    errors.push('Price trigger requires an asset');
                } else if (!this.config.supportedAssets.includes(trigger.asset.toUpperCase())) {
                    warnings.push(`Asset ${trigger.asset} may not be supported`);
                }
                if (trigger.threshold === undefined || trigger.threshold <= 0) {
                    errors.push('Price trigger requires a positive threshold');
                }
                // Sanity check for extreme values
                if (trigger.threshold && trigger.asset === 'ETH') {
                    if (trigger.threshold < 100) {
                        warnings.push('ETH price threshold seems very low');
                    }
                    if (trigger.threshold > 100000) {
                        warnings.push('ETH price threshold seems very high');
                    }
                }
                break;

            case TriggerType.GAS_BELOW:
                if (trigger.threshold === undefined || trigger.threshold <= 0) {
                    errors.push('Gas trigger requires a positive threshold');
                }
                if (trigger.threshold && trigger.threshold < 5) {
                    warnings.push('Gas threshold very low - may rarely trigger');
                }
                if (trigger.threshold && trigger.threshold > 500) {
                    warnings.push('Gas threshold very high - will trigger frequently');
                }
                break;

            case TriggerType.TIME_SCHEDULE:
                if (!trigger.schedule) {
                    errors.push('Schedule trigger requires a cron expression');
                } else if (!this.isValidCron(trigger.schedule)) {
                    errors.push('Invalid cron expression');
                }
                break;

            case TriggerType.HEALTH_FACTOR_BELOW:
                if (trigger.threshold === undefined || trigger.threshold <= 1) {
                    warnings.push('Health factor threshold at or below 1 is dangerous');
                }
                break;
        }

        return { errors, warnings };
    }

    /**
     * Validate action configuration
     */
    private validateAction(action: PolicyAction): { errors: string[]; warnings: string[]; riskFactors: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];
        const riskFactors: string[] = [];

        // Validate action type
        if (!Object.values(PolicyActionType).includes(action.type)) {
            errors.push(`Invalid action type: ${action.type}`);
        }

        // Type-specific validation
        switch (action.type) {
            case PolicyActionType.SWAP:
                if (!action.fromAsset) {
                    errors.push('Swap action requires fromAsset');
                }
                if (!action.toAsset) {
                    errors.push('Swap action requires toAsset');
                }
                if (action.fromAsset === action.toAsset) {
                    errors.push('Cannot swap an asset to itself');
                }
                if (action.amount === 'max' || action.amount === '100%') {
                    riskFactors.push('Swapping entire balance');
                    warnings.push('Consider using a percentage less than 100% for safety');
                }
                break;

            case PolicyActionType.TRANSFER:
                if (!action.recipient) {
                    errors.push('Transfer action requires a recipient');
                } else if (!this.isValidAddress(action.recipient) && !action.recipient.endsWith('.eth')) {
                    errors.push('Invalid recipient address');
                }
                if (action.amount === 'max') {
                    riskFactors.push('Transferring entire balance');
                }
                riskFactors.push('Transfers funds to external address');
                break;

            case PolicyActionType.STAKE:
            case PolicyActionType.PROVIDE_LIQUIDITY:
                if (!action.protocol) {
                    warnings.push('No protocol specified - will use default');
                }
                break;

            case PolicyActionType.REBALANCE:
                if (!action.customParams) {
                    warnings.push('Rebalance action needs target allocation');
                }
                break;
        }

        // Amount validation
        if (action.amount) {
            const parsed = this.parseAmount(action.amount);
            if (parsed.percentage && parsed.value > 100) {
                errors.push('Percentage cannot exceed 100%');
            }
        }

        return { errors, warnings, riskFactors };
    }

    /**
     * Validate condition configuration
     */
    private validateCondition(condition: PolicyCondition): { errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!condition.field) {
            errors.push('Condition requires a field');
        }

        if (!condition.operator) {
            errors.push('Condition requires an operator');
        }

        if (condition.value === undefined || condition.value === null) {
            errors.push('Condition requires a value');
        }

        return { errors, warnings };
    }

    /**
     * Cross-validate trigger and action compatibility
     */
    private crossValidate(
        trigger: PolicyTrigger,
        action: PolicyAction,
        conditions: PolicyCondition[]
    ): { errors: string[]; warnings: string[]; riskFactors: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];
        const riskFactors: string[] = [];

        // Check for potential infinite loops
        if (trigger.type === TriggerType.PRICE_BELOW && action.type === PolicyActionType.SWAP) {
            if (action.toAsset === trigger.asset) {
                warnings.push('Swapping TO the trigger asset may cause repeated triggers');
            }
        }

        // High-frequency triggers with high-value actions
        if (trigger.type === TriggerType.TIME_SCHEDULE && trigger.schedule) {
            if (this.isFastSchedule(trigger.schedule)) {
                riskFactors.push('High-frequency schedule');
                if (action.type === PolicyActionType.SWAP || action.type === PolicyActionType.TRANSFER) {
                    warnings.push('High-frequency schedule with value-moving action may be expensive');
                }
            }
        }

        // No gas check for expensive operations
        if ((action.type === PolicyActionType.SWAP || action.type === PolicyActionType.PROVIDE_LIQUIDITY) &&
            !conditions.some(c => c.field === 'gasPrice')) {
            warnings.push('Consider adding a gas price condition to avoid high fees');
        }

        return { errors, warnings, riskFactors };
    }

    /**
     * Calculate overall risk level
     */
    private calculateRiskLevel(
        policy: Partial<AutomationPolicy>,
        riskFactors: string[]
    ): 'low' | 'medium' | 'high' {
        let score = 0;

        // Factor in risk factors
        score += riskFactors.length * 10;

        // Action-based risk
        if (policy.action) {
            if (policy.action.type === PolicyActionType.TRANSFER) score += 30;
            if (policy.action.amount === 'max') score += 20;
            if (policy.action.amount?.includes('%')) {
                const pct = parseFloat(policy.action.amount);
                if (pct > 80) score += 15;
            }
        }

        // Lack of conditions
        if (!policy.conditions || policy.conditions.length === 0) {
            score += 10;
        }

        // Protective conditions
        if (policy.conditions?.some(c => c.field === 'gasPrice')) {
            score -= 10;
        }
        if (policy.conditions?.some(c => c.field === 'slippage')) {
            score -= 10;
        }

        if (score >= 40) return 'high';
        if (score >= 20) return 'medium';
        return 'low';
    }

    /**
     * Check if a cron expression is valid
     */
    private isValidCron(cron: string): boolean {
        const parts = cron.split(' ');
        // Basic check: cron should have 5-6 parts
        return parts.length >= 5 && parts.length <= 6;
    }

    /**
     * Check if an address is valid
     */
    private isValidAddress(address: string): boolean {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    /**
     * Parse amount string
     */
    private parseAmount(amount: string): { value: number; percentage: boolean } {
        const isPercentage = amount.includes('%');
        const value = parseFloat(amount.replace('%', ''));
        return { value, percentage: isPercentage };
    }

    /**
     * Check if schedule is high-frequency
     */
    private isFastSchedule(cron: string): boolean {
        const parts = cron.split(' ');
        // Check minute field for frequent execution
        const minuteField = parts[0];
        if (minuteField === '*' || minuteField.includes('/')) {
            return true;
        }
        // Check hour field
        const hourField = parts[1];
        if (hourField === '*' || hourField.includes('/')) {
            return true;
        }
        return false;
    }
}
