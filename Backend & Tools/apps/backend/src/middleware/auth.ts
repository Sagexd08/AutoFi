/**
 * Authentication and Authorization Middleware
 * 
 * Provides JWT-based authentication and role-based access control for the AutoFi API.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  walletAddress?: string;
  iat?: number;
  exp?: number;
}

export type UserRole = 'admin' | 'operator' | 'viewer' | 'agent';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// ============================================================================
// Configuration
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  operator: 50,
  viewer: 10,
  agent: 5,
};

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Refresh a JWT token if valid
 */
export function refreshToken(token: string): string | null {
  const payload = verifyToken(token);
  if (!payload) return null;

  const { iat, exp, ...rest } = payload;
  return generateToken(rest);
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Extract token from Authorization header or cookies
 */
function extractToken(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check for token in cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  // Check for token in query params (for WebSocket connections)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
}

/**
 * Authentication middleware - verifies JWT token
 * Attaches user payload to request if valid
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  // Attach user to request
  req.user = payload;

  logger.debug({ userId: payload.userId, role: payload.role }, 'User authenticated');

  next();
}

/**
 * Optional authentication middleware - attaches user if token is valid,
 * but doesn't require authentication
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}

/**
 * Role-based authorization middleware
 * Must be used after authenticate middleware
 * 
 * @param allowedRoles - Array of roles that can access the route
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        { userId: req.user.userId, role: req.user.role, requiredRoles: allowedRoles },
        'Access denied - insufficient permissions'
      );

      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
      });
      return;
    }

    next();
  };
}

/**
 * Minimum role level authorization middleware
 * Checks if user's role level is at or above the required level
 * 
 * @param minRole - Minimum role required to access the route
 */
export function requireMinRole(minRole: UserRole) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      logger.warn(
        { userId: req.user.userId, role: req.user.role, requiredRole: minRole },
        'Access denied - role level too low'
      );

      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        minimumRole: minRole,
      });
      return;
    }

    next();
  };
}

/**
 * Owner or admin check middleware
 * Allows access if user is admin OR if the resource belongs to them
 * 
 * @param getOwnerId - Function to extract owner ID from request
 */
export function requireOwnerOrAdmin(
  getOwnerId: (req: AuthenticatedRequest) => string | undefined
) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    // Admins can access everything
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Check if user is the owner
    const ownerId = getOwnerId(req);
    if (ownerId && ownerId === req.user.userId) {
      next();
      return;
    }

    logger.warn(
      { userId: req.user.userId, ownerId },
      'Access denied - not owner or admin'
    );

    res.status(403).json({
      success: false,
      error: 'Access denied - you do not own this resource',
      code: 'NOT_OWNER',
    });
  };
}

/**
 * Wallet ownership check middleware
 * Verifies that the wallet address in the request matches the user's wallet
 */
export function requireWalletOwner(
  getWalletAddress: (req: AuthenticatedRequest) => string | undefined
) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    // Admins can access all wallets
    if (req.user.role === 'admin') {
      next();
      return;
    }

    const requestWallet = getWalletAddress(req)?.toLowerCase();
    const userWallet = req.user.walletAddress?.toLowerCase();

    if (!userWallet || !requestWallet || userWallet !== requestWallet) {
      logger.warn(
        { userId: req.user.userId, requestWallet, userWallet },
        'Access denied - wallet mismatch'
      );

      res.status(403).json({
        success: false,
        error: 'Access denied - wallet address mismatch',
        code: 'WALLET_MISMATCH',
      });
      return;
    }

    next();
  };
}

/**
 * API Key authentication middleware
 * For service-to-service communication
 */
export function authenticateApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key required',
      code: 'API_KEY_REQUIRED',
    });
    return;
  }

  // In production, validate against stored API keys
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    res.status(401).json({
      success: false,
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
    });
    return;
  }

  // Set system user for API key access
  req.user = {
    userId: 'system',
    email: 'system@autofi.local',
    role: 'operator',
  };

  logger.debug('API key authenticated');

  next();
}

/**
 * Combined authentication - accepts either JWT or API key
 */
export function authenticateAny(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);
  const apiKey = req.headers['x-api-key'] as string;

  // Try JWT first
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
      next();
      return;
    }
  }

  // Try API key
  if (apiKey) {
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    if (validApiKeys.includes(apiKey)) {
      req.user = {
        userId: 'system',
        email: 'system@autofi.local',
        role: 'operator',
      };
      next();
      return;
    }
  }

  res.status(401).json({
    success: false,
    error: 'Authentication required (JWT or API key)',
    code: 'AUTH_REQUIRED',
  });
}

// ============================================================================
// Rate Limiting by User
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limiting middleware per user
 */
export function rateLimit(options: {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (req: AuthenticatedRequest) => string;
}) {
  const windowMs = options.windowMs || 60000; // 1 minute default
  const maxRequests = options.maxRequests || 100;
  const keyGenerator = options.keyGenerator || ((req: AuthenticatedRequest) => 
    req.user?.userId || req.ip || 'anonymous'
  );

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Reset if window expired
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      logger.warn({ key, count: entry.count }, 'Rate limit exceeded');

      res.status(429).json({
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

// ============================================================================
// Exports
// ============================================================================

export default {
  authenticate,
  optionalAuth,
  requireRole,
  requireMinRole,
  requireOwnerOrAdmin,
  requireWalletOwner,
  authenticateApiKey,
  authenticateAny,
  rateLimit,
  generateToken,
  verifyToken,
  refreshToken,
};
