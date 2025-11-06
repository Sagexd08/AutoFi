export interface SDKConfig {
  readonly apiKey?: string;
  readonly privateKey?: string;
  readonly network?: string;
  readonly rpcUrl?: string;
  readonly enableRealTransactions?: boolean;
  readonly maxRiskScore?: number;
  readonly requireApproval?: boolean;
  readonly enableSimulation?: boolean;
  readonly enableGasOptimization?: boolean;
  readonly enableMultiChain?: boolean;
  readonly enableProxy?: boolean;
  readonly enableTesting?: boolean;
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error';
  readonly timeout?: number;
  readonly retryAttempts?: number;
  readonly retryDelay?: number;
  readonly metrics?: {
    readonly rawMetricsEnabled?: boolean;
    readonly maxRawMetrics?: number;
    readonly metricsTTL?: number;
  };
}

export interface ChainConfig {
  readonly id: string;
  readonly name: string;
  readonly chainId: number;
  readonly rpcUrls: readonly string[];
  readonly nativeCurrency: {
    readonly name: string;
    readonly symbol: string;
    readonly decimals: number;
  };
  readonly blockExplorer?: string;
  readonly isTestnet: boolean;
  readonly priority: number;
  readonly gasPriceMultiplier: number;
  readonly maxGasPrice: string;
  readonly minGasPrice: string;
  readonly contracts?: Record<string, string>;
  readonly tokens?: Record<string, string>;
}

export interface AgentConfig {
  readonly type: string;
  readonly name: string;
  readonly description: string;
  readonly capabilities: readonly string[];
  readonly context?: Record<string, unknown>;
  readonly preferences?: Record<string, unknown>;
  readonly maxExecutionTime?: number;
  readonly retryAttempts?: number;
  readonly enableLogging?: boolean;
}

export interface ContractConfig {
  readonly name: string;
  readonly version: string;
  readonly source: string;
  readonly abi: readonly unknown[];
  readonly bytecode: string;
  readonly constructorArgs?: readonly unknown[];
  readonly gasLimit?: string;
  readonly gasPrice?: string;
  readonly value?: string;
  readonly libraries?: Record<string, string>;
  readonly optimizer?: {
    readonly enabled: boolean;
    readonly runs: number;
  };
}

export interface ProxyConfig {
  readonly enabled: boolean;
  readonly port: number;
  readonly host: string;
  readonly loadBalancer: LoadBalancerConfig;
  readonly healthCheck?: {
    readonly enabled: boolean;
    readonly interval: number;
    readonly timeout: number;
    readonly retries: number;
  };
  readonly rateLimit?: {
    readonly enabled: boolean;
    readonly windowMs: number;
    readonly maxRequests: number;
  };
  readonly cors?: {
    readonly enabled: boolean;
    readonly origins: readonly string[];
  };
  readonly authentication?: {
    readonly enabled: boolean;
    readonly apiKey?: string;
    readonly jwtSecret?: string;
  };
}

export interface LoadBalancerConfig {
  readonly algorithm: 'round-robin' | 'least-connections' | 'weighted' | 'ip-hash';
  readonly healthCheck: boolean;
  readonly failover: boolean;
  readonly circuitBreaker: {
    readonly enabled: boolean;
    readonly failureThreshold: number;
    readonly recoveryTimeout: number;
  };
  readonly weights?: Record<string, number>;
}

export interface TestConfig {
  readonly enabled: boolean;
  readonly postman: {
    readonly apiKey?: string;
    readonly workspaceId?: string;
    readonly collectionId?: string;
    readonly environmentId?: string;
  };
  readonly timeout: number;
  readonly retries: number;
  readonly parallel: boolean;
  readonly reportFormat: 'json' | 'html' | 'xml';
  readonly outputDir: string;
}
