export interface ChainInfo {
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
}
export interface NetworkStatus {
  readonly chainId: string;
  readonly name: string;
  readonly status: 'healthy' | 'unhealthy' | 'unknown';
  readonly blockNumber?: string;
  readonly responseTime?: number;
  readonly lastChecked: string;
  readonly errorCount: number;
  readonly successCount: number;
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
export interface HealthCheck {
  readonly healthy: boolean;
  readonly status: string;
  readonly timestamp: string;
  readonly services: Record<string, ServiceHealth>;
  readonly uptime: number;
  readonly version: string;
}
export interface ServiceHealth {
  readonly healthy: boolean;
  readonly status: string;
  readonly responseTime?: number;
  readonly lastChecked: string;
  readonly error?: string;
}
