import { SDKError } from './base';
import { ERROR_CODES } from '../constants/errors';

/**
 * Error thrown when chain-related operations fail.
 */
export class ChainError extends SDKError {
  public readonly chainId?: string;
  public readonly chainName?: string;

  /**
   * Creates a new ChainError instance.
   * 
   * @param message - Error message
   * @param options - Additional error options
   * @param options.chainId - Chain ID where the error occurred
   * @param options.chainName - Chain name where the error occurred
   * @param options.context - Additional context data
   * @param options.recoverable - Whether the error is recoverable
   * @param options.cause - Original error that caused this error
   */
  constructor(
    message: string,
    options: {
      chainId?: string;
      chainName?: string;
      context?: Record<string, unknown>;
      recoverable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(ERROR_CODES.CHAIN_NOT_SUPPORTED, message, {
      context: {
        ...options.context,
        chainId: options.chainId,
        chainName: options.chainName,
      },
      recoverable: options.recoverable ?? true,
      cause: options.cause,
    });
    (this as { name: string }).name = 'ChainError';
    this.chainId = options.chainId;
    this.chainName = options.chainName;
  }
}
