/**
 * Blockchain Integration Service
 * Connects Frontend with Backend blockchain functionality
 */

import { apiClient } from './api-client'

export interface BlockchainConfig {
  network: 'mainnet' | 'testnet'
  rpcUrl: string
  chainId: number
  contracts: {
    agentRegistry: string
    agentTreasury: string
    donationSplitter: string
    yieldAggregator: string
    masterTrading: string
    attendanceNFT: string
  }
  tokens: {
    CELO: string
    cUSD: string
    cEUR: string
    cREAL: string
  }
}

export interface TokenInfo {
  address: string
  symbol: string
  name: string
  decimals: number
  balance: string
  price?: number
  value?: number
}

export interface TransactionInfo {
  hash: string
  from: string
  to: string
  value: string
  status: 'pending' | 'success' | 'failed'
  timestamp: number
  blockNumber?: number
  gasUsed?: string
  gasPrice?: string
}

export interface AutomationExecution {
  id: string
  automationId: string
  status: 'pending' | 'success' | 'failed'
  txHash?: string
  error?: string
  timestamp: number
  gasUsed?: string
  result?: any
}

export interface BlockchainEvent {
  type: 'transaction' | 'automation' | 'price' | 'balance'
  data: any
  timestamp: number
}

class BlockchainIntegration {
  private config: BlockchainConfig
  private eventListeners: Map<string, (event: BlockchainEvent) => void> = new Map()
  private wsConnection: WebSocket | null = null
  private apiClient: any

  constructor(config: BlockchainConfig, apiClient?: any) {
    this.config = config
    this.apiClient = apiClient
  }

  // Network Management
  async switchNetwork(network: 'mainnet' | 'testnet'): Promise<void> {
    this.config.network = network
    // Update backend network configuration
    await apiClient.callBlockchainFunction({
      functionName: 'switchNetwork',
      parameters: { network }
    })
  }

  // Wallet Operations
  async getWalletBalance(address: string): Promise<string> {
    const response = await apiClient.getWalletBalance(address)
    if (response.success && response.data) {
      return response.data.balance
    }
    throw new Error(response.error || 'Failed to get wallet balance')
  }

  async getWalletTokens(address: string): Promise<TokenInfo[]> {
    const response = await apiClient.getWalletTokens(address)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to get wallet tokens')
  }

  async getTokenInfo(tokenAddress: string, walletAddress: string): Promise<TokenInfo> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'getTokenInfo',
      parameters: { tokenAddress, walletAddress }
    })
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to get token info')
  }

  // Transaction Operations
  async sendTransaction(to: string, value: string, data?: string): Promise<string> {
    const response = await apiClient.sendTransaction({
      to,
      value,
      data
    })
    if (response.success && response.data) {
      return response.data.txHash
    }
    throw new Error(response.error || 'Failed to send transaction')
  }

  async getTransactionStatus(txHash: string): Promise<TransactionInfo> {
    const response = await apiClient.getTransactionStatus(txHash)
    if (response.success && response.data) {
      return {
        hash: txHash,
        from: '',
        to: '',
        value: '0',
        status: response.data.status as 'pending' | 'success' | 'failed',
        timestamp: Date.now(),
        blockNumber: response.data.blockNumber
      }
    }
    throw new Error(response.error || 'Failed to get transaction status')
  }

  async getTransactionHistory(address: string, limit: number = 10): Promise<TransactionInfo[]> {
    const response = await apiClient.getTransactionHistory(address, limit)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to get transaction history')
  }

  // Automation Operations
  async executeAutomation(automationId: string, context?: Record<string, any>): Promise<AutomationExecution> {
    const response = await apiClient.executeAutomation(automationId, context)
    if (response.success && response.data) {
      return {
        id: Date.now().toString(),
        automationId,
        status: 'success',
        txHash: response.data.txHash,
        timestamp: Date.now(),
        result: response.data.result
      }
    }
    throw new Error(response.error || 'Failed to execute automation')
  }

  // DeFi Operations
  async swapTokens(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    minAmountOut: string,
    slippage: number = 0.5
  ): Promise<string> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'swapTokens',
      parameters: {
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        slippage
      }
    })
    if (response.success && response.data) {
      return response.data.txHash
    }
    throw new Error(response.error || 'Failed to swap tokens')
  }

  async addLiquidity(
    tokenA: string,
    tokenB: string,
    amountA: string,
    amountB: string
  ): Promise<string> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'addLiquidity',
      parameters: {
        tokenA,
        tokenB,
        amountA,
        amountB
      }
    })
    if (response.success && response.data) {
      return response.data.txHash
    }
    throw new Error(response.error || 'Failed to add liquidity')
  }

  async removeLiquidity(
    tokenA: string,
    tokenB: string,
    liquidity: string
  ): Promise<string> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'removeLiquidity',
      parameters: {
        tokenA,
        tokenB,
        liquidity
      }
    })
    if (response.success && response.data) {
      return response.data.txHash
    }
    throw new Error(response.error || 'Failed to remove liquidity')
  }

  // NFT Operations
  async mintNFT(
    to: string,
    tokenURI: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'mintNFT',
      parameters: {
        to,
        tokenURI,
        metadata
      }
    })
    if (response.success && response.data) {
      return response.data.txHash
    }
    throw new Error(response.error || 'Failed to mint NFT')
  }

  async transferNFT(
    from: string,
    to: string,
    tokenId: string
  ): Promise<string> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'transferNFT',
      parameters: {
        from,
        to,
        tokenId
      }
    })
    if (response.success && response.data) {
      return response.data.txHash
    }
    throw new Error(response.error || 'Failed to transfer NFT')
  }

  async getNFTMetadata(tokenId: string): Promise<Record<string, any>> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'getNFTMetadata',
      parameters: { tokenId }
    })
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to get NFT metadata')
  }

  // DAO Operations
  async createProposal(
    title: string,
    description: string,
    actions: Array<{
      target: string
      value: string
      signature: string
      calldata: string
    }>
  ): Promise<string> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'createProposal',
      parameters: {
        title,
        description,
        actions
      }
    })
    if (response.success && response.data) {
      return response.data.txHash
    }
    throw new Error(response.error || 'Failed to create proposal')
  }

  async voteOnProposal(
    proposalId: string,
    support: boolean,
    reason?: string
  ): Promise<string> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'voteOnProposal',
      parameters: {
        proposalId,
        support,
        reason
      }
    })
    if (response.success && response.data) {
      return response.data.txHash
    }
    throw new Error(response.error || 'Failed to vote on proposal')
  }

  async executeProposal(proposalId: string): Promise<string> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'executeProposal',
      parameters: { proposalId }
    })
    if (response.success && response.data) {
      return response.data.txHash
    }
    throw new Error(response.error || 'Failed to execute proposal')
  }

  // ReFi Operations
  async donateToCause(
    causeId: string,
    amount: string,
    token: string = 'cUSD'
  ): Promise<string> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'donateToCause',
      parameters: {
        causeId,
        amount,
        token
      }
    })
    if (response.success && response.data) {
      return response.data.txHash
    }
    throw new Error(response.error || 'Failed to donate to cause')
  }

  async createImpactNFT(
    causeId: string,
    impactData: Record<string, any>
  ): Promise<string> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'createImpactNFT',
      parameters: {
        causeId,
        impactData
      }
    })
    if (response.success && response.data) {
      return response.data.txHash
    }
    throw new Error(response.error || 'Failed to create impact NFT')
  }

  // Price Monitoring
  async getTokenPrice(tokenSymbol: string): Promise<number> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'getTokenPrice',
      parameters: { tokenSymbol }
    })
    if (response.success && response.data) {
      return response.data.price
    }
    throw new Error(response.error || 'Failed to get token price')
  }

  async setPriceAlert(
    tokenSymbol: string,
    targetPrice: number,
    condition: 'above' | 'below'
  ): Promise<string> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'setPriceAlert',
      parameters: {
        tokenSymbol,
        targetPrice,
        condition
      }
    })
    if (response.success && response.data) {
      return response.data.alertId
    }
    throw new Error(response.error || 'Failed to set price alert')
  }

  // Event System
  addEventListener(eventType: string, callback: (event: BlockchainEvent) => void): void {
    this.eventListeners.set(eventType, callback)
  }

  removeEventListener(eventType: string): void {
    this.eventListeners.delete(eventType)
  }

  private emitEvent(event: BlockchainEvent): void {
    const listener = this.eventListeners.get(event.type)
    if (listener) {
      listener(event)
    }
  }

  // WebSocket Connection for Real-time Updates
  connectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close()
    }

    this.wsConnection = apiClient.connectWebSocket((data) => {
      this.emitEvent({
        type: data.type,
        data: data.payload,
        timestamp: Date.now()
      })
    })
  }

  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close()
      this.wsConnection = null
    }
  }

  // Utility Methods
  async estimateGas(transaction: {
    to: string
    value?: string
    data?: string
  }): Promise<{
    gasLimit: string
    gasPrice: string
    breakdown?: any
    estimatedCost?: string
    gasPriceWei?: string
    estimatedCostGwei?: string
  }> {
    try {
      // Try direct API endpoint first
      const response = await fetch(`${this.apiClient.baseUrl}/api/blockchain/estimate-gas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction)
      })

      const data = await response.json()
      if (data.success && data.data) {
        const txData = data.data.transaction
        return {
          gasLimit: txData.gasLimit,
          gasPrice: txData.gasPrice,
          breakdown: txData.breakdown,
          estimatedCost: txData.estimatedCost,
          gasPriceWei: txData.gasPriceWei,
          estimatedCostGwei: txData.estimatedCostGwei
        }
      }
      throw new Error(data.error || 'Failed to estimate gas')
    } catch (error) {
      console.error('Gas estimation error:', error)
      // Fallback to function call
      const response = await this.apiClient.callBlockchainFunction({
        functionName: 'estimateGas',
        parameters: transaction
      })
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to estimate gas')
    }
  }

  async getGasPrice(): Promise<{ standard: string; fast: string; instant: string }> {
    const response = await apiClient.callBlockchainFunction({
      functionName: 'getGasPrice',
      parameters: {}
    })
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to get gas price')
  }

  // Configuration
  getConfig(): BlockchainConfig {
    return { ...this.config }
  }

  updateConfig(newConfig: Partial<BlockchainConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // Enhanced methods that connect to Backend
  async executeWithAI(prompt: string, context?: Record<string, any>): Promise<{
    functionCalls: Array<{
      functionName: string
      parameters: Record<string, any>
    }>
    response: string
    txHash?: string
  }> {
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }
    
    const response = await this.apiClient.executeBlockchainFunctionWithAI(prompt, context)
    if (!response.success) {
      throw new Error(response.error || 'Failed to execute with AI')
    }
    
    return response.data
  }

  async createAutomationWithAI(prompt: string, context?: Record<string, any>): Promise<{
    id: string
    name: string
    type: string
    status: string
    progress: number
    nextRun: string
    createdAt: string
  }> {
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }
    
    const response = await this.apiClient.createAutomationWithAI(prompt, context)
    if (!response.success) {
      throw new Error(response.error || 'Failed to create automation with AI')
    }
    
    return response.data
  }

  async getSystemStatus(): Promise<{
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
  }> {
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }
    
    const response = await this.apiClient.getDetailedSystemStatus()
    if (!response.success) {
      throw new Error(response.error || 'Failed to get system status')
    }
    
    return response.data
  }

  async getAnalytics(): Promise<{
    totalAutomations: number
    activeAutomations: number
    totalTransactions: number
    successRate: number
    averageExecutionTime: number
    mostUsedFunctions: Array<{ functionName: string; count: number }>
  }> {
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }
    
    const response = await this.apiClient.getAnalytics()
    if (!response.success) {
      throw new Error(response.error || 'Failed to get analytics')
    }
    
    return response.data
  }

  async getAutomationAnalytics(automationId?: string): Promise<{
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
  }> {
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }
    
    const response = await this.apiClient.getAutomationAnalytics(automationId)
    if (!response.success) {
      throw new Error(response.error || 'Failed to get automation analytics')
    }
    
    return response.data
  }

  async getBlockchainAnalytics(): Promise<{
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
  }> {
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }
    
    const response = await this.apiClient.getBlockchainAnalytics()
    if (!response.success) {
      throw new Error(response.error || 'Failed to get blockchain analytics')
    }
    
    return response.data
  }

  // Enhanced WebSocket connection with Backend
  connectToBackendWebSocket(): WebSocket {
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }
    
    const ws = this.apiClient.connectWebSocket((data: any) => {
      // Handle different types of events from Backend
      switch (data.type) {
        case 'automation_update':
          this.emitEvent({
            type: 'automation',
            data: data.payload,
            timestamp: Date.now()
          })
          break
        case 'transaction_update':
          this.emitEvent({
            type: 'transaction',
            data: data.payload,
            timestamp: Date.now()
          })
          break
        case 'price_update':
          this.emitEvent({
            type: 'price',
            data: data.payload,
            timestamp: Date.now()
          })
          break
        case 'balance_update':
          this.emitEvent({
            type: 'balance',
            data: data.payload,
            timestamp: Date.now()
          })
          break
      }
    })
    
    this.wsConnection = ws
    return ws
  }

  // Subscribe to specific automation updates
  subscribeToAutomation(automationId: string, callback: (update: any) => void): void {
    if (this.apiClient) {
      this.apiClient.subscribeToAutomationUpdates(automationId, callback)
    }
  }

  // Subscribe to specific transaction updates
  subscribeToTransaction(txHash: string, callback: (update: any) => void): void {
    if (this.apiClient) {
      this.apiClient.subscribeToTransactionUpdates(txHash, callback)
    }
  }

  // Subscribe to price updates
  subscribeToPrice(tokenSymbol: string, callback: (price: number) => void): void {
    if (this.apiClient) {
      this.apiClient.subscribeToPriceUpdates(tokenSymbol, callback)
    }
  }

  // Subscribe to balance updates
  subscribeToBalance(address: string, callback: (balance: string) => void): void {
    if (this.apiClient) {
      this.apiClient.subscribeToBalanceUpdates(address, callback)
    }
  }
}

// Create singleton instance
export const blockchainIntegration = new BlockchainIntegration(
  {
    network: 'testnet',
    rpcUrl: 'https://alfajores-forno.celo-testnet.org',
    chainId: 44787,
    contracts: {
      agentRegistry: '0x0000000000000000000000000000000000000000',
      agentTreasury: '0x0000000000000000000000000000000000000000',
      donationSplitter: '0x0000000000000000000000000000000000000000',
      yieldAggregator: '0x0000000000000000000000000000000000000000',
      masterTrading: '0x0000000000000000000000000000000000000000',
      attendanceNFT: '0x0000000000000000000000000000000000000000'
    },
    tokens: {
      CELO: '0x0000000000000000000000000000000000000000',
      cUSD: '0x874069Fa1Eb16D44d62F6a2e4c8B0C1C3b1C5C1C',
      cEUR: '0x10c892A6ECfc32b4C1C6Cb8C1C3b1C5C1C3b1C5C1C',
      cREAL: '0x00Be915B9dCf56a3CBE739D9B9c202ca692409EC'
    }
  },
  apiClient
)

export type {
  BlockchainConfig,
  TokenInfo,
  TransactionInfo,
  AutomationExecution,
  BlockchainEvent
}
