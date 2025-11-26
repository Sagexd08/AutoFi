// Re-export Prisma client
export { PrismaClient } from '@prisma/client';
export type {
  User,
  Session,
  Agent,
  Workflow,
  WorkflowExecution,
  WorkflowStep,
  Transaction,
  Approval,
  AuditLog,
  Chain,
  QueueJob,
  Notification,
  UserRole,
  AgentType,
  ExecutionMode,
  WorkflowStatus,
  ExecutionStatus,
  TransactionStatus,
  RiskLevel,
  ApprovalStatus,
  ApprovalPriority,
  AuditEventType,
  JobStatus,
  NotificationType,
} from '@prisma/client';

// Export database client singleton
export { db, disconnectDb, connectDb } from './client.js';

// Export repository classes
export * from './repositories/index.js';

// Export utilities
export * from './utils/index.js';
