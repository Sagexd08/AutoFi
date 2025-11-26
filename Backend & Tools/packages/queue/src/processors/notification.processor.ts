import { Job } from 'bullmq';
import type { NotificationJobData } from '../queues/notification.queue.js';

/**
 * Notification processor - sends notifications through various channels
 * 
 * Supported channels:
 * - in_app: Save to database for in-app display
 * - email: Send via email service
 * - webhook: POST to webhook URL
 * - push: Send push notification
 */
export class NotificationProcessor {
  async process(job: Job<NotificationJobData>): Promise<{ success: boolean; channels: string[] }> {
    const { userId, type, channels } = job.data;
    const processedChannels: string[] = [];

    console.log(`[NotificationProcessor] Sending ${type} notification to user ${userId}`);

    try {
      for (const channel of channels) {
        try {
          switch (channel) {
            case 'in_app':
              await this.sendInApp(job.data);
              processedChannels.push('in_app');
              break;
            case 'email':
              await this.sendEmail(job.data);
              processedChannels.push('email');
              break;
            case 'webhook':
              await this.sendWebhook(job.data);
              processedChannels.push('webhook');
              break;
            case 'push':
              await this.sendPush(job.data);
              processedChannels.push('push');
              break;
            default:
              console.warn(`[NotificationProcessor] Unknown channel: ${channel}`);
          }
        } catch (channelError) {
          console.error(`[NotificationProcessor] Failed to send via ${channel}:`, channelError);
          // Continue with other channels
        }
      }

      return {
        success: processedChannels.length > 0,
        channels: processedChannels,
      };
    } catch (error) {
      console.error('[NotificationProcessor] Notification failed:', error);
      throw error;
    }
  }

  private async sendInApp(data: NotificationJobData): Promise<void> {
    // TODO: Save to database via notification repository
    console.log('[NotificationProcessor] Saving in-app notification:', {
      userId: data.userId,
      type: data.type,
      title: data.title,
    });

    // Placeholder - would save to database
    // await db.notification.create({
    //   data: {
    //     userId: data.userId!,
    //     type: data.type.toUpperCase() as any,
    //     title: data.title,
    //     message: data.message,
    //     resourceType: data.resourceType,
    //     resourceId: data.resourceId,
    //     channels: data.channels,
    //     metadata: data.metadata,
    //   },
    // });
  }

  private async sendEmail(data: NotificationJobData): Promise<void> {
    if (!data.emailTo && !data.userId) {
      throw new Error('No email recipient specified');
    }

    const emailHtml = this._buildEmailHtml(data);

    console.log('[NotificationProcessor] Sending email notification:', {
      to: data.emailTo,
      subject: data.title,
      htmlLength: emailHtml.length,
    });

    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    // await emailService.send({
    //   to: data.emailTo ?? await getUserEmail(data.userId!),
    //   subject: data.title,
    //   html: emailHtml,
    // });
  }

  private async sendWebhook(data: NotificationJobData): Promise<void> {
    if (!data.webhookUrl) {
      throw new Error('No webhook URL specified');
    }

    console.log('[NotificationProcessor] Sending webhook notification:', {
      url: data.webhookUrl,
    });

    const response = await fetch(data.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: data.type,
        title: data.title,
        message: data.message,
        userId: data.userId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        timestamp: data.timestamp ?? Date.now(),
        metadata: data.metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  private async sendPush(data: NotificationJobData): Promise<void> {
    console.log('[NotificationProcessor] Sending push notification:', {
      userId: data.userId,
      title: data.title,
    });

    // TODO: Integrate with push notification service (Firebase, OneSignal, etc.)
    // await pushService.send({
    //   userId: data.userId!,
    //   title: data.title,
    //   body: data.message,
    //   data: {
    //     type: data.type,
    //     resourceType: data.resourceType,
    //     resourceId: data.resourceId,
    //     actionUrl: data.actionUrl,
    //   },
    // });
  }

  private _buildEmailHtml(data: NotificationJobData): string {
    // Simple email template
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${data.title}</h1>
            </div>
            <div class="content">
              <p>${data.message}</p>
              ${data.actionUrl ? `<a href="${data.actionUrl}" class="button">View Details</a>` : ''}
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

export const notificationProcessor = new NotificationProcessor();
