/**
 * Express API Server
 * Main entry point for the backend application
 * Integrates all routes, middleware, and services
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getBackendEnv } from './env.js';
import { logger } from './utils/logger.js';
import { initializeSupabase } from './config/supabase.js';

import authRoutes from './routes/auth.js';
import automationsRoutes from './routes/automations.js';
import { blockchainRoutes } from './routes/blockchain.js';
import { analyticsRoutes } from './routes/analytics.js';
import { healthRoutes } from './routes/health.js';

/**
 * Initialize Express application
 */
export async function createApp(): Promise<Express> {
  const app = express();
  const env = getBackendEnv();

  // Initialize Supabase
  logger.info('Initializing Supabase');
  try {
    initializeSupabase();
    logger.info('Supabase initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Supabase', { error });
    throw error;
  }

  // ============================================
  // Security Middleware
  // ============================================
  app.use(helmet());

  // CORS configuration
  const corsOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ============================================
  // Request Parsing
  // ============================================
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting to API routes (but not health check)
  app.use('/api/', limiter);

  // ============================================
  // Request ID Middleware
  // ============================================
  app.use((req: Request, res: Response, next) => {
    const requestId = req.get('x-request-id') || Math.random().toString(36).substr(2, 9);
    res.setHeader('x-request-id', requestId);
    (req as any).id = requestId;
    next();
  });

  // ============================================
  // API Routes
  // ============================================

  // Health check (no rate limiting, no auth)
  app.use('/api/health', healthRoutes);

  // Authentication routes
  app.use('/api/auth', authRoutes);

  // Automations routes (protected)
  app.use('/api/automations', automationsRoutes);

  // Blockchain routes (protected)
  app.use('/api/blockchain', blockchainRoutes);

  // Analytics routes (protected)
  app.use('/api/analytics', analyticsRoutes);

  // ============================================
  // Error Handling Middleware
  // ============================================

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      path: req.path,
    });
  });

  app.use((err: Error, req: Request, res: Response, _next: express.NextFunction) => {
    const requestId = (req as any).id || 'unknown';

    logger.error('Unhandled error', {
      requestId,
      error: err,
      path: req.path,
      method: req.method,
    });

    const statusCode = (err as any).statusCode || (err as any).status || 500;
    const message = err.message || 'Internal server error';

    res.status(statusCode).json({
      success: false,
      error: message,
      requestId,
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  return app;
}

/**
 * Start the server
 */
export async function startServer(): Promise<void> {
  const env = getBackendEnv();

  try {
    const app = await createApp();

    app.listen(env.PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${env.PORT}`, {
        port: env.PORT,
        environment: env.NODE_ENV,
      });

      logger.info('Available routes:', {
        health: 'GET /api/health',
        auth: {
          signup: 'POST /api/auth/signup',
          signin: 'POST /api/auth/signin',
          walletVerify: 'POST /api/auth/wallet-verify',
          refresh: 'POST /api/auth/refresh',
          signout: 'POST /api/auth/signout',
          me: 'GET /api/auth/me',
          passwordReset: 'POST /api/auth/password-reset',
          confirmEmail: 'POST /api/auth/confirm-email',
        },
        automations: {
          list: 'GET /api/automations',
          create: 'POST /api/automations',
          get: 'GET /api/automations/:id',
          update: 'PUT /api/automations/:id',
          delete: 'DELETE /api/automations/:id',
          execute: 'POST /api/automations/:id/execute',
          executions: 'GET /api/automations/:id/executions',
          riskAssessment: 'GET /api/automations/:id/risk-assessment',
        },
        blockchain: {
          transfer: 'POST /api/blockchain/transfer',
          swap: 'POST /api/blockchain/swap',
          callContract: 'POST /api/blockchain/call-contract',
          transactionStatus: 'GET /api/blockchain/transaction/:hash',
        },
        analytics: {
          metrics: 'GET /api/analytics/metrics',
          executionStats: 'GET /api/analytics/execution-stats',
        },
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default createApp;
