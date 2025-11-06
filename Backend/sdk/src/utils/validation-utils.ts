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


  const sensitivePatterns = [

    'address', 'amount', 'value', 'privateKey', 'key', 'secret',

    'token', 'password', 'apiKey', 'mnemonic', 'seed', 'credential',

    'to', 'from', 'data', 'input'

  ];


  const obj = request as Record<string, unknown>;

  const topLevelKeys = Object.keys(obj);

  const safeKeys = topLevelKeys.filter(key => {

    const lowerKey = key.toLowerCase();

    return !sensitivePatterns.some(pattern => lowerKey.includes(pattern));

  });


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


  if (safeKeys.length > 0) {

    metadata.safeKeys = safeKeys.slice(0, 10); // Limit to first 10 keys

    metadata.totalKeys = topLevelKeys.length;

  }

  return metadata;

}

export class ValidationUtils {

  private handleValidationError(

    schema: z.ZodTypeAny,

    value: unknown,

    defaultFieldName: string,

    defaultErrorMessage: string,

    redactValue: boolean = false,

    valueTransformer?: (val: unknown) => unknown,

    causeTransformer?: (error: z.ZodError) => Error

  ): void {

    try {

      schema.parse(value);

    } catch (error) {

      if (error instanceof z.ZodError) {

        const firstError = error.issues[0];

        const fieldPath = firstError?.path.length 

          ? firstError.path.join('.') 

          : defaultFieldName;

        let errorValue: unknown;

        if (redactValue) {

          errorValue = '[REDACTED]';

        } else if (valueTransformer) {

          errorValue = valueTransformer(value);

        } else {

          errorValue = value;

        }

        const errorCause = causeTransformer ? causeTransformer(error) : (error as Error);

        throw new ValidationError(

          firstError?.message ?? defaultErrorMessage,

          {

            field: fieldPath,

            value: errorValue,

            reason: firstError?.message,

            cause: errorCause,

          }

        );

      }

      throw error;

    }

  }

  validateAddress(address: string): void {

    this.handleValidationError(

      AddressSchema,

      address,

      'address',

      'Invalid address',

      false

    );

  }

  validateTransactionRequest(request: unknown): void {

    this.handleValidationError(

      TransactionRequestSchema,

      request,

      '<root>',

      'Invalid transaction request',

      false,

      extractMinimalRequestMetadata

    );

  }

  validateAgentConfig(config: unknown): void {

    this.handleValidationError(

      AgentConfigSchema,

      config,

      'config',

      'Invalid agent config',

      false,

      sanitizeConfigObject

    );

  }

  validateContractConfig(config: unknown): void {

    this.handleValidationError(

      ContractConfigSchema,

      config,

      'config',

      'Invalid contract config',

      false,

      sanitizeConfigObject

    );

  }

  validatePrivateKey(privateKey: string): void {

    const privateKeySchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format');

    const causeTransformer = (error: z.ZodError): Error => {

      const firstError = error.issues[0];


      const sanitizedError = new Error(firstError?.message ?? 'Invalid private key format');

      sanitizedError.name = error.name;

      sanitizedError.stack = error.stack;

      return sanitizedError;

    };


    this.handleValidationError(

      privateKeySchema,

      privateKey,

      'privateKey',

      'Invalid private key',

      false,

      () => '<redacted>',

      causeTransformer

    );

  }

  validateChainId(chainId: string | number): void {

    const chainIdSchema = z.union([

      z.string().transform((val) => parseInt(val, 10)),

      z.number(),

    ]).pipe(z.number().int().positive('Chain ID must be a positive number'));

    this.handleValidationError(

      chainIdSchema,

      chainId,

      'chainId',

      'Invalid chain ID',

      false

    );

  }

  validateAmount(amount: string): void {

    this.handleValidationError(

      NonNegativeNumberStringSchema,

      amount,

      'amount',

      'Invalid amount',

      false

    );

  }

  validateGasPrice(gasPrice: string): void {

    const gasPriceSchema = NumberStringSchema.pipe(z.string().refine((val) => parseInt(val, 10) > 0, {

      message: 'Gas price must be positive',

    }));

    this.handleValidationError(

      gasPriceSchema,

      gasPrice,

      'gasPrice',

      'Invalid gas price',

      false

    );

  }

  validateUrl(url: string): void {

    this.handleValidationError(

      z.string().url('Invalid URL format'),

      url,

      'url',

      'Invalid URL',

      false

    );

  }

  validateApiKey(apiKey: string): void {

    this.handleValidationError(

      z.string().min(10, 'API key must be at least 10 characters long'),

      apiKey,

      'apiKey',

      'Invalid API key',

      false,

      (val) => `[REDACTED] (length: ${(val as string).length})`

    );

  }

  validateSDKConfig(config: unknown): void {

    this.handleValidationError(

      SDKConfigSchema,

      config,

      'config',

      'Invalid SDK config',

      false,

      sanitizeConfigObject

    );

  }

  validateChainConfig(config: unknown): void {

    this.handleValidationError(

      ChainConfigSchema,

      config,

      'config',

      'Invalid chain config',

      false,

      sanitizeConfigObject

    );

  }

}

