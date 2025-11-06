import { z } from 'zod';
import type { SDKConfig, ChainConfig, AgentConfig, ContractConfig, ProxyConfig, LoadBalancerConfig, TestConfig } from '../types/config';

/**
 * Zod schema for SDK configuration.
 */
export const SDKConfigSchema: z.ZodType<SDKConfig> = z.object({
  apiKey: z.string().min(10, 'API key must be at least 10 characters').optional(),
  privateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format').optional(),
  network: z.string().optional(),
  rpcUrl: z.string().url('Invalid RPC URL').optional(),
  enableRealTransactions: z.boolean().optional(),
  maxRiskScore: z.number().min(0).max(100).optional(),
  requireApproval: z.boolean().optional(),
  enableSimulation: z.boolean().optional(),
  enableGasOptimization: z.boolean().optional(),
  enableMultiChain: z.boolean().optional(),
  enableProxy: z.boolean().optional(),
  enableTesting: z.boolean().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  timeout: z.number().positive('Timeout must be positive').optional(),
  retryAttempts: z.number().int().min(0, 'Retry attempts must be non-negative').optional(),
  retryDelay: z.number().positive('Retry delay must be positive').optional(),
  metrics: z.object({
    rawMetricsEnabled: z.boolean().optional(),
    maxRawMetrics: z.number().int().positive('Max raw metrics must be a positive integer').optional(),
    metricsTTL: z.number().positive('Metrics TTL must be positive (milliseconds)').optional(),
  }).optional(),
}).strict();

/**
 * Zod schema for chain configuration.
 */
export const ChainConfigSchema: z.ZodType<ChainConfig> = z.object({
  id: z.string().min(1, 'Chain ID is required'),
  name: z.string().min(1, 'Chain name is required'),
  chainId: z.number().int().positive('Chain ID must be a positive integer'),
  rpcUrls: z.array(z.string().url('Invalid RPC URL')).min(1, 'At least one RPC URL is required'),
  nativeCurrency: z.object({
    name: z.string().min(1, 'Currency name is required'),
    symbol: z.string().min(1, 'Currency symbol is required'),
    decimals: z.number().int().min(0).max(18),
  }),
  blockExplorer: z.string().url('Invalid block explorer URL').optional(),
  isTestnet: z.boolean(),
  priority: z.number().int().min(0),
  gasPriceMultiplier: z.number().positive(),
  maxGasPrice: z.string().regex(/^\d+$/, 'Max gas price must be a number string'),
  minGasPrice: z.string().regex(/^\d+$/, 'Min gas price must be a number string'),
  contracts: z.record(z.string(), z.string()).optional(),
  tokens: z.record(z.string(), z.string()).optional(),
}).strict();

/**
 * Zod schema for agent configuration.
 */
export const AgentConfigSchema: z.ZodType<AgentConfig> = z.object({
  type: z.string().min(1, 'Agent type is required'),
  name: z.string().min(1, 'Agent name is required'),
  description: z.string().min(1, 'Agent description is required'),
  capabilities: z.array(z.string()).min(1, 'At least one capability is required'),
  context: z.record(z.string(), z.unknown()).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
  maxExecutionTime: z.number().positive('Max execution time must be positive').optional(),
  retryAttempts: z.number().int().min(0).optional(),
  enableLogging: z.boolean().optional(),
}).strict();

/**
 * Zod schema for contract configuration.
 */
export const ContractConfigSchema: z.ZodType<ContractConfig> = z.object({
  name: z.string().min(1, 'Contract name is required'),
  version: z.string().min(1, 'Contract version is required'),
  source: z.string().min(1, 'Contract source is required'),
  abi: z.array(z.unknown()).min(1, 'ABI must be a non-empty array'),
  bytecode: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid bytecode format'),
  constructorArgs: z.array(z.unknown()).optional(),
  gasLimit: z.string().regex(/^\d+$/, 'Gas limit must be a number string').optional(),
  gasPrice: z.string().regex(/^\d+$/, 'Gas price must be a number string').optional(),
  value: z.string().regex(/^\d+$/, 'Value must be a number string').optional(),
  libraries: z.record(z.string(), z.string()).optional(),
  optimizer: z.object({
    enabled: z.boolean(),
    runs: z.number().int().min(0),
  }).optional(),
}).strict();

/**
 * Zod schema for load balancer configuration.
 */
export const LoadBalancerConfigSchema: z.ZodType<LoadBalancerConfig> = z.object({
  algorithm: z.enum(['round-robin', 'least-connections', 'weighted', 'ip-hash']),
  healthCheck: z.boolean(),
  failover: z.boolean(),
  circuitBreaker: z.object({
    enabled: z.boolean(),
    failureThreshold: z.number().int().positive(),
    recoveryTimeout: z.number().positive(),
  }),
  weights: z.record(z.string(), z.number().positive()).optional(),
}).strict();

/**
 * Zod schema for proxy configuration.
 */
export const ProxyConfigSchema = z.object({
  enabled: z.boolean(),
  port: z.number().int().min(1).max(65535),
  host: z.string().min(1),
  loadBalancer: LoadBalancerConfigSchema,
  healthCheck: z.object({
    enabled: z.boolean(),
    interval: z.number().positive(),
    timeout: z.number().positive(),
    retries: z.number().int().min(0),
  }).optional(),
  rateLimit: z.object({
    enabled: z.boolean(),
    windowMs: z.number().positive(),
    maxRequests: z.number().int().positive(),
  }).optional(),
  cors: z.object({
    enabled: z.boolean(),
    origins: z.array(z.string()),
  }).optional(),
  authentication: z.object({
    enabled: z.boolean(),
    apiKey: z.string().optional(),
    jwtSecret: z.string().optional(),
  }).optional(),
}).strict()
  .refine(
    (data) => !data.cors?.enabled || (data.cors && data.cors.origins && data.cors.origins.length > 0),
    {
      message: 'When CORS is enabled, at least one origin must be provided',
      path: ['cors', 'origins'],
    }
  )
  .refine(
    (data) => !data.authentication?.enabled || (data.authentication && (data.authentication.apiKey || data.authentication.jwtSecret)),
    {
      message: 'When authentication is enabled, at least one of apiKey or jwtSecret must be provided',
      path: ['authentication'],
    }
  ) as z.ZodType<ProxyConfig>;

/**
 * Zod schema for test configuration.
 */
export const TestConfigSchema: z.ZodType<TestConfig> = z.object({
  enabled: z.boolean(),
  postman: z.object({
    apiKey: z.string().optional(),
    workspaceId: z.string().optional(),
    collectionId: z.string().optional(),
    environmentId: z.string().optional(),
  }),
  timeout: z.number().positive(),
  retries: z.number().int().min(0),
  parallel: z.boolean(),
  reportFormat: z.enum(['json', 'html', 'xml']),
  outputDir: z.string().min(1),
}).strict();
