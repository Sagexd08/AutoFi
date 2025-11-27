/**
 * @autofi/approval-manager
 * 
 * Allowance tracking and auto-revocation system for Autofi
 * 
 * Features:
 * - Track all token approvals
 * - Auto-revoke after use
 * - Unlimited approval warnings
 * - On-chain sync
 * - Risk scoring
 * - Batch revocation
 */

export { ApprovalManager } from './manager';
export { AutoRevokeSystem } from './auto-revoke';
export { AllowanceDatabase } from './database/allowance-db';

export type {
    ApprovalRecord,
    ApprovalSummary,
    RevocationResult,
    ApprovalManagerConfig,
    ApprovalEvent,
    RevokeQueueItem,
} from './types';

export { ApprovalStatus } from './types';
