/**
 * In-memory persistence layer for Vector DB
 * A fallback when SQLite native modules aren't available
 * Data is stored in memory and can optionally be serialized to JSON files
 */

import type { VectorDocument } from '../embeddings/hnsw-index.js';
import * as fs from 'fs';
import * as path from 'path';

export interface MemoryPersistenceConfig {
  filePath?: string; // Optional path to persist to JSON file
}

export class MemoryPersistence {
  private documents: Map<string, VectorDocument & { collection: string }> = new Map();
  private collections: Map<string, { description?: string; dimensions: number; createdAt: Date }> = new Map();
  private indexStates: Map<string, any> = new Map();
  private filePath?: string;

  constructor(config: MemoryPersistenceConfig = {}) {
    this.filePath = config.filePath;
    if (this.filePath) {
      this.loadFromFile();
    }
  }

  private loadFromFile(): void {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      
      if (data.documents) {
        for (const [id, doc] of Object.entries(data.documents)) {
          const d = doc as any;
          this.documents.set(id, {
            ...d,
            createdAt: new Date(d.createdAt),
            updatedAt: new Date(d.updatedAt),
          });
        }
      }
      
      if (data.collections) {
        for (const [name, col] of Object.entries(data.collections)) {
          const c = col as any;
          this.collections.set(name, {
            ...c,
            createdAt: new Date(c.createdAt),
          });
        }
      }
      
      if (data.indexStates) {
        for (const [name, state] of Object.entries(data.indexStates)) {
          this.indexStates.set(name, state);
        }
      }
    } catch (e) {
      console.warn('Failed to load persistence file:', e);
    }
  }

  private saveToFile(): void {
    if (!this.filePath) return;
    
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const data = {
        documents: Object.fromEntries(this.documents),
        collections: Object.fromEntries(this.collections),
        indexStates: Object.fromEntries(this.indexStates),
      };
      
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn('Failed to save persistence file:', e);
    }
  }

  /**
   * Insert a document
   */
  insert(document: VectorDocument, collection: string = 'default'): void {
    const now = new Date();
    this.documents.set(document.id, {
      ...document,
      collection,
      createdAt: document.createdAt || now,
      updatedAt: document.updatedAt || now,
    });
    this.saveToFile();
  }

  /**
   * Update a document
   */
  update(document: VectorDocument): void {
    const existing = this.documents.get(document.id);
    if (existing) {
      this.documents.set(document.id, {
        ...existing,
        ...document,
        updatedAt: new Date(),
      });
      this.saveToFile();
    }
  }

  /**
   * Delete a document
   */
  delete(id: string): boolean {
    const deleted = this.documents.delete(id);
    if (deleted) {
      this.saveToFile();
    }
    return deleted;
  }

  /**
   * Get a document by ID
   */
  get(id: string): VectorDocument | null {
    const doc = this.documents.get(id);
    if (!doc) return null;
    const { collection: _, ...document } = doc;
    return document;
  }

  /**
   * Get all documents
   */
  getAll(): VectorDocument[] {
    return Array.from(this.documents.values())
      .map(({ collection: _, ...doc }) => doc)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  /**
   * Get documents by collection
   */
  getByCollection(collection: string): VectorDocument[] {
    return Array.from(this.documents.values())
      .filter(doc => doc.collection === collection)
      .map(({ collection: _, ...doc }) => doc)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  /**
   * Text search (basic)
   */
  textSearch(query: string, collection: string = 'default', limit: number = 10): VectorDocument[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.documents.values())
      .filter(doc => 
        doc.collection === collection && 
        doc.content.toLowerCase().includes(lowerQuery)
      )
      .map(({ collection: _, ...doc }) => doc)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  /**
   * Get document count for a collection
   */
  count(collection: string = 'default'): number {
    return Array.from(this.documents.values())
      .filter(doc => doc.collection === collection)
      .length;
  }

  /**
   * Delete all documents in a collection
   */
  deleteCollection(collection: string): number {
    let count = 0;
    for (const [id, doc] of this.documents.entries()) {
      if (doc.collection === collection) {
        this.documents.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.saveToFile();
    }
    return count;
  }

  /**
   * Save index state for a collection
   */
  saveIndexState(collection: string, state: any): void {
    this.indexStates.set(collection, state);
    this.saveToFile();
  }

  /**
   * Load index state for a collection
   */
  loadIndexState(collection: string): any | null {
    return this.indexStates.get(collection) || null;
  }

  /**
   * Batch insert documents
   */
  insertBatch(documents: VectorDocument[], collection: string = 'default'): void {
    const now = new Date();
    for (const doc of documents) {
      this.documents.set(doc.id, {
        ...doc,
        collection,
        createdAt: doc.createdAt || now,
        updatedAt: doc.updatedAt || now,
      });
    }
    this.saveToFile();
  }

  /**
   * Close (no-op for memory persistence, but saves to file)
   */
  close(): void {
    this.saveToFile();
  }

  /**
   * Get database stats
   */
  getStats(): {
    totalDocuments: number;
    collections: { name: string; count: number }[];
    dbSize: number;
  } {
    const collectionCounts = new Map<string, number>();
    
    for (const doc of this.documents.values()) {
      collectionCounts.set(
        doc.collection, 
        (collectionCounts.get(doc.collection) || 0) + 1
      );
    }

    return {
      totalDocuments: this.documents.size,
      collections: Array.from(collectionCounts.entries()).map(([name, count]) => ({ name, count })),
      dbSize: JSON.stringify(Object.fromEntries(this.documents)).length,
    };
  }
}

export default MemoryPersistence;
