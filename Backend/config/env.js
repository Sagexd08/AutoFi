import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  HOST: z.string().default('0.0.0.0'),

  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  POSTMAN_API_KEY: z.string().optional(),
  
  PRIVATE_KEY: z.string().optional(),
  NETWORK: z.string().default('alfajores'),
  RPC_URL: z.string().url().optional(),
  
  DATABASE_URL: z.string().optional(),
  
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().positive()).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().positive()).default('100'),
  
  JWT_SECRET: z.string().min(32).optional(),
  API_KEY: z.string().optional(),
  ALLOWED_ORIGINS: z.string().default('*'),
  
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  ENABLE_REQUEST_LOGGING: z.string().transform(v => v === 'true').default('true'),
  
  ENABLE_PROXY: z.string().transform(v => v === 'true').default('false'),
  ENABLE_MULTI_CHAIN: z.string().transform(v => v === 'true').default('true'),
  ENABLE_TESTING: z.string().transform(v => v === 'true').default('true'),
});

let env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment variable validation failed:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export const config = {
  ...env,
  
  get isDevelopment() {
    return env.NODE_ENV === 'development';
  },
  
  get isProduction() {
    return env.NODE_ENV === 'production';
  },
  
  get isTest() {
    return env.NODE_ENV === 'test';
  },
  
  get allowedOrigins() {
    return env.ALLOWED_ORIGINS === '*' 
      ? ['*'] 
      : env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  },
  
  get serverConfig() {
    return {
      port: env.PORT,
      host: env.HOST,
      environment: env.NODE_ENV,
    };
  },
  
  get apiConfig() {
    return {
      rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      enableRequestLogging: env.ENABLE_REQUEST_LOGGING,
    };
  },
  
  get blockchainConfig() {
    return {
      privateKey: env.PRIVATE_KEY,
      network: env.NETWORK,
      rpcUrl: env.RPC_URL,
    };
  },
  
  get securityConfig() {
    return {
      jwtSecret: env.JWT_SECRET,
      apiKey: env.API_KEY,
      allowedOrigins: this.allowedOrigins,
    };
  },
  
  get featuresConfig() {
    return {
      enableProxy: env.ENABLE_PROXY,
      enableMultiChain: env.ENABLE_MULTI_CHAIN,
      enableTesting: env.ENABLE_TESTING,
    };
  },
};

export default config;

