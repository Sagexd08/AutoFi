/**
 * API Client for connecting Frontend to Backend
 * Handles all communication with the automation system backend
 */

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface AutomationRequest {
  name: string
  type: "transaction" | "swap" | "nft" | "dao" | "refi" | "alerts"
  parameters: Record<string, any>
  schedule?: {
    frequency: "once" | "daily" | "weekly" | "monthly"
    cron?: string
  }
  conditions?: Record<string, any>
}

export interface AutomationResponse {
  id: string
  name: string
  type: string
  status: "active" | "paused" | "completed" | "failed"
  progress: number
  nextRun: string
  createdAt: string
  parameters: Record<string, any>
  lastExecution?: {
    timestamp: string
    status: "success" | "failed"
    txHash?: string
    error?: string
  }
}

export interface WalletInfo {
  address: string
  balance: string
  network: "mainnet" | "testnet"
  tokens: Array<{
    address: string
    symbol: string
    name: string
    balance: string
    price?: number
  }>
}

export interface TransactionRequest {
  to: string
  value?: string
  data?: string
  gasLimit?: string
  gasPrice?: string
}

export interface BlockchainFunctionCall {
  functionName: string
  parameters: Record<string, any>
  context?: Record<string, any>
}

class ApiClient {
  private baseUrl: string
  private apiKey?: string
  private wsConnection: WebSocket | null = null
  private eventListeners: Map<string, (data: any) => void> = new Map()

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', apiKey?: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      }

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`
      }

      const response = await fetch(url, {
        ...options,
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  // Automation Management
  async createAutomation(automation: AutomationRequest): Promise<ApiResponse<AutomationResponse>> {
    return this.request<AutomationResponse>('/api/automations', {
      method: 'POST',
      body: JSON.stringify(automation),
    })
  }

  async getAutomations(): Promise<ApiResponse<AutomationResponse[]>> {
    return this.request<AutomationResponse[]>('/api/automations')
  }

  async getAutomation(id: string): Promise<ApiResponse<AutomationResponse>> {
    return this.request<AutomationResponse>(`/api/automations/${id}`)
  }

  async updateAutomation(id: string, updates: Partial<AutomationRequest>): Promise<ApiResponse<AutomationResponse>> {
    return this.request<AutomationResponse>(`/api/automations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteAutomation(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/automations/${id}`, {
      method: 'DELETE',
    })
  }

  async pauseAutomation(id: string): Promise<ApiResponse<AutomationResponse>> {
    return this.request<AutomationResponse>(`/api/automations/${id}/pause`, {
      method: 'POST',
    })
  }

  async resumeAutomation(id: string): Promise<ApiResponse<AutomationResponse>> {
    return this.request<AutomationResponse>(`/api/automations/${id}/resume`, {
      method: 'POST',
    })
  }

  async executeAutomation(id: string, context?: Record<string, any>): Promise<ApiResponse<{ txHash?: string; result: any }>> {
    return this.request<{ txHash?: string; result: any }>(`/api/automations/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ context }),
    })
  }

  // Wallet Management
  async getWalletInfo(address: string): Promise<ApiResponse<WalletInfo>> {
    return this.request<WalletInfo>(`/api/wallet/${address}`)
  }

  async getWalletBalance(address: string): Promise<ApiResponse<{ balance: string; tokens: any[] }>> {
    return this.request<{ balance: string; tokens: any[] }>(`/api/wallet/${address}/balance`)
  }

  async getWalletTokens(address: string): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/api/wallet/${address}/tokens`)
  }

  // Blockchain Operations
  async sendTransaction(tx: TransactionRequest): Promise<ApiResponse<{ txHash: string }>> {
    return this.request<{ txHash: string }>('/api/blockchain/send-transaction', {
      method: 'POST',
      body: JSON.stringify(tx),
    })
  }

  async callBlockchainFunction(call: BlockchainFunctionCall): Promise<ApiResponse<any>> {
    return this.request<any>('/api/blockchain/function-call', {
      method: 'POST',
      body: JSON.stringify(call),
    })
  }

  async getTransactionStatus(txHash: string): Promise<ApiResponse<{ status: string; blockNumber?: number }>> {
    return this.request<{ status: string; blockNumber?: number }>(`/api/blockchain/transaction/${txHash}`)
  }

  async getTransactionHistory(address: string, limit: number = 10): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/api/blockchain/transactions/${address}?limit=${limit}`)
  }

  // Natural Language Processing
  async processNaturalLanguage(prompt: string, context?: Record<string, any>): Promise<ApiResponse<{
    functionCalls: Array<{
      functionName: string
      parameters: Record<string, any>
    }>
    response: string
  }>> {
    return this.request<{
      functionCalls: Array<{
        functionName: string
        parameters: Record<string, any>
      }>
      response: string
    }>('/api/ai/process', {
      method: 'POST',
      body: JSON.stringify({ prompt, context }),
    })
  }

  // AI-Powered Intent Parsing
  async parseIntent(prompt: string, walletAddress: string): Promise<ApiResponse<{
    action: string
    tokens: string[]
    amounts: string[]
    addresses: string[]
    conditions: any[]
    schedule?: any
    confidence: number
  }>> {
    return this.request('/api/ai/parse', {
      method: 'POST',
      body: JSON.stringify({ prompt, walletAddress }),
    })
  }

  // AI-Powered Execution Plan Generation
  async generatePlan(prompt: string, walletAddress: string): Promise<ApiResponse<{
    intent: any
    plan: {
      id: string
      steps: any[]
      estimatedGas: string
      risks: any[]
      recommendations: string[]
    }
  }>> {
    return this.request('/api/ai/plan', {
      method: 'POST',
      body: JSON.stringify({ prompt, walletAddress }),
    })
  }

  // Execute AI-generated plan
  async executePlan(plan: any, chainId?: number): Promise<ApiResponse<{
    jobId: string
    status: string
    estimatedTime: string
  }>> {
    return this.request('/api/ai/execute', {
      method: 'POST',
      body: JSON.stringify({ plan, chainId }),
    })
  }

  // Semantic search in user memory
  async searchMemory(query: string, options?: {
    walletAddress?: string
    type?: 'automation' | 'transaction' | 'prompt' | 'context' | 'feedback'
    limit?: number
  }): Promise<ApiResponse<any[]>> {
    return this.request('/api/ai/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...options }),
    })
  }

  // Store user feedback
  async storeFeedback(data: {
    walletAddress: string
    automationId: string
    rating: number
    comment?: string
  }): Promise<ApiResponse<{ id: string }>> {
    return this.request('/api/ai/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Get personalized recommendations
  async getRecommendations(walletAddress: string): Promise<ApiResponse<string[]>> {
    return this.request(`/api/ai/recommendations/${walletAddress}`)
  }

  // Get automation history
  async getAutomationHistory(walletAddress: string, limit?: number): Promise<ApiResponse<any[]>> {
    return this.request(`/api/ai/history/${walletAddress}?limit=${limit || 20}`)
  }

  // Get vector DB stats
  async getVectorDBStats(): Promise<ApiResponse<{
    totalDocuments: number
    totalCollections: number
    dimensions: number
    memoryUsage: number
  }>> {
    return this.request('/api/ai/stats')
  }

  // Calculate text similarity
  async calculateSimilarity(text1: string, text2: string): Promise<ApiResponse<{ similarity: number }>> {
    return this.request('/api/ai/similarity', {
      method: 'POST',
      body: JSON.stringify({ text1, text2 }),
    })
  }

  // Analytics
  async getAnalytics(sessionId?: string): Promise<ApiResponse<{
    totalAutomations: number
    activeAutomations: number
    totalTransactions: number
    successRate: number
    averageExecutionTime: number
    mostUsedFunctions: Array<{ functionName: string; count: number }>
  }>> {
    return this.request<{
      totalAutomations: number
      activeAutomations: number
      totalTransactions: number
      successRate: number
      averageExecutionTime: number
      mostUsedFunctions: Array<{ functionName: string; count: number }>
    }>(`/api/analytics${sessionId ? `?sessionId=${sessionId}` : ''}`)
  }

  // System Status
  async getSystemStatus(): Promise<ApiResponse<{
    status: string
    version: string
    uptime: number
    blockchainConnected: boolean
    aiConnected: boolean
    databaseConnected: boolean
  }>> {
    return this.request<{
      status: string
      version: string
      uptime: number
      blockchainConnected: boolean
      aiConnected: boolean
      databaseConnected: boolean
    }>('/api/status')
  }

  // Available Functions
  async getAvailableFunctions(): Promise<ApiResponse<string[]>> {
    return this.request<string[]>('/api/functions')
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (data: any) => void): WebSocket {
    try {
      if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
        return this.wsConnection
      }

      if (this.wsConnection) {
        this.wsConnection.close()
      }

      let wsUrl = this.baseUrl

      if (wsUrl.startsWith('https://')) {
        wsUrl = wsUrl.replace('https://', 'wss://')
      } else if (wsUrl.startsWith('http://')) {
        wsUrl = wsUrl.replace('http://', 'ws://')
      }

      wsUrl = wsUrl.replace(/\/$/, '')

      const fullWsUrl = `${wsUrl}/ws`

      const ws = new WebSocket(fullWsUrl)

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close()
        }
      }, 10000)

      ws.onopen = () => {
        clearTimeout(connectionTimeout)
        ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessage(data)
        } catch (error) {
          console.error('[WebSocket] Message parsing error:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error)
      }

      ws.onclose = () => {
        if (this.wsConnection === ws) {
          this.wsConnection = null
        }
      }

      this.wsConnection = ws
      return ws
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error)
      throw error
    }
  }

  // Enhanced WebSocket methods
  addEventListener(eventType: string, callback: (data: any) => void): void {
    this.eventListeners.set(eventType, callback)
  }

  removeEventListener(eventType: string): void {
    this.eventListeners.delete(eventType)
  }

  private emitEvent(eventType: string, data: any): void {
    const callback = this.eventListeners.get(eventType)
    if (callback) {
      callback(data)
    }
  }

  // Real-time automation updates
  subscribeToAutomationUpdates(automationId: string, callback: (update: any) => void): void {
    this.addEventListener(`automation:${automationId}`, callback)
  }

  // Real-time transaction updates
  subscribeToTransactionUpdates(txHash: string, callback: (update: any) => void): void {
    this.addEventListener(`transaction:${txHash}`, callback)
  }

  // Real-time price updates
  subscribeToPriceUpdates(tokenSymbol: string, callback: (price: number) => void): void {
    this.addEventListener(`price:${tokenSymbol}`, callback)
  }

  // Real-time balance updates
  subscribeToBalanceUpdates(address: string, callback: (balance: string) => void): void {
    this.addEventListener(`balance:${address}`, callback)
  }

  // Disconnect WebSocket
  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close()
      this.wsConnection = null
    }
  }

  // Enhanced automation methods
  async createAutomationWithAI(prompt: string, context?: Record<string, any>): Promise<ApiResponse<AutomationResponse>> {
    return this.request<AutomationResponse>('/api/automations/ai-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify({ prompt, context })
    })
  }

  // Enhanced blockchain function calls
  async executeBlockchainFunctionWithAI(
    prompt: string, 
    context?: Record<string, any>
  ): Promise<ApiResponse<{
    functionCalls: Array<{
      functionName: string
      parameters: Record<string, any>
    }>
    response: string
    txHash?: string
  }>> {
    return this.request('/api/blockchain/ai-execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify({ prompt, context })
    })
  }

  // Get system status with detailed information
  async getDetailedSystemStatus(): Promise<ApiResponse<{
    status: string
    version: string
    uptime: number
    blockchainConnected: boolean
    aiConnected: boolean
    databaseConnected: boolean
    activeAutomations: number
    totalTransactions: number
    successRate: number
    lastUpdate: string
  }>> {
    return this.request('/api/system/status')
  }

  // Get automation analytics
  async getAutomationAnalytics(automationId?: string): Promise<ApiResponse<{
    totalExecutions: number
    successRate: number
    averageExecutionTime: number
    lastExecution?: {
      timestamp: string
      status: 'success' | 'failed'
      txHash?: string
    }
    gasUsed: string
    costAnalysis: {
      totalCost: string
      averageCost: string
      costPerExecution: string
    }
  }>> {
    const endpoint = automationId ? `/api/analytics/automation/${automationId}` : '/api/analytics/automation'
    return this.request(endpoint)
  }

  // Get blockchain analytics
  async getBlockchainAnalytics(): Promise<ApiResponse<{
    totalTransactions: number
    successfulTransactions: number
    failedTransactions: number
    totalGasUsed: string
    averageGasPrice: string
    mostUsedFunctions: Array<{ functionName: string; count: number }>
    networkStats: {
      blockHeight: number
      networkHashRate: string
      averageBlockTime: number
    }
  }>> {
    return this.request('/api/analytics/blockchain')
  }
}

export const apiClient = new ApiClient()
