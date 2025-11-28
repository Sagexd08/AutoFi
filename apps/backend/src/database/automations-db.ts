/**
 * SQLite-based persistence layer for Automations
 * Replaces in-memory Map storage with persistent database
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export interface Automation {
  id: string;
  name: string;
  type: 'transaction' | 'swap' | 'nft' | 'dao' | 'refi' | 'alerts';
  status: 'active' | 'paused' | 'completed' | 'failed';
  progress: number;
  parameters: Record<string, any>;
  schedule?: {
    frequency: 'once' | 'daily' | 'weekly' | 'monthly';
    cron?: string;
  };
  conditions?: Record<string, any>;
  walletAddress?: string;
  createdAt: string;
  updatedAt: string;
  nextRun: string;
  lastExecution?: {
    timestamp: string;
    status: 'success' | 'failed' | 'pending';
    txHash?: string;
    error?: string;
  };
}

export interface AutomationExecution {
  id: string;
  automationId: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
  txHash?: string;
  error?: string;
  gasUsed?: string;
  blockNumber?: number;
}

export class AutomationsDatabase {
  private db: Database.Database;
  private statements: {
    insert: Database.Statement;
    update: Database.Statement;
    delete: Database.Statement;
    get: Database.Statement;
    getAll: Database.Statement;
    getByWallet: Database.Statement;
    getByStatus: Database.Statement;
    updateStatus: Database.Statement;
    updateLastExecution: Database.Statement;
    insertExecution: Database.Statement;
    getExecutions: Database.Statement;
    count: Database.Statement;
  };

  constructor(dbPath: string = './data/automations.db') {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.initializeSchema();
    this.statements = this.prepareStatements();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        progress INTEGER DEFAULT 0,
        parameters TEXT NOT NULL DEFAULT '{}',
        schedule TEXT,
        conditions TEXT,
        wallet_address TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        next_run TEXT NOT NULL,
        last_execution TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_automations_wallet 
        ON automations(wallet_address);
      
      CREATE INDEX IF NOT EXISTS idx_automations_status 
        ON automations(status);
      
      CREATE INDEX IF NOT EXISTS idx_automations_type 
        ON automations(type);

      CREATE INDEX IF NOT EXISTS idx_automations_next_run 
        ON automations(next_run);

      CREATE TABLE IF NOT EXISTS automation_executions (
        id TEXT PRIMARY KEY,
        automation_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL,
        tx_hash TEXT,
        error TEXT,
        gas_used TEXT,
        block_number INTEGER,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_executions_automation 
        ON automation_executions(automation_id);
      
      CREATE INDEX IF NOT EXISTS idx_executions_timestamp 
        ON automation_executions(timestamp);
    `);
  }

  private prepareStatements() {
    return {
      insert: this.db.prepare(`
        INSERT INTO automations (
          id, name, type, status, progress, parameters, schedule, 
          conditions, wallet_address, created_at, updated_at, next_run, last_execution
        ) VALUES (
          @id, @name, @type, @status, @progress, @parameters, @schedule,
          @conditions, @wallet_address, @created_at, @updated_at, @next_run, @last_execution
        )
      `),
      update: this.db.prepare(`
        UPDATE automations SET
          name = @name,
          parameters = @parameters,
          schedule = @schedule,
          conditions = @conditions,
          updated_at = @updated_at,
          next_run = @next_run
        WHERE id = @id
      `),
      delete: this.db.prepare(`
        DELETE FROM automations WHERE id = @id
      `),
      get: this.db.prepare(`
        SELECT * FROM automations WHERE id = @id
      `),
      getAll: this.db.prepare(`
        SELECT * FROM automations ORDER BY created_at DESC
      `),
      getByWallet: this.db.prepare(`
        SELECT * FROM automations WHERE wallet_address = @wallet_address ORDER BY created_at DESC
      `),
      getByStatus: this.db.prepare(`
        SELECT * FROM automations WHERE status = @status ORDER BY created_at DESC
      `),
      updateStatus: this.db.prepare(`
        UPDATE automations SET status = @status, updated_at = @updated_at WHERE id = @id
      `),
      updateLastExecution: this.db.prepare(`
        UPDATE automations SET 
          last_execution = @last_execution, 
          progress = @progress,
          updated_at = @updated_at 
        WHERE id = @id
      `),
      insertExecution: this.db.prepare(`
        INSERT INTO automation_executions (
          id, automation_id, timestamp, status, tx_hash, error, gas_used, block_number
        ) VALUES (
          @id, @automation_id, @timestamp, @status, @tx_hash, @error, @gas_used, @block_number
        )
      `),
      getExecutions: this.db.prepare(`
        SELECT * FROM automation_executions 
        WHERE automation_id = @automation_id 
        ORDER BY timestamp DESC 
        LIMIT @limit
      `),
      count: this.db.prepare(`
        SELECT COUNT(*) as count FROM automations
      `),
    };
  }

  /**
   * Insert a new automation
   */
  insert(automation: Automation): void {
    this.statements.insert.run({
      id: automation.id,
      name: automation.name,
      type: automation.type,
      status: automation.status,
      progress: automation.progress,
      parameters: JSON.stringify(automation.parameters),
      schedule: automation.schedule ? JSON.stringify(automation.schedule) : null,
      conditions: automation.conditions ? JSON.stringify(automation.conditions) : null,
      wallet_address: automation.walletAddress || null,
      created_at: automation.createdAt,
      updated_at: automation.updatedAt,
      next_run: automation.nextRun,
      last_execution: automation.lastExecution ? JSON.stringify(automation.lastExecution) : null,
    });
  }

  /**
   * Update an automation
   */
  update(id: string, updates: Partial<Automation>): Automation | null {
    const existing = this.get(id);
    if (!existing) return null;

    const updatedAutomation = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.statements.update.run({
      id,
      name: updatedAutomation.name,
      parameters: JSON.stringify(updatedAutomation.parameters),
      schedule: updatedAutomation.schedule ? JSON.stringify(updatedAutomation.schedule) : null,
      conditions: updatedAutomation.conditions ? JSON.stringify(updatedAutomation.conditions) : null,
      updated_at: updatedAutomation.updatedAt,
      next_run: updatedAutomation.nextRun,
    });

    return this.get(id);
  }

  /**
   * Delete an automation
   */
  delete(id: string): boolean {
    const result = this.statements.delete.run({ id });
    return result.changes > 0;
  }

  /**
   * Get an automation by ID
   */
  get(id: string): Automation | null {
    const row = this.statements.get.get({ id }) as any;
    return row ? this.rowToAutomation(row) : null;
  }

  /**
   * Check if an automation exists
   */
  has(id: string): boolean {
    return this.get(id) !== null;
  }

  /**
   * Get all automations
   */
  getAll(): Automation[] {
    const rows = this.statements.getAll.all() as any[];
    return rows.map(row => this.rowToAutomation(row));
  }

  /**
   * Get automations by wallet address
   */
  getByWallet(walletAddress: string): Automation[] {
    const rows = this.statements.getByWallet.all({ wallet_address: walletAddress }) as any[];
    return rows.map(row => this.rowToAutomation(row));
  }

  /**
   * Get automations by status
   */
  getByStatus(status: Automation['status']): Automation[] {
    const rows = this.statements.getByStatus.all({ status }) as any[];
    return rows.map(row => this.rowToAutomation(row));
  }

  /**
   * Update automation status
   */
  updateStatus(id: string, status: Automation['status']): Automation | null {
    this.statements.updateStatus.run({
      id,
      status,
      updated_at: new Date().toISOString(),
    });
    return this.get(id);
  }

  /**
   * Record an execution
   */
  recordExecution(
    automationId: string, 
    execution: AutomationExecution
  ): void {
    // Insert execution record
    this.statements.insertExecution.run({
      id: execution.id,
      automation_id: automationId,
      timestamp: execution.timestamp,
      status: execution.status,
      tx_hash: execution.txHash || null,
      error: execution.error || null,
      gas_used: execution.gasUsed || null,
      block_number: execution.blockNumber || null,
    });

    // Update automation's last execution
    const lastExecution = {
      timestamp: execution.timestamp,
      status: execution.status,
      txHash: execution.txHash,
      error: execution.error,
    };

    this.statements.updateLastExecution.run({
      id: automationId,
      last_execution: JSON.stringify(lastExecution),
      progress: execution.status === 'success' ? 100 : 0,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Get execution history for an automation
   */
  getExecutions(automationId: string, limit: number = 20): AutomationExecution[] {
    const rows = this.statements.getExecutions.all({ 
      automation_id: automationId, 
      limit 
    }) as any[];
    
    return rows.map(row => ({
      id: row.id,
      automationId: row.automation_id,
      timestamp: row.timestamp,
      status: row.status,
      txHash: row.tx_hash || undefined,
      error: row.error || undefined,
      gasUsed: row.gas_used || undefined,
      blockNumber: row.block_number || undefined,
    }));
  }

  /**
   * Get automations due for execution
   */
  getDueAutomations(): Automation[] {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM automations 
      WHERE status = 'active' AND next_run <= @now
      ORDER BY next_run ASC
    `);
    const rows = stmt.all({ now }) as any[];
    return rows.map(row => this.rowToAutomation(row));
  }

  /**
   * Get total count
   */
  count(): number {
    const result = this.statements.count.get() as { count: number };
    return result.count;
  }

  /**
   * Convert database row to Automation
   */
  private rowToAutomation(row: any): Automation {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      progress: row.progress,
      parameters: JSON.parse(row.parameters || '{}'),
      schedule: row.schedule ? JSON.parse(row.schedule) : undefined,
      conditions: row.conditions ? JSON.parse(row.conditions) : undefined,
      walletAddress: row.wallet_address || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      nextRun: row.next_run,
      lastExecution: row.last_execution ? JSON.parse(row.last_execution) : undefined,
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    active: number;
    paused: number;
    completed: number;
    failed: number;
    byType: Record<string, number>;
  } {
    const total = this.count();
    
    const statusCounts = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM automations GROUP BY status
    `).all() as { status: string; count: number }[];
    
    const typeCounts = this.db.prepare(`
      SELECT type, COUNT(*) as count FROM automations GROUP BY type
    `).all() as { type: string; count: number }[];

    const statusMap: Record<string, number> = {};
    statusCounts.forEach(s => { statusMap[s.status] = s.count; });

    const typeMap: Record<string, number> = {};
    typeCounts.forEach(t => { typeMap[t.type] = t.count; });

    return {
      total,
      active: statusMap['active'] || 0,
      paused: statusMap['paused'] || 0,
      completed: statusMap['completed'] || 0,
      failed: statusMap['failed'] || 0,
      byType: typeMap,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let automationsDbInstance: AutomationsDatabase | null = null;

export function getAutomationsDB(dbPath?: string): AutomationsDatabase {
  if (!automationsDbInstance) {
    automationsDbInstance = new AutomationsDatabase(dbPath);
  }
  return automationsDbInstance;
}

export function closeAutomationsDB(): void {
  if (automationsDbInstance) {
    automationsDbInstance.close();
    automationsDbInstance = null;
  }
}
