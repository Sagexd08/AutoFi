import { SDKError } from './base';
import { ERROR_CODES } from '../constants/errors';
export class AgentError extends SDKError {
  public override readonly name: string = 'AgentError';
  public readonly agentId?: string;
  public readonly agentType?: string;
  public readonly operation?: string;
  constructor(
    message: string,
    options: {
      agentId?: string;
      agentType?: string;
      operation?: string;
      context?: Record<string, unknown>;
      recoverable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(ERROR_CODES.AGENT_NOT_FOUND, message, {
      context: {
        ...options.context,
        agentId: options.agentId,
        agentType: options.agentType,
        operation: options.operation,
      },
      recoverable: options.recoverable ?? true,
      cause: options.cause,
    });    this.agentId = options.agentId;
    this.agentType = options.agentType;
    this.operation = options.operation;
  }
}
