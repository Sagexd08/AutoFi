import logger from '../utils/logger.js';
import { getRequestId } from '../utils/request-id.js';

export function requestLoggerMiddleware(req, res, next) {
  const startTime = Date.now();
  
  logger.debug(`${req.method} ${req.path}`, {
    requestId: getRequestId(req),
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
  });

  const originalJson = res.json.bind(res);
  res.json = function(body) {
    const responseTime = Date.now() - startTime;
    logger.request(req, res, responseTime);
    return originalJson(body);
  };

  next();
}

