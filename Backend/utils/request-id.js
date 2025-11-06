import { randomUUID } from 'crypto';

export function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

export function getRequestId(req) {
  return req.id || req.headers['x-request-id'] || 'unknown';
}

