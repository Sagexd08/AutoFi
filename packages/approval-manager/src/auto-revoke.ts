import {
    createPublicClient,
    createWalletClient,
    http,
    Address,
    WalletClient,
    PublicClient,
    parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import { ApprovalRecord, RevocationResult, RevokeQueueItem } from './types';
import { AllowanceDatabase } from './database/allowance-db';

/**
 * Auto-revoke system for cleaning up approvals after use
 */
export class AutoRevokeSystem {
    private db: AllowanceDatabase;
    private revokeQueue: Map<string, RevokeQueueItem>;
    private isProcessing: boolean;
    private processInterval: NodeJS.Timeout | null;

    constructor(db: AllowanceDatabase) {
        this.db = db;
        this.revokeQueue = new Map();
        this.isProcessing = false;
        this.processInterval = null;
    }

    /**
     * Start the auto-revoke processor
     */
    start(intervalMs: number = 60000): void {
        if (this.processInterval) {
            return; // Already running
        }

        this.processInterval = setInterval(() => {
            this.processQueue().catch(console.error);
        }, intervalMs);

        console.log(`Auto-revoke system started (interval: ${intervalMs}ms)`);
    }

    /**
     * Stop the auto-revoke processor
     */
    stop(): void {
        if (this.processInterval) {
            clearInterval(this.processInterval);
            this.processInterval = null;
            console.log('Auto-revoke system stopped');
        }
    }

    /**
     * Schedule an approval for revocation
     */
    scheduleRevoke(
        approvalId: string,
        priority: 'low' | 'medium' | 'high' = 'medium',
        delayMs: number = 0
    ): void {
        const scheduledFor = Date.now() + delayMs;

        this.revokeQueue.set(approvalId, {
            approvalId,
            priority,
            scheduledFor,
            retryCount: 0,
            maxRetries: 3,
        });

        console.log(`Scheduled approval ${approvalId} for revocation (priority: ${priority})`);
    }

    /**
     * Revoke an approval immediately
     */
    async revokeApproval(
        approval: ApprovalRecord,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<RevocationResult> {
        try {
            console.log(`Revoking approval ${approval.id}...`);

            // ERC20 approve function ABI
            const erc20Abi = parseAbi([
                'function approve(address spender, uint256 amount) returns (bool)',
            ]);

            // Revoke by setting allowance to 0
            const hash = await walletClient.writeContract({
                address: approval.tokenAddress,
                abi: erc20Abi,
                functionName: 'approve',
                args: [approval.spenderAddress, BigInt(0)],
                account: approval.walletAddress,
            });

            console.log(`Revoke transaction sent: ${hash}`);

            // Wait for transaction confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success') {
                // Update database
                this.db.updateApprovalStatus(approval.id, 'revoked', hash);

                console.log(`✅ Approval ${approval.id} revoked successfully`);

                return {
                    success: true,
                    approvalId: approval.id,
                    transactionHash: hash,
                    gasUsed: receipt.gasUsed,
                };
            } else {
                throw new Error('Transaction reverted');
            }
        } catch (error: any) {
            console.error(`❌ Failed to revoke approval ${approval.id}:`, error.message);

            return {
                success: false,
                approvalId: approval.id,
                error: error.message,
            };
        }
    }

    /**
     * Process the revoke queue
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing) {
            return; // Already processing
        }

        this.isProcessing = true;

        try {
            const now = Date.now();
            const itemsToProcess: RevokeQueueItem[] = [];

            // Find items ready for processing
            for (const [id, item] of this.revokeQueue.entries()) {
                if (item.scheduledFor <= now) {
                    itemsToProcess.push(item);
                }
            }

            if (itemsToProcess.length === 0) {
                return;
            }

            // Sort by priority (high -> medium -> low)
            itemsToProcess.sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });

            console.log(`Processing ${itemsToProcess.length} revoke items...`);

            for (const item of itemsToProcess) {
                const approval = this.db.getApproval(item.approvalId);

                if (!approval) {
                    console.warn(`Approval ${item.approvalId} not found in database`);
                    this.revokeQueue.delete(item.approvalId);
                    continue;
                }

                if (approval.status !== 'active') {
                    console.log(`Approval ${item.approvalId} already ${approval.status}`);
                    this.revokeQueue.delete(item.approvalId);
                    continue;
                }

                // Note: In a real implementation, you would need to provide
                // wallet client and public client here. For now, we'll just
                // mark it as pending and let the user handle the actual revocation.

                console.log(`Approval ${item.approvalId} ready for revocation`);
                this.db.updateApprovalStatus(item.approvalId, 'pending_revoke');
                this.revokeQueue.delete(item.approvalId);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Revoke all unlimited approvals for a wallet
     */
    async revokeAllUnlimited(
        walletAddress: Address,
        chainId: number,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<RevocationResult[]> {
        const unlimitedApprovals = this.db.getUnlimitedApprovals(walletAddress, chainId);
        const results: RevocationResult[] = [];

        console.log(`Revoking ${unlimitedApprovals.length} unlimited approvals...`);

        for (const approval of unlimitedApprovals) {
            const result = await this.revokeApproval(approval, walletClient, publicClient);
            results.push(result);

            // Add delay between revocations to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        return results;
    }

    /**
     * Revoke expired approvals
     */
    async revokeExpired(
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<RevocationResult[]> {
        const expiredApprovals = this.db.getExpiredApprovals();
        const results: RevocationResult[] = [];

        console.log(`Revoking ${expiredApprovals.length} expired approvals...`);

        for (const approval of expiredApprovals) {
            const result = await this.revokeApproval(approval, walletClient, publicClient);
            results.push(result);

            // Add delay between revocations
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        return results;
    }

    /**
     * Get queue status
     */
    getQueueStatus(): {
        totalItems: number;
        readyItems: number;
        pendingItems: number;
        byPriority: { high: number; medium: number; low: number };
    } {
        const now = Date.now();
        let readyItems = 0;
        let pendingItems = 0;
        const byPriority = { high: 0, medium: 0, low: 0 };

        for (const item of this.revokeQueue.values()) {
            if (item.scheduledFor <= now) {
                readyItems++;
            } else {
                pendingItems++;
            }
            byPriority[item.priority]++;
        }

        return {
            totalItems: this.revokeQueue.size,
            readyItems,
            pendingItems,
            byPriority,
        };
    }

    /**
     * Clear the queue
     */
    clearQueue(): void {
        this.revokeQueue.clear();
        console.log('Revoke queue cleared');
    }

    /**
     * Estimate gas cost for revoking approvals
     */
    async estimateRevokeCost(
        approval: ApprovalRecord,
        publicClient: PublicClient
    ): Promise<bigint> {
        const erc20Abi = parseAbi([
            'function approve(address spender, uint256 amount) returns (bool)',
        ]);

        try {
            const gasEstimate = await publicClient.estimateContractGas({
                address: approval.tokenAddress,
                abi: erc20Abi,
                functionName: 'approve',
                args: [approval.spenderAddress, BigInt(0)],
                account: approval.walletAddress,
            });

            return gasEstimate;
        } catch (error) {
            // Return a conservative estimate if estimation fails
            return BigInt(50000); // Typical approve gas cost
        }
    }
}
