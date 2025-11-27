/**
 * @autofi/nlp-policy-builder
 * 
 * Natural language automation policy builder for Autofi
 * 
 * Features:
 * - Parse natural language into structured automation policies
 * - Custom LSTM-based understanding with rule patterns
 * - Rule-based fallback for reliability
 * - Policy validation and risk assessment
 * - Policy execution engine
 */

import { randomUUID } from 'crypto';
import {
    AutomationPolicy,
    PolicyParseResult,
    PolicyValidationResult,
    PolicyExecutionResult,
    PolicyBuilderConfig,
    PolicyBuilderConfigSchema,
} from './types';
import { NLPParser } from './nlp-parser';
import { PolicyValidator } from './policy-validator';
import { PolicyExecutor, MarketDataProvider, WalletDataProvider } from './policy-executor';

export class PolicyBuilder {
    private config: PolicyBuilderConfig;
    private parser: NLPParser;
    private validator: PolicyValidator;
    private executor: PolicyExecutor;
    private policies: Map<string, AutomationPolicy>;
    private userPolicies: Map<string, string[]>; // userId -> policyIds

    constructor(config?: Partial<PolicyBuilderConfig>) {
        this.config = PolicyBuilderConfigSchema.parse(config || {});
        this.parser = new NLPParser(this.config);
        this.validator = new PolicyValidator(this.config);
        this.executor = new PolicyExecutor(this.config);
        this.policies = new Map();
        this.userPolicies = new Map();
    }

    /**
     * Parse natural language into a policy
     */
    async parsePolicy(text: string): Promise<PolicyParseResult> {
        return this.parser.parse(text);
    }

    /**
     * Create a policy from natural language
     */
    async createFromNaturalLanguage(
        userId: string,
        text: string
    ): Promise<{ success: boolean; policy?: AutomationPolicy; error?: string; validation?: PolicyValidationResult }> {
        // Parse the text
        const parseResult = await this.parser.parse(text);
        
        if (!parseResult.success || !parseResult.policy) {
            return {
                success: false,
                error: parseResult.error || 'Failed to parse policy',
            };
        }

        // Validate the policy
        const validation = this.validator.validate(parseResult.policy);
        
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join('; '),
                validation,
            };
        }

        // Create the full policy
        const policy: AutomationPolicy = {
            ...parseResult.policy,
            id: randomUUID(),
            userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            executionCount: 0,
        };

        // Store the policy
        this.policies.set(policy.id, policy);
        
        if (!this.userPolicies.has(userId)) {
            this.userPolicies.set(userId, []);
        }
        this.userPolicies.get(userId)!.push(policy.id);

        return {
            success: true,
            policy,
            validation,
        };
    }

    /**
     * Validate a policy
     */
    validatePolicy(policy: Partial<AutomationPolicy>): PolicyValidationResult {
        return this.validator.validate(policy);
    }

    /**
     * Get a policy by ID
     */
    getPolicy(policyId: string): AutomationPolicy | undefined {
        return this.policies.get(policyId);
    }

    /**
     * Get all policies for a user
     */
    getUserPolicies(userId: string): AutomationPolicy[] {
        const policyIds = this.userPolicies.get(userId) || [];
        return policyIds
            .map(id => this.policies.get(id))
            .filter((p): p is AutomationPolicy => p !== undefined);
    }

    /**
     * Update a policy
     */
    updatePolicy(policyId: string, updates: Partial<AutomationPolicy>): AutomationPolicy | null {
        const policy = this.policies.get(policyId);
        if (!policy) return null;

        const updated: AutomationPolicy = {
            ...policy,
            ...updates,
            id: policy.id, // Preserve ID
            userId: policy.userId, // Preserve user
            createdAt: policy.createdAt, // Preserve creation time
            updatedAt: Date.now(),
        };

        this.policies.set(policyId, updated);
        return updated;
    }

    /**
     * Delete a policy
     */
    deletePolicy(policyId: string): boolean {
        const policy = this.policies.get(policyId);
        if (!policy) return false;

        this.policies.delete(policyId);
        
        const userPolicies = this.userPolicies.get(policy.userId);
        if (userPolicies) {
            const index = userPolicies.indexOf(policyId);
            if (index !== -1) {
                userPolicies.splice(index, 1);
            }
        }

        return true;
    }

    /**
     * Enable/disable a policy
     */
    setEnabled(policyId: string, enabled: boolean): boolean {
        const policy = this.policies.get(policyId);
        if (!policy) return false;

        policy.enabled = enabled;
        policy.updatedAt = Date.now();
        return true;
    }

    /**
     * Check if a policy should trigger
     */
    async shouldTrigger(policyId: string): Promise<{ should: boolean; reason?: string }> {
        const policy = this.policies.get(policyId);
        if (!policy) {
            return { should: false, reason: 'Policy not found' };
        }

        return this.executor.shouldTrigger(policy);
    }

    /**
     * Execute a policy
     */
    async executePolicy(policyId: string): Promise<PolicyExecutionResult> {
        const policy = this.policies.get(policyId);
        if (!policy) {
            return {
                policyId,
                success: false,
                timestamp: Date.now(),
                error: 'Policy not found',
            };
        }

        const result = await this.executor.execute(policy);

        // Update execution count and last execution time
        if (result.success) {
            policy.executionCount++;
            policy.lastExecutedAt = Date.now();
            policy.updatedAt = Date.now();
        }

        return result;
    }

    /**
     * Check all policies for a user and return those that should trigger
     */
    async checkUserPolicies(userId: string): Promise<{ policy: AutomationPolicy; reason: string }[]> {
        const policies = this.getUserPolicies(userId);
        const triggerable: { policy: AutomationPolicy; reason: string }[] = [];

        for (const policy of policies) {
            const result = await this.executor.shouldTrigger(policy);
            if (result.should) {
                triggerable.push({ policy, reason: result.reason || 'Trigger condition met' });
            }
        }

        return triggerable;
    }

    /**
     * Get policy statistics for a user
     */
    getUserStats(userId: string): {
        totalPolicies: number;
        activePolicies: number;
        totalExecutions: number;
        byRiskLevel: Record<string, number>;
    } {
        const policies = this.getUserPolicies(userId);
        
        return {
            totalPolicies: policies.length,
            activePolicies: policies.filter(p => p.enabled).length,
            totalExecutions: policies.reduce((sum, p) => sum + p.executionCount, 0),
            byRiskLevel: {
                low: policies.filter(p => p.riskLevel === 'low').length,
                medium: policies.filter(p => p.riskLevel === 'medium').length,
                high: policies.filter(p => p.riskLevel === 'high').length,
            },
        };
    }

    /**
     * Set custom data providers for execution
     */
    setDataProviders(
        marketData?: MarketDataProvider,
        walletData?: WalletDataProvider
    ): void {
        this.executor = new PolicyExecutor(this.config, marketData, walletData);
    }

    /**
     * Export policies to JSON
     */
    exportPolicies(userId: string): string {
        const policies = this.getUserPolicies(userId);
        return JSON.stringify(policies, null, 2);
    }

    /**
     * Import policies from JSON
     */
    importPolicies(userId: string, json: string): { imported: number; errors: string[] } {
        const errors: string[] = [];
        let imported = 0;

        try {
            const policies = JSON.parse(json) as AutomationPolicy[];
            
            for (const policy of policies) {
                const validation = this.validator.validate(policy);
                
                if (validation.valid) {
                    const newPolicy: AutomationPolicy = {
                        ...policy,
                        id: randomUUID(),
                        userId,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        executionCount: 0,
                        lastExecutedAt: undefined,
                    };
                    
                    this.policies.set(newPolicy.id, newPolicy);
                    
                    if (!this.userPolicies.has(userId)) {
                        this.userPolicies.set(userId, []);
                    }
                    this.userPolicies.get(userId)!.push(newPolicy.id);
                    
                    imported++;
                } else {
                    errors.push(`Policy "${policy.name}": ${validation.errors.join(', ')}`);
                }
            }
        } catch (error) {
            errors.push(`Failed to parse JSON: ${error}`);
        }

        return { imported, errors };
    }
}

// Export all types and classes
export type {
    AutomationPolicy,
    PolicyParseResult,
    PolicyValidationResult,
    PolicyExecutionResult,
    PolicyBuilderConfig,
    PolicyTrigger,
    PolicyAction,
    PolicyCondition,
    TriggerType,
    PolicyActionType,
    ComparisonOperator,
    ExamplePolicy,
} from './types';
export { PolicyBuilderConfigSchema } from './types';
export { NLPParser } from './nlp-parser';
export { PolicyValidator } from './policy-validator';
export { PolicyExecutor } from './policy-executor';
export type { MarketDataProvider, WalletDataProvider } from './policy-executor';
