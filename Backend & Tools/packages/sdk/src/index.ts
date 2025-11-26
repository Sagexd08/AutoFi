import {
  AgentCreateRequest,
  AgentCreateResponse,
  AgentListResponse,
  AgentQueryRequest,
  AgentQueryResponse,
  ContractDeploymentRequest,
  ContractDeploymentResponse,
  GasEstimateResponse,
  HealthResponse,
  SDKConfig,
  SpendingLimitConfig,
  SpendingLimitResponse,
  TransactionRequest,
  TransactionResponse,
} from './types.js';
import { SDKError, SDKHttpClient } from './client.js';
import { BatchProcessor } from './utils/batch.js';
import { validateOrThrow, ValidationSchemas } from './utils/validation.js';
import type { EventEmitter, SDKEventMap } from './utils/events.js';
import type { PaginationParams } from './utils/pagination.js';

export * from './client.js';
export * from './types.js';
export * from './utils/index.js';

export interface ProcessPromptParams extends AgentQueryRequest {
  agentId?: string;
}

export class CeloAISDK {
  private readonly config: SDKConfig;
  private readonly http: SDKHttpClient;
  private readonly batchProcessors: Map<string, BatchProcessor<unknown, unknown>> = new Map();

  constructor(config: SDKConfig) {
    this.config = config;
    this.http = new SDKHttpClient(config);
  }

  getEvents(): EventEmitter<SDKEventMap> {
    return this.http.getEvents();
  }

  getHttpClient(): SDKHttpClient {
    return this.http;
  }

  async initialize(): Promise<HealthResponse> {
    return this.getHealth();
  }

  async createAgent(input: AgentCreateRequest): Promise<AgentCreateResponse> {
    if (this.config.validateRequests !== false) {
      validateOrThrow(ValidationSchemas.agentCreateRequest, input);
    }

    return this.http.request<AgentCreateResponse>('/api/agents', {
      method: 'POST',
      body: input,
    });
  }

  async listAgents(params?: PaginationParams): Promise<AgentListResponse> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (params) {
      if (params.page !== undefined) query.page = params.page;
      if (params.limit !== undefined) query.limit = params.limit;
      if (params.cursor) query.cursor = params.cursor;
      if (params.offset !== undefined) query.offset = params.offset;
    }
    return this.http.request<AgentListResponse>('/api/agents', {
      method: 'GET',
      query,
    });
  }

  async processPrompt(params: ProcessPromptParams): Promise<AgentQueryResponse> {
    const agentId = params.agentId ?? this.config.defaultAgentId;
    if (!agentId) {
      throw new SDKError('Agent ID is required for processPrompt', {
        code: 'sdk_missing_agent_id',
      });
    }

    if (this.config.validateRequests !== false) {
      validateOrThrow(ValidationSchemas.agentQueryRequest, params);
    }

    const payload: AgentQueryRequest = {
      prompt: params.prompt,
      context: params.context,
      metadata: params.metadata,
      streaming: params.streaming,
      intentOnly: params.intentOnly,
    };

    return this.http.request<AgentQueryResponse>(`/api/agents/${agentId}/query`, {
      method: 'POST',
      body: payload,
    });
  }

  async deployContract(
    request: ContractDeploymentRequest
  ): Promise<ContractDeploymentResponse> {
    if (this.config.validateRequests !== false) {
      validateOrThrow(ValidationSchemas.contractDeploymentRequest, request);
    }

    return this.http.request<ContractDeploymentResponse>('/api/deploy', {
      method: 'POST',
      body: request,
    });
  }

  async sendTransaction(
    request: TransactionRequest
  ): Promise<TransactionResponse> {
    if (this.config.validateRequests !== false) {
      validateOrThrow(ValidationSchemas.transactionRequest, request);
    }

    return this.http.request<TransactionResponse>('/api/tx/send', {
      method: 'POST',
      body: request,
    });
  }

  async sendTransactionsBatch(
    requests: TransactionRequest[]
  ): Promise<TransactionResponse[]> {
    const processor = this.getBatchProcessor<TransactionRequest, TransactionResponse>(
      'transactions',
      async (batch) => {
        const responses = await Promise.all(
          batch.map((req) => this.sendTransaction(req))
        );
        return responses;
      }
    );

    return Promise.all(requests.map((req) => processor.add(req)));
  }

  async estimateGas(
    request: TransactionRequest
  ): Promise<GasEstimateResponse> {
    if (this.config.validateRequests !== false) {
      validateOrThrow(ValidationSchemas.transactionRequest, request);
    }

    return this.http.request<GasEstimateResponse>('/api/tx/estimate', {
      method: 'POST',
      body: request,
    });
  }

  async getHealth(options?: { chainId?: string | number }): Promise<HealthResponse> {
    if (options?.chainId !== undefined) {
      return this.http.request<HealthResponse>(
        `/api/chains/${options.chainId}/health`
      );
    }

    return this.http.request<HealthResponse>('/api/chains/health');
  }

  async setLimits(config: SpendingLimitConfig): Promise<SpendingLimitResponse> {
    if (this.config.validateRequests !== false) {
      validateOrThrow(ValidationSchemas.spendingLimitConfig, config);
    }

    return this.http.request<SpendingLimitResponse>('/api/limits', {
      method: 'POST',
      body: config,
    });
  }

  async getLimits(agentId: string): Promise<SpendingLimitResponse> {
    if (!agentId) {
      throw new SDKError('agentId is required', { code: 'sdk_missing_agent_id' });
    }

    return this.http.request<SpendingLimitResponse>(`/api/limits/${agentId}`, {
      method: 'GET',
    });
  }

  private getBatchProcessor<TRequest, TResponse>(
    type: string,
    processor: (requests: TRequest[]) => Promise<TResponse[]>
  ): BatchProcessor<TRequest, TResponse> {
    if (!this.batchProcessors.has(type)) {
      this.batchProcessors.set(
        type,
        new BatchProcessor(processor as (requests: unknown[]) => Promise<unknown[]>)
      );
    }
    return this.batchProcessors.get(type) as BatchProcessor<TRequest, TResponse>;
  }

  async flushBatches(): Promise<void> {
    await Promise.all(
      Array.from(this.batchProcessors.values()).map((processor) => processor.flush())
    );
  }
}
