/**
 * Error handling system for the Celo AI SDK.
 * 
 * Provides a hierarchy of custom error classes with error codes,
 * context preservation, and recovery strategies.
 */

export { SDKError } from './base';
export type { SDKError } from './base';
export { ChainError } from './chain-error';
export { ValidationError } from './validation-error';
export { ContractError } from './contract-error';
export { AgentError } from './agent-error';
export { TransactionError } from './transaction-error';

/**
 * Type guard to check if an error is an SDKError.
 */
export function isSDKError(error: unknown): error is SDKError {
  return error instanceof Error && 'code' in error && 'context' in error;
}

/**
 * Extracts error information from an unknown error.
 */
export function extractErrorInfo(error: unknown): {
  message: string;
  code?: string;
  context?: Record<string, unknown>;
  recoverable?: boolean;
  cause?: Error;
} {
  if (isSDKError(error)) {
    return {
      message: error.message,
      code: error.code,
      context: error.context,
      recoverable: error.recoverable,
      cause: error.cause,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      cause: error,
    };
  }

  return {
    message: String(error),
  };
}
