/**
 * Transaction Service - Handles blockchain transactions and history
 */

import { ethers } from "ethers"
import { getProvider, getSigner } from "./wallet-service"

export interface Transaction {
  hash: string
  from: string
  to: string
  value: string
  status: "pending" | "success" | "failed"
  timestamp: number
  blockNumber?: number
  gasUsed?: string
}

export interface TransactionParams {
  to: string
  value?: string
  data?: string
}

/**
 * Send a transaction
 */
export async function sendTransaction(
  params: TransactionParams
): Promise<string> {
  try {
    const signer = await getSigner()
    const tx = await signer.sendTransaction({
      to: params.to,
      value: params.value ? ethers.parseEther(params.value) : 0,
      data: params.data,
    })

    return tx.hash
  } catch (error) {
    console.error("[Transaction Service] Send error:", error)
    throw error
  }
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  txHash: string,
  confirmations: number = 1
): Promise<{ status: "success" | "failed"; blockNumber: number }> {
  try {
    const provider = getProvider()
    if (!provider) throw new Error("Provider not available")

    const receipt = await provider.waitForTransaction(txHash, confirmations)

    if (!receipt) {
      throw new Error("Transaction receipt not found")
    }

    return {
      status: receipt.status === 1 ? "success" : "failed",
      blockNumber: receipt.blockNumber,
    }
  } catch (error) {
    console.error("[Transaction Service] Wait error:", error)
    throw error
  }
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(txHash: string): Promise<Transaction | null> {
  try {
    const provider = getProvider()
    if (!provider) throw new Error("Provider not available")

    const [tx, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ])

    if (!tx) return null

    return {
      hash: tx.hash,
      from: tx.from || "",
      to: tx.to || "",
      value: ethers.formatEther(tx.value),
      status: receipt ? (receipt.status === 1 ? "success" : "failed") : "pending",
      timestamp: 0,
      blockNumber: receipt?.blockNumber,
      gasUsed: receipt ? receipt.gasUsed.toString() : undefined,
    }
  } catch (error) {
    console.error("[Transaction Service] Status error:", error)
    return null
  }
}

/**
 * Get transaction history for an address
 */
export async function getTransactionHistory(
  address: string,
  limit: number = 10
): Promise<Transaction[]> {
  try {
    const provider = getProvider()
    if (!provider) throw new Error("Provider not available")

    const blockNumber = await provider.getBlockNumber()
    const filter = {
      fromBlock: Math.max(0, blockNumber - 10000), // Last ~10000 blocks
      toBlock: blockNumber,
      address: address,
    }

    // Note: This is a simplified approach. For production, use Celo Indexer or Celoscan API
    const logs = await provider.getLogs(filter)

    const transactions: Transaction[] = logs
      .slice(0, limit)
      .map((log) => ({
        hash: log.transactionHash,
        from: log.address,
        to: log.address,
        value: "0",
        status: "success" as const,
        timestamp: 0,
        blockNumber: log.blockNumber,
      }))

    return transactions
  } catch (error) {
    console.error("[Transaction Service] History error:", error)
    return []
  }
}

/**
 * Get real transaction history from Celoscan API
 */
export async function getTransactionHistoryFromAPI(
  address: string,
  limit: number = 10
): Promise<Transaction[]> {
  try {
    const explorerUrl = "https://celoscan.io/api"
    const params = new URLSearchParams({
      module: "account",
      action: "txlist",
      address: address,
      startblock: "0",
      endblock: "99999999",
      sort: "desc",
      page: "1",
      offset: limit.toString(),
      apikey: "YourApiKeyToken", // Add your Celoscan API key
    })

    const response = await fetch(`${explorerUrl}?${params.toString()}`)
    const data = await response.json()

    if (data.status !== "1") {
      console.warn("[Transaction Service] No transactions found")
      return []
    }

    return data.result.map((tx: any) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: ethers.formatEther(tx.value),
      status: tx.isError === "0" ? "success" : "failed",
      timestamp: parseInt(tx.timeStamp) * 1000,
      blockNumber: parseInt(tx.blockNumber),
      gasUsed: tx.gasUsed,
    }))
  } catch (error) {
    console.error("[Transaction Service] API history error:", error)
    return []
  }
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
  params: TransactionParams
): Promise<string> {
  try {
    const provider = getProvider()
    if (!provider) throw new Error("Provider not available")

    const gasEstimate = await provider.estimateGas({
      to: params.to,
      value: params.value ? ethers.parseEther(params.value) : 0,
      data: params.data,
    })

    return ethers.formatUnits(gasEstimate, 0)
  } catch (error) {
    console.error("[Transaction Service] Gas estimate error:", error)
    throw error
  }
}

/**
 * Get current gas price
 */
export async function getGasPrice(): Promise<{
  standard: string
  fast: string
  instant: string
}> {
  try {
    const provider = getProvider()
    if (!provider) throw new Error("Provider not available")

    const feeData = await provider.getFeeData()

    const basePrice = feeData.gasPrice || 0
    return {
      standard: ethers.formatUnits(basePrice, "gwei"),
      fast: ethers.formatUnits(typeof basePrice === "bigint" ? basePrice * BigInt(2) : BigInt(basePrice) * BigInt(2), "gwei"),
      instant: ethers.formatUnits(typeof basePrice === "bigint" ? basePrice * BigInt(3) : BigInt(basePrice) * BigInt(3), "gwei"),
    }
  } catch (error) {
    console.error("[Transaction Service] Gas price error:", error)
    return {
      standard: "0",
      fast: "0",
      instant: "0",
    }
  }
}

/**
 * Sign a message
 */
export async function signMessage(message: string): Promise<string> {
  try {
    const signer = await getSigner()
    return await signer.signMessage(message)
  } catch (error) {
    console.error("[Transaction Service] Sign error:", error)
    throw error
  }
}
