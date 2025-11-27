import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  userId?: string;
  agentId?: string;
  transactionHash?: string;
  riskScore?: number;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

const auditLogs: AuditLogEntry[] = [];

export function auditLog(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  const logEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  auditLogs.push(logEntry);
  logger.info('Audit log', { ...logEntry } as Record<string, unknown>);

  if (auditLogs.length > 10000) {
    auditLogs.shift();
  }
}

export function getAuditLogs(filters?: {
  agentId?: string;
  action?: string;
  startTime?: string;
  endTime?: string;
}): AuditLogEntry[] {
  let filtered = auditLogs;

  if (filters?.agentId) {
    filtered = filtered.filter((log) => log.agentId === filters.agentId);
  }

  if (filters?.action) {
    filtered = filtered.filter((log) => log.action === filters.action);
  }

  if (filters?.startTime) {
    filtered = filtered.filter((log) => log.timestamp >= filters.startTime!);
  }

  if (filters?.endTime) {
    filtered = filtered.filter((log) => log.timestamp <= filters.endTime!);
  }

  return filtered;
}

export function auditMiddleware(req: Request, res: Response, next: () => void): void {
  const originalSend = res.send;

  res.send = function (body) {
    if (res.statusCode >= 400) {
      auditLog({
        action: 'api_error',
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          error: typeof body === 'string' ? body : JSON.stringify(body),
        },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    return originalSend.call(this, body);
  };

  next();
}

