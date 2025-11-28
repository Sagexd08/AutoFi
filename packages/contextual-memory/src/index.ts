/**
 * @autofi/contextual-memory
 * 
 * User preference learning and contextual memory system
 * 
 * Features:
 * - Vector-based semantic memory storage
 * - Automatic preference learning from user actions
 * - Risk profile calculation
 * - Pattern detection
 * - Personalization context for AI agents
 */

import {
    UserPreference,
    PreferenceType,
    MemoryEntry,
    MemoryMetadata,
    UserContext,
    RiskProfile,
    ContextPattern,
    UserFeedback,
    MemoryQueryResult,
    ContextualMemoryConfig,
    ContextualMemoryConfigSchema,
} from './types';
import { VectorStore } from './vector-store';
import { PreferenceLearner } from './preference-learner';
import { EmbeddingService } from './embedding-service';

export class ContextualMemory {
    private config: ContextualMemoryConfig;
    private vectorStore: VectorStore;
    private preferenceLearner: PreferenceLearner;
    private _embeddingService: EmbeddingService;
    private userContextCache: Map<string, { context: UserContext; timestamp: number }>;
    private feedbackStore: Map<string, UserFeedback[]>;

    constructor(config?: Partial<ContextualMemoryConfig>) {
        this.config = ContextualMemoryConfigSchema.parse(config || {});
        this.vectorStore = new VectorStore(this.config);
        this.preferenceLearner = new PreferenceLearner(this.config);
        this._embeddingService = new EmbeddingService(this.config);
        this.userContextCache = new Map();
        this.feedbackStore = new Map();
    }

    /**
     * Get the embedding service for external use
     */
    get embeddingService(): EmbeddingService {
        return this._embeddingService;
    }

    /**
     * Record a user action and learn from it
     */
    async recordAction(
        userId: string,
        actionDescription: string,
        metadata: MemoryMetadata
    ): Promise<{ memory: MemoryEntry; learnedPreferences: UserPreference[] }> {
        // Store the action in vector memory
        const memory = await this.vectorStore.add(userId, actionDescription, {
            ...metadata,
            type: 'action',
        });

        // Learn preferences from the action
        const learnedPreferences = this.preferenceLearner.learn(userId, memory);

        // Invalidate context cache
        this.userContextCache.delete(userId);

        return { memory, learnedPreferences };
    }

    /**
     * Learn from user feedback
     */
    async learnFromFeedback(
        userId: string,
        actionId: string,
        rating: number,
        comment?: string
    ): Promise<void> {
        const feedback: UserFeedback = {
            userId,
            actionId,
            rating,
            comment,
            timestamp: Date.now(),
        };

        if (!this.feedbackStore.has(userId)) {
            this.feedbackStore.set(userId, []);
        }
        this.feedbackStore.get(userId)!.push(feedback);

        // Store feedback as memory
        if (comment) {
            await this.vectorStore.add(userId, `User feedback: ${comment}`, {
                type: 'feedback',
                tags: [`rating_${rating}`],
            });
        }

        // Invalidate context cache
        this.userContextCache.delete(userId);
    }

    /**
     * Set an explicit user preference
     */
    setPreference(
        userId: string,
        type: PreferenceType,
        key: string,
        value: any
    ): UserPreference {
        const pref = this.preferenceLearner.setExplicit(userId, type, key, value);
        this.userContextCache.delete(userId);
        return pref;
    }

    /**
     * Get a specific preference
     */
    getPreference(userId: string, key: string): UserPreference | undefined {
        return this.preferenceLearner.getPreference(userId, key);
    }

    /**
     * Get all user preferences
     */
    getPreferences(userId: string): UserPreference[] {
        return this.preferenceLearner.getUserPreferences(userId);
    }

    /**
     * Get preferences by type
     */
    getPreferencesByType(userId: string, type: PreferenceType): UserPreference[] {
        return this.preferenceLearner.getPreferencesByType(userId, type);
    }

    /**
     * Query similar memories
     */
    async queryMemories(
        userId: string,
        query: string,
        options?: {
            topK?: number;
            type?: string;
            minRelevance?: number;
            tags?: string[];
        }
    ): Promise<MemoryQueryResult> {
        return this.vectorStore.query(userId, query, options);
    }

    /**
     * Get user's recent memories
     */
    getRecentMemories(userId: string, limit?: number): MemoryEntry[] {
        return this.vectorStore.getUserMemories(userId, limit);
    }

    /**
     * Get full user context for AI agents
     */
    async getUserContext(userId: string, forceRefresh?: boolean): Promise<UserContext> {
        // Check cache
        if (!forceRefresh) {
            const cached = this.userContextCache.get(userId);
            if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
                return cached.context;
            }
        }

        // Get preferences
        const preferences = this.preferenceLearner.getUserPreferences(userId);

        // Get recent actions
        const recentActions = this.vectorStore.getUserMemories(userId, 50);

        // Detect patterns
        const patterns = this.preferenceLearner.detectPatterns(userId, recentActions);

        // Calculate risk profile
        const riskProfile = this.preferenceLearner.calculateRiskProfile(userId, recentActions);

        const context: UserContext = {
            userId,
            preferences,
            recentActions,
            patterns,
            riskProfile,
            lastUpdated: Date.now(),
        };

        // Cache the context
        this.userContextCache.set(userId, { context, timestamp: Date.now() });

        return context;
    }

    /**
     * Get risk profile for a user
     */
    getRiskProfile(userId: string): RiskProfile {
        const actions = this.vectorStore.getUserMemories(userId);
        return this.preferenceLearner.calculateRiskProfile(userId, actions);
    }

    /**
     * Get detected patterns
     */
    getPatterns(userId: string): ContextPattern[] {
        const actions = this.vectorStore.getUserMemories(userId);
        return this.preferenceLearner.detectPatterns(userId, actions);
    }

    /**
     * Generate personalized suggestions based on context
     */
    async generateSuggestions(userId: string): Promise<string[]> {
        const context = await this.getUserContext(userId);
        const suggestions: string[] = [];

        // Suggestions based on patterns
        for (const pattern of context.patterns) {
            if (pattern.type === 'time_preference') {
                suggestions.push(`Schedule automated tasks around your peak activity time (${pattern.description})`);
            }
            if (pattern.type === 'protocol_preference') {
                suggestions.push(`Check new opportunities on ${pattern.description.split(' ').pop()}`);
            }
        }

        // Suggestions based on risk profile
        if (context.riskProfile.level === 'conservative') {
            suggestions.push('Consider setting up stop-loss orders for your positions');
        } else if (context.riskProfile.level === 'aggressive') {
            suggestions.push('You might benefit from portfolio diversification');
        }

        // Suggestions based on recent activity
        if (context.recentActions.length === 0) {
            suggestions.push('Set up your first automated trading policy');
        } else if (context.recentActions.length < 5) {
            suggestions.push('Keep using the platform to unlock personalized recommendations');
        }

        return suggestions;
    }

    /**
     * Get summary statistics for a user
     */
    getUserStats(userId: string): {
        totalActions: number;
        totalPreferences: number;
        patternCount: number;
        riskProfile: RiskProfile;
        memberSince?: number;
    } {
        const memories = this.vectorStore.getUserMemories(userId);
        const preferences = this.preferenceLearner.getUserPreferences(userId);
        const patterns = this.preferenceLearner.detectPatterns(userId, memories);
        const riskProfile = this.preferenceLearner.calculateRiskProfile(userId, memories);

        return {
            totalActions: memories.length,
            totalPreferences: preferences.length,
            patternCount: patterns.length,
            riskProfile,
            memberSince: memories.length > 0 
                ? Math.min(...memories.map(m => m.timestamp))
                : undefined,
        };
    }

    /**
     * Clear all data for a user
     */
    clearUserData(userId: string): void {
        this.vectorStore.deleteUserMemories(userId);
        this.preferenceLearner.clearUserPreferences(userId);
        this.userContextCache.delete(userId);
        this.feedbackStore.delete(userId);
    }

    /**
     * Export user data
     */
    exportUserData(userId: string): string {
        const data = {
            preferences: this.preferenceLearner.getUserPreferences(userId),
            memories: this.vectorStore.getUserMemories(userId).map(m => ({
                ...m,
                embedding: undefined, // Don't export embeddings
            })),
            feedback: this.feedbackStore.get(userId) || [],
        };

        return JSON.stringify(data, null, 2);
    }

    /**
     * Get system statistics
     */
    getSystemStats(): {
        totalMemories: number;
        uniqueUsers: number;
        byType: Record<string, number>;
    } {
        return this.vectorStore.getStats();
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.vectorStore.clear();
        this.userContextCache.clear();
        this.feedbackStore.clear();
    }
}

// Export all types and classes
export * from './types';
export { VectorStore } from './vector-store';
export { PreferenceLearner } from './preference-learner';
export { EmbeddingService } from './embedding-service';
