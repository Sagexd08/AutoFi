import { SDKError } from './base';
import { ERROR_CODES } from '../constants/errors';

/**
 * Error thrown when agent-related operations fail.
 */
export class AgentError extends SDKError {
  public override readonly name: string = 'AgentError';
  public readonly agentId?: string;
  public readonly agentType?: string;
  public readonly operation?: string;

  /**
   * Creates a new AgentError instance.
   * 
   * @param message - Error message
   * @param options - Additional error options
   * @param options.agentId - Agent ID where the error occurred
   * @param options.agentType - Agent type where the error occurred
   * @param options.operation - Operation that failed
   * @param options.context - Additional context data
   * @param options.recoverable - Whether the error is recoverable
   * @param options.cause - Original error that caused this error
   */
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
    super(ERROR_CODES.AGENT_NOT_FOUND, message, {
      context: {
        ...options.context,
        agentId: options.agentId,
        agentType: options.agentType,
        operation: options.operation,
      },
      recoverable: options.recoverable ?? true,
      cause: options.cause,
    });    });
    this.agentId = options.agentId;
    this.agentType = options.agentType;
    this.operation = options.operation;
  }
}
