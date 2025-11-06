import { ERROR_CODES } from '../constants/errors';


export class SDKError extends Error {
  public override readonly name: string = 'SDKError';
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly recoverable: boolean;
  public readonly timestamp: string;
  public override readonly cause?: Error;

  /**
   * 
   * @param code - Error code from ERROR_CODES
   * @param message - Human-readable error message
   * @param options - Additional error options
   * @param options.context - Additional context data
   * @param options.recoverable - Whether the error is recoverable
   * @param options.cause - Original error that caused this error
   */
  constructor(
    code: string,
    message: string,
    options: {
      context?: Record<string, unknown>;
      recoverable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.code = code;
    this.context = options.context;
    this.recoverable = options.recoverable ?? false;
    this.timestamp = new Date().toISOString();
    this.cause = options.cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SDKError);
    }
  }

  /**
   * Converts the error to a JSON-serializable object.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      stack: this.stack,
      ...(this.cause && { cause: this.cause.message }),
    };
  }

  /**
   * Returns a human-readable error message with context.
   */
  override toString(): string {
    let message = `[${this.code}] ${this.message}`;
    if (this.context) {
      try {
        message += ` | Context: ${JSON.stringify(this.context)}`;
      } catch {
        message += ` | Context: [Unable to stringify]`;
      }
    }
    if (this.cause) {
      message += ` | Caused by: ${this.cause.message}`;
    }
    return message;
  }}
