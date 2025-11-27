import { z } from 'zod';

/**
 * Types of user preferences
 */
export enum PreferenceType {
    RISK_TOLERANCE = 'risk_tolerance',
    PREFERRED_DEX = 'preferred_dex',
    PREFERRED_CHAIN = 'preferred_chain',
    MAX_SLIPPAGE = 'max_slippage',
    MAX_GAS_PRICE = 'max_gas_price',
    TRADE_SIZE = 'trade_size',
    TRADING_HOURS = 'trading_hours',
    TOKEN_PREFERENCE = 'token_preference',
    PROTOCOL_PREFERENCE = 'protocol_preference',
    AUTOMATION_STYLE = 'automation_style',
    NOTIFICATION_PREFERENCE = 'notification_preference',
    CUSTOM = 'custom',
}

/**
 * User preference record
 */
export interface UserPreference {
    id: string;
    userId: string;
    type: PreferenceType;
    key: string;
    value: any;
    confidence: number; // 0-1
    learnedAt: number;
    updatedAt: number;
    sourceActions: number; // Number of actions this was learned from
    isExplicit: boolean; // User explicitly set vs learned
}

/**
 * Memory entry for vector storage
 */
export interface MemoryEntry {
    id: string;
    userId: string;
    content: string;
    embedding?: number[];
    metadata: MemoryMetadata;
    timestamp: number;
}

/**
 * Metadata for memory entries
 */
export interface MemoryMetadata {
    type: 'action' | 'preference' | 'feedback' | 'context';
    actionType?: string;
    protocol?: string;
    chain?: string;
    tokens?: string[];
    amount?: number;
    success?: boolean;
    tags?: string[];
}

/**
 * User context for personalization
 */
export interface UserContext {
    userId: string;
    preferences: UserPreference[];
    recentActions: MemoryEntry[];
    patterns: ContextPattern[];
    riskProfile: RiskProfile;
    lastUpdated: number;
}

/**
 * Detected pattern in user behavior
 */
export interface ContextPattern {
    type: string;
    description: string;
    confidence: number;
    occurrences: number;
    lastSeen: number;
}

/**
 * User risk profile
 */
export interface RiskProfile {
    level: 'conservative' | 'moderate' | 'aggressive';
    maxPositionSize: number; // percentage of portfolio
    maxSingleTrade: number; // in USD
    preferredLeverage: number;
    stopLossEnabled: boolean;
    calculatedAt: number;
}

/**
 * Learning feedback from user
 */
export interface UserFeedback {
    userId: string;
    actionId: string;
    rating: number; // 1-5
    comment?: string;
    timestamp: number;
}

/**
 * Query result for memory search
 */
export interface MemoryQueryResult {
    entries: MemoryEntry[];
    relevanceScores: number[];
    totalResults: number;
}

/**
 * Configuration for contextual memory
 * Uses custom LSTM-based embeddings instead of external LLM providers
 */
export const ContextualMemoryConfigSchema = z.object({
    chromaDbUrl: z.string().default('http://localhost:8000'),
    collectionName: z.string().default('autofi_memories'),
    embeddingDimensions: z.number().default(128), // LSTM embedding output dimensions
    maxMemoriesPerUser: z.number().default(10000),
    relevanceThreshold: z.number().default(0.7),
    learningRate: z.number().default(0.1),
    minActionsForLearning: z.number().default(5),
    sqliteDbPath: z.string().optional(),
    lstmUnits: z.number().default(64), // LSTM hidden units
    vocabularySize: z.number().default(10000), // Max vocabulary size for tokenizer
});

export type ContextualMemoryConfig = z.infer<typeof ContextualMemoryConfigSchema>;

/**
 * Preference update event
 */
export interface PreferenceUpdateEvent {
    userId: string;
    preference: UserPreference;
    previousValue?: any;
    reason: string;
}
