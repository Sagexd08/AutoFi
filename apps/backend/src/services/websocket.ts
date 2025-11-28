/**
 * WebSocket Service
 * Handles real-time communication between backend and frontend
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { logger } from '../utils/logger.js';

export interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: string;
}

export interface ClientSubscription {
  automations?: string[];
  transactions?: string[];
  prices?: string[];
  balances?: string[];
}

interface ClientInfo {
  ws: WebSocket;
  id: string;
  isAlive: boolean;
  subscriptions: ClientSubscription;
  walletAddress?: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientInfo> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server attached to HTTP server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = this.generateClientId();
      
      const clientInfo: ClientInfo = {
        ws,
        id: clientId,
        isAlive: true,
        subscriptions: {},
      };

      this.clients.set(clientId, clientInfo);

      logger.info('WebSocket client connected', { 
        clientId, 
        ip: req.socket.remoteAddress 
      });

      // Send welcome message
      this.sendToClient(clientInfo, {
        type: 'connected',
        payload: { clientId },
        timestamp: new Date().toISOString(),
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleMessage(clientInfo, message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message', { error: String(error) });
        }
      });

      // Handle pong for heartbeat
      ws.on('pong', () => {
        clientInfo.isAlive = true;
      });

      // Handle close
      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info('WebSocket client disconnected', { clientId });
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        logger.error('WebSocket error', { clientId, error: String(error) });
      });
    });

    // Start heartbeat to detect dead connections
    this.startHeartbeat();

    logger.info('WebSocket server initialized on /ws');
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(client: ClientInfo, message: WebSocketMessage): void {
    switch (message.type) {
      case 'ping':
        this.sendToClient(client, {
          type: 'pong',
          timestamp: new Date().toISOString(),
        });
        break;

      case 'subscribe':
        this.handleSubscribe(client, message.payload);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(client, message.payload);
        break;

      case 'setWallet':
        client.walletAddress = message.payload?.address;
        logger.info('Client set wallet', { 
          clientId: client.id, 
          wallet: client.walletAddress 
        });
        break;

      default:
        logger.debug('Unknown message type', { type: message.type });
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscribe(client: ClientInfo, payload: any): void {
    const { channel, id } = payload || {};

    if (!channel) return;

    switch (channel) {
      case 'automation':
        client.subscriptions.automations = client.subscriptions.automations || [];
        if (id && !client.subscriptions.automations.includes(id)) {
          client.subscriptions.automations.push(id);
        }
        break;

      case 'transaction':
        client.subscriptions.transactions = client.subscriptions.transactions || [];
        if (id && !client.subscriptions.transactions.includes(id)) {
          client.subscriptions.transactions.push(id);
        }
        break;

      case 'price':
        client.subscriptions.prices = client.subscriptions.prices || [];
        if (id && !client.subscriptions.prices.includes(id)) {
          client.subscriptions.prices.push(id);
        }
        break;

      case 'balance':
        client.subscriptions.balances = client.subscriptions.balances || [];
        if (id && !client.subscriptions.balances.includes(id)) {
          client.subscriptions.balances.push(id);
        }
        break;
    }

    this.sendToClient(client, {
      type: 'subscribed',
      payload: { channel, id },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle unsubscription requests
   */
  private handleUnsubscribe(client: ClientInfo, payload: any): void {
    const { channel, id } = payload || {};

    if (!channel) return;

    switch (channel) {
      case 'automation':
        if (client.subscriptions.automations) {
          client.subscriptions.automations = client.subscriptions.automations.filter(a => a !== id);
        }
        break;

      case 'transaction':
        if (client.subscriptions.transactions) {
          client.subscriptions.transactions = client.subscriptions.transactions.filter(t => t !== id);
        }
        break;

      case 'price':
        if (client.subscriptions.prices) {
          client.subscriptions.prices = client.subscriptions.prices.filter(p => p !== id);
        }
        break;

      case 'balance':
        if (client.subscriptions.balances) {
          client.subscriptions.balances = client.subscriptions.balances.filter(b => b !== id);
        }
        break;
    }

    this.sendToClient(client, {
      type: 'unsubscribed',
      payload: { channel, id },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: ClientInfo, message: WebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast automation update to subscribed clients
   */
  broadcastAutomationUpdate(automationId: string, update: any): void {
    const message: WebSocketMessage = {
      type: `automation:${automationId}`,
      payload: update,
      timestamp: new Date().toISOString(),
    };

    for (const client of this.clients.values()) {
      if (client.subscriptions.automations?.includes(automationId)) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Broadcast transaction update to subscribed clients
   */
  broadcastTransactionUpdate(txHash: string, update: any): void {
    const message: WebSocketMessage = {
      type: `transaction:${txHash}`,
      payload: update,
      timestamp: new Date().toISOString(),
    };

    for (const client of this.clients.values()) {
      if (client.subscriptions.transactions?.includes(txHash)) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Broadcast price update to subscribed clients
   */
  broadcastPriceUpdate(tokenSymbol: string, price: number): void {
    const message: WebSocketMessage = {
      type: `price:${tokenSymbol}`,
      payload: { symbol: tokenSymbol, price },
      timestamp: new Date().toISOString(),
    };

    for (const client of this.clients.values()) {
      if (client.subscriptions.prices?.includes(tokenSymbol)) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Broadcast balance update to subscribed clients
   */
  broadcastBalanceUpdate(address: string, balance: string): void {
    const message: WebSocketMessage = {
      type: `balance:${address}`,
      payload: { address, balance },
      timestamp: new Date().toISOString(),
    };

    for (const client of this.clients.values()) {
      if (client.subscriptions.balances?.includes(address) || 
          client.walletAddress === address) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(message: WebSocketMessage): void {
    for (const client of this.clients.values()) {
      this.sendToClient(client, message);
    }
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(clientId);
          logger.info('Terminated dead connection', { clientId });
          continue;
        }

        client.isAlive = false;
        client.ws.ping();
      }
    }, 30000); // 30 seconds
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   */
  getStats(): { connectedClients: number; subscriptions: Record<string, number> } {
    const subscriptions: Record<string, number> = {
      automations: 0,
      transactions: 0,
      prices: 0,
      balances: 0,
    };

    for (const client of this.clients.values()) {
      subscriptions.automations += client.subscriptions.automations?.length || 0;
      subscriptions.transactions += client.subscriptions.transactions?.length || 0;
      subscriptions.prices += client.subscriptions.prices?.length || 0;
      subscriptions.balances += client.subscriptions.balances?.length || 0;
    }

    return {
      connectedClients: this.clients.size,
      subscriptions,
    };
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server shut down');
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
