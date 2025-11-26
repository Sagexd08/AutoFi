/**
 * Wallet Service - Handles wallet connections and interactions
 * Supports MetaMask, WalletConnect, and other EIP-1193 providers
 */

import { ethers } from "ethers"

export interface WalletProvider {
  address: string
  balance: string
  chainId: number
  network: string
}

// Initialize provider
export function getProvider() {
  if (typeof window === "undefined") return null
  if (!window.ethereum) {
    throw new Error("No Ethereum provider found. Please install a Web3 wallet.")
  }
  return new ethers.BrowserProvider(window.ethereum)
}

// Get signer for transactions
export async function getSigner() {
  const provider = getProvider()
  if (!provider) throw new Error("Provider not available")
  return await provider.getSigner()
}

/**
 * Connect wallet and fetch provider details
 */
export async function connectWallet(): Promise<WalletProvider> {
  try {
    if (typeof window === "undefined") throw new Error("Client-side only")

    // Request account access
    const accounts = await window.ethereum?.request({
      method: "eth_requestAccounts",
    })

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found")
    }

    const address = accounts[0]
    const provider = getProvider()
    if (!provider) throw new Error("Provider not available")

    // Get balance
    const balance = await provider.getBalance(address)
    const balanceInCELO = ethers.formatEther(balance)

    // Get chain info
    const network = await provider.getNetwork()

    return {
      address,
      balance: balanceInCELO,
      chainId: Number(network.chainId),
      network: network.name || "unknown",
    }
  } catch (error) {
    console.error("[Wallet Service] Connect error:", error)
    throw new Error(
      error instanceof Error ? error.message : "Failed to connect wallet"
    )
  }
}

/**
 * Switch to Celo mainnet
 */
export async function switchToCeloMainnet() {
  try {
    if (typeof window === "undefined") throw new Error("Client-side only")

    await window.ethereum?.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xa4ec" }], // 42220 in hex
    })
  } catch (error: any) {
    // If chain doesn't exist, add it
    if (error.code === 4902) {
      await window.ethereum?.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xa4ec",
            chainName: "Celo Mainnet",
            rpcUrls: ["https://forno.celo.org"],
            nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
            blockExplorerUrls: ["https://celoscan.io"],
          },
        ],
      })
    } else {
      throw error
    }
  }
}

/**
 * Switch to Celo testnet (Alfajores)
 */
export async function switchToCeloTestnet() {
  try {
    if (typeof window === "undefined") throw new Error("Client-side only")

    await window.ethereum?.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaef3" }], // 44787 in hex
    })
  } catch (error: any) {
    if (error.code === 4902) {
      await window.ethereum?.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xaef3",
            chainName: "Celo Alfajores Testnet",
            rpcUrls: ["https://alfajores-forno.celo-testnet.org"],
            nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
            blockExplorerUrls: ["https://alfajores-blockscout.celo-testnet.org"],
          },
        ],
      })
    } else {
      throw error
    }
  }
}

/**
 * Get current wallet balance
 */
export async function getWalletBalance(address: string): Promise<string> {
  try {
    const provider = getProvider()
    if (!provider) throw new Error("Provider not available")

    const balance = await provider.getBalance(address)
    return ethers.formatEther(balance)
  } catch (error) {
    console.error("[Wallet Service] Balance fetch error:", error)
    throw error
  }
}

/**
 * Disconnect wallet (clear connection)
 */
export function disconnectWallet() {
  // Most wallets don't have a disconnect method, so we just clear local storage
  if (typeof window !== "undefined") {
    localStorage.removeItem("walletAddress")
    localStorage.removeItem("walletBalance")
  }
}

/**
 * Watch for wallet account changes
 */
export function watchAccountChanges(callback: (accounts: string[]) => void) {
  if (typeof window === "undefined") return

  window.ethereum?.on("accountsChanged", callback)

  return () => {
    window.ethereum?.removeListener("accountsChanged", callback)
  }
}

/**
 * Watch for chain changes
 */
export function watchChainChanges(callback: (chainId: string) => void) {
  if (typeof window === "undefined") return

  window.ethereum?.on("chainChanged", callback)

  return () => {
    window.ethereum?.removeListener("chainChanged", callback)
  }
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, callback: (...args: any[]) => void) => void
      removeListener: (
        event: string,
        callback: (...args: any[]) => void
      ) => void
    }
  }
}
