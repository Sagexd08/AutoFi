import { randomUUID } from 'crypto';
import {
    UserPreference,
    PreferenceType,
    MemoryEntry,
    ContextPattern,
    RiskProfile,
    ContextualMemoryConfig,
} from './types';

/**
 * PreferenceLearner - Learns user preferences from actions
 * 
 * Analyzes user behavior to infer preferences and risk profile
 */
export class PreferenceLearner {
    private config: ContextualMemoryConfig;
    private preferences: Map<string, Map<string, UserPreference>>; // userId -> key -> preference

    constructor(config: ContextualMemoryConfig) {
        this.config = config;
        this.preferences = new Map();
    }

    /**
     * Learn from a user action
     */
    learn(userId: string, action: MemoryEntry): UserPreference[] {
        const learned: UserPreference[] = [];
        const metadata = action.metadata;

        // Learn protocol preference
        if (metadata.protocol) {
            const pref = this.updatePreference(userId, {
                type: PreferenceType.PROTOCOL_PREFERENCE,
                key: `preferred_protocol_${metadata.actionType}`,
                value: metadata.protocol,
            });
            if (pref) learned.push(pref);
        }

        // Learn chain preference
        if (metadata.chain) {
            const pref = this.updatePreference(userId, {
                type: PreferenceType.PREFERRED_CHAIN,
                key: 'preferred_chain',
                value: metadata.chain,
            });
            if (pref) learned.push(pref);
        }

        // Learn token preferences
        if (metadata.tokens && metadata.tokens.length > 0) {
            for (const token of metadata.tokens) {
                const pref = this.updatePreference(userId, {
                    type: PreferenceType.TOKEN_PREFERENCE,
                    key: `token_${token}`,
                    value: true,
                });
                if (pref) learned.push(pref);
            }
        }

        // Learn trade size preference
        if (metadata.amount) {
            const pref = this.updatePreference(userId, {
                type: PreferenceType.TRADE_SIZE,
                key: 'average_trade_size',
                value: metadata.amount,
                aggregate: 'average',
            });
            if (pref) learned.push(pref);
        }

        // Learn trading hours
        const hour = new Date(action.timestamp).getHours();
        const pref = this.updatePreference(userId, {
            type: PreferenceType.TRADING_HOURS,
            key: `active_hour_${hour}`,
            value: true,
        });
        if (pref) learned.push(pref);

        return learned;
    }

    /**
     * Update or create a preference
     */
    private updatePreference(
        userId: string,
        data: {
            type: PreferenceType;
            key: string;
            value: any;
            aggregate?: 'average' | 'sum' | 'count' | 'mode';
        }
    ): UserPreference | null {
        if (!this.preferences.has(userId)) {
            this.preferences.set(userId, new Map());
        }

        const userPrefs = this.preferences.get(userId)!;
        const existing = userPrefs.get(data.key);

        let newValue = data.value;
        let sourceActions = 1;
        let confidence = this.config.learningRate;

        if (existing) {
            sourceActions = existing.sourceActions + 1;
            
            // Apply aggregation
            if (data.aggregate === 'average' && typeof data.value === 'number') {
                // Exponential moving average
                newValue = existing.value * (1 - this.config.learningRate) + data.value * this.config.learningRate;
            } else if (data.aggregate === 'sum') {
                newValue = existing.value + data.value;
            } else if (data.aggregate === 'count') {
                newValue = existing.value + 1;
            } else if (data.aggregate === 'mode') {
                // For mode, we'd need to track frequencies - simplified here
                newValue = data.value;
            }

            // Update confidence based on number of observations
            confidence = Math.min(0.95, existing.confidence + (1 - existing.confidence) * this.config.learningRate);
        }

        const preference: UserPreference = {
            id: existing?.id || randomUUID(),
            userId,
            type: data.type,
            key: data.key,
            value: newValue,
            confidence,
            learnedAt: existing?.learnedAt || Date.now(),
            updatedAt: Date.now(),
            sourceActions,
            isExplicit: false,
        };

        userPrefs.set(data.key, preference);
        return preference;
    }

    /**
     * Set an explicit preference
     */
    setExplicit(userId: string, type: PreferenceType, key: string, value: any): UserPreference {
        if (!this.preferences.has(userId)) {
            this.preferences.set(userId, new Map());
        }

        const userPrefs = this.preferences.get(userId)!;
        const existing = userPrefs.get(key);

        const preference: UserPreference = {
            id: existing?.id || randomUUID(),
            userId,
            type,
            key,
            value,
            confidence: 1.0, // Explicit preferences have full confidence
            learnedAt: existing?.learnedAt || Date.now(),
            updatedAt: Date.now(),
            sourceActions: existing?.sourceActions || 0,
            isExplicit: true,
        };

        userPrefs.set(key, preference);
        return preference;
    }

    /**
     * Get a specific preference
     */
    getPreference(userId: string, key: string): UserPreference | undefined {
        return this.preferences.get(userId)?.get(key);
    }

    /**
     * Get all preferences for a user
     */
    getUserPreferences(userId: string): UserPreference[] {
        const userPrefs = this.preferences.get(userId);
        if (!userPrefs) return [];
        return [...userPrefs.values()];
    }

    /**
     * Get preferences by type
     */
    getPreferencesByType(userId: string, type: PreferenceType): UserPreference[] {
        return this.getUserPreferences(userId).filter(p => p.type === type);
    }

    /**
     * Calculate risk profile from preferences and actions
     */
    calculateRiskProfile(userId: string, actions: MemoryEntry[]): RiskProfile {
        const prefs = this.getUserPreferences(userId);
        
        // Default profile
        let profile: RiskProfile = {
            level: 'moderate',
            maxPositionSize: 20,
            maxSingleTrade: 1000,
            preferredLeverage: 1,
            stopLossEnabled: true,
            calculatedAt: Date.now(),
        };

        // Get risk tolerance if explicitly set
        const riskPref = prefs.find(p => p.type === PreferenceType.RISK_TOLERANCE);
        if (riskPref) {
            profile.level = riskPref.value;
        } else if (actions.length >= this.config.minActionsForLearning) {
            // Infer from behavior
            profile = this.inferRiskFromBehavior(actions, profile);
        }

        return profile;
    }

    /**
     * Infer risk profile from user behavior
     */
    private inferRiskFromBehavior(actions: MemoryEntry[], current: RiskProfile): RiskProfile {
        const profile = { ...current };
        
        // Analyze trade sizes
        const tradeSizes = actions
            .filter(a => a.metadata.amount)
            .map(a => a.metadata.amount!);

        if (tradeSizes.length > 0) {
            const avgSize = tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length;
            const maxSize = Math.max(...tradeSizes);
            
            profile.maxSingleTrade = maxSize;
            
            // Large trades relative to average suggest higher risk tolerance
            if (maxSize > avgSize * 3) {
                profile.level = 'aggressive';
                profile.maxPositionSize = 40;
            } else if (maxSize > avgSize * 2) {
                profile.level = 'moderate';
                profile.maxPositionSize = 25;
            } else {
                profile.level = 'conservative';
                profile.maxPositionSize = 15;
            }
        }

        // Analyze success rate
        const successRate = actions.filter(a => a.metadata.success !== false).length / actions.length;
        
        // Lower success rate might indicate more aggressive/risky behavior
        if (successRate < 0.8) {
            profile.stopLossEnabled = true;
        }

        return profile;
    }

    /**
     * Detect patterns from actions
     */
    detectPatterns(_userId: string, actions: MemoryEntry[]): ContextPattern[] {
        const patterns: ContextPattern[] = [];

        if (actions.length < this.config.minActionsForLearning) {
            return patterns;
        }

        // Detect time patterns
        const hourCounts = new Map<number, number>();
        for (const action of actions) {
            const hour = new Date(action.timestamp).getHours();
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        }

        const peakHour = [...hourCounts.entries()]
            .sort((a, b) => b[1] - a[1])[0];

        if (peakHour && peakHour[1] > actions.length * 0.3) {
            patterns.push({
                type: 'time_preference',
                description: `Most active around ${peakHour[0]}:00`,
                confidence: peakHour[1] / actions.length,
                occurrences: peakHour[1],
                lastSeen: Date.now(),
            });
        }

        // Detect protocol patterns
        const protocolCounts = new Map<string, number>();
        for (const action of actions) {
            if (action.metadata.protocol) {
                protocolCounts.set(
                    action.metadata.protocol,
                    (protocolCounts.get(action.metadata.protocol) || 0) + 1
                );
            }
        }

        for (const [protocol, count] of protocolCounts) {
            if (count > actions.length * 0.25) {
                patterns.push({
                    type: 'protocol_preference',
                    description: `Frequently uses ${protocol}`,
                    confidence: count / actions.length,
                    occurrences: count,
                    lastSeen: Date.now(),
                });
            }
        }

        // Detect token patterns
        const tokenCounts = new Map<string, number>();
        for (const action of actions) {
            if (action.metadata.tokens) {
                for (const token of action.metadata.tokens) {
                    tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
                }
            }
        }

        for (const [token, count] of tokenCounts) {
            if (count > actions.length * 0.3) {
                patterns.push({
                    type: 'token_preference',
                    description: `Often trades ${token}`,
                    confidence: count / actions.length,
                    occurrences: count,
                    lastSeen: Date.now(),
                });
            }
        }

        return patterns;
    }

    /**
     * Clear preferences for a user
     */
    clearUserPreferences(userId: string): void {
        this.preferences.delete(userId);
    }

    /**
     * Export preferences
     */
    exportPreferences(userId: string): string {
        const prefs = this.getUserPreferences(userId);
        return JSON.stringify(prefs, null, 2);
    }

    /**
     * Import preferences
     */
    importPreferences(userId: string, json: string): number {
        const prefs = JSON.parse(json) as UserPreference[];
        
        if (!this.preferences.has(userId)) {
            this.preferences.set(userId, new Map());
        }

        const userPrefs = this.preferences.get(userId)!;
        
        for (const pref of prefs) {
            pref.userId = userId;
            pref.id = randomUUID();
            userPrefs.set(pref.key, pref);
        }

        return prefs.length;
    }
}
