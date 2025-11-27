/**
 * Vector Database - Main Entry Point
 * Provides semantic search, document storage, and memory capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import { HNSWIndex, type VectorDocument, type SearchResult, type HNSWConfig } from './embeddings/hnsw-index.js';
import { LocalEmbeddings } from './embeddings/local-embeddings.js';
import { SQLitePersistence } from './persistence/sqlite-persistence.js';
import { MemoryPersistence } from './persistence/memory-persistence.js';

// Persistence interface that both implementations share
interface Persistence {
  insert(document: VectorDocument, collection?: string): void;
  update(document: VectorDocument): void;
  delete(id: string): boolean;
  get(id: string): VectorDocument | null;
  getAll(): VectorDocument[];
  getByCollection(collection: string): VectorDocument[];
  textSearch(query: string, collection?: string, limit?: number): VectorDocument[];
  count(collection?: string): number;
  deleteCollection(collection: string): number;
  saveIndexState(collection: string, state: any): void;
  loadIndexState(collection: string): any | null;
  insertBatch(documents: VectorDocument[], collection?: string): void;
  close(): void;
  getStats(): { totalDocuments: number; collections: { name: string; count: number }[]; dbSize: number };
}

export interface VectorDBConfig {
  /** Path to SQLite database file */
  dbPath?: string;
  /** Number of embedding dimensions */
  dimensions?: number;
  /** Default collection name */
  defaultCollection?: string;
  /** Enable persistence */
  persist?: boolean;
  /** HNSW index configuration */
  indexConfig?: Partial<HNSWConfig>;
}

export interface AddDocumentInput {
  content: string;
  metadata?: Record<string, any>;
  id?: string;
  collection?: string;
}

export interface QueryOptions {
  collection?: string;
  limit?: number;
  minScore?: number;
  filter?: (doc: VectorDocument) => boolean;
}

export interface Collection {
  name: string;
  description?: string;
  dimensions: number;
  documentCount: number;
  createdAt: Date;
}

export class VectorDB {
  private config: Required<VectorDBConfig>;
  private indices: Map<string, HNSWIndex>;
  private persistence: Persistence | null;
  private embeddings: LocalEmbeddings;
  private initialized: boolean;

  constructor(config: VectorDBConfig = {}) {
    this.config = {
      dbPath: config.dbPath || ':memory:',
      dimensions: config.dimensions || 256,
      defaultCollection: config.defaultCollection || 'default',
      persist: config.persist ?? true,
      indexConfig: config.indexConfig || {},
    };

    this.indices = new Map();
    this.persistence = null;
    this.embeddings = new LocalEmbeddings({ dimensions: this.config.dimensions });
    this.initialized = false;
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize persistence layer
    if (this.config.persist && this.config.dbPath !== ':memory:') {
      try {
        // Try SQLite first
        this.persistence = new SQLitePersistence({ dbPath: this.config.dbPath });
      } catch (sqliteError) {
        // Fall back to memory persistence with JSON file backup
        console.warn('SQLite not available, using memory persistence with JSON backup:', sqliteError);
        const jsonPath = this.config.dbPath.replace(/\.db$/, '.json');
        this.persistence = new MemoryPersistence({ filePath: jsonPath });
      }
      
      // Load existing documents into indices
      await this.loadFromPersistence();
    }

    // Ensure default collection exists
    await this.getOrCreateIndex(this.config.defaultCollection);

    this.initialized = true;
  }

  /**
   * Load documents from persistence into memory indices
   */
  private async loadFromPersistence(): Promise<void> {
    if (!this.persistence) return;

    const stats = this.persistence.getStats();
    for (const { name: collection } of stats.collections) {
      const index = await this.getOrCreateIndex(collection);
      const documents = this.persistence.getByCollection(collection);
      
      for (const doc of documents) {
        // Add to index (embeddings already stored)
        await index.add(doc);
      }
    }
  }

  /**
   * Get or create an index for a collection
   */
  private async getOrCreateIndex(collection: string): Promise<HNSWIndex> {
    if (!this.indices.has(collection)) {
      const index = new HNSWIndex({
        dimensions: this.config.dimensions,
        ...this.config.indexConfig,
      });
      this.indices.set(collection, index);
    }
    return this.indices.get(collection)!;
  }

  /**
   * Add a document to the database
   */
  async add(input: AddDocumentInput): Promise<VectorDocument> {
    await this.ensureInitialized();

    const collection = input.collection || this.config.defaultCollection;
    const index = await this.getOrCreateIndex(collection);

    const document: Omit<VectorDocument, 'embedding'> = {
      id: input.id || uuidv4(),
      content: input.content,
      metadata: input.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to index (this generates the embedding)
    const fullDocument = await index.add(document);

    // Persist if enabled
    if (this.persistence) {
      this.persistence.insert(fullDocument, collection);
    }

    return fullDocument;
  }

  /**
   * Add multiple documents
   */
  async addBatch(inputs: AddDocumentInput[]): Promise<VectorDocument[]> {
    const results: VectorDocument[] = [];
    for (const input of inputs) {
      results.push(await this.add(input));
    }
    return results;
  }

  /**
   * Search for similar documents
   */
  async search(query: string, options: QueryOptions = {}): Promise<SearchResult[]> {
    await this.ensureInitialized();

    const collection = options.collection || this.config.defaultCollection;
    const limit = options.limit || 10;
    const minScore = options.minScore || 0;

    const index = this.indices.get(collection);
    if (!index) return [];

    let results = await index.search(query, limit * 2); // Get extra for filtering

    // Apply score filter
    if (minScore > 0) {
      results = results.filter(r => r.score >= minScore);
    }

    // Apply custom filter
    if (options.filter) {
      results = results.filter(r => options.filter!(r.document));
    }

    return results.slice(0, limit);
  }

  /**
   * Get a document by ID
   */
  async get(id: string, collection?: string): Promise<VectorDocument | null> {
    await this.ensureInitialized();

    // Search in specific collection or all collections
    if (collection) {
      const index = this.indices.get(collection);
      return index?.get(id) || null;
    }

    // Search all collections
    for (const index of this.indices.values()) {
      const doc = index.get(id);
      if (doc) return doc;
    }

    return null;
  }

  /**
   * Update a document
   */
  async update(id: string, updates: Partial<AddDocumentInput>): Promise<VectorDocument | null> {
    await this.ensureInitialized();

    // Find the document
    let foundCollection: string | null = null;
    let existingDoc: VectorDocument | null = null;

    for (const [collection, index] of this.indices) {
      const doc = index.get(id);
      if (doc) {
        foundCollection = collection;
        existingDoc = doc;
        break;
      }
    }

    if (!existingDoc || !foundCollection) return null;

    // Remove old document
    await this.delete(id, foundCollection);

    // Add updated document
    const newDoc = await this.add({
      id,
      content: updates.content || existingDoc.content,
      metadata: { ...existingDoc.metadata, ...updates.metadata },
      collection: foundCollection,
    });

    return newDoc;
  }

  /**
   * Delete a document
   */
  async delete(id: string, collection?: string): Promise<boolean> {
    await this.ensureInitialized();

    let deleted = false;

    if (collection) {
      const index = this.indices.get(collection);
      if (index) {
        deleted = await index.remove(id);
      }
    } else {
      // Delete from all collections
      for (const index of this.indices.values()) {
        if (await index.remove(id)) {
          deleted = true;
          break;
        }
      }
    }

    // Remove from persistence
    if (deleted && this.persistence) {
      this.persistence.delete(id);
    }

    return deleted;
  }

  /**
   * List all documents in a collection
   */
  async list(collection?: string): Promise<VectorDocument[]> {
    await this.ensureInitialized();

    const targetCollection = collection || this.config.defaultCollection;
    const index = this.indices.get(targetCollection);
    
    return index?.getAll() || [];
  }

  /**
   * Get all collections
   */
  async getCollections(): Promise<Collection[]> {
    await this.ensureInitialized();

    const collections: Collection[] = [];
    for (const [name, index] of this.indices) {
      const stats = index.getStats();
      collections.push({
        name,
        dimensions: stats.dimensions,
        documentCount: stats.totalDocuments,
        createdAt: new Date(), // Would need to track this in persistence
      });
    }
    return collections;
  }

  /**
   * Create a new collection
   */
  async createCollection(name: string, description?: string): Promise<Collection> {
    await this.ensureInitialized();

    const index = await this.getOrCreateIndex(name);
    const stats = index.getStats();

    return {
      name,
      description,
      dimensions: stats.dimensions,
      documentCount: 0,
      createdAt: new Date(),
    };
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.indices.has(name)) return false;

    this.indices.delete(name);
    
    if (this.persistence) {
      this.persistence.deleteCollection(name);
    }

    return true;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    totalCollections: number;
    dimensions: number;
    memoryUsage: number;
    persistenceStats?: any;
  }> {
    await this.ensureInitialized();

    let totalDocuments = 0;
    let memoryUsage = 0;

    for (const index of this.indices.values()) {
      const stats = index.getStats();
      totalDocuments += stats.totalDocuments;
      memoryUsage += stats.memoryUsage;
    }

    return {
      totalDocuments,
      totalCollections: this.indices.size,
      dimensions: this.config.dimensions,
      memoryUsage,
      persistenceStats: this.persistence?.getStats(),
    };
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
    if (this.persistence) {
      this.persistence.close();
    }
    this.indices.clear();
    this.initialized = false;
  }

  /**
   * Generate embedding for text (utility method)
   */
  async embed(text: string): Promise<number[]> {
    const result = await this.embeddings.embed(text);
    return result.embedding;
  }

  /**
   * Calculate similarity between two texts
   */
  async similarity(text1: string, text2: string): Promise<number> {
    const [emb1, emb2] = await Promise.all([
      this.embeddings.embed(text1),
      this.embeddings.embed(text2),
    ]);
    return LocalEmbeddings.cosineSimilarity(emb1.embedding, emb2.embedding);
  }
}

// Export everything
export { HNSWIndex, LocalEmbeddings, SQLitePersistence, MemoryPersistence };
export type { VectorDocument, SearchResult, HNSWConfig } from './embeddings/hnsw-index.js';
export type { EmbeddingOptions, EmbeddingResult } from './embeddings/local-embeddings.js';
export type { PersistenceConfig, StoredDocument } from './persistence/sqlite-persistence.js';
export type { MemoryPersistenceConfig } from './persistence/memory-persistence.js';

export default VectorDB;
