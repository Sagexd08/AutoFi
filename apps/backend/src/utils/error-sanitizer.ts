const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'credential',
  'auth',
  'authorization',
  'sql',
  'query',
  'params',
  'param',
  'body',
  'headers',
  'cookie',
];

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /credential/i,
  /auth/i,
  /authorization/i,
];

export function redactSensitiveFields(obj: any, depth = 0): any {
  if (depth > 10) return '[Max depth reached]';
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveFields(item, depth + 1));
  }

  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field)) ||
                       SENSITIVE_PATTERNS.some(pattern => pattern.test(lowerKey));

    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveFields(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

export function sanitizeErrorForLogging(err: any): any {
  const sanitized: Record<string, any> = {
    name: err.name,
    message: err.message,
    code: err.code,
    statusCode: err.statusCode || err.status,
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    sanitized.stack = err.stack
      .split('\n')
      .map((line: string) => {
        return line.replace(/\([^)]*[/\\]([^/\\]+\.(js|ts|tsx|jsx)):\d+:\d+\)/g, '($1:REDACTED)');
      })
      .join('\n');
  }

  if (err.details) {
    sanitized.details = redactSensitiveFields(err.details);
  }

  const errorObj = { ...err };
  delete errorObj.stack;
  delete errorObj.details;
  
  const additionalFields = redactSensitiveFields(errorObj);
  Object.assign(sanitized, additionalFields);

  return sanitized;
}

export function generateErrorCode(): string {
  return `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

