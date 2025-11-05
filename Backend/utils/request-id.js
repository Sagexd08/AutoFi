import { randomUUID } from 'crypto';

/**
 * Request ID middleware for tracking requests
 */
export function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

/**
 * Get request ID from request object
 */
export function getRequestId(req) {
  return req.id || req.headers['x-request-id'] || 'unknown';
}

