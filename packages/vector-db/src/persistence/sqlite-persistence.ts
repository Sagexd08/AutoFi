/**
 * SQLite-based persistence layer for Vector DB
 * Stores documents, metadata, and index state
 */

import Database from 'better-sqlite3';
import type { VectorDocument } from '../embeddings/hnsw-index.js';

export interface PersistenceConfig {
  dbPath: string;
  tableName?: string;
}

export interface StoredDocument {
  id: string;
  content: string;
  embedding: string; // JSON string of number[]
  metadata: string; // JSON string
  created_at: string;
  updated_at: string;
  collection: string;
}

export class SQLitePersistence {
  private db: Database.Database;
  private tableName: string;
  private statements: {
    insert: Database.Statement;
    update: Database.Statement;
    delete: Database.Statement;
    get: Database.Statement;
    getAll: Database.Statement;
    getByCollection: Database.Statement;
    search: Database.Statement;
    count: Database.Statement;
    deleteCollection: Database.Statement;
  };

  constructor(config: PersistenceConfig) {
    this.tableName = config.tableName || 'vector_documents';
    this.db = new Database(config.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    
    this.initializeSchema();
    this.statements = this.prepareStatements();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        collection TEXT DEFAULT 'default'
      );

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_collection 
        ON ${this.tableName}(collection);
      
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_created_at 
        ON ${this.tableName}(created_at);

      CREATE TABLE IF NOT EXISTS collections (
        name TEXT PRIMARY KEY,
        description TEXT,
        dimensions INTEGER DEFAULT 256,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS index_state (
        collection TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  private prepareStatements() {
    return {
      insert: this.db.prepare(`
        INSERT INTO ${this.tableName} (id, content, embedding, metadata, created_at, updated_at, collection)
        VALUES (@id, @content, @embedding, @metadata, @created_at, @updated_at, @collection)
      `),
      update: this.db.prepare(`
        UPDATE ${this.tableName}
        SET content = @content, embedding = @embedding, metadata = @metadata, updated_at = @updated_at
        WHERE id = @id
      `),
      delete: this.db.prepare(`
        DELETE FROM ${this.tableName} WHERE id = @id
      `),
      get: this.db.prepare(`
        SELECT * FROM ${this.tableName} WHERE id = @id
      `),
      getAll: this.db.prepare(`
        SELECT * FROM ${this.tableName} ORDER BY created_at DESC
      `),
      getByCollection: this.db.prepare(`
        SELECT * FROM ${this.tableName} WHERE collection = @collection ORDER BY created_at DESC
      `),
      search: this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE collection = @collection AND content LIKE @query
        ORDER BY created_at DESC
        LIMIT @limit
      `),
      count: this.db.prepare(`
        SELECT COUNT(*) as count FROM ${this.tableName} WHERE collection = @collection
      `),
      deleteCollection: this.db.prepare(`
        DELETE FROM ${this.tableName} WHERE collection = @collection
      `),
    };
  }

  /**
   * Insert a document
   */
  insert(document: VectorDocument, collection: string = 'default'): void {
    const now = new Date().toISOString();
    this.statements.insert.run({
      id: document.id,
      content: document.content,
      embedding: JSON.stringify(document.embedding || []),
      metadata: JSON.stringify(document.metadata),
      created_at: document.createdAt?.toISOString() || now,
      updated_at: document.updatedAt?.toISOString() || now,
      collection,
    });
  }

  /**
   * Update a document
   */
  update(document: VectorDocument): void {
    this.statements.update.run({
      id: document.id,
      content: document.content,
      embedding: JSON.stringify(document.embedding || []),
      metadata: JSON.stringify(document.metadata),
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Delete a document
   */
  delete(id: string): boolean {
    const result = this.statements.delete.run({ id });
    return result.changes > 0;
  }

  /**
   * Get a document by ID
   */
  get(id: string): VectorDocument | null {
    const row = this.statements.get.get({ id }) as StoredDocument | undefined;
    if (!row) return null;
    return this.rowToDocument(row);
  }

  /**
   * Get all documents
   */
  getAll(): VectorDocument[] {
    const rows = this.statements.getAll.all() as StoredDocument[];
    return rows.map(row => this.rowToDocument(row));
  }

  /**
   * Get documents by collection
   */
  getByCollection(collection: string): VectorDocument[] {
    const rows = this.statements.getByCollection.all({ collection }) as StoredDocument[];
    return rows.map(row => this.rowToDocument(row));
  }

  /**
   * Text search (basic)
   */
  textSearch(query: string, collection: string = 'default', limit: number = 10): VectorDocument[] {
    const rows = this.statements.search.all({
      collection,
      query: `%${query}%`,
      limit,
    }) as StoredDocument[];
    return rows.map(row => this.rowToDocument(row));
  }

  /**
   * Get document count for a collection
   */
  count(collection: string = 'default'): number {
    const result = this.statements.count.get({ collection }) as { count: number };
    return result.count;
  }

  /**
   * Delete all documents in a collection
   */
  deleteCollection(collection: string): number {
    const result = this.statements.deleteCollection.run({ collection });
    return result.changes;
  }

  /**
   * Save index state for a collection
   */
  saveIndexState(collection: string, state: any): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO index_state (collection, state, updated_at)
      VALUES (@collection, @state, @updated_at)
    `);
    stmt.run({
      collection,
      state: JSON.stringify(state),
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Load index state for a collection
   */
  loadIndexState(collection: string): any | null {
    const stmt = this.db.prepare(`
      SELECT state FROM index_state WHERE collection = @collection
    `);
    const row = stmt.get({ collection }) as { state: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.state);
  }

  /**
   * Batch insert documents
   */
  insertBatch(documents: VectorDocument[], collection: string = 'default'): void {
    const insertMany = this.db.transaction((docs: VectorDocument[]) => {
      const now = new Date().toISOString();
      for (const doc of docs) {
        this.statements.insert.run({
          id: doc.id,
          content: doc.content,
          embedding: JSON.stringify(doc.embedding || []),
          metadata: JSON.stringify(doc.metadata),
          created_at: doc.createdAt?.toISOString() || now,
          updated_at: doc.updatedAt?.toISOString() || now,
          collection,
        });
      }
    });
    insertMany(documents);
  }

  /**
   * Convert database row to VectorDocument
   */
  private rowToDocument(row: StoredDocument): VectorDocument {
    return {
      id: row.id,
      content: row.content,
      embedding: JSON.parse(row.embedding),
      metadata: JSON.parse(row.metadata),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database stats
   */
  getStats(): {
    totalDocuments: number;
    collections: { name: string; count: number }[];
    dbSize: number;
  } {
    const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
    const total = (totalStmt.get() as { count: number }).count;

    const collectionsStmt = this.db.prepare(`
      SELECT collection as name, COUNT(*) as count 
      FROM ${this.tableName} 
      GROUP BY collection
    `);
    const collections = collectionsStmt.all() as { name: string; count: number }[];

    // Approximate DB size
    const pageCountStmt = this.db.prepare('PRAGMA page_count');
    const pageSizeStmt = this.db.prepare('PRAGMA page_size');
    const pageCount = (pageCountStmt.get() as { page_count: number }).page_count;
    const pageSize = (pageSizeStmt.get() as { page_size: number }).page_size;

    return {
      totalDocuments: total,
      collections,
      dbSize: pageCount * pageSize,
    };
  }
}

export default SQLitePersistence;
