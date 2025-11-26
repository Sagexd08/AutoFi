import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { CeloClient } from '@celo-automator/celo-functions';
import {
  getBalance,
  getTokenBalance,
  sendCELO,
  sendToken,
  callContract,
  readContract,
  getTransactionStatus,
} from '@celo-automator/celo-functions';
import type { Address, Hash } from 'viem';

export function createTools(celoClient?: CeloClient) {
  if (!celoClient) {
    return [];
  }

  return [
    new DynamicStructuredTool({
      name: 'get_balance',
      description: 'Get the native CELO balance of a wallet address',
      schema: z.object({
        address: z.string().describe('The wallet address to check'),
      }),
      func: async ({ address }) => {
        const balance = await getBalance(celoClient, address as Address);
        return JSON.stringify({
          success: true,
          address,
          balance,
          balanceFormatted: (BigInt(balance) / BigInt(10 ** 18)).toString(),
        });
      },
    }),

    new DynamicStructuredTool({
      name: 'get_token_balance',
      description: 'Get the ERC20 token balance of a wallet address',
      schema: z.object({
        address: z.string().describe('The wallet address to check'),
        tokenAddress: z.string().describe('The ERC20 token contract address'),
      }),
      func: async ({ address, tokenAddress }) => {
        const balance = await getTokenBalance(
          celoClient,
          address as Address,
          tokenAddress as Address
        );
        return JSON.stringify({
          success: true,
          ...balance,
        });
      },
    }),

    new DynamicStructuredTool({
      name: 'send_celo',
      description: 'Send native CELO tokens to an address',
      schema: z.object({
        to: z.string().describe('Recipient wallet address'),
        amount: z.string().describe('Amount to send (in wei, smallest unit)'),
      }),
      func: async ({ to, amount }) => {
        const result = await sendCELO(celoClient, to as Address, amount);
        return JSON.stringify(result);
      },
    }),

    new DynamicStructuredTool({
      name: 'send_token',
      description: 'Send ERC20 tokens to an address',
      schema: z.object({
        tokenAddress: z.string().describe('The ERC20 token contract address'),
        to: z.string().describe('Recipient wallet address'),
        amount: z.string().describe('Amount to send (in smallest token unit)'),
      }),
      func: async ({ tokenAddress, to, amount }) => {
        const result = await sendToken(
          celoClient,
          tokenAddress as Address,
          to as Address,
          amount
        );
        return JSON.stringify(result);
      },
    }),

    new DynamicStructuredTool({
      name: 'call_contract',
      description: 'Call a smart contract function',
      schema: z.object({
        address: z.string().describe('The contract address'),
        functionName: z.string().describe('The function name to call'),
        parameters: z.array(z.any()).describe('Function parameters'),
        abi: z.array(z.any()).optional().describe('Contract ABI (if not cached)'),
      }),
      func: async ({ address, functionName, parameters, abi }) => {
        if (!abi) {
          return JSON.stringify({
            success: false,
            error: 'ABI required for contract calls',
          });
        }

        const result = await callContract(celoClient, {
          address: address as Address,
          abi,
          functionName,
          args: parameters,
        });
        return JSON.stringify(result);
      },
    }),

    new DynamicStructuredTool({
      name: 'read_contract',
      description: 'Read data from a smart contract (view function)',
      schema: z.object({
        address: z.string().describe('The contract address'),
        functionName: z.string().describe('The function name to read'),
        parameters: z.array(z.any()).describe('Function parameters'),
        abi: z.array(z.any()).describe('Contract ABI'),
      }),
      func: async ({ address, functionName, parameters, abi }) => {
        try {
          const result = await readContract(celoClient, {
            address: address as Address,
            abi,
            functionName,
            args: parameters,
          });
          return JSON.stringify({
            success: true,
            result,
          });
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'get_transaction_status',
      description: 'Get the status of a transaction by hash',
      schema: z.object({
        txHash: z.string().describe('The transaction hash'),
      }),
      func: async ({ txHash }) => {
        const status = await getTransactionStatus(celoClient, txHash as Hash);
        return JSON.stringify({
          success: true,
          ...status,
        });
      },
    }),
  ];}
