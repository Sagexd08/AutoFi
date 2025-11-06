import { z } from 'zod';
import { ValidationError } from '../errors';
import {
  SDKConfigSchema,
  ChainConfigSchema,
  AgentConfigSchema,
  ContractConfigSchema,
  TransactionRequestSchema,
  AddressSchema,
  NumberStringSchema,
  NonNegativeNumberStringSchema,
} from '../schemas';

/**
 * Sanitizes a config object by redacting sensitive fields.
 * Prevents sensitive data (like private keys, API keys) from being logged.
 * 
 * @param obj - Object to sanitize
 * @returns Sanitized object with sensitive fields redacted
 */
function sanitizeConfigObject(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  const sensitiveFields = [
    'privateKey', 'apiKey', 'secret', 'password', 'token',
    'mnemonic', 'seed', 'key', 'credential', 'auth'
  ];

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeConfigObject(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));
    
    if (isSensitive && typeof value === 'string') {
      sanitized[key] = `[REDACTED] (length: ${value.length})`;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeConfigObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Extracts minimal metadata from a request object for error context.
 * Avoids including sensitive data (addresses, amounts, keys) and full request bodies.
 * 
 * @param request - Request object to extract metadata from
 * @returns Minimal metadata object with structure indicators
 */
function extractMinimalRequestMetadata(request: unknown): Record<string, unknown> {
  if (request === null || request === undefined) {
    return { type: String(request) };
  }

  if (typeof request !== 'object') {
    return { type: typeof request };
  }

  if (Array.isArray(request)) {
    return {
      type: 'array',
      length: request.length,
    };
  }

  const metadata: Record<string, unknown> = {
    type: 'object',
  };

  // List of sensitive field patterns to exclude
  const sensitivePatterns = [
    'address', 'amount', 'value', 'privateKey', 'key', 'secret',
    'token', 'password', 'apiKey', 'mnemonic', 'seed', 'credential',
    'to', 'from', 'data', 'input'
  ];

  // Extract only safe, non-sensitive metadata
  const obj = request as Record<string, unknown>;
  const topLevelKeys = Object.keys(obj);
  const safeKeys = topLevelKeys.filter(key => {
    const lowerKey = key.toLowerCase();
    return !sensitivePatterns.some(pattern => lowerKey.includes(pattern));
  });

  // Include request type/ID if available
  if ('requestType' in obj && typeof obj.requestType === 'string') {
    metadata.requestType = obj.requestType;
  }
  if ('requestId' in obj && typeof obj.requestId === 'string') {
    metadata.requestId = obj.requestId;
  }
  if ('type' in obj && typeof obj.type === 'string') {
    metadata.type = obj.type;
  }
  if ('method' in obj && typeof obj.method === 'string') {
    metadata.method = obj.method;
  }

  // Include count of safe keys (but not the values)
  if (safeKeys.length > 0) {
    metadata.safeKeys = safeKeys.slice(0, 10); // Limit to first 10 keys
    metadata.totalKeys = topLevelKeys.length;
  }

  return metadata;
}

/**
 * Validation utilities using Zod schemas.
 * Provides type-safe validation with detailed error messages.
 */
export class ValidationUtils {
  /**
   * Validates an Ethereum address.
   * 
   * @param address - Address to validate
   * @throws ValidationError if address is invalid
   */
  validateAddress(address: string): void {
    try {
      AddressSchema.parse(address);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        throw new ValidationError(
          firstError?.message ?? 'Invalid address',
          {
            field: 'address',
            value: address,
            reason: firstError?.message,
            cause: error as Error,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Validates a transaction request.
   * 
   * @param request - Transaction request to validate
   * @throws ValidationError if request is invalid
   */
  validateTransactionRequest(request: unknown): void {
    try {
      TransactionRequestSchema.parse(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        const fieldPath = firstError?.path.length 
          ? firstError.path.join('.') 
          : '<root>';
        throw new ValidationError(
          firstError?.message ?? 'Invalid transaction request',
          {
            field: fieldPath,
            value: extractMinimalRequestMetadata(request),
            reason: firstError?.message,
            cause: error as Error,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Validates an agent configuration.
   * 
   * @param config - Agent config to validate
   * @throws ValidationError if config is invalid
   */
  validateAgentConfig(config: unknown): void {
    try {
      AgentConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        throw new ValidationError(
          firstError?.message ?? 'Invalid agent config',
          {
            field: firstError?.path.join('.') || 'config',
            value: sanitizeConfigObject(config),
            reason: firstError?.message,
            cause: error as Error,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Validates a contract configuration.
   * 
   * @param config - Contract config to validate
   * @throws ValidationError if config is invalid
   */
  validateContractConfig(config: unknown): void {
    try {
      ContractConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        throw new ValidationError(
          firstError?.message ?? 'Invalid contract config',
          {
            field: firstError?.path.join('.') || 'config',
            value: sanitizeConfigObject(config),
            reason: firstError?.message,
            cause: error as Error,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Validates a private key.
   * 
   * @param privateKey - Private key to validate
   * @throws ValidationError if private key is invalid
   */
  validatePrivateKey(privateKey: string): void {
    try {
      z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format').parse(privateKey);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        // Create a sanitized error cause to prevent private key exposure
        const sanitizedError = new Error(firstError?.message ?? 'Invalid private key format');
        sanitizedError.name = error.name;
        sanitizedError.stack = error.stack;
        
        throw new ValidationError(
          firstError?.message ?? 'Invalid private key',
          {
            field: 'privateKey',
            value: '<redacted>',
            reason: firstError?.message,
            cause: sanitizedError,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Validates a chain ID.
   * 
   * @param chainId - Chain ID to validate
   * @throws ValidationError if chain ID is invalid
   */
  validateChainId(chainId: string | number): void {
    try {
      z.union([
        z.string().transform((val) => parseInt(val, 10)),
        z.number(),
      ]).pipe(z.number().int().positive('Chain ID must be a positive number')).parse(chainId);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        throw new ValidationError(
          firstError?.message ?? 'Invalid chain ID',
          {
            field: 'chainId',
            value: chainId,
            reason: firstError?.message,
            cause: error as Error,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Validates an amount string.
   * 
   * @param amount - Amount to validate
   * @throws ValidationError if amount is invalid
   */
  validateAmount(amount: string): void {
    try {
      NonNegativeNumberStringSchema.parse(amount);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        throw new ValidationError(
          firstError?.message ?? 'Invalid amount',
          {
            field: 'amount',
            value: amount,
            reason: firstError?.message,
            cause: error as Error,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Validates a gas price string.
   * 
   * @param gasPrice - Gas price to validate
   * @throws ValidationError if gas price is invalid
   */
  validateGasPrice(gasPrice: string): void {
    try {
      NumberStringSchema.pipe(z.string().refine((val) => parseInt(val, 10) > 0, {
        message: 'Gas price must be positive',
      })).parse(gasPrice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        throw new ValidationError(
          firstError?.message ?? 'Invalid gas price',
          {
            field: 'gasPrice',
            value: gasPrice,
            reason: firstError?.message,
            cause: error as Error,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Validates a URL string.
   * 
   * @param url - URL to validate
   * @throws ValidationError if URL is invalid
   */
  validateUrl(url: string): void {
    try {
      z.string().url('Invalid URL format').parse(url);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        throw new ValidationError(
          firstError?.message ?? 'Invalid URL',
          {
            field: 'url',
            value: url,
            reason: firstError?.message,
            cause: error as Error,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Validates an API key.
   * 
   * @param apiKey - API key to validate
   * @throws ValidationError if API key is invalid
   */
  validateApiKey(apiKey: string): void {
    try {
      z.string().min(10, 'API key must be at least 10 characters long').parse(apiKey);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        throw new ValidationError(
          firstError?.message ?? 'Invalid API key',
          {
            field: 'apiKey',
            value: `[REDACTED] (length: ${apiKey.length})`,
            reason: firstError?.message,
            cause: error as Error,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Validates SDK configuration.
   * 
   * @param config - SDK config to validate
   * @throws ValidationError if config is invalid
   */
  validateSDKConfig(config: unknown): void {
    try {
      SDKConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        throw new ValidationError(
          firstError?.message ?? 'Invalid SDK config',
          {
            field: firstError?.path.join('.') || 'config',
            value: sanitizeConfigObject(config),
            reason: firstError?.message,
            cause: error as Error,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Validates chain configuration.
   * 
   * @param config - Chain config to validate
   * @throws ValidationError if config is invalid
   */
  validateChainConfig(config: unknown): void {
    try {
      ChainConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = (error as any).errors?.[0];
        throw new ValidationError(
          firstError?.message ?? 'Invalid chain config',
          {
            field: firstError?.path.join('.') || 'config',
            value: sanitizeConfigObject(config),
            reason: firstError?.message,
            cause: error as Error,
          }
        );
      }
      throw error;
    }
  }
}
