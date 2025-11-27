import { z } from 'zod';
import { Address } from 'viem';

/**
 * Approval status
 */
export enum ApprovalStatus {
    ACTIVE = 'active',
    REVOKED = 'revoked',
    EXPIRED = 'expired',
    PENDING_REVOKE = 'pending_revoke',
}

/**
 * Approval record in database
 */
export interface ApprovalRecord {
    id: string;
    walletAddress: Address;
    tokenAddress: Address;
    spenderAddress: Address;
    chainId: number;
    amount: string; // BigInt as string
    isUnlimited: boolean;
    approvedAt: number; // timestamp
    transactionHash: string;
    status: ApprovalStatus;
    revokedAt?: number;
    revokeTransactionHash?: string;
    autoRevoke: boolean;
    expiresAt?: number; // optional expiration timestamp
    metadata?: Record<string, any>;
}

/**
 * Approval summary for a wallet
 */
export interface ApprovalSummary {
    walletAddress: Address;
    chainId: number;
    totalApprovals: number;
    activeApprovals: number;
    unlimitedApprovals: number;
    riskScore: number; // 0-100
    approvals: ApprovalRecord[];
}

/**
 * Revocation result
 */
export interface RevocationResult {
    success: boolean;
    approvalId: string;
    transactionHash?: string;
    error?: string;
    gasUsed?: bigint;
}

/**
 * Approval manager configuration
 */
export const ApprovalManagerConfigSchema = z.object({
    autoRevokeAfterUse: z.boolean().default(true),
    trackUnlimitedApprovals: z.boolean().default(true),
    warnOnUnlimitedApproval: z.boolean().default(true),
    maxApprovalAge: z.number().default(90 * 24 * 60 * 60), // 90 days in seconds
    revokeExpiredApprovals: z.boolean().default(true),
    databasePath: z.string().default('./approvals.db'),
});

export type ApprovalManagerConfig = z.infer<typeof ApprovalManagerConfigSchema>;

/**
 * ERC20 Approval event
 */
export interface ApprovalEvent {
    owner: Address;
    spender: Address;
    value: bigint;
    transactionHash: string;
    blockNumber: bigint;
    logIndex: number;
}

/**
 * Revoke queue item
 */
export interface RevokeQueueItem {
    approvalId: string;
    priority: 'low' | 'medium' | 'high';
    scheduledFor: number; // timestamp
    retryCount: number;
    maxRetries: number;
}
