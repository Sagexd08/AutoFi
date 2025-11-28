/**
 * Backend Environment Variable Validation
 * 
 * This module validates all required backend environment variables at runtime
 * using zod schemas. This is critical for production deployments.
 */

import { z } from 'zod';

/**
 * Schema for backend environment variables
 * These variables are sensitive and should never be exposed to the browser
 */
const backendEnvSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Celo Network Configuration
  CELO_NETWORK: z.enum(['alfajores', 'mainnet', 'baklava']).default('alfajores'),
  CELO_RPC_URL: z.string().url('Invalid Celo RPC URL'),
  CELO_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format (must be 32 bytes hex)'),
  CELO_CHAIN_ID: z.coerce.number().int().positive().default(44787),

  // Database Configuration
  DATABASE_URL: z.string().url('Invalid database URL'),

  // Blockchain RPC URLs (Fallback/Alternative)
  ALCHEMY_API_KEY: z.string().optional().default(''),
  INFURA_API_KEY: z.string().optional().default(''),

  // Security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  CORS_ORIGIN: z.string().default('http://localhost:3002'),

  // Feature Flags
  ENABLE_SIMULATION: z.enum(['true', 'false']).transform((val) => val === 'true').default('true'),
  ENABLE_REAL_EXECUTION: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  ENABLE_GAS_OPTIMIZATION: z.enum(['true', 'false']).transform((val) => val === 'true').default('true'),

  // Monitoring & Telemetry
  SENTRY_DSN: z.string().url('Invalid Sentry DSN').optional().default(''),
  ENABLE_TRACING: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),

  // Email Configuration (Optional)
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().email('Invalid sender email').optional().default(''),

  // Redis Configuration (Optional - for caching/queues)
  REDIS_URL: z.string().url('Invalid Redis URL').optional().default(''),

  // Webhook Configuration
  WEBHOOK_SECRET: z.string().min(16, 'Webhook secret must be at least 16 characters').optional().default(''),
});

/**
 * Parsed and validated backend environment variables
 */
export type BackendEnv = z.infer<typeof backendEnvSchema>;

/**
 * Get validated backend environment variables
 * Throws an error if validation fails
 * 
 * @throws {Error} If environment variables are invalid
 */
export function getBackendEnv(): BackendEnv {
  try {
    return backendEnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      const message = `Invalid backend environment variables:\n${missingVars}`;
      console.error(message);
      throw new Error(message);
    }
    throw error;
  }
}

/**
 * Get a specific backend environment variable with validation
 * 
 * @param key - The environment variable key
 * @returns The validated environment variable value
 */
export function getBackendEnvVar<K extends keyof BackendEnv>(key: K): BackendEnv[K] {
  const env = getBackendEnv();
  return env[key];
}

/**
 * Validate backend environment variables on server startup
 * Call this in your server initialization file (e.g., src/index.ts)
 */
export function validateBackendEnvironment(): void {
  try {
    getBackendEnv();
    console.log('✅ Backend environment variables validated successfully');
  } catch (error) {
    console.error('❌ Backend environment validation failed:', error);
    // Always throw on server startup - we cannot continue without valid config
    process.exit(1);
  }
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
  const env = getBackendEnv();
  return {
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    isSandbox: env.CELO_NETWORK === 'alfajores',
    isMainnet: env.CELO_NETWORK === 'mainnet',
  };
}

// Export environment variables as a singleton
const backendEnv = getBackendEnv();
export default backendEnv;
