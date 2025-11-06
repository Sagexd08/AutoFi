import logger from './logger.js';
import config from '../config/env.js';
import { getRequestId } from './request-id.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details = {}) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', details = {}) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', details = {}) {
    super(`${resource} not found`, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message, details = {}) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', details = {}) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }
}

export class BlockchainError extends AppError {
  constructor(message, details = {}) {
    super(message, 500, 'BLOCKCHAIN_ERROR', details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service, details = {}) {
    super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE', { service, ...details });
  }
}

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

  const statusCode = err.statusCode || 500;
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
