import { createPublicClient, createWalletClient, http, parseEther, formatEther, hexToBigInt } from 'viem';
import { celo, celoAlfajores } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import logger from '../utils/logger.js';

export const CELO_TOKENS = {
  CELO: '0x0000000000000000000000000000000000000000',
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73'
};

const ERC20_ABI = [
  {
    constant: false,
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    gas: 79000
  },
  {
    constant: true,
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: '_owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    gas: 1000
  },
  {
    constant: true,
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    payable: false,
    stateMutability: 'view',
    gas: 1000
  },
  {
    constant: true,
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    gas: 1000
  }
];

export class BlockchainInterface {
  constructor(config = {}) {
    this.config = {
      privateKey: config.privateKey || process.env.PRIVATE_KEY,
      network: config.network || 'alfajores',
      rpcUrl: config.rpcUrl || process.env.RPC_URL,
      enableRealTransactions: config.enableRealTransactions !== false,
      ...config
    };

    this.chain = this.config.network === 'mainnet' ? celo : celoAlfajores;
    this.rpcUrl = this.config.rpcUrl || (this.chain === celo
      ? 'https://forno.celo.org'
      : 'https://alfajores-forno.celo-testnet.org');

    this.initializeClients();
  }

  initializeClients() {
    try {

      this.publicClient = createPublicClient({
        chain: this.chain,
        transport: http(this.rpcUrl)
      });

      if (this.config.privateKey && this.config.privateKey !== '0') {
        try {
          const account = privateKeyToAccount(this.config.privateKey);
          this.walletClient = createWalletClient({
            account,
            chain: this.chain,
            transport: http(this.rpcUrl)
          });
          this.account = account;
          logger.info('Wallet initialized', { address: account.address });
        } catch (error) {
          logger.warn('Invalid private key provided, wallet operations disabled', { error: error.message });
        }
      } else {
        logger.warn('No private key provided, wallet operations disabled');
      }

      logger.info('Blockchain clients initialized', { network: this.config.network });
    } catch (error) {
      logger.error('Failed to initialize blockchain clients', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getTokenBalance(address, tokenAddress) {
    try {
      if (!tokenAddress || tokenAddress === CELO_TOKENS.CELO) {

        const balance = await this.publicClient.getBalance({ address });
        return {
          success: true,
          balance: formatEther(balance),
          raw: balance.toString(),
          symbol: 'CELO'
        };
      }

      const balance = await this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address]
      });

      const decimals = await this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals'
      });

      const adjustedBalance = Number(balance) / (10 ** decimals);

      const symbol = await this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol'
      }).catch(() => 'UNKNOWN');

      return {
        success: true,
        balance: adjustedBalance.toString(),
        raw: balance.toString(),
        decimals,
        symbol
      };
    } catch (error) {
      logger.error('Get token balance error', { error: error.message, address, tokenAddress });
      return {
        success: false,
        error: error.message,
        balance: '0'
      };
    }
  }

  createDynamicWallet(privateKey) {
    try {
      if (!privateKey || !privateKey.startsWith('0x')) {
        throw new Error('Invalid private key format. Must start with 0x');
      }

      const account = privateKeyToAccount(privateKey);
      const walletClient = createWalletClient({
        account,
        chain: this.chain,
        transport: http(this.rpcUrl)
      });

      return {
        account,
        walletClient,
        address: account.address
      };
    } catch (error) {
      logger.error('Error creating dynamic wallet', { error: error.message, stack: error.stack });
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
  }

  async sendTokenWithPrivateKey(privateKey, tokenAddress, to, amount, from) {
    try {

      const { account, walletClient } = this.createDynamicWallet(privateKey);

      if (account.address.toLowerCase() !== from.toLowerCase()) {
        throw new Error('Private key does not match the sender address');
      }

      if (!this.config.enableRealTransactions) {

        const txHash = '0x' + Array.from({length: 64}, () =>
          Math.floor(Math.random() * 16).toString(16)).join('');
        return {
          success: true,
          txHash,
          simulated: true,
          message: 'Transaction simulated (real transactions disabled)'
        };
      }

      const amountWei = parseEther(amount);

      if (tokenAddress === CELO_TOKENS.CELO || !tokenAddress) {

        const txHash = await walletClient.sendTransaction({
          to,
          value: amountWei,
          account
        });

        return {
          success: true,
          txHash,
          message: `Sent ${amount} CELO to ${to}`
        };
      } else {

        const { request } = await this.publicClient.simulateContract({
          account,
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [to, amountWei]
        });

        const txHash = await walletClient.writeContract(request);

        return {
          success: true,
          txHash,
          message: `Sent ${amount} tokens to ${to}`
        };
      }
    } catch (error) {
      logger.error('Send token with private key error', { error: error.message, tokenAddress, to, amount, from });
      return {
        success: false,
        error: error.message,
        txHash: null
      };
    }
  }

  async swapTokensWithPrivateKey(privateKey, tokenIn, tokenOut, amountIn, amountOut, from, slippage = 0.5) {
    try {

      const { account } = this.createDynamicWallet(privateKey);

      if (account.address.toLowerCase() !== from.toLowerCase()) {
        throw new Error('Private key does not match the sender address');
      }

      logger.info('Swapping tokens', { tokenIn, tokenOut, amountIn, amountOut, from, slippage });

      if (!this.config.enableRealTransactions) {

        const txHash = '0x' + Array.from({length: 64}, () =>
          Math.floor(Math.random() * 16).toString(16)).join('');

        return {
          success: true,
          txHash,
          simulated: true,
          message: `Swapped ${amountIn} ${tokenIn} for ${amountOut} ${tokenOut} (simulated)`
        };
      }

      const txHash = '0x' + Array.from({length: 64}, () =>
        Math.floor(Math.random() * 16).toString(16)).join('');

      return {
        success: true,
        txHash,
        simulated: true,
        message: `Swapped ${amountIn} ${tokenIn} for ${amountOut} ${tokenOut}`,
        note: 'DEX integration pending'
      };
    } catch (error) {
      logger.error('Swap tokens with private key error', { error: error.message, tokenIn, tokenOut, amountIn, amountOut, from, slippage });
      return {
        success: false,
        error: error.message,
        txHash: null
      };
    }
  }

  async sendCELOWithPrivateKey(privateKey, to, amount, from) {
    try {
      const { walletClient, account } = this.createDynamicWallet(privateKey);

      if (account.address.toLowerCase() !== from.toLowerCase()) {
        throw new Error('Private key does not match the sender address');
      }

      if (!this.config.enableRealTransactions) {
        const txHash = '0x' + Array.from({length: 64}, () =>
          Math.floor(Math.random() * 16).toString(16)).join('');
        return {
          success: true,
          txHash,
          simulated: true,
          message: 'Transaction simulated (real transactions disabled)'
        };
      }

      const amountWei = parseEther(amount);
      const txHash = await walletClient.sendTransaction({
        to,
        value: amountWei,
        account
      });

      return {
        success: true,
        txHash,
        message: `Sent ${amount} CELO to ${to}`
      };
    } catch (error) {
      logger.error('Send CELO with private key error', { error: error.message, to, amount, from });
      return {
        success: false,
        error: error.message,
        txHash: null
      };
    }
  }

  async swapTokens(tokenIn, tokenOut, amountIn, amountOut, from, slippage = 0.5) {
    try {
      logger.info('Swapping tokens', { tokenIn, tokenOut, amountIn, amountOut, from, slippage });

      if (!this.config.enableRealTransactions) {

        const txHash = '0x' + Array.from({length: 64}, () =>
          Math.floor(Math.random() * 16).toString(16)).join('');

        return {
          success: true,
          txHash,
          simulated: true,
          message: `Swapped ${amountIn} ${tokenIn} for ${amountOut} ${tokenOut} (simulated)`
        };
      }

      const txHash = '0x' + Array.from({length: 64}, () =>
        Math.floor(Math.random() * 16).toString(16)).join('');

      return {
        success: true,
        txHash,
        simulated: true,
        message: `Swapped ${amountIn} ${tokenIn} for ${amountOut} ${tokenOut}`,
        note: 'DEX integration pending'
      };
    } catch (error) {
      logger.error('Swap tokens error', { error: error.message, tokenIn, tokenOut, amountIn, amountOut, from, slippage });
      return {
        success: false,
        error: error.message,
        txHash: null
      };
    }
  }

  async estimateGas(to, value = '0', data = '0x') {
    try {
      const gasEstimate = await this.publicClient.estimateGas({
        account: this.account || '0x0000000000000000000000000000000000000000',
        to,
        value: parseEther(value),
        data: data === '0x' ? undefined : data
      });

      const gasPrice = await this.publicClient.getGasPrice();

      const totalCost = gasEstimate * gasPrice;

      return {
        success: true,
        gasLimit: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        estimatedCost: formatEther(totalCost),
        estimatedCostWei: totalCost.toString()
      };
    } catch (error) {
      logger.error('Estimate gas error', { error: error.message, to, value, data });
      return {
        success: false,
        error: error.message,
        gasLimit: '21000',
        gasPrice: '0'
      };
    }
  }

  async getTransactionStatus(txHash) {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: txHash
      });

      if (receipt) {
        return {
          success: true,
          status: receipt.status === 'success' ? 'success' : 'failed',
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          confirmations: '12+'
        };
      }

      return {
        success: true,
        status: 'pending',
        blockNumber: null,
        confirmations: '0'
      };
    } catch (error) {
      logger.error('Get transaction status error', { error: error.message, txHash });
      return {
        success: false,
        error: error.message,
        status: 'unknown'
      };
    }
  }

  async waitForTransaction(txHash, confirmations = 1) {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations
      });

      return {
        success: receipt.status === 'success',
        receipt,
        message: receipt.status === 'success'
          ? 'Transaction confirmed'
          : 'Transaction failed'
      };
    } catch (error) {
      logger.error('Wait for transaction error', { error: error.message, txHash, confirmations });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAllTokenBalances(address) {
    const balances = {};

    for (const [symbol, tokenAddress] of Object.entries(CELO_TOKENS)) {
      const result = await this.getTokenBalance(address, tokenAddress);
      balances[symbol] = result;
    }

    return {
      success: true,
      balances
    };
  }

  getAccount() {
    return this.account ? {
      address: this.account.address,
      network: this.config.network
    } : null;
  }
}

export default BlockchainInterface;
