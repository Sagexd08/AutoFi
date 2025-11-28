/**
 * Supabase Configuration
 * Handles initialization and management of Supabase client
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

/**
 * Supabase environment variables schema
 */
const supabaseEnvSchema = z.object({
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key required'),
  SUPABASE_JWT_SECRET: z.string().min(1, 'Supabase JWT secret required'),
});

export type SupabaseConfig = z.infer<typeof supabaseEnvSchema>;

/**
 * Supabase client singleton
 */
let supabaseClient: SupabaseClient | null = null;

/**
 * Get validated Supabase configuration
 */
function getSupabaseConfig(): SupabaseConfig {
  try {
    return supabaseEnvSchema.parse({
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      const message = `Invalid Supabase configuration:\n${missingVars}`;
      logger.error(message);
      throw new Error(message);
    }
    throw error;
  }
}

/**
 * Initialize Supabase client
 */
export function initializeSupabase(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  try {
    const config = getSupabaseConfig();

    supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
        detectSessionInUrl: false,
      },
      headers: {
        'x-client-info': 'autofi-backend',
      },
    });

    logger.info('Supabase client initialized successfully', {
      url: config.SUPABASE_URL.replace(/https?:\/\//, '').split('.')[0],
    });

    return supabaseClient;
  } catch (error) {
    logger.error('Failed to initialize Supabase client', { error });
    throw error;
  }
}

/**
 * Get Supabase client (requires initialization first)
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      'Supabase client not initialized. Call initializeSupabase() first.'
    );
  }
  return supabaseClient;
}

/**
 * Create admin client with service role key (for server-side operations)
 */
export function createSupabaseAdmin(): SupabaseClient {
  try {
    const config = getSupabaseConfig();

    return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      headers: {
        'x-client-info': 'autofi-backend-admin',
      },
    });
  } catch (error) {
    logger.error('Failed to create Supabase admin client', { error });
    throw error;
  }
}

/**
 * Validate Supabase connection
 */
export async function validateSupabaseConnection(): Promise<boolean> {
  try {
    const client = getSupabaseClient();

    // Test connection with simple query
    const { error } = await client.from('automations').select('COUNT(*)').limit(1);

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "table not found" which is OK for validation
      logger.error('Supabase connection validation failed', { error });
      return false;
    }

    logger.info('Supabase connection validated successfully');
    return true;
  } catch (error) {
    logger.error('Failed to validate Supabase connection', { error });
    return false;
  }
}

/**
 * Health check for Supabase
 */
export async function checkSupabaseHealth(): Promise<{
  connected: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const client = getSupabaseClient();

    // Perform a simple query to check health
    const { error } = await client.from('automations').select('id').limit(1);

    if (error && error.code !== 'PGRST116') {
      return {
        connected: false,
        latency: Date.now() - startTime,
        error: error.message,
      };
    }

    return {
      connected: true,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      connected: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
