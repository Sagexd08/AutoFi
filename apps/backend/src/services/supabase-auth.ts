import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, createSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export interface UserSession {
  id: string;
  email: string;
  walletAddress: string;
  isVerified: boolean;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export class SupabaseAuthService {
  private client: SupabaseClient;
  private admin: SupabaseClient;

  constructor() {
    this.client = getSupabaseClient();
    this.admin = createSupabaseAdmin();
  }

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

  async verifyWalletSignature(
    walletAddress: string,
    _signature: string,
    _message: string
  ): Promise<UserSession> {
    try {
      logger.info('Wallet signature verification', { walletAddress });

      const user = await this.getOrCreateWalletUser(walletAddress);

      const { error } = await this.admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          walletAddress,
          verifiedAt: new Date().toISOString(),
        },
      });

      if (error) {
        logger.error('Failed to update wallet user', { error });
        throw error;
      }
      
      logger.info('Wallet user authenticated', { userId: user.id, walletAddress });

      return {
        id: user.id,
        email: user.email || walletAddress,
        walletAddress,
        isVerified: true,
        accessToken: '', 
        refreshToken: undefined,
        expiresIn: 3600,
      };
    } catch (error) {
      logger.error('Wallet signature verification error', { error });
      throw error;
    }
  }

  private async getOrCreateWalletUser(walletAddress: string) {
    try {
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

      const email = `${walletAddress.toLowerCase()}@wallet.autofi.local`;
      const password = Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

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

let authService: SupabaseAuthService | null = null;

export function getAuthService(): SupabaseAuthService {
  if (!authService) {
    authService = new SupabaseAuthService();
  }
  return authService;
}

export default getAuthService;
