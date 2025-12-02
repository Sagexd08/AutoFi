/**
 * Environment Variable Validation
 * 
 * This module validates all required environment variables at runtime
 * using zod schemas to ensure type safety and early error detection.
 * 
 * All NEXT_PUBLIC_* variables are automatically exposed to the browser.
 */

import { z } from 'zod';

/**
 * Schema for browser-safe environment variables (NEXT_PUBLIC_*)
 * These are exposed to the client-side code
 */
const publicEnvSchema = z.object({
  // API Configuration
  NEXT_PUBLIC_API_URL: z.string().url('Invalid API URL').default('http://localhost:3001'),
  NEXT_PUBLIC_WS_URL: z.string().url('Invalid WebSocket URL').default('ws://localhost:3001'),

  // Blockchain Configuration
  NEXT_PUBLIC_NETWORK: z.enum(['mainnet', 'testnet']).default('testnet'),
  NEXT_PUBLIC_RPC_URL: z.string().url('Invalid RPC URL').default('https://alfajores-forno.celo-testnet.org'),
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().int().positive('Invalid chain ID').default(44787),

  // Contract Addresses
  NEXT_PUBLIC_AGENT_REGISTRY: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address').default('0x000000000000000000000000000000000000ce10'),
  NEXT_PUBLIC_AGENT_TREASURY: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address').default('0x000000000000000000000000000000000000ce10'),
  NEXT_PUBLIC_DONATION_SPLITTER: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address').default('0x000000000000000000000000000000000000ce10'),
  NEXT_PUBLIC_YIELD_AGGREGATOR: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address').default('0x000000000000000000000000000000000000ce10'),
  NEXT_PUBLIC_MASTER_TRADING: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address').default('0x000000000000000000000000000000000000ce10'),
  NEXT_PUBLIC_ATTENDANCE_NFT: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address').default('0x000000000000000000000000000000000000ce10'),

  // Token Addresses
  NEXT_PUBLIC_CELO_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address').default('0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9'),
  NEXT_PUBLIC_CUSD_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address').default('0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1'),
  NEXT_PUBLIC_CEUR_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address').default('0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F'),
  NEXT_PUBLIC_CREAL_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address').default('0xE4D517785D091D3c54818832dB6094bcc2744545'),

  // DeFi Protocol Addresses
  NEXT_PUBLIC_UBESWAP_ROUTER: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid protocol address').default('0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121'),
  NEXT_PUBLIC_MENTO_BROKER: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid protocol address').default('0x6723749882A3c77b8Bf98A32C7B05b7d05E81b5c'),
  NEXT_PUBLIC_MOOLA_LENDING_POOL: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid protocol address').default('0x0886f74eEEc443fBb6907fB5528B57C28E813129'),

  // API Keys (Optional)
  NEXT_PUBLIC_ALCHEMY_API_KEY: z.string().optional().default(''),
  NEXT_PUBLIC_COINGECKO_API_KEY: z.string().optional().default(''),

  // WalletConnect Project ID (Optional but recommended)
  NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: z.string().optional().default(''),

  // Feature Flags
  NEXT_PUBLIC_ENABLE_REAL_BLOCKCHAIN: z.enum(['true', 'false']).transform((val) => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_SIMULATION: z.enum(['true', 'false']).transform((val) => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_GAS_OPTIMIZATION: z.enum(['true', 'false']).transform((val) => val === 'true').default('true'),

  // Analytics (Optional)
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional().default(''),
  NEXT_PUBLIC_SENTRY_DSN: z.union([z.string().url('Invalid Sentry DSN'), z.literal('')]).default(''),
});

/**
 * Parsed and validated public environment variables
 */
export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Get validated public environment variables
 * Throws an error if validation fails
 */
export function getPublicEnv(): PublicEnv {
  try {
    return publicEnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      throw new Error(`Invalid environment variables:\n${missingVars}`);
    }
    throw error;
  }
}

/**
 * Get a specific environment variable with validation
 */
export function getPublicEnvVar<K extends keyof PublicEnv>(key: K): PublicEnv[K] {
  const env = getPublicEnv();
  return env[key];
}

/**
 * Validate environment variables on app startup
 * Call this early in your app initialization (e.g., in layout.tsx)
 */
export function validateEnvironment(): void {
  try {
    getPublicEnv();
    console.log('✅ Environment variables validated successfully');
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    if (typeof window === 'undefined') {
      // Server-side: throw to prevent server startup
      throw error;
    } else {
      // Client-side: log warning but allow app to continue
      console.warn('Environment validation warning - some features may not work');
    }
  }
}

// Export environment variables as a singleton
const publicEnv = getPublicEnv();
export default publicEnv;
