import { AppError, errorHandler as enhancedErrorHandler } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { getRequestId } from '../utils/request-id.js';
import config from '../config/env.js';

export function errorHandler(err, req, res, next) {
  const requestId = getRequestId(req);
  
  const logMeta = {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      details: err.details,
    },
  };

  if (err instanceof AppError) {
    logger.warn(`Application error: ${err.message}`, logMeta);
  } else {
    logger.error(`Unexpected error: ${err.message}`, logMeta);
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const response = {
    success: false,
    error: {
      message: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
      ...(err.details && Object.keys(err.details).length > 0 && { details: err.details }),
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  if (config.isDevelopment && err.stack) {
    response.error.stack = err.stack;
  }

  return res.status(statusCode).json(response);
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
