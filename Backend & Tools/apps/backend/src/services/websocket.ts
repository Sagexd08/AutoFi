import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger.js';

// Event types
export type EventType = 
  | 'transaction:pending'
  | 'transaction:submitted'
  | 'transaction:confirmed'
  | 'transaction:failed'
  | 'approval:created'
  | 'approval:approved'
  | 'approval:rejected'
  | 'approval:expired'
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'agent:action'
  | 'agent:error'
  | 'system:alert';

export interface WebSocketEvent {
  type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
}

interface SubscribedClient {
  ws: WebSocket;
  userId?: string;
  agentIds?: string[];
  workflowIds?: string[];
  subscriptions: Set<EventType | 'all'>;
  connectedAt: Date;
  lastPing: Date;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, SubscribedClient> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      const client: SubscribedClient = {
        ws,
        subscriptions: new Set(['all']), // Subscribe to all by default
        connectedAt: new Date(),
        lastPing: new Date(),
      };

      this.clients.set(clientId, client);

      logger.info({ 
        clientId, 
        ip: req.socket.remoteAddress,
        totalClients: this.clients.size,
      }, 'WebSocket client connected');

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'system:alert',
        timestamp: new Date().toISOString(),
        data: {
          message: 'Connected to Autofi WebSocket',
          clientId,
        },
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(clientId, data);
        } catch (error) {
          logger.warn({ clientId, error }, 'Failed to parse WebSocket message');
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info({ 
          clientId, 
          totalClients: this.clients.size,
        }, 'WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        logger.error({ clientId, error }, 'WebSocket error');
        this.clients.delete(clientId);
      });

      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastPing = new Date();
        }
      });
    });

    // Heartbeat to detect stale connections
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          // Check if client is responsive
          const timeSinceLastPing = Date.now() - client.lastPing.getTime();
          if (timeSinceLastPing > 60000) { // 60 seconds
            logger.warn({ clientId }, 'Client unresponsive, terminating');
            client.ws.terminate();
            this.clients.delete(clientId);
          } else {
            client.ws.ping();
          }
        } else {
          this.clients.delete(clientId);
        }
      });
    }, 30000); // Every 30 seconds

    logger.info('WebSocket server initialized');
  }

  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private handleClientMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.action) {
      case 'subscribe':
        if (message.events && Array.isArray(message.events)) {
          message.events.forEach((event: EventType | 'all') => {
            client.subscriptions.add(event);
          });
          logger.debug({ clientId, events: message.events }, 'Client subscribed to events');
        }
        if (message.userId) {
          client.userId = message.userId;
        }
        if (message.agentIds && Array.isArray(message.agentIds)) {
          client.agentIds = message.agentIds;
        }
        if (message.workflowIds && Array.isArray(message.workflowIds)) {
          client.workflowIds = message.workflowIds;
        }
        break;

      case 'unsubscribe':
        if (message.events && Array.isArray(message.events)) {
          message.events.forEach((event: EventType | 'all') => {
            client.subscriptions.delete(event);
          });
          logger.debug({ clientId, events: message.events }, 'Client unsubscribed from events');
        }
        break;

      case 'ping':
        this.sendToClient(clientId, {
          type: 'system:alert',
          timestamp: new Date().toISOString(),
          data: { message: 'pong' },
        });
        break;

      default:
        logger.warn({ clientId, action: message.action }, 'Unknown WebSocket action');
    }
  }

  private sendToClient(clientId: string, event: WebSocketEvent): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(event));
      } catch (error) {
        logger.error({ clientId, error }, 'Failed to send WebSocket message');
      }
    }
  }

  private shouldReceiveEvent(client: SubscribedClient, event: WebSocketEvent): boolean {
    // Check if subscribed to this event type
    if (!client.subscriptions.has('all') && !client.subscriptions.has(event.type)) {
      return false;
    }

    // Check user filter
    if (client.userId && event.data.userId && event.data.userId !== client.userId) {
      return false;
    }

    // Check agent filter
    if (client.agentIds && client.agentIds.length > 0 && event.data.agentId) {
      if (!client.agentIds.includes(event.data.agentId as string)) {
        return false;
      }
    }

    // Check workflow filter
    if (client.workflowIds && client.workflowIds.length > 0 && event.data.workflowId) {
      if (!client.workflowIds.includes(event.data.workflowId as string)) {
        return false;
      }
    }

    return true;
  }

  broadcast(event: WebSocketEvent): void {
    this.clients.forEach((client, clientId) => {
      if (this.shouldReceiveEvent(client, event)) {
        this.sendToClient(clientId, event);
      }
    });
  }

  // Convenience methods for common events
  notifyTransactionPending(data: {
    transactionId: string;
    chainId: number;
    to: string;
    value?: string;
    agentId?: string;
    workflowId?: string;
    userId?: string;
    riskScore?: number;
  }): void {
    this.broadcast({
      type: 'transaction:pending',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  notifyTransactionSubmitted(data: {
    transactionId: string;
    hash: string;
    chainId: number;
    agentId?: string;
    workflowId?: string;
    userId?: string;
  }): void {
    this.broadcast({
      type: 'transaction:submitted',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  notifyTransactionConfirmed(data: {
    transactionId: string;
    hash: string;
    blockNumber: number;
    gasUsed: string;
    agentId?: string;
    workflowId?: string;
    userId?: string;
  }): void {
    this.broadcast({
      type: 'transaction:confirmed',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  notifyTransactionFailed(data: {
    transactionId: string;
    error: string;
    agentId?: string;
    workflowId?: string;
    userId?: string;
  }): void {
    this.broadcast({
      type: 'transaction:failed',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  notifyApprovalCreated(data: {
    approvalId: string;
    transactionId: string;
    riskScore: number;
    riskLevel: string;
    priority: string;
    expiresAt: string;
    agentId?: string;
    userId?: string;
  }): void {
    this.broadcast({
      type: 'approval:created',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  notifyApprovalResolved(data: {
    approvalId: string;
    transactionId: string;
    status: 'approved' | 'rejected' | 'expired';
    resolvedBy?: string;
    reason?: string;
    agentId?: string;
    userId?: string;
  }): void {
    const type = data.status === 'approved' 
      ? 'approval:approved' 
      : data.status === 'rejected'
        ? 'approval:rejected'
        : 'approval:expired';
    
    this.broadcast({
      type,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  notifyWorkflowStatus(data: {
    workflowId: string;
    executionId?: string;
    status: 'started' | 'completed' | 'failed';
    error?: string;
    result?: unknown;
    userId?: string;
  }): void {
    const type = data.status === 'started'
      ? 'workflow:started'
      : data.status === 'completed'
        ? 'workflow:completed'
        : 'workflow:failed';
    
    this.broadcast({
      type,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  notifyAgentAction(data: {
    agentId: string;
    action: string;
    details?: unknown;
    userId?: string;
  }): void {
    this.broadcast({
      type: 'agent:action',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  notifyAgentError(data: {
    agentId: string;
    error: string;
    context?: unknown;
    userId?: string;
  }): void {
    this.broadcast({
      type: 'agent:error',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  // Get connection stats
  getStats(): {
    totalConnections: number;
    connections: Array<{
      clientId: string;
      userId?: string;
      subscriptions: string[];
      connectedAt: Date;
    }>;
  } {
    const connections: Array<{
      clientId: string;
      userId?: string;
      subscriptions: string[];
      connectedAt: Date;
    }> = [];

    this.clients.forEach((client, clientId) => {
      connections.push({
        clientId,
        userId: client.userId,
        subscriptions: Array.from(client.subscriptions),
        connectedAt: client.connectedAt,
      });
    });

    return {
      totalConnections: this.clients.size,
      connections,
    };
  }

  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((client) => {
      client.ws.close(1000, 'Server shutting down');
    });

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server shutdown');
  }
}

// Singleton instance
export const wsService = new WebSocketService();

export default wsService;
