import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Original in-memory routes (kept for backward compatibility)
import { workflowRoutes } from './routes/workflows.js';
import { agentRoutes } from './routes/agents.js';
import { deployRoutes } from './routes/deploy.js';
import txRoutes from './routes/tx.js';
import { limitsRoutes } from './routes/limits.js';
import { chainsRoutes } from './routes/chains.js';
import { walletRoutes } from './routes/wallet.js';
import { eventRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';
import { approvalRoutes } from './routes/approvals.js';
import { simulationRoutes } from './routes/simulation.js';

// AI-powered routes (Autofi core)
import { aiRoutes } from './routes/ai.js';

// Database-connected routes (production ready)
import { workflowRoutes as workflowRoutesDb } from './routes/workflows-db.js';
import { agentRoutes as agentRoutesDb } from './routes/agents-db.js';
import txRoutesDb from './routes/tx-db.js';
import { approvalRoutes as approvalRoutesDb } from './routes/approvals-db.js';

// Middleware
import { logger } from './utils/logger.js';
import { sanitizeErrorForLogging, generateErrorCode } from './utils/error-sanitizer.js';
import { setupMetricsRoute } from './middleware/metrics-route.js';
import { auditMiddleware } from './middleware/audit.js';
import { authenticate, optionalAuth } from './middleware/auth.js';

// Services
import { wsService } from './services/websocket.js';

// Workers
import { startWorkers, stopWorkers, getQueueMetrics } from './workers/index.js';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize WebSocket
wsService.initialize(server);

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api/', limiter);
app.use(auditMiddleware);

// Determine if we should use database routes or in-memory routes
const useDatabase = process.env.USE_DATABASE === 'true';

// AI Routes (always available - core Autofi functionality)
app.use('/api/ai', authenticate, aiRoutes);

if (useDatabase) {
  // Production mode: Use database-connected routes with authentication
  logger.info('Using database-connected routes');
  
  // Protected routes requiring authentication
  app.use('/api/workflows', authenticate, workflowRoutesDb);
  app.use('/api/agents', authenticate, agentRoutesDb);
  app.use('/api/tx', authenticate, txRoutesDb);
  app.use('/api/approvals', authenticate, approvalRoutesDb);
  
  // Public routes
  app.use('/api/deploy', deployRoutes);
  app.use('/api/limits', limitsRoutes);
  app.use('/api/chains', chainsRoutes);
  app.use('/api/wallet', authenticate, walletRoutes);
  app.use('/api/events', authenticate, eventRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/simulate', authenticate, simulationRoutes);
} else {
  // Development mode: Use in-memory routes without authentication
  logger.info('Using in-memory routes (development mode)');
  
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/deploy', deployRoutes);
  app.use('/api/tx', txRoutes);
  app.use('/api/limits', limitsRoutes);
  app.use('/api/chains', chainsRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/approvals', approvalRoutes);
  app.use('/api/simulate', simulationRoutes);
}

// WebSocket stats endpoint
app.get('/api/ws/stats', (_req, res) => {
  res.json({
    success: true,
    ...wsService.getStats(),
  });
});

// Queue metrics endpoint (admin only in production)
app.get('/api/queue/metrics', optionalAuth, async (_req, res) => {
  try {
    const metrics = await getQueueMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get queue metrics',
    });
  }
});

setupMetricsRoute(app);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const errorCode = generateErrorCode();
  const statusCode = err.statusCode || err.status || 500;
  const timestamp = new Date().toISOString();

  const sanitizedError = sanitizeErrorForLogging(err);

  logger.error({
    errorCode,
    statusCode,
    error: sanitizedError,
    path: _req.path,
    method: _req.method,
    ip: _req.ip,
    userAgent: _req.get('user-agent'),
  }, 'Request error');

  const response: {
    success: boolean;
    error: string;
    errorCode: string;
    timestamp: string;
    details?: any;
  } = {
    success: false,
    error: 'Internal server error',
    errorCode,
    timestamp,
  };

  if (process.env.NODE_ENV !== 'production') {
    response.error = err.message || 'Internal server error';

    if (err.stack) {
      response.details = {
        stack: err.stack
          .split('\n')
          .map((line: string) => {
            return line.replace(/\([^)]*[/\\]([^/\\]+\.(js|ts|tsx|jsx)):\d+:\d+\)/g, '($1:REDACTED)');
          })
          .join('\n'),
      };
    }
  }

  res.status(statusCode).json(response);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop queue workers
  await stopWorkers();
  
  // Shutdown WebSocket
  wsService.shutdown();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Stop queue workers
  await stopWorkers();
  
  // Shutdown WebSocket
  wsService.shutdown();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start server and workers
async function startServer() {
  try {
    // Start queue workers if Redis is configured
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      logger.info('Starting queue workers...');
      await startWorkers();
    } else {
      logger.info('Redis not configured, skipping queue workers');
    }
    
    server.listen(PORT, () => {
      console.log(`🚀 Celo Automator Backend running on port ${PORT}`);
      const host = process.env.HOST || 'localhost';
      console.log(`📖 Health check: http://${host}:${PORT}/api/health`);
      console.log(`🔌 WebSocket: ws://${host}:${PORT}/ws`);
      console.log(`📊 Queue metrics: http://${host}:${PORT}/api/queue/metrics`);
      console.log(`🔐 Database mode: ${process.env.USE_DATABASE === 'true' ? 'enabled' : 'disabled'}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();