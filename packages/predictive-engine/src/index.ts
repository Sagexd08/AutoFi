/**
 * @autofi/predictive-engine
 * 
 * AI-powered predictive intent engine for Autofi
 * 
 * Features:
 * - ML-based pattern detection using TensorFlow.js
 * - User behavior analysis and prediction
 * - Optimal timing recommendations
 * - Smart action suggestions based on context
 */

import {
    UserAction,
    BehaviorPattern,
    PredictedIntent,
    ActionType,
    MarketCondition,
    PredictiveEngineConfig,
    PredictiveEngineConfigSchema,
} from './types';
import { PatternDetector } from './pattern-detector';
import { IntentModel } from './intent-model';

export class PredictiveEngine {
    private config: PredictiveEngineConfig;
    private patternDetector: PatternDetector;
    private intentModel: IntentModel;
    private userHistory: Map<string, UserAction[]>;
    private userPatterns: Map<string, BehaviorPattern[]>;
    private cache: Map<string, { predictions: PredictedIntent[]; timestamp: number }>;

    constructor(config?: Partial<PredictiveEngineConfig>) {
        this.config = PredictiveEngineConfigSchema.parse(config || {});
        this.patternDetector = new PatternDetector();
        this.intentModel = new IntentModel();
        this.userHistory = new Map();
        this.userPatterns = new Map();
        this.cache = new Map();
    }

    /**
     * Initialize the engine (loads ML model)
     */
    async initialize(): Promise<void> {
        await this.intentModel.initialize();
        
        if (this.config.modelPath) {
            try {
                await this.intentModel.loadModel(this.config.modelPath);
            } catch (error) {
                console.warn('Could not load pre-trained model:', error);
            }
        }
    }

    /**
     * Record a user action for learning
     */
    async recordAction(action: UserAction): Promise<void> {
        const userId = action.userId;
        
        if (!this.userHistory.has(userId)) {
            this.userHistory.set(userId, []);
        }
        
        this.userHistory.get(userId)!.push(action);

        // Update patterns
        const history = this.userHistory.get(userId)!;
        if (history.length >= this.config.minHistoryLength) {
            const patterns = this.patternDetector.detectPatterns(history);
            this.userPatterns.set(userId, patterns);
        }

        // Clear cache for this user
        this.cache.delete(userId);

        // Online training if enabled
        if (this.config.enableOnlineTraining && history.length % 10 === 0) {
            await this.trainOnUserHistory(userId);
        }
    }

    /**
     * Predict user intent based on current context
     */
    async predictIntent(
        userId: string,
        marketCondition?: MarketCondition
    ): Promise<PredictedIntent[]> {
        // Check cache
        if (this.config.cachePredictions) {
            const cached = this.cache.get(userId);
            if (cached && Date.now() - cached.timestamp < this.config.cacheDuration * 1000) {
                return cached.predictions;
            }
        }

        const predictions: PredictedIntent[] = [];
        const now = new Date();

        // Get pattern-based predictions
        const patterns = this.userPatterns.get(userId) || [];
        for (const pattern of patterns) {
            if (!this.patternDetector.isPatternActive(pattern)) {
                continue;
            }

            const nextOccurrence = this.patternDetector.predictNextOccurrence(pattern);
            const timeUntilNext = nextOccurrence - Date.now();
            
            // If predicted to happen within 24 hours
            if (timeUntilNext > 0 && timeUntilNext < 24 * 60 * 60 * 1000) {
                const confidence = this.calculatePatternConfidence(pattern);
                
                predictions.push({
                    actionType: pattern.actionType,
                    confidence,
                    reasoning: this.generatePatternReasoning(pattern),
                    optimalTimeWindow: {
                        start: nextOccurrence - 60 * 60 * 1000, // 1 hour before
                        end: nextOccurrence + 60 * 60 * 1000,   // 1 hour after
                        reason: `Based on your ${pattern.frequency} pattern`,
                    },
                    estimatedSavings: this.estimateSavings(pattern, marketCondition),
                });
            }
        }

        // Get ML model predictions
        const context: Partial<UserAction> = {
            userId,
            timestamp: Date.now(),
            hourOfDay: now.getHours(),
            dayOfWeek: now.getDay(),
        };

        const probabilities = await this.intentModel.predict(context, marketCondition);
        
        // Add top predictions from ML model
        const sortedProbs = [...probabilities.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, this.config.maxPredictions);

        for (const [actionType, confidence] of sortedProbs) {
            if (confidence < this.config.confidenceThreshold) {
                continue;
            }

            // Don't duplicate pattern-based predictions
            if (predictions.some(p => p.actionType === actionType)) {
                continue;
            }

            predictions.push({
                actionType,
                confidence,
                reasoning: this.generateMLReasoning(actionType, confidence, now),
            });
        }

        // Sort by confidence
        predictions.sort((a, b) => b.confidence - a.confidence);

        // Limit results
        const result = predictions.slice(0, this.config.maxPredictions);

        // Cache
        if (this.config.cachePredictions) {
            this.cache.set(userId, { predictions: result, timestamp: Date.now() });
        }

        return result;
    }

    /**
     * Get user behavior patterns
     */
    getPatterns(userId: string): BehaviorPattern[] {
        return this.userPatterns.get(userId) || [];
    }

    /**
     * Train model on specific user's history
     */
    async trainOnUserHistory(userId: string): Promise<void> {
        const history = this.userHistory.get(userId);
        if (!history || history.length < this.config.minHistoryLength) {
            return;
        }

        await this.intentModel.train(history, 20);
    }

    /**
     * Train model on all user histories
     */
    async trainOnAllHistories(): Promise<{ accuracy: number; loss: number }> {
        const allActions: UserAction[] = [];
        
        for (const [, actions] of this.userHistory) {
            allActions.push(...actions);
        }

        if (allActions.length < this.config.minHistoryLength) {
            return { accuracy: 0, loss: 0 };
        }

        return await this.intentModel.train(allActions, 50);
    }

    /**
     * Calculate confidence from pattern
     */
    private calculatePatternConfidence(pattern: BehaviorPattern): number {
        let confidence = 0.5; // Base confidence

        // More occurrences = higher confidence
        confidence += Math.min(pattern.occurrenceCount / 50, 0.3);

        // Higher success rate = higher confidence
        confidence += pattern.successRate * 0.2;

        // Regular patterns = higher confidence
        if (pattern.frequency !== 'irregular') {
            confidence += 0.1;
        }

        return Math.min(confidence, 0.99);
    }

    /**
     * Generate reasoning for pattern-based prediction
     */
    private generatePatternReasoning(pattern: BehaviorPattern): string {
        const actionName = pattern.actionType.replace('_', ' ').toLowerCase();
        const frequency = pattern.frequency.replace('_', ' ');
        
        const preferredTime = pattern.preferredTimeSlots.length > 0
            ? `around ${pattern.preferredTimeSlots[0]}:00`
            : '';
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const preferredDay = pattern.preferredDays.length > 0
            ? `on ${dayNames[pattern.preferredDays[0]]}`
            : '';

        return `You typically ${actionName} ${frequency}${preferredTime ? ` ${preferredTime}` : ''}${preferredDay ? ` ${preferredDay}` : ''} (${pattern.occurrenceCount} times observed)`;
    }

    /**
     * Generate reasoning for ML-based prediction
     */
    private generateMLReasoning(actionType: ActionType, confidence: number, now: Date): string {
        const actionName = actionType.replace('_', ' ').toLowerCase();
        const timeOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening';
        
        return `Based on typical ${timeOfDay} activity patterns, ${actionName} is likely (${(confidence * 100).toFixed(0)}% confidence)`;
    }

    /**
     * Estimate potential savings for an action
     */
    private estimateSavings(
        pattern: BehaviorPattern,
        marketCondition?: MarketCondition
    ): { gasUsd: number; slippageUsd: number } {
        const currentGas = marketCondition?.gasPrice ?? 30;
        const optimalGas = Math.min(currentGas, pattern.avgGasPrice || 30);
        
        // Estimate gas savings
        const gasDiff = currentGas - optimalGas;
        const estimatedGasUsed = 150000; // Typical swap
        const ethPrice = marketCondition?.ethPrice ?? 2500;
        const gasSavings = (gasDiff * estimatedGasUsed * ethPrice) / 1e9;

        // Estimate slippage savings (rough)
        const slippageSavings = marketCondition?.volatilityIndex 
            ? (pattern.avgAmountUsd || 0) * 0.005 * (1 - marketCondition.volatilityIndex / 100)
            : 0;

        return {
            gasUsd: Math.max(0, gasSavings),
            slippageUsd: Math.max(0, slippageSavings),
        };
    }

    /**
     * Get optimal action time based on patterns and market
     */
    getOptimalActionTime(
        userId: string,
        actionType: ActionType,
        marketCondition?: MarketCondition
    ): { timestamp: number; reason: string } | null {
        const patterns = this.userPatterns.get(userId);
        const pattern = patterns?.find(p => p.actionType === actionType);

        if (!pattern) {
            return null;
        }

        const nextOccurrence = this.patternDetector.predictNextOccurrence(pattern);
        
        if (nextOccurrence === 0) {
            return null;
        }

        // Adjust for gas conditions
        let reason = `Based on your ${pattern.frequency} pattern`;
        
        if (marketCondition && marketCondition.gasPrice < 30) {
            reason += ' and current low gas prices';
        } else if (marketCondition && marketCondition.gasPrice > 80) {
            reason += ' (consider waiting for lower gas)';
        }

        return {
            timestamp: nextOccurrence,
            reason,
        };
    }

    /**
     * Save model and patterns
     */
    async save(_basePath: string): Promise<void> {
        if (this.config.modelPath) {
            await this.intentModel.saveModel(this.config.modelPath);
        }
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        this.intentModel.dispose();
        this.userHistory.clear();
        this.userPatterns.clear();
        this.cache.clear();
    }
}

// Export all types and classes
export * from './types';
export { PatternDetector } from './pattern-detector';
export { IntentModel } from './intent-model';
