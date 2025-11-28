import { create } from "zustand"
import { persist } from "zustand/middleware"
import { apiClient, type AutomationRequest, type AutomationResponse, type WalletInfo } from "./api-client"
import { blockchainIntegration } from "./blockchain-integration"

export interface Automation {
  id: string
  name: string
  type: "transaction" | "swap" | "nft" | "dao" | "refi" | "alerts"
  status: "active" | "paused" | "completed"
  progress: number
  nextRun: string
  createdAt: Date
}

export interface WalletState {
  address: string | null
  balance: string
  network: "mainnet" | "testnet"
  isConnected: boolean
  tokens: Array<{
    address: string
    symbol: string
    name: string
    balance: string
    price?: number | null
  }>
}

export interface DashboardState {
  automations: Automation[]
  wallet: WalletState
  totalProcessed: string
  pendingAlerts: number
  loading: boolean
  error: string | null
}

interface Store extends DashboardState {
  // Wallet actions
  connectWallet: (address: string, balance: string) => Promise<void>
  disconnectWallet: () => void
  switchNetwork: (network: "mainnet" | "testnet") => Promise<void>
  updateWalletTokens: (tokens: WalletState["tokens"]) => void
  refreshWalletInfo: (address: string) => Promise<void>

  // Automation actions
  addAutomation: (automation: AutomationRequest) => Promise<void>
  updateAutomation: (id: string, updates: Partial<AutomationRequest>) => Promise<void>
  pauseAutomation: (id: string) => Promise<void>
  resumeAutomation: (id: string) => Promise<void>
  deleteAutomation: (id: string) => Promise<void>
  executeAutomation: (id: string, context?: Record<string, any>) => Promise<void>
  loadAutomations: () => Promise<void>

  // State actions
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  updateTotalProcessed: (amount: string) => void
  updatePendingAlerts: (count: number) => void
  
  // Analytics
  loadAnalytics: () => Promise<void>
  
  // Backend Integration
  executeWithAI: (prompt: string, context?: Record<string, any>) => Promise<void>
  createAutomationWithAI: (prompt: string, context?: Record<string, any>) => Promise<void>
  getSystemStatus: () => Promise<any>
  getBlockchainAnalytics: () => Promise<any>
  getAutomationAnalytics: (automationId?: string) => Promise<any>
  
  // Real-time updates
  connectWebSocket: () => void
  disconnectWebSocket: () => void
  subscribeToAutomation: (automationId: string, callback: (update: any) => void) => void
  subscribeToTransaction: (txHash: string, callback: (update: any) => void) => void
  subscribeToPrice: (tokenSymbol: string, callback: (price: number) => void) => void
  subscribeToBalance: (address: string, callback: (balance: string) => void) => void
}

const initialState: DashboardState = {
  automations: [],
  wallet: {
    address: null,
    balance: "0",
    network: "mainnet",
    isConnected: false,
    tokens: [],
  },
  totalProcessed: "0",
  pendingAlerts: 0,
  loading: false,
  error: null,
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState,

      connectWallet: async (address, balance) => {
        set({ loading: true, error: null })
        try {
          // Get detailed wallet info from API
          const walletResponse = await apiClient.getWalletInfo(address)
          if (walletResponse.success && walletResponse.data) {
            const walletInfo = walletResponse.data
            set({
              wallet: {
                address: walletInfo.address,
                balance: walletInfo.balance,
                network: walletInfo.network,
                isConnected: true,
                tokens: walletInfo.tokens,
              },
              loading: false,
            })
          } else {
            // Fallback to basic info
            set({
              wallet: {
                address,
                balance,
                network: "mainnet",
                isConnected: true,
                tokens: [],
              },
              loading: false,
            })
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to connect wallet',
            loading: false 
          })
        }
      },

      disconnectWallet: () =>
        set({
          wallet: {
            address: null,
            balance: "0",
            network: "mainnet",
            isConnected: false,
            tokens: [],
          },
        }),

      switchNetwork: async (network) => {
        set({ loading: true })
        try {
          // Update network in backend if needed
          set((state) => ({
            wallet: { ...state.wallet, network },
            loading: false,
          }))
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to switch network',
            loading: false 
          })
        }
      },

      updateWalletTokens: (tokens) =>
        set((state) => ({
          wallet: { ...state.wallet, tokens },
        })),

      refreshWalletInfo: async (address) => {
        set({ loading: true })
        try {
          const walletResponse = await apiClient.getWalletInfo(address)
          if (walletResponse.success && walletResponse.data) {
            const walletInfo = walletResponse.data
            set({
              wallet: {
                address: walletInfo.address,
                balance: walletInfo.balance,
                network: walletInfo.network,
                isConnected: true,
                tokens: walletInfo.tokens,
              },
              loading: false,
            })
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to refresh wallet info',
            loading: false 
          })
        }
      },

      addAutomation: async (automationRequest) => {
        set({ loading: true, error: null })
        try {
          const response = await apiClient.createAutomation(automationRequest)
          if (response.success && response.data) {
            const automation: Automation = {
              id: response.data.id,
              name: response.data.name,
              type: response.data.type as Automation["type"],
              status: response.data.status as Automation["status"],
              progress: response.data.progress,
              nextRun: response.data.nextRun,
              createdAt: new Date(response.data.createdAt),
            }
            set((state) => ({
              automations: [...state.automations, automation],
              loading: false,
            }))
          } else {
            set({ 
              error: response.error || 'Failed to create automation',
              loading: false 
            })
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to create automation',
            loading: false 
          })
        }
      },

      updateAutomation: async (id, updates) => {
        set({ loading: true })
        try {
          const response = await apiClient.updateAutomation(id, updates)
          if (response.success && response.data) {
            const automation: Automation = {
              id: response.data.id,
              name: response.data.name,
              type: response.data.type as Automation["type"],
              status: response.data.status as Automation["status"],
              progress: response.data.progress,
              nextRun: response.data.nextRun,
              createdAt: new Date(response.data.createdAt),
            }
            set((state) => ({
              automations: state.automations.map((a) =>
                a.id === id ? automation : a
              ),
              loading: false,
            }))
          } else {
            set({ 
              error: response.error || 'Failed to update automation',
              loading: false 
            })
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update automation',
            loading: false 
          })
        }
      },

      pauseAutomation: async (id) => {
        set({ loading: true })
        try {
          const response = await apiClient.pauseAutomation(id)
          if (response.success) {
            set((state) => ({
              automations: state.automations.map((a) =>
                a.id === id ? { ...a, status: "paused" as const } : a
              ),
              loading: false,
            }))
          } else {
            set({ 
              error: response.error || 'Failed to pause automation',
              loading: false 
            })
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to pause automation',
            loading: false 
          })
        }
      },

      resumeAutomation: async (id) => {
        set({ loading: true })
        try {
          const response = await apiClient.resumeAutomation(id)
          if (response.success) {
            set((state) => ({
              automations: state.automations.map((a) =>
                a.id === id ? { ...a, status: "active" as const } : a
              ),
              loading: false,
            }))
          } else {
            set({ 
              error: response.error || 'Failed to resume automation',
              loading: false 
            })
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to resume automation',
            loading: false 
          })
        }
      },

      deleteAutomation: async (id) => {
        set({ loading: true })
        try {
          const response = await apiClient.deleteAutomation(id)
          if (response.success) {
            set((state) => ({
              automations: state.automations.filter((a) => a.id !== id),
              loading: false,
            }))
          } else {
            set({ 
              error: response.error || 'Failed to delete automation',
              loading: false 
            })
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete automation',
            loading: false 
          })
        }
      },

      executeAutomation: async (id, context) => {
        set({ loading: true })
        try {
          const response = await apiClient.executeAutomation(id, context)
          if (response.success) {
            // Update automation status if needed
            set({ loading: false })
          } else {
            set({ 
              error: response.error || 'Failed to execute automation',
              loading: false 
            })
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to execute automation',
            loading: false 
          })
        }
      },

      loadAutomations: async () => {
        set({ loading: true })
        try {
          const response = await apiClient.getAutomations()
          if (response.success && response.data) {
            const automations: Automation[] = response.data.map((item) => ({
              id: item.id,
              name: item.name,
              type: item.type as Automation["type"],
              status: item.status as Automation["status"],
              progress: item.progress,
              nextRun: item.nextRun,
              createdAt: new Date(item.createdAt),
            }))
            set({ automations, loading: false })
          } else {
            set({ 
              error: response.error || 'Failed to load automations',
              loading: false 
            })
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load automations',
            loading: false 
          })
        }
      },

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      updateTotalProcessed: (amount) => set({ totalProcessed: amount }),

      updatePendingAlerts: (count) => set({ pendingAlerts: count }),

      loadAnalytics: async () => {
        set({ loading: true })
        try {
          const response = await apiClient.getAnalytics()
          if (response.success && response.data) {
            set({
              totalProcessed: response.data.totalTransactions.toString(),
              pendingAlerts: 0, // Calculate from analytics
              loading: false,
            })
          } else {
            set({ 
              error: response.error || 'Failed to load analytics',
              loading: false 
            })
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load analytics',
            loading: false 
          })
        }
      },

      // Backend Integration Methods
      executeWithAI: async (prompt: string, context?: Record<string, any>) => {
        set({ loading: true })
        try {
          await blockchainIntegration.executeWithAI(prompt, context)
          set({ loading: false })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to execute with AI',
            loading: false
          })
        }
      },

      createAutomationWithAI: async (prompt: string, context?: Record<string, any>) => {
        set({ loading: true })
        try {
          const result = await blockchainIntegration.createAutomationWithAI(prompt, context)
          
          const newAutomation: Automation = {
            id: result.id,
            name: result.name,
            type: result.type as Automation["type"],
            status: result.status as Automation["status"],
            progress: result.progress,
            nextRun: result.nextRun,
            createdAt: new Date(result.createdAt),
          }
          
          set((state) => ({
            automations: [...state.automations, newAutomation],
            loading: false
          }))
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create automation with AI',
            loading: false
          })
        }
      },

      getSystemStatus: async () => {
        try {
          return await blockchainIntegration.getSystemStatus()
        } catch (error) {
          console.error('Failed to get system status:', error)
          throw error
        }
      },

      getBlockchainAnalytics: async () => {
        try {
          return await blockchainIntegration.getBlockchainAnalytics()
        } catch (error) {
          console.error('Failed to get blockchain analytics:', error)
          throw error
        }
      },

      getAutomationAnalytics: async (automationId?: string) => {
        try {
          return await blockchainIntegration.getAutomationAnalytics(automationId)
        } catch (error) {
          console.error('Failed to get automation analytics:', error)
          throw error
        }
      },

      // Real-time WebSocket Methods
      connectWebSocket: () => {
        try {
          blockchainIntegration.connectToBackendWebSocket()
        } catch (error) {
          console.error('Failed to connect WebSocket:', error)
        }
      },

      disconnectWebSocket: () => {
        try {
          blockchainIntegration.disconnectWebSocket()
        } catch (error) {
          console.error('Failed to disconnect WebSocket:', error)
        }
      },

      subscribeToAutomation: (automationId: string, callback: (update: any) => void) => {
        blockchainIntegration.subscribeToAutomation(automationId, callback)
      },

      subscribeToTransaction: (txHash: string, callback: (update: any) => void) => {
        blockchainIntegration.subscribeToTransaction(txHash, callback)
      },

      subscribeToPrice: (tokenSymbol: string, callback: (price: number) => void) => {
        blockchainIntegration.subscribeToPrice(tokenSymbol, callback)
      },

      subscribeToBalance: (address: string, callback: (balance: string) => void) => {
        blockchainIntegration.subscribeToBalance(address, callback)
      },
    }),
    {
      name: "celo-automator-store",
    }
  )
)
