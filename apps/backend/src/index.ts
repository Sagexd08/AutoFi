import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { workflowRoutes } from './routes/workflows.js';
import { agentRoutes } from './routes/agents.js';
import { deployRoutes } from './routes/deploy.js';
import { txRoutes } from './routes/tx.js';
import { limitsRoutes } from './routes/limits.js';
import { chainsRoutes } from './routes/chains.js';
import { walletRoutes } from './routes/wallet.js';
import { eventRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';
import { aiRoutes } from './routes/ai.js';
import { logger } from './utils/logger.js';
import { sanitizeErrorForLogging, generateErrorCode } from './utils/error-sanitizer.js';
import { setupMetricsRoute } from './middleware/metrics-route.js';
import { auditMiddleware } from './middleware/audit.js';
import { vectorDBService } from './services/vector-db.js';
import { aiService } from './services/ai.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api/', limiter);
app.use(auditMiddleware);

app.use('/api/workflows', workflowRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/tx', txRoutes);
app.use('/api/limits', limitsRoutes);
app.use('/api/chains', chainsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/ai', aiRoutes);

setupMetricsRoute(app);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const errorCode = generateErrorCode();
  const statusCode = err.statusCode || err.status || 500;
  const timestamp = new Date().toISOString();

  const sanitizedError = sanitizeErrorForLogging(err);

  logger.error('Request error', {
    errorCode,
    statusCode,
    error: sanitizedError,
    path: _req.path,
    method: _req.method,
    ip: _req.ip,
    userAgent: _req.get('user-agent'),
  });

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

// Initialize services and start server
async function startServer() {
  try {
    // Initialize vector database
    await vectorDBService.initialize();
    logger.info('Vector database initialized');

    // Initialize AI service
    await aiService.initialize();
    logger.info('AI service initialized');

    app.listen(PORT, () => {
      console.log(`🚀 Celo Automator Backend running on port ${PORT}`);
      const host = process.env.HOST || 'localhost';
      console.log(`📖 Health check: http://${host}:${PORT}/api/health`);
      console.log(`🧠 AI API: http://${host}:${PORT}/api/ai`);
      console.log(`📊 Vector DB ready with semantic search`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();