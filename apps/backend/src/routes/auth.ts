/**
 * Authentication Routes
 * Handles user authentication: sign up, sign in, sign out, wallet verification
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { authMiddleware, generateToken, refreshToken as refreshTokenFn } from '../middleware/auth.js';
import { getAuthService } from '../services/supabase-auth.js';

const router = Router();

/**
 * Validation schemas
 */
const signUpSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const signInSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string(),
});

const walletVerifySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  signature: z.string(),
  message: z.string(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

/**
 * POST /auth/signup
 * Sign up new user with email and password
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password } = signUpSchema.parse(req.body);
    const authService = getAuthService();

    const session = await authService.signUp(email, password);

    logger.info('User registration successful', { userId: session.id, email });

    res.status(201).json({
      success: true,
      data: {
        id: session.id,
        email: session.email,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Sign up error', { error: String(error) });
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sign up failed',
    });
  }
});

/**
 * POST /auth/signin
 * Sign in user with email and password
 */
router.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = signInSchema.parse(req.body);
    const authService = getAuthService();

    const session = await authService.signIn(email, password);

    logger.info('User login successful', { userId: session.id });

    res.json({
      success: true,
      data: {
        id: session.id,
        email: session.email,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Sign in error', { error: String(error) });
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid credentials',
    });
  }
});

/**
 * POST /auth/wallet-verify
 * Verify wallet signature for Web3 authentication
 */
router.post('/wallet-verify', async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, message } = walletVerifySchema.parse(req.body);
    const authService = getAuthService();

    const session = await authService.verifyWalletSignature(walletAddress, signature, message);

    logger.info('Wallet verification successful', { walletAddress, userId: session.id });

    res.json({
      success: true,
      data: {
        id: session.id,
        email: session.email,
        walletAddress: session.walletAddress,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Wallet verification error', { error: String(error) });
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Wallet verification failed',
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken: token } = refreshTokenSchema.parse(req.body);
    const authService = getAuthService();

    const session = await authService.refreshToken(token);

    logger.info('Token refreshed', { userId: session.id });

    res.json({
      success: true,
      data: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Token refresh error', { error: String(error) });
    res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token',
    });
  }
});

/**
 * POST /auth/signout
 * Sign out user (token-based, no state needed)
 */
router.post('/signout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authService = getAuthService();
    await authService.signOut();

    logger.info('User signed out', { userId: req.user?.id });

    res.json({
      success: true,
      message: 'Signed out successfully',
    });
  } catch (error) {
    logger.error('Sign out error', { error: String(error) });
    res.status(400).json({
      success: false,
      error: 'Sign out failed',
    });
  }
});

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    res.json({
      success: true,
      data: {
        id: req.user.id,
        address: req.user.address,
        scope: req.user.scope,
      },
    });
  } catch (error) {
    logger.error('Get user error', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
    });
  }
});

/**
 * POST /auth/password-reset
 * Send password reset email
 */
router.post('/password-reset', async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const authService = getAuthService();

    await authService.sendPasswordReset(email);

    logger.info('Password reset email sent', { email });

    res.json({
      success: true,
      message: 'Password reset email sent. Check your inbox.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Password reset error', { error: String(error) });
    res.status(400).json({
      success: false,
      error: 'Failed to send password reset email',
    });
  }
});

/**
 * POST /auth/confirm-email
 * Confirm email with token
 */
router.post('/confirm-email', async (req: Request, res: Response) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    const authService = getAuthService();

    await authService.confirmEmail(token);

    logger.info('Email confirmed successfully');

    res.json({
      success: true,
      message: 'Email confirmed successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error('Email confirmation error', { error: String(error) });
    res.status(400).json({
      success: false,
      error: 'Email confirmation failed',
    });
  }
});

export default router;
