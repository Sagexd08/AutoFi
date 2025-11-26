import { wsService, type EventType } from './websocket.js';
import { logger } from '../utils/logger.js';

// Notification channel types
type NotificationChannel = 'websocket' | 'webhook' | 'email' | 'slack';

interface NotificationPayload {
  type: EventType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  data: Record<string, unknown>;
  channels?: NotificationChannel[];
  userId?: string;
  agentId?: string;
  workflowId?: string;
}

interface WebhookConfig {
  url: string;
  secret?: string;
  events: EventType[];
  enabled: boolean;
}

// In-memory webhook registry
const webhooks = new Map<string, WebhookConfig>();

class NotificationService {
  private defaultChannels: NotificationChannel[] = ['websocket'];

  async notify(payload: NotificationPayload): Promise<void> {
    const channels = payload.channels || this.defaultChannels;
    
    const promises = channels.map(async (channel) => {
      try {
        switch (channel) {
          case 'websocket':
            await this.sendWebSocket(payload);
            break;
          case 'webhook':
            await this.sendWebhook(payload);
            break;
          case 'email':
            await this.sendEmail(payload);
            break;
          case 'slack':
            await this.sendSlack(payload);
            break;
        }
      } catch (error) {
        logger.error({ channel, error, type: payload.type }, 'Failed to send notification');
      }
    });

    await Promise.allSettled(promises);
  }

  private async sendWebSocket(payload: NotificationPayload): Promise<void> {
    wsService.broadcast({
      type: payload.type,
      timestamp: new Date().toISOString(),
      data: {
        title: payload.title,
        message: payload.message,
        severity: payload.severity,
        ...payload.data,
        userId: payload.userId,
        agentId: payload.agentId,
        workflowId: payload.workflowId,
      },
    });
  }

  private async sendWebhook(payload: NotificationPayload): Promise<void> {
    const matchingWebhooks = Array.from(webhooks.values())
      .filter(wh => wh.enabled && wh.events.includes(payload.type));

    for (const webhook of matchingWebhooks) {
      try {
        const body = {
          type: payload.type,
          timestamp: new Date().toISOString(),
          title: payload.title,
          message: payload.message,
          severity: payload.severity,
          data: payload.data,
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (webhook.secret) {
          // Create HMAC signature
          const crypto = await import('crypto');
          const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(JSON.stringify(body))
            .digest('hex');
          headers['X-Autofi-Signature'] = `sha256=${signature}`;
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`Webhook failed with status ${response.status}`);
        }

        logger.debug({ url: webhook.url, type: payload.type }, 'Webhook delivered');
      } catch (error) {
        logger.error({ url: webhook.url, error }, 'Webhook delivery failed');
      }
    }
  }

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    // Email sending would be implemented with a service like SendGrid, SES, etc.
    // For now, just log
    logger.info({
      type: payload.type,
      title: payload.title,
      userId: payload.userId,
    }, 'Email notification (not implemented)');
  }

  private async sendSlack(payload: NotificationPayload): Promise<void> {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      return;
    }

    try {
      const color = payload.severity === 'critical' ? '#dc2626'
        : payload.severity === 'error' ? '#ea580c'
        : payload.severity === 'warning' ? '#ca8a04'
        : '#2563eb';

      const response = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [{
            color,
            title: payload.title,
            text: payload.message,
            fields: Object.entries(payload.data).slice(0, 5).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true,
            })),
            footer: 'Autofi Notifications',
            ts: Math.floor(Date.now() / 1000),
          }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed with status ${response.status}`);
      }

      logger.debug({ type: payload.type }, 'Slack notification sent');
    } catch (error) {
      logger.error({ error }, 'Slack notification failed');
    }
  }

  // Webhook management
  registerWebhook(id: string, config: WebhookConfig): void {
    webhooks.set(id, config);
    logger.info({ id, url: config.url, events: config.events }, 'Webhook registered');
  }

  unregisterWebhook(id: string): boolean {
    const deleted = webhooks.delete(id);
    if (deleted) {
      logger.info({ id }, 'Webhook unregistered');
    }
    return deleted;
  }

  getWebhooks(): Array<{ id: string } & WebhookConfig> {
    return Array.from(webhooks.entries()).map(([id, config]) => ({
      id,
      ...config,
    }));
  }

  // Convenience methods for common notifications
  async notifyTransactionPending(data: {
    transactionId: string;
    chainId: number;
    to: string;
    value?: string;
    agentId?: string;
    workflowId?: string;
    userId?: string;
    riskScore?: number;
  }): Promise<void> {
    await this.notify({
      type: 'transaction:pending',
      title: 'Transaction Pending',
      message: `Transaction ${data.transactionId} is pending execution`,
      severity: 'info',
      data,
      userId: data.userId,
      agentId: data.agentId,
      workflowId: data.workflowId,
    });
  }

  async notifyTransactionConfirmed(data: {
    transactionId: string;
    hash: string;
    blockNumber: number;
    gasUsed: string;
    agentId?: string;
    userId?: string;
  }): Promise<void> {
    await this.notify({
      type: 'transaction:confirmed',
      title: 'Transaction Confirmed',
      message: `Transaction ${data.hash} confirmed in block ${data.blockNumber}`,
      severity: 'info',
      data,
      userId: data.userId,
      agentId: data.agentId,
    });
  }

  async notifyTransactionFailed(data: {
    transactionId: string;
    error: string;
    agentId?: string;
    userId?: string;
  }): Promise<void> {
    await this.notify({
      type: 'transaction:failed',
      title: 'Transaction Failed',
      message: `Transaction ${data.transactionId} failed: ${data.error}`,
      severity: 'error',
      data,
      userId: data.userId,
      agentId: data.agentId,
    });
  }

  async notifyApprovalRequired(data: {
    approvalId: string;
    transactionId: string;
    riskScore: number;
    riskLevel: string;
    priority: string;
    expiresAt: string;
    userId?: string;
    agentId?: string;
  }): Promise<void> {
    const severity = data.riskLevel === 'critical' ? 'critical'
      : data.riskLevel === 'high' ? 'error'
      : 'warning';

    await this.notify({
      type: 'approval:created',
      title: 'Approval Required',
      message: `Transaction ${data.transactionId} requires approval (Risk: ${data.riskLevel})`,
      severity,
      data,
      channels: ['websocket', 'webhook', 'slack'],
      userId: data.userId,
      agentId: data.agentId,
    });
  }

  async notifyApprovalResolved(data: {
    approvalId: string;
    transactionId: string;
    status: 'approved' | 'rejected' | 'expired';
    resolvedBy?: string;
    userId?: string;
    agentId?: string;
  }): Promise<void> {
    const type: EventType = data.status === 'approved'
      ? 'approval:approved'
      : data.status === 'rejected'
        ? 'approval:rejected'
        : 'approval:expired';

    await this.notify({
      type,
      title: `Approval ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}`,
      message: `Transaction ${data.transactionId} approval ${data.status}`,
      severity: data.status === 'approved' ? 'info' : 'warning',
      data,
      userId: data.userId,
      agentId: data.agentId,
    });
  }

  async notifySystemAlert(data: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    context?: Record<string, unknown>;
  }): Promise<void> {
    await this.notify({
      type: 'system:alert',
      title: data.title,
      message: data.message,
      severity: data.severity,
      data: data.context || {},
      channels: data.severity === 'critical' ? ['websocket', 'webhook', 'slack'] : ['websocket'],
    });
  }
}

// Singleton instance
export const notificationService = new NotificationService();

export default notificationService;
