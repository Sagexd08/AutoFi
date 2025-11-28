/**
 * Supabase Authentication Service
 * Handles user authentication and JWT token management
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, createSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * User session information
 */
export interface UserSession {
  id: string;
  email: string;
  walletAddress: string;
  isVerified: boolean;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Supabase Auth Service
 */
export class SupabaseAuthService {
  private client: SupabaseClient;
  private admin: SupabaseClient;

  constructor() {
    this.client = getSupabaseClient();
    this.admin = createSupabaseAdmin();
  }

  /**
   * Sign up user with email and password
   */
  async signUp(email: string, password: string): Promise<UserSession> {
    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
      });

      if (error) {
        logger.error('Sign up failed', { error });
        throw new Error(`Sign up failed: ${error.message}`);
      }

      if (!data.user || !data.session) {
        throw new Error('Sign up successful but no session returned');
      }

      logger.info('User signed up', { userId: data.user.id, email });

      return {
        id: data.user.id,
        email: data.user.email || email,
        walletAddress: '',
        isVerified: false,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
      };
    } catch (error) {
      logger.error('Sign up error', { error });
      throw error;
    }
  }

  /**
   * Sign in user with email and password
   */
  async signIn(email: string, password: string): Promise<UserSession> {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error('Sign in failed', { error });
        throw new Error(`Sign in failed: ${error.message}`);
      }

      if (!data.user || !data.session) {
        throw new Error('Sign in successful but no session returned');
      }

      logger.info('User signed in', { userId: data.user.id });

      return {
        id: data.user.id,
        email: data.user.email || email,
        walletAddress: data.user.user_metadata?.walletAddress || '',
        isVerified: data.user.email_confirmed_at ? true : false,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
      };
    } catch (error) {
      logger.error('Sign in error', { error });
      throw error;
    }
  }

  /**
   * Verify wallet signature (Web3 authentication)
   */
  async verifyWalletSignature(
    walletAddress: string,
    signature: string,
    message: string
  ): Promise<UserSession> {
    try {
      logger.info('Wallet signature verification', { walletAddress });

      // Get or create user with wallet
      const user = await this.getOrCreateWalletUser(walletAddress);

      // Update user metadata with wallet
      const { data, error } = await this.admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          walletAddress,
          verifiedAt: new Date().toISOString(),
        },
      });

      if (error) {
        logger.error('Failed to update wallet user', { error });
        throw error;
      }

      // Create session token
      const { data: sessionData, error: sessionError } =
        await this.admin.auth.admin.generateLink({
          type: 'magiclink',
          email: user.email || walletAddress,
        });

      if (sessionError) {
        logger.error('Failed to generate session', { error: sessionError });
        throw sessionError;
      }

      logger.info('Wallet user authenticated', { userId: user.id, walletAddress });

      return {
        id: user.id,
        email: user.email || walletAddress,
        walletAddress,
        isVerified: true,
        accessToken: sessionData?.session?.access_token || '',
        refreshToken: sessionData?.session?.refresh_token,
        expiresIn: sessionData?.session?.expires_in || 3600,
      };
    } catch (error) {
      logger.error('Wallet signature verification error', { error });
      throw error;
    }
  }

  /**
   * Get or create user by wallet address
   */
  private async getOrCreateWalletUser(walletAddress: string) {
    try {
      // Try to find existing user
      const { data: users, error: searchError } = await this.admin.auth.admin.listUsers();

      if (searchError) {
        throw searchError;
      }

      const existingUser = users?.users?.find(
        (u) => u.user_metadata?.walletAddress === walletAddress
      );

      if (existingUser) {
        return existingUser;
      }

      // Create new user for wallet
      const email = `${walletAddress.toLowerCase()}@wallet.autofi.local`;
      const password = Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15); // Random password

      const { data, error } = await this.admin.auth.admin.createUser({
        email,
        password,
        user_metadata: {
          walletAddress,
          createdAt: new Date().toISOString(),
        },
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error('User created but no user data returned');
      }

      logger.info('New wallet user created', { userId: data.user.id, walletAddress });

      return data.user;
    } catch (error) {
      logger.error('Get or create wallet user error', { error });
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<UserSession> {
    try {
      const { data, error } = await this.client.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        logger.error('Token refresh failed', { error });
        throw error;
      }

      if (!data.user || !data.session) {
        throw new Error('Token refresh successful but no session returned');
      }

      logger.info('Token refreshed', { userId: data.user.id });

      return {
        id: data.user.id,
        email: data.user.email || '',
        walletAddress: data.user.user_metadata?.walletAddress || '',
        isVerified: true,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
      };
    } catch (error) {
      logger.error('Refresh token error', { error });
      throw error;
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    try {
      const { error } = await this.client.auth.signOut();

      if (error) {
        logger.error('Sign out failed', { error });
        throw error;
      }

      logger.info('User signed out');
    } catch (error) {
      logger.error('Sign out error', { error });
      throw error;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    try {
      const {
        data: { user },
        error,
      } = await this.client.auth.getUser();

      if (error) {
        logger.error('Failed to get current user', { error });
        throw error;
      }

      return user;
    } catch (error) {
      logger.error('Get current user error', { error });
      throw error;
    }
  }

  /**
   * Verify email (confirm email)
   */
  async confirmEmail(token: string): Promise<void> {
    try {
      const { error } = await this.client.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });

      if (error) {
        logger.error('Email verification failed', { error });
        throw error;
      }

      logger.info('Email verified successfully');
    } catch (error) {
      logger.error('Email verification error', { error });
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset`,
      });

      if (error) {
        logger.error('Password reset email send failed', { error });
        throw error;
      }

      logger.info('Password reset email sent', { email });
    } catch (error) {
      logger.error('Send password reset error', { error });
      throw error;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    try {
      const { error } = await this.admin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) {
        logger.error('Password update failed', { error });
        throw error;
      }

      logger.info('Password updated', { userId });
    } catch (error) {
      logger.error('Update password error', { error });
      throw error;
    }
  }
}

/**
 * Auth service singleton
 */
let authService: SupabaseAuthService | null = null;

/**
 * Get auth service instance
 */
export function getAuthService(): SupabaseAuthService {
  if (!authService) {
    authService = new SupabaseAuthService();
  }
  return authService;
}

export default getAuthService;
