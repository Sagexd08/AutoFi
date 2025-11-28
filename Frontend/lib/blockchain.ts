export interface BlockchainConfig {
  rpcUrl: string
  chainId: number
  contractAddress: string
}

export const CELO_CONFIG: BlockchainConfig = {
  rpcUrl: process.env.NEXT_PUBLIC_CELO_RPC || "https://forno.celo.org",
  chainId: 42220,
  contractAddress: process.env.NEXT_PUBLIC_AUTOMATOR_CONTRACT || "",
}

export const CELO_TESTNET_CONFIG: BlockchainConfig = {
  rpcUrl: process.env.NEXT_PUBLIC_CELO_TESTNET_RPC || "https://alfajores-forno.celo-testnet.org",
  chainId: 44787,
  contractAddress: process.env.NEXT_PUBLIC_AUTOMATOR_TESTNET_CONTRACT || "",
}

export async function fetchWalletBalance(address: string): Promise<string> {
  try {
    return "125.5"
  } catch (error) {
    throw new Error("Failed to fetch wallet balance")
  }
}

export async function executeAutomation(
  automationId: string,
  params: Record<string, unknown>,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    return { success: true, txHash: "0x" + Math.random().toString(16).slice(2) }
  } catch (error) {
    return { success: false, error: "Failed to execute automation" }
  }
}

export async function fetchTransactionHistory(address: string): Promise<any[]> {
  try {
    return []
  } catch (error) {
    throw new Error("Failed to fetch transaction history")
  }
}
