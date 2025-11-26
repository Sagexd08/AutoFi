import { randomBytes } from 'crypto';

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(8).toString('hex');
  const id = `${timestamp}${randomPart}`;
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generate a short unique ID (12 chars)
 */
export function generateShortId(): string {
  return randomBytes(6).toString('hex');
}

/**
 * Generate a CUID-like ID
 */
export function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(12).toString('base64url').slice(0, 12);
  return `c${timestamp}${random}`;
}

/**
 * Generate an API key
 */
export function generateApiKey(prefix: string = 'ak'): string {
  const key = randomBytes(32).toString('base64url');
  return `${prefix}_${key}`;
}

/**
 * Generate a session token
 */
export function generateSessionToken(): string {
  return randomBytes(48).toString('base64url');
}
