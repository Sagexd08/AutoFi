import { SDKError } from './base';
import { ERROR_CODES } from '../constants/errors';
export class TransactionError extends SDKError {
  public override readonly name: string = 'TransactionError';
  public readonly txHash?: string;
  public readonly from?: string;
  public readonly to?: string;
  public readonly value?: string;
  public readonly reason?: string;
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
