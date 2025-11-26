import axios from 'axios';
import { logger } from '../utils/logger.js';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const webhookUrl = process.env.WEBHOOK_URL;

export async function sendWebhook(payload: WebhookPayload): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  try {
    await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
  } catch (error) {
    logger.error({ error, payload }, 'Failed to send webhook');
  }
}

export async function sendHighRiskAlert(
  transactionHash: string,
  riskScore: number,
  agentId?: string
): Promise<void> {
  if (riskScore >= 0.85) {
    await sendWebhook({
      event: 'high_risk_transaction',
      timestamp: new Date().toISOString(),
      data: {
        transactionHash,
        riskScore,
        agentId,
        severity: 'critical',
        message: 'High-risk transaction detected and blocked',
      },
    });
  }
}

export async function sendAgentAlert(
  event: string,
  agentId: string,
  details: Record<string, unknown>
): Promise<void> {
  await sendWebhook({
    event: `agent_${event}`,
    timestamp: new Date().toISOString(),
    data: {
      agentId,
      ...details,
    },
  });
}

