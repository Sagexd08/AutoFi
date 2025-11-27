/**
 * Vector Database Service
 * Provides semantic search and memory capabilities for the backend
 */

import VectorDB, { type VectorDocument, type SearchResult } from '@celo-automator/vector-db';
import { logger } from '../utils/logger.js';
import path from 'path';

export interface MemoryEntry {
  id: string;
  walletAddress: string;
  type: 'automation' | 'transaction' | 'prompt' | 'context' | 'feedback';
  content: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface SearchMemoryOptions {
  walletAddress?: string;
  type?: MemoryEntry['type'];
  limit?: number;
  minScore?: number;
}

class VectorDBService {
  private db: VectorDB;
  private initialized: boolean = false;

  constructor() {
    const dbPath = process.env.VECTOR_DB_PATH || path.join(process.cwd(), 'data', 'vector.db');
    
    this.db = new VectorDB({
      dbPath,
      dimensions: 256,
      defaultCollection: 'automations',
      persist: true,
      indexConfig: {
        efConstruction: 200,
        M: 16,
        efSearch: 100,
      },
    });
  }

  /**
   * Initialize the vector database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.db.initialize();
      
      // Create default collections
      await this.db.createCollection('automations', 'User automation workflows');
      await this.db.createCollection('transactions', 'Transaction history');
      await this.db.createCollection('prompts', 'User prompts and intents');
      await this.db.createCollection('feedback', 'User feedback and ratings');
      await this.db.createCollection('context', 'Contextual memory');
      
      this.initialized = true;
      logger.info('Vector database initialized');
    } catch (error) {
      logger.error('Failed to initialize vector database', { error });
      throw error;
    }
  }

  /**
   * Add a memory entry
   */
  async addMemory(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<MemoryEntry> {
    await this.ensureInitialized();

    const collection = this.getCollectionForType(entry.type);
    
    const doc = await this.db.add({
      content: entry.content,
      metadata: {
        ...entry.metadata,
        walletAddress: entry.walletAddress,
        type: entry.type,
      },
      collection,
    });

    return {
      id: doc.id,
      walletAddress: entry.walletAddress,
      type: entry.type,
      content: entry.content,
      metadata: entry.metadata,
      timestamp: doc.createdAt,
    };
  }

  /**
   * Search memories semantically
   */
  async searchMemory(query: string, options: SearchMemoryOptions = {}): Promise<Array<MemoryEntry & { score: number }>> {
    await this.ensureInitialized();

    const collection = options.type ? this.getCollectionForType(options.type) : undefined;
    
    // If no specific collection, search all
    let allResults: SearchResult[] = [];
    
    if (collection) {
      allResults = await this.db.search(query, {
        collection,
        limit: (options.limit || 10) * 2, // Get extra for filtering
        minScore: options.minScore,
      });
    } else {
      // Search all collections
      const collections = ['automations', 'transactions', 'prompts', 'context', 'feedback'];
      for (const col of collections) {
        const results = await this.db.search(query, {
          collection: col,
          limit: options.limit || 10,
          minScore: options.minScore,
        });
        allResults.push(...results);
      }
      // Sort by score
      allResults.sort((a, b) => b.score - a.score);
    }

    // Filter by wallet address if provided
    if (options.walletAddress) {
      allResults = allResults.filter(
        r => r.document.metadata.walletAddress === options.walletAddress
      );
    }

    // Convert to MemoryEntry
    return allResults.slice(0, options.limit || 10).map(r => ({
      id: r.document.id,
      walletAddress: r.document.metadata.walletAddress || '',
      type: r.document.metadata.type || 'context',
      content: r.document.content,
      metadata: r.document.metadata,
      timestamp: r.document.createdAt,
      score: r.score,
    }));
  }

  /**
   * Get similar automations for a user
   */
  async getSimilarAutomations(
    prompt: string,
    walletAddress: string,
    limit: number = 5
  ): Promise<Array<{ automation: VectorDocument; score: number }>> {
    await this.ensureInitialized();

    const results = await this.db.search(prompt, {
      collection: 'automations',
      limit: limit * 2,
      filter: doc => doc.metadata.walletAddress === walletAddress,
    });

    return results.slice(0, limit).map(r => ({
      automation: r.document,
      score: r.score,
    }));
  }

  /**
   * Store automation for learning
   */
  async storeAutomation(
    walletAddress: string,
    prompt: string,
    plan: any,
    success: boolean
  ): Promise<string> {
    await this.ensureInitialized();

    const doc = await this.db.add({
      content: prompt,
      metadata: {
        walletAddress,
        plan,
        success,
        executedAt: new Date().toISOString(),
      },
      collection: 'automations',
    });

    return doc.id;
  }

  /**
   * Store transaction for history
   */
  async storeTransaction(
    walletAddress: string,
    txHash: string,
    description: string,
    details: any
  ): Promise<string> {
    await this.ensureInitialized();

    const doc = await this.db.add({
      content: description,
      metadata: {
        walletAddress,
        txHash,
        ...details,
      },
      collection: 'transactions',
    });

    return doc.id;
  }

  /**
   * Store user prompt for learning
   */
  async storePrompt(
    walletAddress: string,
    prompt: string,
    parsedIntent: any
  ): Promise<string> {
    await this.ensureInitialized();

    const doc = await this.db.add({
      content: prompt,
      metadata: {
        walletAddress,
        parsedIntent,
      },
      collection: 'prompts',
    });

    return doc.id;
  }

  /**
   * Store user feedback
   */
  async storeFeedback(
    walletAddress: string,
    automationId: string,
    rating: number,
    comment?: string
  ): Promise<string> {
    await this.ensureInitialized();

    const doc = await this.db.add({
      content: comment || `Rating: ${rating}`,
      metadata: {
        walletAddress,
        automationId,
        rating,
      },
      collection: 'feedback',
    });

    return doc.id;
  }

  /**
   * Get user context
   */
  async getUserContext(walletAddress: string, limit: number = 10): Promise<MemoryEntry[]> {
    await this.ensureInitialized();

    const results = await this.searchMemory('', {
      walletAddress,
      limit,
    });

    return results;
  }

  /**
   * Calculate text similarity
   */
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    await this.ensureInitialized();
    return this.db.similarity(text1, text2);
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    await this.ensureInitialized();
    return this.db.getStats();
  }

  /**
   * Get collection name for memory type
   */
  private getCollectionForType(type: MemoryEntry['type']): string {
    const mapping: Record<MemoryEntry['type'], string> = {
      automation: 'automations',
      transaction: 'transactions',
      prompt: 'prompts',
      context: 'context',
      feedback: 'feedback',
    };
    return mapping[type] || 'context';
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Close the database
   */
  async close(): Promise<void> {
    await this.db.close();
    this.initialized = false;
  }
}

// Export singleton instance
export const vectorDBService = new VectorDBService();
export default vectorDBService;
