import { SDKError } from './base';
import { ERROR_CODES } from '../constants/errors';
export class ContractError extends SDKError {
  public override readonly name: string = 'ContractError';
  public readonly contractAddress?: string;
  public readonly contractName?: string;
  public readonly operation?: string;
  constructor(
    message: string,
    options: {
      contractAddress?: string;
      contractName?: string;
      operation?: string;
      context?: Record<string, unknown>;
      recoverable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(
      options.operation === 'deployment' 
        ? ERROR_CODES.CONTRACT_DEPLOYMENT_FAILED 
        : ERROR_CODES.CONTRACT_NOT_FOUND,
      message,
      {
        context: {
          contractAddress: options.contractAddress,
          contractName: options.contractName,
          operation: options.operation,
          ...options.context,
        },
        recoverable: options.recoverable ?? true,
        cause: options.cause,
      }
    );
    this.contractAddress = options.contractAddress;
    this.contractName = options.contractName;
    this.operation = options.operation;
  }
}
