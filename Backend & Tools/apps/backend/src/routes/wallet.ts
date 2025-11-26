import express, { Router } from 'express';
import { CeloClient } from '@celo-automator/celo-functions';
import { getBalance, getTokenBalance } from '@celo-automator/celo-functions';
import { AddressSchema } from '@celo-automator/core';
import type { Address } from 'viem';

const router: Router = express.Router();

let celoClient: CeloClient | undefined;

if (process.env.CELO_PRIVATE_KEY) {
  celoClient = new CeloClient({
    privateKey: process.env.CELO_PRIVATE_KEY,
    network: (process.env.CELO_NETWORK as 'alfajores' | 'mainnet') || 'alfajores',
    rpcUrl: process.env.CELO_RPC_URL,
  });
}

router.get('/balance/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    const { tokenAddress } = req.query;

    if (!AddressSchema.safeParse(address).success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format',
      });
    }

    if (!celoClient) {
      return res.status(503).json({
        success: false,
        error: 'Celo client not initialized',
      });
    }

    if (tokenAddress) {
      if (!AddressSchema.safeParse(tokenAddress as string).success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid token address format',
        });
      }

      const balance = await getTokenBalance(
        celoClient,
        address as Address,
        tokenAddress as Address
      );

      return res.json({
        success: true,
        balance,
      });
    } else {
      const balance = await getBalance(celoClient, address as Address);

      return res.json({
        success: true,
        balance: balance.toString(),
        balanceFormatted: (BigInt(balance) / BigInt(10 ** 18)).toString(),
      });
    }
  } catch (error) {
    return next(error);
  }
});

export { router as walletRoutes };
