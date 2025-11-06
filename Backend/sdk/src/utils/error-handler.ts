import { SDKError, isSDKError, extractErrorInfo } from '../errors';
import { ERROR_CODES } from '../constants/errors';
import { DataMasker, type MaskingConfig } from './data-masker';


export class ErrorHandler {
  private static instance: ErrorHandler | undefined;
  private errorCount: Map<string, number> = new Map();
  private errorHistory: SDKError[] = [];
  private readonly maxHistorySize: number = 1000;
  private masker: DataMasker;
  private enableMasking: boolean = true;

  constructor(maskingConfig?: MaskingConfig) {
    this.masker = new DataMasker(maskingConfig || {
      strategy: process.env.NODE_ENV === 'production' ? 'full' : 'partial',
    });
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance!;
  }

  
  handleError(error: unknown, context?: string): ReturnType<typeof extractErrorInfo> {
    const errorInfo = extractErrorInfo(error);
    const errorKey = context || errorInfo.code || 'unknown';
    
    const currentCount = this.errorCount.get(errorKey) ?? 0;
    this.errorCount.set(errorKey, currentCount + 1);
    
    
    if (isSDKError(error)) {
      const errorToStore = this.enableMasking 
        ? this.sanitizeSDKError(error)
        : error;
      this.addToHistory(errorToStore);
    }
    
    
    let logMessage = `[${errorKey}] ${errorInfo.message}`;
    if (this.enableMasking) {
      logMessage = this.masker.sanitizeString(logMessage);
    }
    
    if (errorInfo.recoverable) {
      console.warn(logMessage);
    } else {
      console.error(logMessage);
    }
    
    
    if (this.enableMasking) {
      return {
        ...errorInfo,
        message: this.masker.sanitizeString(errorInfo.message),
        context: errorInfo.context ? this.masker.maskObject(errorInfo.context) : undefined,
      };
    }
    
    return errorInfo;
  }

  
  private sanitizeSDKError(error: SDKError): SDKError {
    const sanitized = new SDKError(
      error.code,
      this.masker.sanitizeString(error.message),
      {
        context: error.context ? this.masker.maskObject(error.context) : undefined,
        recoverable: error.recoverable,
        cause: error.cause,
      }
    );
    return sanitized;
  }

  
  private addToHistory(error: SDKError): void {
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  
  getErrorCount(context?: string): number {
    if (context) {
      return this.errorCount.get(context) ?? 0;
    }
    
    return Array.from(this.errorCount.values()).reduce((sum, count) => sum + count, 0);
  }

  
  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [key, count] of this.errorCount.entries()) {
      stats[key] = count;
    }
    return stats;
  }

  
  getErrorHistory(limit?: number): readonly SDKError[] {
    if (limit) {
      return this.errorHistory.slice(-limit);
    }
    return [...this.errorHistory];
  }

  
  resetErrorCount(context?: string): void {
    if (context) {
      this.errorCount.delete(context);
    } else {
      this.errorCount.clear();
    }
  }

  
  clearHistory(): void {
    this.errorHistory = [];
  }

  
  isRecoverable(error: unknown): boolean {
    if (isSDKError(error)) {
      return error.recoverable;
    }
    return false;
  }

  
  getRecoveryStrategy(error: unknown): string[] {
    const errorInfo = extractErrorInfo(error);
    const strategies: string[] = [];

    if (errorInfo.code === ERROR_CODES.NETWORK_ERROR || errorInfo.code === ERROR_CODES.NETWORK_TIMEOUT) {
      strategies.push('Retry the operation after a short delay');
      strategies.push('Check network connectivity');
      strategies.push('Verify RPC endpoint is accessible');
    } else if (errorInfo.code === ERROR_CODES.RATE_LIMIT_EXCEEDED) {
      strategies.push('Wait before retrying');
      strategies.push('Reduce request frequency');
    } else if (errorInfo.code === ERROR_CODES.INSUFFICIENT_FUNDS) {
      strategies.push('Ensure sufficient balance for transaction and gas');
      strategies.push('Check account balance');
    } else if (errorInfo.code === ERROR_CODES.GAS_ESTIMATION_FAILED) {
      strategies.push('Manually specify gas limit');
      strategies.push('Verify transaction parameters');
    } else if (errorInfo.recoverable) {
      strategies.push('Retry the operation');
    }

    return strategies;
  }

  
  setMasking(enabled: boolean): void {
    this.enableMasking = enabled;
  }

  
  updateMaskingConfig(maskingConfig: MaskingConfig): void {
    this.masker = new DataMasker(maskingConfig);
  }
}
