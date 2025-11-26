import { create } from "zustand"
import { persist } from "zustand/middleware"

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
  connectWallet: (address: string, balance: string) => void
  disconnectWallet: () => void
  switchNetwork: (network: "mainnet" | "testnet") => void
  updateWalletTokens: (tokens: WalletState["tokens"]) => void

  // Automation actions
  addAutomation: (automation: Automation) => void
  updateAutomation: (id: string, updates: Partial<Automation>) => void
  pauseAutomation: (id: string) => void
  resumeAutomation: (id: string) => void
  deleteAutomation: (id: string) => void

  // State actions
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  updateTotalProcessed: (amount: string) => void
  updatePendingAlerts: (count: number) => void
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
    (set) => ({
      ...initialState,

      connectWallet: (address, balance) =>
        set({
          wallet: {
            address,
            balance,
            network: "mainnet",
            isConnected: true,
            tokens: [],
          },
        }),

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

      switchNetwork: (network) =>
        set((state) => ({
          wallet: { ...state.wallet, network },
        })),

      updateWalletTokens: (tokens) =>
        set((state) => ({
          wallet: { ...state.wallet, tokens },
        })),

      addAutomation: (automation) =>
        set((state) => ({
          automations: [...state.automations, automation],
        })),

      updateAutomation: (id, updates) =>
        set((state) => ({
          automations: state.automations.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),

      pauseAutomation: (id) =>
        set((state) => ({
          automations: state.automations.map((a) =>
            a.id === id ? { ...a, status: "paused" as const } : a
          ),
        })),

      resumeAutomation: (id) =>
        set((state) => ({
          automations: state.automations.map((a) =>
            a.id === id ? { ...a, status: "active" as const } : a
          ),
        })),

      deleteAutomation: (id) =>
        set((state) => ({
          automations: state.automations.filter((a) => a.id !== id),
        })),

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      updateTotalProcessed: (amount) => set({ totalProcessed: amount }),

      updatePendingAlerts: (count) => set({ pendingAlerts: count }),
    }),
    {
      name: "celo-automator-store",
    }
  )
)
