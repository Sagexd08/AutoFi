/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user context
 * Supports both custom JWT and Supabase JWT validation
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { getBackendEnv } from '../env.js';
import { getSupabaseClient } from '../config/supabase.js';

/**
 * Extended Express Request with user context
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    address: string;
    scope: string[];
  };
  token?: string;
}

/**
 * JWT Token payload
 */
interface TokenPayload {
  id: string;
  address: string;
  scope: string[];
  iat: number;
  exp: number;
}

/**
 * Authentication middleware - validates JWT tokens
 */
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing authentication token',
    });
    return;
  }

  try {
    // Try Supabase JWT first
    try {
      const user = await validateSupabaseToken(token);
      req.user = user;
      req.token = token;
      next();
      return;
    } catch (error) {
      logger.debug('Supabase token validation failed, trying custom JWT', { error: String(error) });
    }

    // Fall back to custom JWT
    const env = getBackendEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

    req.user = {
      id: decoded.id,
      address: decoded.address,
      scope: decoded.scope || [],
    };
    req.token = token;

    next();
  } catch (error) {
    logger.warn('Invalid token', { error: String(error) });

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token, but validates if present
 */
export async function optionalAuthMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  try {
    // Try Supabase JWT first
    try {
      const user = await validateSupabaseToken(token);
      req.user = user;
      req.token = token;
      next();
      return;
    } catch (error) {
      logger.debug('Supabase token validation failed, trying custom JWT', { error: String(error) });
    }

    // Fall back to custom JWT
    const env = getBackendEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

    req.user = {
      id: decoded.id,
      address: decoded.address,
      scope: decoded.scope || [],
    };
    req.token = token;
  } catch (error) {
    logger.debug('Invalid optional token', { error: String(error) });
    // Don't fail, just continue without user context
  }

  next();
}

/**
 * Check for specific scope
 */
export function requireScope(...scopes: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const hasScope = scopes.some((scope) => req.user!.scope.includes(scope));

    if (!hasScope) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        requiredScopes: scopes,
      });
      return;
    }

    next();
  };
}

/**
 * Extract JWT token from request
 */
function extractToken(req: AuthenticatedRequest): string | null {
  const authHeader = req.get('Authorization');

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Generate JWT token
 */
export function generateToken(payload: { id: string; address: string; scope: string[] }): string {
  const env = getBackendEnv();

  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '24h',
    algorithm: 'HS256',
  });

  return token;
}

/**
 * Refresh JWT token
 */
export function refreshToken(token: string): string {
  const env = getBackendEnv();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { ignoreExpiration: true }) as TokenPayload;

    return generateToken({
      id: decoded.id,
      address: decoded.address,
      scope: decoded.scope,
    });
  } catch (error) {
    throw new Error('Invalid token for refresh');
  }
}

/**
 * Validate Supabase JWT token
 */
async function validateSupabaseToken(token: string) {
  try {
    const client = getSupabaseClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);

    if (error || !user) {
      throw new Error(`Supabase validation failed: ${error?.message}`);
    }

    return {
      id: user.id,
      address: user.user_metadata?.walletAddress || user.email || user.id,
      scope: user.user_metadata?.scope || ['user'],
    };
  } catch (error) {
    logger.debug('Supabase token validation error', { error: String(error) });
    throw error;
  }
}
