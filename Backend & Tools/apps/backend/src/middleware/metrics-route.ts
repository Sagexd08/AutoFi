import express, { Request, Response, NextFunction } from 'express';
import { register } from './metrics.js';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/metrics') {
    res.set('Content-Type', register.contentType);
    register.metrics().then((metrics) => {
      res.end(metrics);
    });
    return;
  }
  next();
}

export function setupMetricsRoute(app: express.Application): void {
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  });
}
