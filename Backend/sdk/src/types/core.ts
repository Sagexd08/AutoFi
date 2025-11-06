export interface TransactionRequest {
  readonly to: string;
  readonly value?: string;
  readonly data?: string;
  readonly gasLimit?: string;
  readonly gasPrice?: string;
  readonly maxFeePerGas?: string;
  readonly maxPriorityFeePerGas?: string;
  readonly nonce?: number;
  readonly chainId?: number;
  readonly type?: 'legacy' | 'eip1559';
}
export interface TransactionResponse {
  readonly success: boolean;
  readonly txHash?: string;
  readonly receipt?: TransactionReceipt;
  readonly error?: string;
  readonly gasUsed?: string;
  readonly gasPrice?: string;
  readonly blockNumber?: string;
  readonly confirmations?: number;
  readonly duration?: number;
  readonly timestamp: string;
}
export interface TransactionReceipt {
  readonly transactionHash: string;
  readonly blockNumber: string;
  readonly blockHash: string;
  readonly transactionIndex: number;
  readonly from: string;
  readonly to: string;
  readonly gasUsed: string;
  readonly effectiveGasPrice: string;
  readonly status: 'success' | 'failed';
  readonly logs: readonly Log[];
  readonly logsBloom: string;
  readonly contractAddress?: string;
}
export interface Log {
  readonly address: string;
  readonly topics: readonly string[];
  readonly data: string;
  readonly blockNumber: string;
  readonly transactionHash: string;
  readonly transactionIndex: number;
  readonly logIndex: number;
  readonly removed: boolean;
}
export interface TokenBalance {
  readonly success: boolean;
  readonly balance: string;
  readonly raw: string;
  readonly decimals: number;
  readonly symbol: string;
  readonly name?: string;
  readonly address: string;
  readonly error?: string;
}
export interface ContractDeployment {
  readonly success: boolean;
  readonly contractAddress?: string;
  readonly txHash?: string;
  readonly gasUsed?: string;
  readonly blockNumber?: string;
  readonly abi?: readonly unknown[];
  readonly bytecode?: string;
  readonly error?: string;
  readonly duration?: number;
  readonly timestamp: string;
}
export interface AgentResponse {
  readonly success: boolean;
  readonly response: string;
  readonly reasoning?: string;
  readonly confidence: number;
  readonly functionCalls: readonly FunctionCall[];
  readonly executionTime: number;
  readonly agentId: string;
  readonly timestamp: string;
  readonly error?: string;
}
export interface FunctionCall {
  readonly name: string;
  readonly parameters: Record<string, unknown>;
  readonly result?: unknown;
  readonly error?: string;
  readonly duration?: number;
}
export interface TestResult {
  readonly success: boolean;
  readonly testName: string;
  readonly duration: number;
  readonly status: 'passed' | 'failed' | 'skipped';
  readonly error?: string;
  readonly assertions: readonly Assertion[];
  readonly request?: {
    readonly method: string;
    readonly url: string;
    readonly headers: Record<string, string>;
    readonly body?: unknown;
  };
  readonly response?: {
    readonly status: number;
    readonly headers: Record<string, string>;
    readonly body: unknown;
    readonly duration: number;
  };
  readonly timestamp: string;
}
export interface Assertion {
  readonly name: string;
  readonly passed: boolean;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly error?: string;
}
export interface GasEstimate {
  readonly success: boolean;
  readonly gasLimit: string;
  readonly gasPrice: string;
  readonly estimatedCost: string;
  readonly estimatedCostWei: string;
  readonly error?: string;
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
