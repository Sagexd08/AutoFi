import { Queue } from 'bullmq';
import { getRedisConnection } from '../redis.js';
import { QUEUE_NAMES, type BaseJobData } from '../types.js';

export type NotificationChannel = 'in_app' | 'email' | 'webhook' | 'push';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationJobData extends BaseJobData {
  type: 'info' | 'success' | 'warning' | 'error' | 'approval_request' | 'transaction_update' | 'workflow_update';
  title: string;
  message: string;
  channels: NotificationChannel[];
  priority?: NotificationPriority;
  resourceType?: string;
  resourceId?: string;
  actionUrl?: string;
  webhookUrl?: string;
  emailTo?: string;
}

export const notificationQueue = new Queue<NotificationJobData>(
  QUEUE_NAMES.NOTIFICATION,
  {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  }
);

// Helper functions
export async function sendNotification(
  userId: string,
  notification: Omit<NotificationJobData, 'userId' | 'timestamp'>
): Promise<string> {
  const job = await notificationQueue.add(
    'send-notification',
    {
      ...notification,
      userId,
      timestamp: Date.now(),
    },
    {
      priority: notification.priority === 'urgent' ? 10 : notification.priority === 'high' ? 5 : 0,
    }
  );
  return job.id ?? '';
}

export async function sendApprovalRequest(
  userId: string,
  approvalId: string,
  options: {
    title: string;
    message: string;
    riskLevel: string;
    channels?: NotificationChannel[];
  }
): Promise<string> {
  return sendNotification(userId, {
    type: 'approval_request',
    title: options.title,
    message: options.message,
    channels: options.channels ?? ['in_app', 'email'],
    priority: options.riskLevel === 'critical' ? 'urgent' : 'high',
    resourceType: 'approval',
    resourceId: approvalId,
    actionUrl: `/approvals/${approvalId}`,
  });
}

export async function sendTransactionUpdate(
  userId: string,
  transactionId: string,
  status: 'confirmed' | 'failed',
  options?: {
    hash?: string;
    error?: string;
  }
): Promise<string> {
  return sendNotification(userId, {
    type: 'transaction_update',
    title: `Transaction ${status === 'confirmed' ? 'Confirmed' : 'Failed'}`,
    message: status === 'confirmed'
      ? `Transaction ${options?.hash?.slice(0, 10)}... has been confirmed`
      : `Transaction failed: ${options?.error ?? 'Unknown error'}`,
    channels: ['in_app'],
    priority: status === 'failed' ? 'high' : 'normal',
    resourceType: 'transaction',
    resourceId: transactionId,
  });
}

export async function sendWorkflowUpdate(
  userId: string,
  workflowId: string,
  status: 'completed' | 'failed',
  options?: {
    name?: string;
    error?: string;
  }
): Promise<string> {
  return sendNotification(userId, {
    type: 'workflow_update',
    title: `Workflow ${status === 'completed' ? 'Completed' : 'Failed'}`,
    message: status === 'completed'
      ? `Workflow "${options?.name ?? workflowId}" completed successfully`
      : `Workflow "${options?.name ?? workflowId}" failed: ${options?.error ?? 'Unknown error'}`,
    channels: ['in_app'],
    priority: status === 'failed' ? 'high' : 'normal',
    resourceType: 'workflow',
    resourceId: workflowId,
  });
}
