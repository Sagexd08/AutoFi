import { SDKError } from './base';
import { ERROR_CODES } from '../constants/errors';

/**
 * Sanitizes a value if it appears to contain sensitive data.
 * Detects common patterns like passwords, credit cards, SSNs, emails, etc.
 * 
 * @param value - The value to sanitize
 * @param fieldName - Optional field name that may indicate sensitivity
 * @returns Sanitized value string (redacted if sensitive)
 */
function sanitizeValue(value: unknown, fieldName?: string): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  const strValue = String(value);
  const lowerField = fieldName?.toLowerCase() || '';
  
  // Check if field name indicates sensitive data
  const sensitiveFieldPatterns = [
    'password', 'passwd', 'pwd', 'secret', 'private', 'key',
    'token', 'auth', 'credential', 'credit', 'card', 'cvv',
    'ssn', 'social', 'security', 'ssn', 'account', 'routing',
    'email', 'phone', 'address', 'ssn', 'tax', 'id'
  ];
  
  const isSensitiveField = sensitiveFieldPatterns.some(pattern => 
    lowerField.includes(pattern)
  );

  // Check for credit card patterns (13-19 digits)
  const creditCardPattern = /^\d{13,19}$/;
  const isCreditCard = creditCardPattern.test(strValue.replace(/[\s-]/g, ''));

  // Check for SSN pattern (XXX-XX-XXXX)
  const ssnPattern = /^\d{3}-?\d{2}-?\d{4}$/;
  const isSSN = ssnPattern.test(strValue);

  // Check for email pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmail = emailPattern.test(strValue);

  // Check for private key patterns (hex strings starting with 0x, long hex strings)
  const privateKeyPattern = /^(0x)?[a-fA-F0-9]{64}$/;
  const isPrivateKey = privateKeyPattern.test(strValue);

  // Check for phone number patterns
  const phonePattern = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
  const isPhone = phonePattern.test(strValue.replace(/[\s()-]/g, ''));

  // If any sensitive pattern matches, redact the value
  if (isSensitiveField || isCreditCard || isSSN || isEmail || isPrivateKey || isPhone) {
    const length = strValue.length;
    if (length <= 4) {
      return '****';
    }
    // Show first 2 and last 2 characters, mask the rest
    const visible = 2;
    const start = strValue.substring(0, visible);
    const end = strValue.substring(length - visible);
    return `${start}${'*'.repeat(Math.max(4, length - visible * 2))}${end}`;
  }

  // For long strings that might be sensitive (e.g., tokens, keys)
  if (strValue.length > 32 && /^[a-zA-Z0-9+/=_-]+$/.test(strValue)) {
    return `${strValue.substring(0, 4)}${'*'.repeat(Math.min(20, strValue.length - 8))}${strValue.substring(strValue.length - 4)}`;
  }

  return strValue;
}

/**
 * Error thrown when validation fails.
 * 
 * @security WARNING: The `value` property may contain sensitive information such as
 * passwords, credit card numbers, PII, or private keys. When logging, serializing,
 * or sending errors to monitoring systems, use the `sanitizedValue` property instead
 * to prevent sensitive data exposure. The `value` property should only be used for
 * internal debugging in secure environments.
 */
export class ValidationError extends SDKError {
  public override readonly name: string = 'ValidationError';
  public readonly field?: string;
  public readonly value?: unknown;
  /**
   * Sanitized version of the value property, safe for logging and monitoring.
   * Automatically redacts sensitive patterns like passwords, credit cards, SSNs, emails, etc.
   */
  public readonly sanitizedValue?: string;
  public readonly reason?: string;

  /**
   * Creates a new ValidationError instance.
   * 
   * @param message - Error message
   * @param options - Additional error options
   * @param options.field - Field that failed validation
   * @param options.value - Value that failed validation.
   *                          WARNING: Avoid passing sensitive data (passwords, credit cards, PII).
   *                          Use sanitizedValue for logging purposes.
   * @param options.reason - Reason for validation failure
   * @param options.context - Additional context data (avoid including sensitive values here)
   * @param options.cause - Original error that caused this error
   */
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

  /**
   * Converts the error to a JSON-serializable object.
   * Uses sanitizedValue instead of value to prevent sensitive data exposure.
   */
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
