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

export * from './client.js';
export * from './types.js';

export interface ProcessPromptParams extends AgentQueryRequest {
  agentId?: string;
}

export class CeloAISDK {
  private readonly config: SDKConfig;
  private readonly http: SDKHttpClient;

  constructor(config: SDKConfig) {
    this.config = config;
    this.http = new SDKHttpClient(config);
  }

  /**
   * Performs a lightweight health check against the backend.
   */
  async initialize(): Promise<HealthResponse> {
    return this.getHealth();
  }

  /**
   * Creates a new autonomous agent managed by the backend.
   */
  async createAgent(input: AgentCreateRequest): Promise<AgentCreateResponse> {
    return this.http.request<AgentCreateResponse>('/api/agents', {
      method: 'POST',
      body: input,
    });
  }

  /**
   * Lists all available agents.
   */
  async listAgents(): Promise<AgentListResponse> {
    return this.http.request<AgentListResponse>('/api/agents', {
      method: 'GET',
    });
  }

  /**
   * Processes a natural language prompt with the specified agent.
   */
  async processPrompt(params: ProcessPromptParams): Promise<AgentQueryResponse> {
    const agentId = params.agentId ?? this.config.defaultAgentId;
    if (!agentId) {
      throw new SDKError('Agent ID is required for processPrompt', {
        code: 'sdk_missing_agent_id',
      });
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

  /**
   * Deploys a smart contract on the configured network.
   */
  async deployContract(
    request: ContractDeploymentRequest
  ): Promise<ContractDeploymentResponse> {
    return this.http.request<ContractDeploymentResponse>('/api/deploy', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Sends a transaction through the secure transaction manager.
   */
  async sendTransaction(
    request: TransactionRequest
  ): Promise<TransactionResponse> {
    return this.http.request<TransactionResponse>('/api/tx/send', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Estimates gas usage for a transaction prior to execution.
   */
  async estimateGas(
    request: TransactionRequest
  ): Promise<GasEstimateResponse> {
    return this.http.request<GasEstimateResponse>('/api/tx/estimate', {
      method: 'POST',
      body: request,
    });
  }

  /**
   * Retrieves system and chain health information.
   */
  async getHealth(options?: { chainId?: string | number }): Promise<HealthResponse> {
    if (options?.chainId !== undefined) {
      return this.http.request<HealthResponse>(
        `/api/chains/${options.chainId}/health`
      );
    }

    return this.http.request<HealthResponse>('/api/chains/health');
  }

  /**
   * Sets spending limits for a given agent.
   */
  async setLimits(config: SpendingLimitConfig): Promise<SpendingLimitResponse> {
    return this.http.request<SpendingLimitResponse>('/api/limits', {
      method: 'POST',
      body: config,
    });
  }

  /**
   * Retrieves spending limits for an agent.
   */
  async getLimits(agentId: string): Promise<SpendingLimitResponse> {
    if (!agentId) {
      throw new SDKError('agentId is required', { code: 'sdk_missing_agent_id' });
    }

    return this.http.request<SpendingLimitResponse>(`/api/limits/${agentId}`, {
      method: 'GET',
    });
  }
}
