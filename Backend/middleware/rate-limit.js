import rateLimit from 'express-rate-limit';

export function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests from this IP, please try again later.',
    standardHeaders = true,
    legacyHeaders = false,
  } = options;

  return rateLimit({
    windowMs,
    max,
    standardHeaders,
    legacyHeaders,
    skip: (req) => false,
    keyGenerator: (req) => {
      return req.headers['x-api-key'] || req.ip || req.connection.remoteAddress;
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          timestamp: new Date().toISOString(),
          retryAfter: req.rateLimit?.resetTime 
            ? Math.max(0, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000))
            : Math.ceil(windowMs / 1000),        },
      });
    },
  });
}

export const strictRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests to this sensitive endpoint. Please try again later.',
});

export const standardRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests. Please try again later.',
});

export const lenientRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Rate limit exceeded. Please slow down.',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts. Please try again later.',
});

export const transactionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Transaction rate limit exceeded. Please wait before sending more transactions.',
});

export const agentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'AI agent rate limit exceeded. Please wait before making more requests.',
});
