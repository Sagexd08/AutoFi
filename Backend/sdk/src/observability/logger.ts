import type { SDKConfig } from '../types/config';
import { DataMasker, type MaskingConfig } from '../utils/data-masker';


export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}


export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
  correlationId?: string;
}


export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}


export interface LoggerConfig extends Partial<SDKConfig> {
  enableMasking?: boolean;
  maskingConfig?: MaskingConfig;
  useWinston?: boolean;
  usePino?: boolean;
  winstonConfig?: unknown;
  pinoConfig?: unknown;
  /**
   * Enable pretty-printed JSON logs (2-space indentation).
   * If not specified, defaults to false in production (NODE_ENV=production)
   * and true in development, or can be set via LOG_PRETTY environment variable.
   * Compact one-line JSON is recommended for production to reduce log volume and improve parsing.
   */
  prettyLogs?: boolean;
}


export class StructuredLogger implements Logger {
  private readonly logLevel: LogLevel;
  private correlationId?: string;
  private readonly enableMasking: boolean;
  private readonly masker: DataMasker;
  private readonly prettyLogs: boolean;
  private winstonLogger?: any;
  private pinoLogger?: any;

  constructor(config: LoggerConfig = {}) {
    const level = config.logLevel ?? 'info';
    this.logLevel = this.parseLogLevel(level);
    this.enableMasking = config.enableMasking ?? true;
    
    // Determine pretty log formatting: config > env var > default (false in production, true in development)
    if (config.prettyLogs !== undefined) {
      this.prettyLogs = config.prettyLogs;
    } else if (process.env.LOG_PRETTY !== undefined) {
      this.prettyLogs = process.env.LOG_PRETTY === 'true' || process.env.LOG_PRETTY === '1';
    } else {
      this.prettyLogs = process.env.NODE_ENV !== 'production';
    }
    
    this.masker = new DataMasker(config.maskingConfig || {
      strategy: process.env.NODE_ENV === 'production' ? 'full' : 'partial',
    });

    
    if (config.useWinston) {
      this.initializeWinston(config.winstonConfig);
    } else if (config.usePino) {
      this.initializePino(config.pinoConfig);
    }
  }

  
  private initializeWinston(config?: unknown): void {
    try {
      
      const winston = require('winston');
      this.winstonLogger = winston.createLogger(config || {
        level: this.getLogLevelString(),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
          winston.format((info: any) => {
            
            if (this.enableMasking && info.message) {
              info.message = this.masker.sanitizeString(String(info.message));
            }
            if (this.enableMasking && info.meta) {
              info.meta = this.masker.maskObject(info.meta);
            }
            return info;
          })()
        ),
        transports: [
          new winston.transports.Console(),
        ],
      });
    } catch (error) {
      console.warn('Winston not available, falling back to console logging:', error);
    }
  }

  
  private initializePino(config?: unknown): void {
    try {
      
      const pino = require('pino');
      const pinoConfig = config || {
        level: this.getLogLevelString(),
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        serializers: {
          error: (err: Error) => {
            if (this.enableMasking) {
              return this.masker.sanitizeError(err);
            }
            return err;
          },
        },
      };
      
      
      if (this.enableMasking) {
        (pinoConfig as any).serializers = {
          ...(pinoConfig as any).serializers,
          '*': (value: unknown) => {
            if (typeof value === 'object' && value !== null) {
              return this.masker.maskObject(value as Record<string, unknown>);
            }
            return value;
          },
        };
      }
      
      this.pinoLogger = pino(pinoConfig);
    } catch (error) {
      console.warn('Pino not available, falling back to console logging:', error);
    }
  }

  
  private getLogLevelString(): string {
    switch (this.logLevel) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARN:
        return 'warn';
      case LogLevel.ERROR:
        return 'error';
      default:
        return 'info';
    }
  }

  
  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  
  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, undefined, context);
  }

  
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, undefined, context);
  }

  
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, undefined, context);
  }

  
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, error, context);
  }

  
  private log(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    if (level < this.logLevel) {
      return;
    }

    
    let sanitizedMessage = message;
    let sanitizedContext = context;
    let sanitizedError = error;

    if (this.enableMasking) {
      sanitizedMessage = this.masker.sanitizeString(message);
      sanitizedContext = context ? this.masker.maskObject(context) : undefined;
      sanitizedError = error ? this.masker.sanitizeError(error) : undefined;
    }

    const entry: LogEntry = {
      level,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      context: {
        ...sanitizedContext,
        ...(this.correlationId && { correlationId: this.correlationId }),
      },
      ...(sanitizedError && { error: sanitizedError }),
    };

    
    if (this.winstonLogger) {
      const winstonLevel = this.getLogLevelString();
      this.winstonLogger.log({
        level: winstonLevel,
        message: sanitizedMessage,
        ...entry.context,
        ...(sanitizedError && { error: sanitizedError }),
      });
      return;
    }

    if (this.pinoLogger) {
      const pinoMethod = this.pinoLogger[this.getLogLevelString()].bind(this.pinoLogger);
      pinoMethod({
        msg: sanitizedMessage,
        ...entry.context,
        ...(sanitizedError && { err: sanitizedError }),
      });
      return;
    }

    
    const logOutput = this.prettyLogs 
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logOutput);
        break;
      case LogLevel.INFO:
        console.info(logOutput);
        break;
      case LogLevel.WARN:
        console.warn(logOutput);
        break;
      case LogLevel.ERROR:
        console.error(logOutput);
        break;
    }
  }

  
  setMasking(enabled: boolean): void {
    (this as any).enableMasking = enabled;
  }

  
  updateMaskingConfig(config: Partial<MaskingConfig>): void {
    this.masker.updateConfig(config);
  }
}
