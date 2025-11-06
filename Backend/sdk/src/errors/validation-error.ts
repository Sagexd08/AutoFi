import { SDKError } from './base';

import { ERROR_CODES } from '../constants/errors';

function sanitizeValue(value: unknown, fieldName?: string): string {

  if (value === null || value === undefined) {

    return String(value);

  }

  const strValue = String(value);

  const lowerField = fieldName?.toLowerCase() || '';


  const sensitiveFieldPatterns = [

    'password', 'passwd', 'pwd', 'secret', 'private', 'key',

    'token', 'auth', 'credential', 'credit', 'card', 'cvv',

    'ssn', 'social', 'security', 'ssn', 'account', 'routing',

    'email', 'phone', 'address', 'ssn', 'tax', 'id'

  ];

  const isSensitiveField = sensitiveFieldPatterns.some(pattern => 

    lowerField.includes(pattern)

  );


  const creditCardPattern = /^\d{13,19}$/;

  const isCreditCard = creditCardPattern.test(strValue.replace(/[\s-]/g, ''));


  const ssnPattern = /^\d{3}-?\d{2}-?\d{4}$/;

  const isSSN = ssnPattern.test(strValue);


  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const isEmail = emailPattern.test(strValue);


  const privateKeyPattern = /^(0x)?[a-fA-F0-9]{64}$/;

  const isPrivateKey = privateKeyPattern.test(strValue);


  const phonePattern = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;

  const isPhone = phonePattern.test(strValue.replace(/[\s()-]/g, ''));


  if (isSensitiveField || isCreditCard || isSSN || isEmail || isPrivateKey || isPhone) {

    const length = strValue.length;

    if (length <= 4) {

      return '****';

    }


    const visible = 2;

    const start = strValue.substring(0, visible);

    const end = strValue.substring(length - visible);

    return `${start}${'*'.repeat(Math.max(4, length - visible * 2))}${end}`;

  }


  if (strValue.length > 32 && /^[a-zA-Z0-9+/=_-]+$/.test(strValue)) {

    return `${strValue.substring(0, 4)}${'*'.repeat(Math.min(20, strValue.length - 8))}${strValue.substring(strValue.length - 4)}`;

  }

  return strValue;

}

export class ValidationError extends SDKError {

  public override readonly name: string = 'ValidationError';

  public readonly field?: string;

  public readonly value?: unknown;

  public readonly sanitizedValue?: string;

  public readonly reason?: string;

  constructor(

    message: string,

    options: {

      field?: string;

      value?: unknown;

      reason?: string;

      context?: Record<string, unknown>;

      cause?: Error;

    } = {}

  ) {

    const sanitized = options.value !== undefined 

      ? sanitizeValue(options.value, options.field)

      : undefined;

    super(ERROR_CODES.VALIDATION_ERROR, message, {

      context: {

        ...options.context,

        field: options.field,

        value: sanitized, // Store sanitized value in context to prevent exposure (takes precedence over context.value)

        sanitizedValue: sanitized, // Explicit sanitized value for clarity

        reason: options.reason,

      },

      recoverable: false,

      cause: options.cause,

    });

    this.field = options.field;

    this.value = options.value; // Keep original for debugging (use with caution)

    this.sanitizedValue = sanitized;

    this.reason = options.reason;

  }

  override toJSON(): Record<string, unknown> {

    const base = super.toJSON();

    return {

      ...base,

      field: this.field,

      value: this.sanitizedValue, // Use sanitized value in JSON serialization

      sanitizedValue: this.sanitizedValue,

      reason: this.reason,

    };

  }

}

