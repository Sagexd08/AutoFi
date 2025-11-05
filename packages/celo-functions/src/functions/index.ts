import type { Address, Hash } from 'viem';
import { CeloClient } from '../client.js';
import type {
  TransactionResult,
  TokenBalance,
  ContractCall,
} from '@celo-automator/types';

/**
 * ERC20 standard ABI including common functions
 */
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const;

/**
 * Get native CELO balance for an address
 */
export async function getBalance(
  client: CeloClient,
  address: Address
): Promise<string> {
  const balance = await client.getPublicClient().getBalance({ address });
  return balance.toString();
}

/**
 * Get ERC20 token balance
 */
export async function getTokenBalance(
  client: CeloClient,
  address: Address,
  tokenAddress: Address
): Promise<TokenBalance> {
  const publicClient = client.getPublicClient();

  const [balance, decimals, symbol, name] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'symbol',
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'name',
    }).catch(() => undefined),
  ]);

  return {
    token: tokenAddress,
    balance: (balance as bigint).toString(),
    decimals: Number(decimals),
    symbol: (symbol as string) || 'UNKNOWN',
    name: (name as string | undefined) || undefined,
  };
}

/**
 * Send native CELO tokens
 */
export async function sendCELO(
  client: CeloClient,
  to: Address,
  amount: string
): Promise<TransactionResult> {
  const walletClient = client.getWalletClient();
  if (!walletClient) {
    throw new Error('Private key required for sending transactions');
  }

  try {
    const hash = await walletClient.sendTransaction({
      to,
      value: BigInt(amount),
      account: await walletClient.getAddresses().then((addrs) => addrs[0]),
      chain: client.getChain(),
    });

    const receipt = await client.getPublicClient().waitForTransactionReceipt({
      hash,
    });

    return {
      success: receipt.status === 'success',
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      receipt,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send ERC20 tokens
 */
export async function sendToken(
  client: CeloClient,
  tokenAddress: Address,
  to: Address,
  amount: string
): Promise<TransactionResult> {
  const walletClient = client.getWalletClient();
  if (!walletClient) {
    throw new Error('Private key required for sending transactions');
  }

  try {
    const { request } = await client.getPublicClient().simulateContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, BigInt(amount)],
      account: await walletClient.getAddresses().then((addrs) => addrs[0]),
    });

    const hash = await walletClient.writeContract(request);

    const receipt = await client.getPublicClient().waitForTransactionReceipt({
      hash,
    });

    return {
      success: receipt.status === 'success',
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      receipt,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Call a contract function
 */
export async function callContract(
  client: CeloClient,
  call: ContractCall
): Promise<TransactionResult> {
  const walletClient = client.getWalletClient();
  if (!walletClient) {
    throw new Error('Private key required for contract calls');
  }

  try {
    const { request } = await client.getPublicClient().simulateContract({
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args || [],
      value: call.value,
      account: await walletClient.getAddresses().then((addrs) => addrs[0]),
    });

    const hash = await walletClient.writeContract(request);

    const receipt = await client.getPublicClient().waitForTransactionReceipt({
      hash,
    });

    return {
      success: receipt.status === 'success',
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      receipt,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Read contract data (view function)
 */
export async function readContract(
  client: CeloClient,
  call: Omit<ContractCall, 'value'>
): Promise<any> {
  return await client.getPublicClient().readContract({
    address: call.address,
    abi: call.abi,
    functionName: call.functionName,
    args: call.args || [],
  });
}

/**
 * Listen to blockchain events
 */
export async function listenToEvent(
  client: CeloClient,
  filter: {
    address?: Address | Address[];
    event: string;
    abi: any[];
  },
  callback: (event: any) => void | Promise<void>
): Promise<() => void> {
  const publicClient = client.getPublicClient();

  return publicClient.watchContractEvent({
    address: filter.address,
    abi: filter.abi,
    eventName: filter.event as any,
    onLogs: (logs) => {
      logs.forEach((log) => callback(log));
    },
  });
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(
  client: CeloClient,
  txHash: Hash
): Promise<any> {
  return await client.getPublicClient().getTransactionReceipt({ hash: txHash });
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(
  client: CeloClient,
  txHash: Hash
): Promise<{
  status: 'pending' | 'success' | 'failed';
  blockNumber?: bigint;
  gasUsed?: bigint;
}> {
  try {
    const receipt = await getTransactionReceipt(client, txHash);
    return {
      status: receipt.status === 'success' ? 'success' : 'failed',
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  } catch {
    return { status: 'pending' };
  }
}