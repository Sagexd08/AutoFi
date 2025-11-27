import {
    createPublicClient,
    createWalletClient,
    http,
    Address,
    WalletClient,
    PublicClient,
    parseAbi,
    Chain,
} from 'viem';
import { mainnet } from 'viem/chains';
import {
    ApprovalRecord,
    ApprovalStatus,
    ApprovalSummary,
    ApprovalManagerConfig,
    ApprovalManagerConfigSchema,
    RevocationResult,
} from './types';
import { AllowanceDatabase } from './database/allowance-db';
import { AutoRevokeSystem } from './auto-revoke';
import { randomUUID } from 'crypto';

/**
 * Main Approval Manager - Tracks and manages token allowances
 */
export class ApprovalManager {
    private config: ApprovalManagerConfig;
    private db: AllowanceDatabase;
    private autoRevoke: AutoRevokeSystem;
    private publicClients: Map<number, PublicClient>;
    private walletClients: Map<number, WalletClient>;

    constructor(config?: Partial<ApprovalManagerConfig>) {
        this.config = ApprovalManagerConfigSchema.parse(config || {});
        this.db = new AllowanceDatabase(this.config.databasePath);
        this.autoRevoke = new AutoRevokeSystem(this.db);
        this.publicClients = new Map();
        this.walletClients = new Map();

        if (this.config.autoRevokeAfterUse) {
            this.autoRevoke.start();
        }
    }

    /**
     * Track a new approval
     */
    async trackApproval(
        walletAddress: Address,
        tokenAddress: Address,
        spenderAddress: Address,
        amount: bigint,
        chainId: number,
        transactionHash: string,
        autoRevoke: boolean = true
    ): Promise<ApprovalRecord> {
        const isUnlimited = amount >= BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') / BigInt(2);

        // Warn on unlimited approval
        if (isUnlimited && this.config.warnOnUnlimitedApproval) {
            console.warn(`⚠️ Unlimited approval granted to ${spenderAddress} for token ${tokenAddress}`);
        }

        const approval: ApprovalRecord = {
            id: randomUUID(),
            walletAddress,
            tokenAddress,
            spenderAddress,
            chainId,
            amount: amount.toString(),
            isUnlimited,
            approvedAt: Date.now(),
            transactionHash,
            status: ApprovalStatus.ACTIVE,
            autoRevoke,
            expiresAt: this.config.maxApprovalAge
                ? Date.now() + this.config.maxApprovalAge * 1000
                : undefined,
        };

        this.db.insertApproval(approval);
        console.log(`✅ Tracked approval ${approval.id}`);

        return approval;
    }

    /**
     * Mark approval as used and schedule for revocation
     */
    async markAsUsed(
        approvalId: string,
        priority: 'low' | 'medium' | 'high' = 'medium'
    ): Promise<void> {
        const approval = this.db.getApproval(approvalId);

        if (!approval) {
            throw new Error(`Approval ${approvalId} not found`);
        }

        if (approval.autoRevoke && this.config.autoRevokeAfterUse) {
            // Schedule for immediate revocation
            this.autoRevoke.scheduleRevoke(approvalId, priority, 5000); // 5 second delay
            console.log(`Scheduled approval ${approvalId} for auto-revocation`);
        }
    }

    /**
     * Revoke a specific approval
     */
    async revokeApproval(
        approvalId: string,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<RevocationResult> {
        const approval = this.db.getApproval(approvalId);

        if (!approval) {
            return {
                success: false,
                approvalId,
                error: 'Approval not found',
            };
        }

        return this.autoRevoke.revokeApproval(approval, walletClient, publicClient);
    }

    /**
     * Revoke all approvals for a specific spender
     */
    async revokeAllForSpender(
        walletAddress: Address,
        spenderAddress: Address,
        chainId: number,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<RevocationResult[]> {
        const approvals = this.db
            .getActiveApprovals(walletAddress, chainId)
            .filter((a) => a.spenderAddress.toLowerCase() === spenderAddress.toLowerCase());

        const results: RevocationResult[] = [];

        for (const approval of approvals) {
            const result = await this.autoRevoke.revokeApproval(
                approval,
                walletClient,
                publicClient
            );
            results.push(result);

            // Add delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        return results;
    }

    /**
     * Revoke all unlimited approvals
     */
    async revokeAllUnlimited(
        walletAddress: Address,
        chainId: number,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<RevocationResult[]> {
        return this.autoRevoke.revokeAllUnlimited(
            walletAddress,
            chainId,
            walletClient,
            publicClient
        );
    }

    /**
     * Get approval summary for a wallet
     */
    getApprovalSummary(walletAddress: Address, chainId?: number): ApprovalSummary {
        return this.db.getApprovalSummary(walletAddress, chainId);
    }

    /**
     * Get active approvals for a wallet
     */
    getActiveApprovals(walletAddress: Address, chainId?: number): ApprovalRecord[] {
        return this.db.getActiveApprovals(walletAddress, chainId);
    }

    /**
     * Get unlimited approvals for a wallet
     */
    getUnlimitedApprovals(walletAddress: Address, chainId?: number): ApprovalRecord[] {
        return this.db.getUnlimitedApprovals(walletAddress, chainId);
    }

    /**
     * Check current allowance on-chain
     */
    async checkAllowance(
        tokenAddress: Address,
        ownerAddress: Address,
        spenderAddress: Address,
        chainId: number
    ): Promise<bigint> {
        const publicClient = this.getPublicClient(chainId);

        const erc20Abi = parseAbi([
            'function allowance(address owner, address spender) view returns (uint256)',
        ]);

        const allowance = await publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [ownerAddress, spenderAddress],
        });

        return allowance as bigint;
    }

    /**
     * Sync approvals with on-chain state
     */
    async syncApprovals(walletAddress: Address, chainId: number): Promise<void> {
        const approvals = this.db.getActiveApprovals(walletAddress, chainId);

        console.log(`Syncing ${approvals.length} approvals for ${walletAddress}...`);

        for (const approval of approvals) {
            try {
                const currentAllowance = await this.checkAllowance(
                    approval.tokenAddress,
                    walletAddress,
                    approval.spenderAddress,
                    chainId
                );

                // If allowance is 0, mark as revoked
                if (currentAllowance === BigInt(0)) {
                    this.db.updateApprovalStatus(approval.id, ApprovalStatus.REVOKED);
                    console.log(`Approval ${approval.id} synced as revoked`);
                }
            } catch (error) {
                console.error(`Failed to sync approval ${approval.id}:`, error);
            }

            // Add delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 200));
        }

        console.log('✅ Sync complete');
    }

    /**
     * Get statistics
     */
    getStatistics() {
        return this.db.getStatistics();
    }

    /**
     * Clean up old revoked approvals
     */
    cleanupOldApprovals(olderThanDays: number = 180): number {
        return this.db.cleanupOldApprovals(olderThanDays);
    }

    /**
     * Format approval summary for display
     */
    static formatApprovalSummary(summary: ApprovalSummary): string {
        const lines: string[] = [];

        lines.push('═══════════════════════════════════════════════════');
        lines.push('📋 APPROVAL SUMMARY');
        lines.push('═══════════════════════════════════════════════════');
        lines.push('');
        lines.push(`Wallet: ${summary.walletAddress}`);
        if (summary.chainId) {
            lines.push(`Chain ID: ${summary.chainId}`);
        }
        lines.push('');
        lines.push(`Total Approvals: ${summary.totalApprovals}`);
        lines.push(`Active Approvals: ${summary.activeApprovals}`);
        lines.push(`Unlimited Approvals: ${summary.unlimitedApprovals}`);
        lines.push('');

        // Risk score
        const riskEmoji =
            summary.riskScore >= 75
                ? '🔴'
                : summary.riskScore >= 50
                    ? '🟠'
                    : summary.riskScore >= 25
                        ? '🟡'
                        : '🟢';
        lines.push(`Risk Score: ${riskEmoji} ${summary.riskScore}/100`);
        lines.push('');

        if (summary.approvals.length > 0) {
            lines.push('───────────────────────────────────────────────────');
            lines.push('ACTIVE APPROVALS:');
            lines.push('───────────────────────────────────────────────────');

            summary.approvals.forEach((approval, index) => {
                lines.push(`\n${index + 1}. ${approval.isUnlimited ? '⚠️ UNLIMITED' : '✓'}`);
                lines.push(`   Token: ${approval.tokenAddress}`);
                lines.push(`   Spender: ${approval.spenderAddress}`);
                if (!approval.isUnlimited) {
                    lines.push(`   Amount: ${approval.amount}`);
                }
                lines.push(`   Approved: ${new Date(approval.approvedAt).toLocaleString()}`);
                if (approval.expiresAt) {
                    lines.push(`   Expires: ${new Date(approval.expiresAt).toLocaleString()}`);
                }
            });
        }

        lines.push('\n═══════════════════════════════════════════════════');

        return lines.join('\n');
    }

    /**
     * Get public client for chain
     */
    private getPublicClient(chainId: number): PublicClient {
        if (!this.publicClients.has(chainId)) {
            // TODO: Support multiple chains
            const client = createPublicClient({
                chain: mainnet,
                transport: http(),
            });
            this.publicClients.set(chainId, client);
        }
        return this.publicClients.get(chainId)!;
    }

    /**
     * Shutdown the manager
     */
    shutdown(): void {
        this.autoRevoke.stop();
        this.db.close();
        console.log('Approval Manager shutdown complete');
    }
}
