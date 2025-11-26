/**
 * useWallet Hook - Manages wallet connection and state
 * Handles connecting, switching networks, and watching for changes
 */

"use client"

import { useEffect, useState, useCallback } from "react"
import { useStore } from "@/lib/store"
import {
  connectWallet as connectWalletService,
  disconnectWallet as disconnectWalletService,
  switchToCeloMainnet,
  switchToCeloTestnet,
  watchAccountChanges,
  watchChainChanges,
} from "@/lib/wallet-service"
import { getCeloCommonTokens } from "@/lib/token-service"

export function useWallet() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    wallet,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    updateWalletTokens,
    setLoading,
    setError: setStoreError,
  } = useStore()

  // Refresh balance and tokens
  const refreshBalanceAndTokens = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) return

    try {
      setLoading(true)
      const provider = await connectWalletService()
      connectWallet(provider.address, provider.balance)

      // Fetch tokens for the new network
      const tokens = await getCeloCommonTokens(provider.address)
      updateWalletTokens(
        tokens.map((t) => ({
          address: t.address,
          symbol: t.symbol,
          name: t.name,
          balance: t.balance,
          price: t.price,
        }))
      )
    } catch (err) {
      console.error("[useWallet] Failed to refresh balance:", err)
    } finally {
      setLoading(false)
    }
  }, [wallet.isConnected, wallet.address, connectWallet, updateWalletTokens, setLoading])

  // Connect wallet
  const handleConnect = useCallback(async () => {
    setIsConnecting(true)
    setError(null)
    try {
      const provider = await connectWalletService()
      connectWallet(provider.address, provider.balance)

      // Fetch tokens
      setLoading(true)
      const tokens = await getCeloCommonTokens(provider.address)
      updateWalletTokens(
        tokens.map((t) => ({
          address: t.address,
          symbol: t.symbol,
          name: t.name,
          balance: t.balance,
          price: t.price,
        }))
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet"
      setError(message)
      setStoreError(message)
    } finally {
      setIsConnecting(false)
      setLoading(false)
    }
  }, [connectWallet, updateWalletTokens, setLoading, setStoreError])

  // Disconnect wallet
  const handleDisconnect = useCallback(() => {
    disconnectWalletService()
    disconnectWallet()
    setError(null)
  }, [disconnectWallet])

  // Switch to mainnet
  const handleSwitchToMainnet = useCallback(async () => {
    setError(null)
    try {
      await switchToCeloMainnet()
      switchNetwork("mainnet")
      // Give the network a moment to switch, then refresh balance
      setTimeout(() => {
        refreshBalanceAndTokens()
      }, 1000)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to switch network"
      setError(message)
      setStoreError(message)
    }
  }, [switchNetwork, setStoreError, refreshBalanceAndTokens])

  // Switch to testnet
  const handleSwitchToTestnet = useCallback(async () => {
    setError(null)
    try {
      await switchToCeloTestnet()
      switchNetwork("testnet")
      // Give the network a moment to switch, then refresh balance
      setTimeout(() => {
        refreshBalanceAndTokens()
      }, 1000)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to switch network"
      setError(message)
      setStoreError(message)
    }
  }, [switchNetwork, setStoreError, refreshBalanceAndTokens])

  // Watch for wallet changes
  useEffect(() => {
    if (!wallet.isConnected) return

    const unsubscribeAccounts = watchAccountChanges((accounts) => {
      if (accounts.length === 0) {
        handleDisconnect()
      } else if (accounts[0] !== wallet.address) {
        // Account changed, reconnect
        handleConnect()
      }
    })

    const unsubscribeChain = watchChainChanges((chainId) => {
      console.log("[useWallet] Chain changed:", chainId)
      // Refresh balance and tokens when chain changes
      refreshBalanceAndTokens()
    })

    return () => {
      unsubscribeAccounts?.()
      unsubscribeChain?.()
    }
  }, [wallet.isConnected, wallet.address, handleConnect, handleDisconnect, refreshBalanceAndTokens])

  // Auto-connect if previously connected
  useEffect(() => {
    const savedAddress = localStorage.getItem("walletAddress")
    if (savedAddress && !wallet.isConnected) {
      handleConnect()
    }
  }, [])

  return {
    wallet,
    isConnecting,
    error,
    connect: handleConnect,
    disconnect: handleDisconnect,
    switchToMainnet: handleSwitchToMainnet,
    switchToTestnet: handleSwitchToTestnet,
  }
}
