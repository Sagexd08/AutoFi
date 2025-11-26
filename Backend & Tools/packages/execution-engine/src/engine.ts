import { 
  createPublicClient, 
  http, 
  PublicClient, 
  Hash, 
  TransactionReceipt, 
  Hex
} from 'viem';
import { mainnet } from 'viem/chains';
import { WalletManager } from '@autofi/wallet-manager';
import { IExecutionEngine, ExecutionRequest, ExecutionResult } from './types.js';
import { transactionQueue } from '@autofi/queue';
import pino from 'pino';

const logger = pino({ name: 'execution-engine' });

export class ExecutionEngine implements IExecutionEngine {
  private publicClient: PublicClient;
  private walletManager: WalletManager;

  constructor(
    rpcUrl: string,
    walletManager: WalletManager
  ) {
    this.walletManager = walletManager;
    // Defaulting to mainnet for now, but this should be configurable per request or instance
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl)
    });
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const executionId = request.id;
    logger.info({ executionId, request }, 'Starting execution');

    try {
      // 1. Get the wallet address
      // For now, we assume the wallet manager has a default provider or we pick one.
      // In a real scenario, the request might specify which wallet to use.
      const fromAddress = await this.walletManager.getAddress();

      if (request.useQueue) {
        logger.info({ executionId }, 'Queueing transaction');
        await transactionQueue.add(`tx-${executionId}`, {
          transactionId: executionId,
          chainId: request.chainId,
          from: fromAddress,
          to: request.to,
          data: request.data,
          value: request.value ? request.value.toString() : '0',
          gasLimit: request.gasLimit ? request.gasLimit.toString() : undefined,
        });
        
        return {
          id: executionId,
          status: 'QUEUED',
          timestamp: Date.now(),
          from: fromAddress
        };
      }

      // 2. Prepare the transaction
      // We need to fetch current gas price and nonce
      const nonce = await this.publicClient.getTransactionCount({ address: fromAddress as Hex });
      
      // Gas optimization: Use EIP-1559 fees if available
      let gasFees: any = {};
      try {
        const fees = await this.publicClient.estimateFeesPerGas();
        if (fees.maxFeePerGas && fees.maxPriorityFeePerGas) {
           gasFees = {
             maxFeePerGas: fees.maxFeePerGas.toString(),
             maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString()
           };
        } else {
           const gasPrice = await this.publicClient.getGasPrice();
           gasFees = { gasPrice: gasPrice.toString() };
        }
      } catch (e) {
         const gasPrice = await this.publicClient.getGasPrice();
         gasFees = { gasPrice: gasPrice.toString() };
      }

      const txRequest = {
        to: request.to,
        value: request.value ? request.value.toString() : '0',
        data: request.data || '0x',
        chainId: request.chainId,
        nonce: nonce,
        ...gasFees,
        gasLimit: request.gasLimit ? request.gasLimit.toString() : undefined, // Let wallet/viem estimate if undefined
      };

      logger.info({ executionId, txRequest }, 'Signing transaction');

      // 3. Sign the transaction
      const signedTx = await this.walletManager.signTransaction(txRequest);

      logger.info({ executionId, signedTxHash: signedTx }, 'Broadcasting transaction');

      // 4. Broadcast the transaction
      // Note: wallet.signTransaction returns the raw signed tx string
      const txHash = await this.publicClient.sendRawTransaction({
        serializedTransaction: signedTx as Hex
      });

      logger.info({ executionId, txHash }, 'Transaction submitted');

      return {
        id: executionId,
        status: 'SUBMITTED',
        txHash: txHash,
        timestamp: Date.now(),
        from: fromAddress
      };

    } catch (error: any) {
      logger.error({ executionId, error }, 'Execution failed');
      return {
        id: executionId,
        status: 'FAILED',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  async waitForConfirmation(txHash: Hash, chainId: number): Promise<TransactionReceipt> {
    // In a real multi-chain setup, we'd need to ensure this.publicClient is connected to the correct chainId
    // For now, we assume the engine is initialized for the correct chain.
    
    logger.info({ txHash, chainId }, 'Waiting for confirmation');
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    logger.info({ txHash, blockNumber: receipt.blockNumber }, 'Transaction confirmed');
    return receipt;
  }
}
