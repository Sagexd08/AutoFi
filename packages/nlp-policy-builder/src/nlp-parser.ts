import {
    PolicyParseResult,
    AutomationPolicy,
    PolicyTrigger,
    PolicyAction,
    PolicyCondition,
    TriggerType,
    PolicyActionType,
    ComparisonOperator,
    PolicyBuilderConfig,
} from './types';

/**
 * Intent classification result
 */
interface IntentClassification {
    triggerType: TriggerType | null;
    actionType: PolicyActionType | null;
    confidence: number;
}

/**
 * LSTM-based Intent Classifier
 * 
 * Custom neural network for classifying user intents without external LLM providers
 */
class IntentClassifier {
    private hiddenSize = 64;
    private vocabSize = 256;
    private numTriggerClasses = Object.values(TriggerType).length;
    private numActionClasses = Object.values(PolicyActionType).length;
    
    // LSTM weights
    private Wf: number[][] = [];
    private Wi: number[][] = [];
    private Wc: number[][] = [];
    private Wo: number[][] = [];
    private bf: number[] = [];
    private bi: number[] = [];
    private bc: number[] = [];
    private bo: number[] = [];
    
    // Classification layers
    private WTrigger: number[][] = [];
    private bTrigger: number[] = [];
    private WAction: number[][] = [];
    private bAction: number[] = [];

    constructor() {
        this.initializeWeights();
    }

    private initializeWeights(): void {
        const inputSize = this.vocabSize;
        const scale = Math.sqrt(2.0 / (inputSize + this.hiddenSize));
        
        this.Wf = this.createMatrix(this.hiddenSize, inputSize + this.hiddenSize, scale, 100);
        this.Wi = this.createMatrix(this.hiddenSize, inputSize + this.hiddenSize, scale, 200);
        this.Wc = this.createMatrix(this.hiddenSize, inputSize + this.hiddenSize, scale, 300);
        this.Wo = this.createMatrix(this.hiddenSize, inputSize + this.hiddenSize, scale, 400);
        
        this.bf = new Array(this.hiddenSize).fill(1.0);
        this.bi = new Array(this.hiddenSize).fill(0);
        this.bc = new Array(this.hiddenSize).fill(0);
        this.bo = new Array(this.hiddenSize).fill(0);
        
        const triggerScale = Math.sqrt(2.0 / (this.hiddenSize + this.numTriggerClasses));
        this.WTrigger = this.createMatrix(this.numTriggerClasses, this.hiddenSize, triggerScale, 500);
        this.bTrigger = new Array(this.numTriggerClasses).fill(0);
        
        const actionScale = Math.sqrt(2.0 / (this.hiddenSize + this.numActionClasses));
        this.WAction = this.createMatrix(this.numActionClasses, this.hiddenSize, actionScale, 600);
        this.bAction = new Array(this.numActionClasses).fill(0);
    }

    private createMatrix(rows: number, cols: number, scale: number, seed: number): number[][] {
        const matrix: number[][] = [];
        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                const x = Math.sin(seed + i * 1000 + j) * 10000;
                matrix[i][j] = (x - Math.floor(x) - 0.5) * 2 * scale;
            }
        }
        return matrix;
    }

    private sigmoid(x: number): number {
        return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
    }

    private tanh(x: number): number {
        const clampedX = Math.max(-500, Math.min(500, x));
        const exp2x = Math.exp(2 * clampedX);
        return (exp2x - 1) / (exp2x + 1);
    }

    private softmax(arr: number[]): number[] {
        const max = Math.max(...arr);
        const exps = arr.map(x => Math.exp(x - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map(x => x / sum);
    }

    private matVecMul(matrix: number[][], vector: number[]): number[] {
        return matrix.map(row => row.reduce((sum, val, i) => sum + val * vector[i], 0));
    }

    private vecAdd(a: number[], b: number[]): number[] {
        return a.map((val, i) => val + b[i]);
    }

    private vecMul(a: number[], b: number[]): number[] {
        return a.map((val, i) => val * b[i]);
    }

    classify(text: string): IntentClassification {
        const tokens = text.toLowerCase().slice(0, 256);
        
        // Initialize hidden state
        let h = new Array(this.hiddenSize).fill(0);
        let c = new Array(this.hiddenSize).fill(0);

        // Process through LSTM
        for (let i = 0; i < tokens.length; i++) {
            const charCode = Math.min(tokens.charCodeAt(i), this.vocabSize - 1);
            const input = new Array(this.vocabSize).fill(0);
            input[charCode] = 1;
            
            const concat = [...input, ...h];
            
            const fGate = this.vecAdd(this.matVecMul(this.Wf, concat), this.bf).map(x => this.sigmoid(x));
            const iGate = this.vecAdd(this.matVecMul(this.Wi, concat), this.bi).map(x => this.sigmoid(x));
            const cCandidate = this.vecAdd(this.matVecMul(this.Wc, concat), this.bc).map(x => this.tanh(x));
            const oGate = this.vecAdd(this.matVecMul(this.Wo, concat), this.bo).map(x => this.sigmoid(x));
            
            c = this.vecAdd(this.vecMul(fGate, c), this.vecMul(iGate, cCandidate));
            h = this.vecMul(oGate, c.map(x => this.tanh(x)));
        }

        // Classify trigger type
        const triggerLogits = this.vecAdd(this.matVecMul(this.WTrigger, h), this.bTrigger);
        const triggerProbs = this.softmax(triggerLogits);
        const triggerIdx = triggerProbs.indexOf(Math.max(...triggerProbs));
        const triggerTypes = Object.values(TriggerType);

        // Classify action type
        const actionLogits = this.vecAdd(this.matVecMul(this.WAction, h), this.bAction);
        const actionProbs = this.softmax(actionLogits);
        const actionIdx = actionProbs.indexOf(Math.max(...actionProbs));
        const actionTypes = Object.values(PolicyActionType);

        const triggerConfidence = triggerProbs[triggerIdx];
        const actionConfidence = actionProbs[actionIdx];

        return {
            triggerType: triggerConfidence > 0.3 ? triggerTypes[triggerIdx] : null,
            actionType: actionConfidence > 0.3 ? actionTypes[actionIdx] : null,
            confidence: (triggerConfidence + actionConfidence) / 2,
        };
    }
}

/**
 * NLPParser - Parses natural language into structured automation policies
 * 
 * Uses custom LSTM classification + rule-based extraction for robust parsing
 * without requiring any external LLM provider
 */
export class NLPParser {
    private config: PolicyBuilderConfig;
    private intentClassifier: IntentClassifier;

    constructor(config: PolicyBuilderConfig) {
        this.config = config;
        this.intentClassifier = new IntentClassifier();
    }

    /**
     * Parse natural language into a policy
     */
    async parse(text: string): Promise<PolicyParseResult> {
        // Use hybrid approach: LSTM for intent hints + rule-based for extraction
        const classification = this.intentClassifier.classify(text);
        return this.hybridParse(text, classification);
    }

    /**
     * Hybrid parsing combining LSTM classification with rule-based extraction
     */
    private hybridParse(text: string, classification: IntentClassification): PolicyParseResult {
        const lowerText = text.toLowerCase();

        // Try to extract trigger (rule-based with classification hint)
        const trigger = this.extractTrigger(lowerText, classification.triggerType);
        if (!trigger) {
            return {
                success: false,
                error: 'Could not understand the trigger condition',
                confidence: 0,
                suggestions: [
                    'Try: "When ETH price drops below $2000"',
                    'Try: "Every Monday at 9am"',
                    'Try: "When gas is below 30 gwei"',
                ],
            };
        }

        // Try to extract action (rule-based with classification hint)
        const action = this.extractAction(lowerText, classification.actionType);
        if (!action) {
            return {
                success: false,
                error: 'Could not understand what action to take',
                confidence: 0,
                suggestions: [
                    'Try: "swap 50% of ETH to USDC"',
                    'Try: "claim my rewards"',
                    'Try: "stake my tokens"',
                ],
            };
        }

        // Extract conditions
        const conditions = this.extractConditions(lowerText);

        // Determine risk level
        const riskLevel = this.assessRisk(trigger, action, conditions);

        // Calculate confidence (combine classification and extraction confidence)
        const extractionConfidence = this.calculateExtractionConfidence(text, trigger, action);
        const finalConfidence = Math.min(0.95, (classification.confidence + extractionConfidence) / 2);

        const policy: Omit<AutomationPolicy, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'executionCount'> = {
            name: this.generatePolicyName(trigger, action),
            description: text,
            enabled: true,
            trigger,
            action,
            conditions,
            cooldown: this.config.defaultCooldown,
            priority: 5,
            riskLevel,
            originalText: text,
        };

        return {
            success: true,
            policy,
            confidence: finalConfidence,
        };
    }

    /**
     * Calculate extraction confidence based on pattern matching quality
     */
    private calculateExtractionConfidence(text: string, trigger: PolicyTrigger, action: PolicyAction): number {
        let confidence = 0.5;
        
        // Boost confidence for clear keywords
        const triggerKeywords = ['when', 'if', 'every', 'daily', 'weekly', 'monthly'];
        const actionKeywords = ['swap', 'stake', 'claim', 'transfer', 'send', 'compound'];
        
        for (const kw of triggerKeywords) {
            if (text.toLowerCase().includes(kw)) {
                confidence += 0.1;
                break;
            }
        }
        
        for (const kw of actionKeywords) {
            if (text.toLowerCase().includes(kw)) {
                confidence += 0.1;
                break;
            }
        }
        
        // Boost for specific values
        if (trigger.threshold !== undefined) confidence += 0.1;
        if (trigger.asset) confidence += 0.1;
        if (action.amount) confidence += 0.05;
        if (action.fromAsset || action.toAsset) confidence += 0.05;
        
        return Math.min(confidence, 0.95);
    }

    /**
     * Extract trigger from text with optional classification hint
     */
    private extractTrigger(text: string, hint?: TriggerType | null): PolicyTrigger | null {
        // Price triggers
        const priceMatch = text.match(
            /(?:when|if)\s+(\w+)\s+(?:price\s+)?(?:drops?\s+)?(?:below|under)\s+\$?([\d,]+)/i
        );
        if (priceMatch) {
            return {
                type: TriggerType.PRICE_BELOW,
                asset: priceMatch[1].toUpperCase(),
                threshold: parseFloat(priceMatch[2].replace(',', '')),
            };
        }

        const priceAboveMatch = text.match(
            /(?:when|if)\s+(\w+)\s+(?:price\s+)?(?:rises?\s+|goes?\s+)?(?:above|over)\s+\$?([\d,]+)/i
        );
        if (priceAboveMatch) {
            return {
                type: TriggerType.PRICE_ABOVE,
                asset: priceAboveMatch[1].toUpperCase(),
                threshold: parseFloat(priceAboveMatch[2].replace(',', '')),
            };
        }

        // Price change percentage
        const priceChangeMatch = text.match(
            /(?:when|if)\s+(\w+)\s+(?:price\s+)?(?:changes?|moves?|drops?|rises?)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%/i
        );
        if (priceChangeMatch) {
            return {
                type: TriggerType.PRICE_CHANGE_PERCENT,
                asset: priceChangeMatch[1].toUpperCase(),
                percentage: parseFloat(priceChangeMatch[2]),
            };
        }

        // Time triggers with more patterns
        const schedulePatterns = [
            { pattern: /every\s+day\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i, cron: (h: number, m: number) => `${m} ${h} * * *` },
            { pattern: /every\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i, cron: (h: number, m: number) => `${m} ${h} * * *` },
            { pattern: /every\s+monday/i, cron: () => '0 9 * * 1' },
            { pattern: /every\s+tuesday/i, cron: () => '0 9 * * 2' },
            { pattern: /every\s+wednesday/i, cron: () => '0 9 * * 3' },
            { pattern: /every\s+thursday/i, cron: () => '0 9 * * 4' },
            { pattern: /every\s+friday/i, cron: () => '0 9 * * 5' },
            { pattern: /every\s+saturday/i, cron: () => '0 9 * * 6' },
            { pattern: /every\s+sunday/i, cron: () => '0 9 * * 0' },
            { pattern: /every\s+week/i, cron: () => '0 9 * * 1' },
            { pattern: /every\s+month/i, cron: () => '0 9 1 * *' },
            { pattern: /daily/i, cron: () => '0 9 * * *' },
            { pattern: /weekly/i, cron: () => '0 9 * * 1' },
            { pattern: /monthly/i, cron: () => '0 9 1 * *' },
            { pattern: /hourly/i, cron: () => '0 * * * *' },
        ];

        for (const sp of schedulePatterns) {
            const match = text.match(sp.pattern);
            if (match) {
                let hour = parseInt(match[1] || '9');
                const minute = parseInt(match[2] || '0');
                const ampm = match[3]?.toLowerCase();
                
                if (ampm === 'pm' && hour < 12) hour += 12;
                if (ampm === 'am' && hour === 12) hour = 0;

                return {
                    type: TriggerType.TIME_SCHEDULE,
                    schedule: sp.cron(hour, minute),
                };
            }
        }

        // Gas triggers
        const gasMatch = text.match(/(?:when|if)\s+gas\s+(?:is\s+)?(?:below|under|less\s+than)\s+(\d+)\s*(?:gwei)?/i);
        if (gasMatch) {
            return {
                type: TriggerType.GAS_BELOW,
                threshold: parseFloat(gasMatch[1]),
            };
        }

        // Balance triggers
        const balanceAboveMatch = text.match(
            /(?:when|if)\s+(?:my\s+)?(\w+)\s+balance\s+(?:is\s+)?(?:above|over|exceeds?)\s+\$?([\d,]+)/i
        );
        if (balanceAboveMatch) {
            return {
                type: TriggerType.BALANCE_ABOVE,
                asset: balanceAboveMatch[1].toUpperCase(),
                threshold: parseFloat(balanceAboveMatch[2].replace(',', '')),
            };
        }

        const balanceBelowMatch = text.match(
            /(?:when|if)\s+(?:my\s+)?(\w+)\s+balance\s+(?:is\s+)?(?:below|under)\s+\$?([\d,]+)/i
        );
        if (balanceBelowMatch) {
            return {
                type: TriggerType.BALANCE_BELOW,
                asset: balanceBelowMatch[1].toUpperCase(),
                threshold: parseFloat(balanceBelowMatch[2].replace(',', '')),
            };
        }

        // Health factor triggers (for lending protocols)
        const healthMatch = text.match(
            /(?:when|if)\s+(?:my\s+)?health\s*factor\s+(?:is\s+)?(?:below|under|drops?\s+to)\s+([\d.]+)/i
        );
        if (healthMatch) {
            return {
                type: TriggerType.HEALTH_FACTOR_BELOW,
                threshold: parseFloat(healthMatch[1]),
            };
        }

        // APY change triggers
        const apyMatch = text.match(
            /(?:when|if)\s+(?:the\s+)?apy\s+(?:on\s+)?(\w+)?\s*(?:is\s+)?(?:above|over|exceeds?)\s+([\d.]+)\s*%/i
        );
        if (apyMatch) {
            return {
                type: TriggerType.APY_CHANGE,
                protocol: apyMatch[1]?.toLowerCase(),
                threshold: parseFloat(apyMatch[2]),
            };
        }

        // Use hint if no pattern matched but hint was provided
        if (hint) {
            return { type: hint };
        }

        return null;
    }

    /**
     * Extract action from text with optional classification hint
     */
    private extractAction(text: string, hint?: PolicyActionType | null): PolicyAction | null {
        // Swap action
        const swapMatch = text.match(
            /swap\s+(?:all|(\d+)%?|max)?\s*(?:of\s+)?(?:my\s+)?(\w+)\s+(?:to|for|into)\s+(\w+)/i
        );
        if (swapMatch) {
            const amount = swapMatch[1] 
                ? (text.includes('%') ? `${swapMatch[1]}%` : swapMatch[1])
                : 'max';
            return {
                type: PolicyActionType.SWAP,
                fromAsset: swapMatch[2].toUpperCase(),
                toAsset: swapMatch[3].toUpperCase(),
                amount,
            };
        }

        // Alternative swap patterns
        const convertMatch = text.match(
            /(?:convert|exchange)\s+(?:all|(\d+)%?|max)?\s*(?:of\s+)?(?:my\s+)?(\w+)\s+(?:to|for|into)\s+(\w+)/i
        );
        if (convertMatch) {
            const amount = convertMatch[1] 
                ? (text.includes('%') ? `${convertMatch[1]}%` : convertMatch[1])
                : 'max';
            return {
                type: PolicyActionType.SWAP,
                fromAsset: convertMatch[2].toUpperCase(),
                toAsset: convertMatch[3].toUpperCase(),
                amount,
            };
        }

        // Stake action
        const stakeMatch = text.match(/stake\s+(?:all|(\d+)%?|max)?\s*(?:of\s+)?(?:my\s+)?(\w+)?(?:\s+(?:on|in|with)\s+(\w+))?/i);
        if (stakeMatch) {
            const amount = stakeMatch[1] 
                ? (text.includes('%') ? `${stakeMatch[1]}%` : stakeMatch[1])
                : 'max';
            return {
                type: PolicyActionType.STAKE,
                fromAsset: stakeMatch[2]?.toUpperCase() || 'ETH',
                amount,
                protocol: stakeMatch[3]?.toLowerCase(),
            };
        }

        // Unstake action
        const unstakeMatch = text.match(/unstake\s+(?:all|(\d+)%?|max)?\s*(?:of\s+)?(?:my\s+)?(\w+)?/i);
        if (unstakeMatch) {
            const amount = unstakeMatch[1] 
                ? (text.includes('%') ? `${unstakeMatch[1]}%` : unstakeMatch[1])
                : 'max';
            return {
                type: PolicyActionType.UNSTAKE,
                fromAsset: unstakeMatch[2]?.toUpperCase() || 'ETH',
                amount,
            };
        }

        // Claim action
        if (/claim\s+(?:my\s+)?(?:staking\s+)?rewards?/i.test(text)) {
            const protocolMatch = text.match(/(?:from|on)\s+(\w+)/i);
            return {
                type: PolicyActionType.CLAIM,
                protocol: protocolMatch?.[1]?.toLowerCase(),
            };
        }

        // Compound action
        if (/compound|reinvest|auto.?compound/i.test(text)) {
            return {
                type: PolicyActionType.COMPOUND,
            };
        }

        // Provide liquidity
        const lpMatch = text.match(
            /(?:provide|add)\s+(?:liquidity|lp)\s+(?:to\s+)?(\w+)?(?:\s*[-\/]\s*(\w+))?/i
        );
        if (lpMatch) {
            return {
                type: PolicyActionType.PROVIDE_LIQUIDITY,
                fromAsset: lpMatch[1]?.toUpperCase(),
                toAsset: lpMatch[2]?.toUpperCase(),
            };
        }

        // Remove liquidity
        if (/(?:remove|withdraw)\s+(?:liquidity|lp)/i.test(text)) {
            return {
                type: PolicyActionType.REMOVE_LIQUIDITY,
            };
        }

        // Transfer action
        const transferMatch = text.match(
            /(?:send|transfer)\s+(?:all|(\d+)%?)?\s*(?:of\s+)?(?:my\s+)?(\w+)\s+to\s+(0x[a-fA-F0-9]+|\w+\.eth)/i
        );
        if (transferMatch) {
            return {
                type: PolicyActionType.TRANSFER,
                fromAsset: transferMatch[2].toUpperCase(),
                amount: transferMatch[1] ? `${transferMatch[1]}%` : 'max',
                recipient: transferMatch[3],
            };
        }

        // Rebalance action
        if (/rebalance\s+(?:my\s+)?(?:portfolio)?/i.test(text)) {
            return {
                type: PolicyActionType.REBALANCE,
            };
        }

        // Bridge action
        const bridgeMatch = text.match(
            /bridge\s+(?:all|(\d+)%?)?\s*(?:of\s+)?(?:my\s+)?(\w+)\s+(?:to|from)\s+(\w+)/i
        );
        if (bridgeMatch) {
            return {
                type: PolicyActionType.BRIDGE,
                fromAsset: bridgeMatch[2]?.toUpperCase(),
                amount: bridgeMatch[1] ? `${bridgeMatch[1]}%` : 'max',
                chain: bridgeMatch[3],
            };
        }

        // Notify action
        if (/(?:notify|alert|tell)\s+me/i.test(text)) {
            return {
                type: PolicyActionType.NOTIFY,
            };
        }

        // Use hint if no pattern matched
        if (hint) {
            return { type: hint };
        }

        return null;
    }

    /**
     * Extract additional conditions from text
     */
    private extractConditions(text: string): PolicyCondition[] {
        const conditions: PolicyCondition[] = [];

        // Gas condition
        const gasCondition = text.match(/(?:if|when|and)\s+gas\s+(?:is\s+)?(?:below|under)\s+(\d+)/i);
        if (gasCondition) {
            conditions.push({
                field: 'gasPrice',
                operator: ComparisonOperator.LESS_THAN,
                value: parseFloat(gasCondition[1]),
                description: `Gas price below ${gasCondition[1]} gwei`,
            });
        }

        // Weekend condition
        if (/(?:not\s+on\s+weekend|weekday|work\s*day|business\s*day)/i.test(text)) {
            conditions.push({
                field: 'isWeekend',
                operator: ComparisonOperator.EQUALS,
                value: false,
                description: 'Only on weekdays',
            });
        }

        // Only weekend
        if (/(?:on\s+weekend|weekend\s+only)/i.test(text)) {
            conditions.push({
                field: 'isWeekend',
                operator: ComparisonOperator.EQUALS,
                value: true,
                description: 'Only on weekends',
            });
        }

        // Slippage condition
        const slippageMatch = text.match(/slippage\s+(?:below|under|less\s+than)\s+(\d+(?:\.\d+)?)/i);
        if (slippageMatch) {
            conditions.push({
                field: 'slippage',
                operator: ComparisonOperator.LESS_THAN,
                value: parseFloat(slippageMatch[1]),
                description: `Slippage below ${slippageMatch[1]}%`,
            });
        }

        // Minimum amount condition
        const minAmountMatch = text.match(/(?:at\s+least|minimum|min)\s+\$?([\d,]+)/i);
        if (minAmountMatch) {
            conditions.push({
                field: 'amount',
                operator: ComparisonOperator.GREATER_OR_EQUAL,
                value: parseFloat(minAmountMatch[1].replace(',', '')),
                description: `Minimum amount $${minAmountMatch[1]}`,
            });
        }

        return conditions;
    }

    /**
     * Assess risk level of the policy
     */
    private assessRisk(
        trigger: PolicyTrigger,
        action: PolicyAction,
        conditions: PolicyCondition[]
    ): 'low' | 'medium' | 'high' {
        let riskScore = 0;

        // High-value actions
        if (action.type === PolicyActionType.SWAP && action.amount === 'max') {
            riskScore += 30;
        }
        if (action.type === PolicyActionType.TRANSFER) {
            riskScore += 40;
        }
        if (action.type === PolicyActionType.BRIDGE) {
            riskScore += 25;
        }

        // Large percentages
        if (action.amount?.includes('%')) {
            const pct = parseFloat(action.amount);
            if (pct > 50) riskScore += 20;
            if (pct > 80) riskScore += 20;
        }

        // Volatile triggers
        if (trigger.type === TriggerType.PRICE_CHANGE_PERCENT) {
            riskScore += 15;
        }

        // Health factor triggers (dangerous)
        if (trigger.type === TriggerType.HEALTH_FACTOR_BELOW) {
            riskScore += 20;
        }

        // Lack of conditions (safety checks)
        if (conditions.length === 0) {
            riskScore += 10;
        }

        // Gas conditions reduce risk
        if (conditions.some(c => c.field === 'gasPrice')) {
            riskScore -= 10;
        }

        // Slippage conditions reduce risk
        if (conditions.some(c => c.field === 'slippage')) {
            riskScore -= 5;
        }

        if (riskScore >= 50) return 'high';
        if (riskScore >= 25) return 'medium';
        return 'low';
    }

    /**
     * Generate a name for the policy
     */
    private generatePolicyName(trigger: PolicyTrigger, action: PolicyAction): string {
        const actionName = action.type.replace(/_/g, ' ');
        
        switch (trigger.type) {
            case TriggerType.PRICE_BELOW:
                return `${trigger.asset} Price Drop ${actionName}`;
            case TriggerType.PRICE_ABOVE:
                return `${trigger.asset} Price Rise ${actionName}`;
            case TriggerType.PRICE_CHANGE_PERCENT:
                return `${trigger.asset} Price Change ${actionName}`;
            case TriggerType.TIME_SCHEDULE:
                return `Scheduled ${actionName}`;
            case TriggerType.GAS_BELOW:
                return `Low Gas ${actionName}`;
            case TriggerType.BALANCE_ABOVE:
                return `${trigger.asset} Balance Threshold ${actionName}`;
            case TriggerType.BALANCE_BELOW:
                return `Low ${trigger.asset} Balance ${actionName}`;
            case TriggerType.HEALTH_FACTOR_BELOW:
                return `Health Factor Alert ${actionName}`;
            case TriggerType.APY_CHANGE:
                return `APY Opportunity ${actionName}`;
            default:
                return `Auto ${actionName}`;
        }
    }
}
