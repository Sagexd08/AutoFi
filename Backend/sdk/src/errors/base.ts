import { ERROR_CODES } from '../constants/errors';

export class SDKError extends Error {

  public override readonly name: string = 'SDKError';

  public readonly code: string;

  public readonly context?: Record<string, unknown>;

  public readonly recoverable: boolean;

  public readonly timestamp: string;

  public override readonly cause?: Error;

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


    if ((Error as any).captureStackTrace) {

      (Error as any).captureStackTrace(this, SDKError);

    }

  }

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

  }

}
