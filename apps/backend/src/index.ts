import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { workflowRoutes } from './routes/workflows.js';
import { walletRoutes } from './routes/wallet.js';
import { eventRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';
import { logger } from './utils/logger.js';
import { sanitizeErrorForLogging, generateErrorCode } from './utils/error-sanitizer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.use('/api/workflows', workflowRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/health', healthRoutes);

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const errorCode = generateErrorCode();
  const statusCode = err.statusCode || err.status || 500;
  const timestamp = new Date().toISOString();

  // Sanitize error for logging (redacts sensitive fields, removes file paths)
  const sanitizedError = sanitizeErrorForLogging(err);

  // Log full error details to server logs (with sanitization)
  logger.error('Request error', {
    errorCode,
    statusCode,
    error: sanitizedError,
    path: _req.path,
    method: _req.method,
    ip: _req.ip,
    userAgent: _req.get('user-agent'),
  });

  // Prepare safe response for client
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

  // Only include detailed error information in non-production
  if (process.env.NODE_ENV !== 'production') {
    // In development, include more details but still sanitized
    response.error = err.message || 'Internal server error';
    
    // Only include stack trace in development, and sanitize file paths
    if (err.stack) {
      response.details = {
        stack: err.stack
          .split('\n')
          .map((line: string) => {
            // Remove absolute file paths, keep only file names
            return line.replace(/\([^)]*[/\\]([^/\\]+\.(js|ts|tsx|jsx)):\d+:\d+\)/g, '($1:REDACTED)');
          })
          .join('\n'),
      };
    }
  }

  res.status(statusCode).json(response);
});

app.listen(PORT, () => {
  console.log(`🚀 Celo Automator Backend running on port ${PORT}`);
  const host = process.env.HOST || 'localhost';
  console.log(`📖 Health check: http://${host}:${PORT}/api/health`);
});