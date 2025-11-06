import { SDKError } from './base';
import { ERROR_CODES } from '../constants/errors';
export class ChainError extends SDKError {
  public readonly chainId?: string;
  public readonly chainName?: string;
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
