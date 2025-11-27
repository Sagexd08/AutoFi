import { randomUUID } from 'crypto';
import {
    MemoryEntry,
    MemoryMetadata,
    MemoryQueryResult,
    ContextualMemoryConfig,
} from './types';
import { EmbeddingService } from './embedding-service';

/**
 * VectorStore - In-memory vector database for memory storage
 * 
 * In production, this would integrate with ChromaDB or similar
 * For now, provides a fully functional in-memory implementation
 */
export class VectorStore {
    private config: ContextualMemoryConfig;
    private embeddingService: EmbeddingService;
    private memories: Map<string, MemoryEntry>;
    private userIndex: Map<string, Set<string>>; // userId -> memoryIds
    private typeIndex: Map<string, Set<string>>; // type -> memoryIds

    constructor(config: ContextualMemoryConfig) {
        this.config = config;
        this.embeddingService = new EmbeddingService(config);
        this.memories = new Map();
        this.userIndex = new Map();
        this.typeIndex = new Map();
    }

    /**
     * Add a memory entry
     */
    async add(
        userId: string,
        content: string,
        metadata: MemoryMetadata
    ): Promise<MemoryEntry> {
        const embedding = await this.embeddingService.embed(content);

        const entry: MemoryEntry = {
            id: randomUUID(),
            userId,
            content,
            embedding,
            metadata,
            timestamp: Date.now(),
        };

        // Store the memory
        this.memories.set(entry.id, entry);

        // Update user index
        if (!this.userIndex.has(userId)) {
            this.userIndex.set(userId, new Set());
        }
        this.userIndex.get(userId)!.add(entry.id);

        // Update type index
        if (!this.typeIndex.has(metadata.type)) {
            this.typeIndex.set(metadata.type, new Set());
        }
        this.typeIndex.get(metadata.type)!.add(entry.id);

        // Check memory limits
        await this.enforceMemoryLimits(userId);

        return entry;
    }

    /**
     * Add multiple memories in batch
     */
    async addBatch(
        userId: string,
        entries: { content: string; metadata: MemoryMetadata }[]
    ): Promise<MemoryEntry[]> {
        const contents = entries.map(e => e.content);
        const embeddings = await this.embeddingService.embedBatch(contents);

        const memories: MemoryEntry[] = entries.map((entry, index) => ({
            id: randomUUID(),
            userId,
            content: entry.content,
            embedding: embeddings[index],
            metadata: entry.metadata,
            timestamp: Date.now(),
        }));

        for (const memory of memories) {
            this.memories.set(memory.id, memory);

            if (!this.userIndex.has(userId)) {
                this.userIndex.set(userId, new Set());
            }
            this.userIndex.get(userId)!.add(memory.id);

            if (!this.typeIndex.has(memory.metadata.type)) {
                this.typeIndex.set(memory.metadata.type, new Set());
            }
            this.typeIndex.get(memory.metadata.type)!.add(memory.id);
        }

        await this.enforceMemoryLimits(userId);

        return memories;
    }

    /**
     * Query memories by similarity
     */
    async query(
        userId: string,
        queryText: string,
        options: {
            topK?: number;
            type?: string;
            minRelevance?: number;
            tags?: string[];
        } = {}
    ): Promise<MemoryQueryResult> {
        const topK = options.topK || 10;
        const minRelevance = options.minRelevance ?? this.config.relevanceThreshold;

        // Get user's memories
        const userMemoryIds = this.userIndex.get(userId);
        if (!userMemoryIds || userMemoryIds.size === 0) {
            return { entries: [], relevanceScores: [], totalResults: 0 };
        }

        // Filter by type if specified
        let candidateIds = [...userMemoryIds];
        if (options.type) {
            const typeMemoryIds = this.typeIndex.get(options.type);
            if (typeMemoryIds) {
                candidateIds = candidateIds.filter(id => typeMemoryIds.has(id));
            }
        }

        // Get candidates with embeddings
        const candidates = candidateIds
            .map(id => this.memories.get(id))
            .filter((m): m is MemoryEntry => m !== undefined && m.embedding !== undefined)
            .map(m => ({ id: m.id, embedding: m.embedding! }));

        if (candidates.length === 0) {
            return { entries: [], relevanceScores: [], totalResults: 0 };
        }

        // Generate query embedding
        const queryEmbedding = await this.embeddingService.embed(queryText);

        // Find most similar
        const similar = this.embeddingService.findMostSimilar(
            queryEmbedding,
            candidates,
            topK * 2 // Get more for filtering
        );

        // Filter by relevance threshold
        const filtered = similar.filter(s => s.similarity >= minRelevance);

        // Filter by tags if specified
        let results = filtered;
        if (options.tags && options.tags.length > 0) {
            results = filtered.filter(s => {
                const memory = this.memories.get(s.id);
                if (!memory?.metadata.tags) return false;
                return options.tags!.some(tag => memory.metadata.tags!.includes(tag));
            });
        }

        // Get final results
        const finalResults = results.slice(0, topK);

        return {
            entries: finalResults.map(r => this.memories.get(r.id)!),
            relevanceScores: finalResults.map(r => r.similarity),
            totalResults: results.length,
        };
    }

    /**
     * Get all memories for a user
     */
    getUserMemories(userId: string, limit?: number): MemoryEntry[] {
        const memoryIds = this.userIndex.get(userId);
        if (!memoryIds) return [];

        let memories = [...memoryIds]
            .map(id => this.memories.get(id))
            .filter((m): m is MemoryEntry => m !== undefined)
            .sort((a, b) => b.timestamp - a.timestamp);

        if (limit) {
            memories = memories.slice(0, limit);
        }

        return memories;
    }

    /**
     * Get a specific memory
     */
    getMemory(memoryId: string): MemoryEntry | undefined {
        return this.memories.get(memoryId);
    }

    /**
     * Delete a memory
     */
    delete(memoryId: string): boolean {
        const memory = this.memories.get(memoryId);
        if (!memory) return false;

        this.memories.delete(memoryId);

        const userMemories = this.userIndex.get(memory.userId);
        if (userMemories) {
            userMemories.delete(memoryId);
        }

        const typeMemories = this.typeIndex.get(memory.metadata.type);
        if (typeMemories) {
            typeMemories.delete(memoryId);
        }

        return true;
    }

    /**
     * Delete all memories for a user
     */
    deleteUserMemories(userId: string): number {
        const memoryIds = this.userIndex.get(userId);
        if (!memoryIds) return 0;

        let deleted = 0;
        for (const id of memoryIds) {
            if (this.delete(id)) {
                deleted++;
            }
        }

        this.userIndex.delete(userId);
        return deleted;
    }

    /**
     * Enforce memory limits per user
     */
    private async enforceMemoryLimits(userId: string): Promise<void> {
        const memoryIds = this.userIndex.get(userId);
        if (!memoryIds || memoryIds.size <= this.config.maxMemoriesPerUser) {
            return;
        }

        // Get memories sorted by timestamp (oldest first)
        const memories = [...memoryIds]
            .map(id => this.memories.get(id))
            .filter((m): m is MemoryEntry => m !== undefined)
            .sort((a, b) => a.timestamp - b.timestamp);

        // Delete oldest memories
        const toDelete = memories.slice(0, memories.length - this.config.maxMemoriesPerUser);
        for (const memory of toDelete) {
            this.delete(memory.id);
        }
    }

    /**
     * Get statistics
     */
    getStats(): {
        totalMemories: number;
        uniqueUsers: number;
        byType: Record<string, number>;
    } {
        const byType: Record<string, number> = {};
        for (const [type, ids] of this.typeIndex) {
            byType[type] = ids.size;
        }

        return {
            totalMemories: this.memories.size,
            uniqueUsers: this.userIndex.size,
            byType,
        };
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.memories.clear();
        this.userIndex.clear();
        this.typeIndex.clear();
    }
}
