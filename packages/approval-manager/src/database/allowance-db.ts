import Database from 'better-sqlite3';
import { ApprovalRecord, ApprovalStatus, ApprovalSummary } from '../types';
import { Address } from 'viem';

/**
 * Database manager for approval tracking
 */
export class AllowanceDatabase {
    private db: Database.Database;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.initializeSchema();
    }

    /**
     * Initialize database schema
     */
    private initializeSchema(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        token_address TEXT NOT NULL,
        spender_address TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        amount TEXT NOT NULL,
        is_unlimited INTEGER NOT NULL,
        approved_at INTEGER NOT NULL,
        transaction_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        revoked_at INTEGER,
        revoke_transaction_hash TEXT,
        auto_revoke INTEGER NOT NULL,
        expires_at INTEGER,
        metadata TEXT,
        UNIQUE(wallet_address, token_address, spender_address, chain_id, transaction_hash)
      );

      CREATE INDEX IF NOT EXISTS idx_wallet_status 
        ON approvals(wallet_address, status);
      
      CREATE INDEX IF NOT EXISTS idx_chain_status 
        ON approvals(chain_id, status);
      
      CREATE INDEX IF NOT EXISTS idx_expires_at 
        ON approvals(expires_at) 
        WHERE expires_at IS NOT NULL;
      
      CREATE INDEX IF NOT EXISTS idx_auto_revoke 
        ON approvals(auto_revoke, status) 
        WHERE auto_revoke = 1;
    `);
    }

    /**
     * Insert new approval record
     */
    insertApproval(approval: ApprovalRecord): void {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO approvals (
        id, wallet_address, token_address, spender_address, chain_id,
        amount, is_unlimited, approved_at, transaction_hash, status,
        revoked_at, revoke_transaction_hash, auto_revoke, expires_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            approval.id,
            approval.walletAddress,
            approval.tokenAddress,
            approval.spenderAddress,
            approval.chainId,
            approval.amount,
            approval.isUnlimited ? 1 : 0,
            approval.approvedAt,
            approval.transactionHash,
            approval.status,
            approval.revokedAt || null,
            approval.revokeTransactionHash || null,
            approval.autoRevoke ? 1 : 0,
            approval.expiresAt || null,
            approval.metadata ? JSON.stringify(approval.metadata) : null
        );
    }

    /**
     * Get approval by ID
     */
    getApproval(id: string): ApprovalRecord | null {
        const stmt = this.db.prepare('SELECT * FROM approvals WHERE id = ?');
        const row = stmt.get(id) as any;
        return row ? this.rowToApproval(row) : null;
    }

    /**
     * Get all approvals for a wallet
     */
    getApprovalsByWallet(
        walletAddress: Address,
        chainId?: number,
        status?: ApprovalStatus
    ): ApprovalRecord[] {
        let query = 'SELECT * FROM approvals WHERE wallet_address = ?';
        const params: any[] = [walletAddress];

        if (chainId !== undefined) {
            query += ' AND chain_id = ?';
            params.push(chainId);
        }

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY approved_at DESC';

        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as any[];
        return rows.map((row) => this.rowToApproval(row));
    }

    /**
     * Get active approvals for a wallet
     */
    getActiveApprovals(walletAddress: Address, chainId?: number): ApprovalRecord[] {
        return this.getApprovalsByWallet(walletAddress, chainId, ApprovalStatus.ACTIVE);
    }

    /**
     * Get unlimited approvals
     */
    getUnlimitedApprovals(walletAddress: Address, chainId?: number): ApprovalRecord[] {
        let query = 'SELECT * FROM approvals WHERE wallet_address = ? AND is_unlimited = 1 AND status = ?';
        const params: any[] = [walletAddress, ApprovalStatus.ACTIVE];

        if (chainId !== undefined) {
            query += ' AND chain_id = ?';
            params.push(chainId);
        }

        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as any[];
        return rows.map((row) => this.rowToApproval(row));
    }

    /**
     * Get expired approvals
     */
    getExpiredApprovals(): ApprovalRecord[] {
        const now = Date.now();
        const stmt = this.db.prepare(`
      SELECT * FROM approvals 
      WHERE expires_at IS NOT NULL 
        AND expires_at < ? 
        AND status = ?
    `);
        const rows = stmt.all(now, ApprovalStatus.ACTIVE) as any[];
        return rows.map((row) => this.rowToApproval(row));
    }

    /**
     * Update approval status
     */
    updateApprovalStatus(
        id: string,
        status: ApprovalStatus,
        revokeTransactionHash?: string
    ): void {
        const stmt = this.db.prepare(`
      UPDATE approvals 
      SET status = ?, 
          revoked_at = ?,
          revoke_transaction_hash = ?
      WHERE id = ?
    `);

        stmt.run(
            status,
            status === ApprovalStatus.REVOKED ? Date.now() : null,
            revokeTransactionHash || null,
            id
        );
    }

    /**
     * Get approval summary for a wallet
     */
    getApprovalSummary(walletAddress: Address, chainId?: number): ApprovalSummary {
        const approvals = this.getApprovalsByWallet(walletAddress, chainId);
        const activeApprovals = approvals.filter((a) => a.status === ApprovalStatus.ACTIVE);
        const unlimitedApprovals = activeApprovals.filter((a) => a.isUnlimited);

        // Calculate risk score
        let riskScore = 0;
        riskScore += unlimitedApprovals.length * 10; // 10 points per unlimited approval
        riskScore += activeApprovals.length * 2; // 2 points per active approval

        // Add points for old approvals
        const now = Date.now();
        const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
        const oldApprovals = activeApprovals.filter((a) => a.approvedAt < ninetyDaysAgo);
        riskScore += oldApprovals.length * 5; // 5 points per old approval

        riskScore = Math.min(riskScore, 100);

        return {
            walletAddress,
            chainId: chainId || 0,
            totalApprovals: approvals.length,
            activeApprovals: activeApprovals.length,
            unlimitedApprovals: unlimitedApprovals.length,
            riskScore,
            approvals: activeApprovals,
        };
    }

    /**
     * Delete old revoked approvals
     */
    cleanupOldApprovals(olderThanDays: number = 180): number {
        const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
        const stmt = this.db.prepare(`
      DELETE FROM approvals 
      WHERE status = ? 
        AND revoked_at < ?
    `);
        const result = stmt.run(ApprovalStatus.REVOKED, cutoffTime);
        return result.changes;
    }

    /**
     * Get statistics
     */
    getStatistics(): {
        totalApprovals: number;
        activeApprovals: number;
        revokedApprovals: number;
        unlimitedApprovals: number;
    } {
        const total = this.db.prepare('SELECT COUNT(*) as count FROM approvals').get() as any;
        const active = this.db.prepare('SELECT COUNT(*) as count FROM approvals WHERE status = ?').get(ApprovalStatus.ACTIVE) as any;
        const revoked = this.db.prepare('SELECT COUNT(*) as count FROM approvals WHERE status = ?').get(ApprovalStatus.REVOKED) as any;
        const unlimited = this.db.prepare('SELECT COUNT(*) as count FROM approvals WHERE is_unlimited = 1 AND status = ?').get(ApprovalStatus.ACTIVE) as any;

        return {
            totalApprovals: total.count,
            activeApprovals: active.count,
            revokedApprovals: revoked.count,
            unlimitedApprovals: unlimited.count,
        };
    }

    /**
     * Convert database row to ApprovalRecord
     */
    private rowToApproval(row: any): ApprovalRecord {
        return {
            id: row.id,
            walletAddress: row.wallet_address as Address,
            tokenAddress: row.token_address as Address,
            spenderAddress: row.spender_address as Address,
            chainId: row.chain_id,
            amount: row.amount,
            isUnlimited: row.is_unlimited === 1,
            approvedAt: row.approved_at,
            transactionHash: row.transaction_hash,
            status: row.status as ApprovalStatus,
            revokedAt: row.revoked_at || undefined,
            revokeTransactionHash: row.revoke_transaction_hash || undefined,
            autoRevoke: row.auto_revoke === 1,
            expiresAt: row.expires_at || undefined,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        };
    }

    /**
     * Close database connection
     */
    close(): void {
        this.db.close();
    }
}
