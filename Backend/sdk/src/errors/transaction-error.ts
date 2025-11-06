import { SDKError } from './base';
import { ERROR_CODES } from '../constants/errors';

/**
 * Error thrown when transaction-related operations fail.
 */
export class TransactionError extends SDKError {
  public override readonly name: string = 'TransactionError';
  public readonly txHash?: string;
  public readonly from?: string;
  public readonly to?: string;
  public readonly value?: string;
  public readonly reason?: string;

  /**
   * Creates a new TransactionError instance.
   * 
   * @param message - Error message
   * @param options - Additional error options
   * @param options.txHash - Transaction hash if available
   * @param options.from - Sender address
   * @param options.to - Recipient address
   * @param options.value - Transaction value
   * @param options.reason - Reason for transaction failure
   * @param options.context - Additional context data
   * @param options.recoverable - Whether the error is recoverable
   * @param options.cause - Original error that caused this error
   */
  constructor(
    message: string,
    options: {
      txHash?: string;
      from?: string;
      to?: string;
      value?: string;
      reason?: string;
      context?: Record<string, unknown>;
      recoverable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(ERROR_CODES.TRANSACTION_FAILED, message, {
      context: {
        txHash: options.txHash,
        from: options.from,
        to: options.to,
        value: options.value,
        reason: options.reason,
        ...options.context,
      },
      recoverable: options.recoverable ?? false,
      cause: options.cause,
    });
    this.txHash = options.txHash;
    this.from = options.from;
    this.to = options.to;
    this.value = options.value;
    this.reason = options.reason;
  }
}
