import crypto from 'crypto';

/**
 * Configuration interface for encryption settings
 */
export interface EncryptionConfig {
  algorithm?: string;
  keyLength?: number;
  ivLength?: number;
  saltLength?: number;
  iterations?: number;
  authTagLength?: number;
}

/**
 * Configuration for TokenManager
 */
export interface TokenManagerConfig {
  maxTokens?: number;
  enableRateLimiting?: boolean;
  rateLimitWindowMs?: number;
  maxTokensPerWindow?: number;
  enablePersistentStorage?: boolean;
  storageBackend?: TokenStorageBackend;
  cleanupIntervalMs?: number;
}

/**
 * Storage backend interface for token persistence
 */
export interface TokenStorageBackend {
  get(token: string): Promise<TokenInfo | null>;
  set(token: string, info: TokenInfo): Promise<void>;
  delete(token: string): Promise<boolean>;
  getAll(): Promise<Map<string, TokenInfo>>;
  clear(): Promise<void>;
}

/**
 * Token information structure
 */
export interface TokenInfo {
  payload: Record<string, unknown>;
  expiresAt: number;
  createdAt: number;
  lastAccess?: number;
  accessCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Rate limit information
 */
interface RateLimitInfo {
  count: number;
  windowStart: number;
}

/**
 * Secure storage configuration
 */
export interface SecureStorageConfig {
  enableKeyRotation?: boolean;
  keyRotationIntervalMs?: number;
  maxKeyAge?: number;
  storageBackend?: SecureStorageBackend;
}

/**
 * Secure storage backend interface
 */
export interface SecureStorageBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getAll(): Promise<Map<string, string>>;
}

/**
 * Logger interface for security events
 */
export interface SecurityLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

const DEFAULT_CONFIG: Required<Omit<EncryptionConfig, 'authTagLength'>> & { authTagLength: number } = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  saltLength: 32,
  iterations: 100000,
  authTagLength: 16, // Default for AES-GCM
};

/**
 * Supported GCM algorithms and their auth tag lengths
 */
const GCM_ALGORITHMS: Record<string, number> = {
  'aes-128-gcm': 16,
  'aes-192-gcm': 16,
  'aes-256-gcm': 16,
  'chacha20-poly1305': 16,
};

/**
 * Advanced Encryption Utility with comprehensive security features
 */
export class EncryptionUtil {
  private readonly config: Required<Omit<EncryptionConfig, 'authTagLength'>> & { authTagLength: number };
  private logger?: SecurityLogger;

  constructor(config: EncryptionConfig = {}, logger?: SecurityLogger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger;
    
    // Validate configuration
    this.validateConfig();
    
    // Set auth tag length based on algorithm if not provided
    if (!config.authTagLength) {
      this.config.authTagLength = GCM_ALGORITHMS[this.config.algorithm.toLowerCase()] || 16;
    }
  }

  /**
   * Validate encryption configuration
   */
  private validateConfig(): void {
    if (this.config.keyLength < 16 || this.config.keyLength > 64) {
      throw new Error('Key length must be between 16 and 64 bytes');
    }
    if (this.config.ivLength < 12 || this.config.ivLength > 16) {
      throw new Error('IV length must be between 12 and 16 bytes');
    }
    if (this.config.saltLength < 16 || this.config.saltLength > 64) {
      throw new Error('Salt length must be between 16 and 64 bytes');
    }
    if (this.config.iterations < 10000 || this.config.iterations > 1000000) {
      throw new Error('Iterations must be between 10000 and 1000000');
    }
  }

  /**
   * Validate input parameters
   */
  private validateInput(data: string, password: string): void {
    if (typeof data !== 'string' || data.length === 0) {
      throw new Error('Data must be a non-empty string');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Password must be a non-empty string');
    }
    if (password.length < 8) {
      this.logger?.warn('Password is shorter than recommended minimum length (8 characters)');
    }
  }

  /**
   * Validate GCM algorithm
   */
  private validateGCMAlgorithm(): void {
    const algorithm = this.config.algorithm.toLowerCase();
    const isGCM = Object.keys(GCM_ALGORITHMS).includes(algorithm) || algorithm.includes('gcm');
    
    if (!isGCM) {
      throw new Error(
        `Unsupported algorithm: ${this.config.algorithm}. ` +
        `Only GCM mode algorithms are supported (e.g., aes-128-gcm, aes-192-gcm, aes-256-gcm, chacha20-poly1305). ` +
        `The algorithm must support authentication tags via getAuthTag().`
      );
    }
  }

  /**
   * Get auth tag length for the current algorithm
   */
  private getAuthTagLength(): number {
    const algorithm = this.config.algorithm.toLowerCase();
    return GCM_ALGORITHMS[algorithm] || this.config.authTagLength;
  }

  /**
   * Derive key asynchronously (non-blocking)
   */
  private async deriveKeyAsync(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        this.config.iterations,
        this.config.keyLength,
        'sha256',
        (err, derivedKey) => {
          if (err) {
            reject(new Error(`Key derivation failed: ${err.message}`));
          } else {
            resolve(derivedKey);
          }
        }
      );
    });
  }

  /**
   * Derive key synchronously (blocking)
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    try {
      return crypto.pbkdf2Sync(
        password,
        salt,
        this.config.iterations,
        this.config.keyLength,
        'sha256'
      );
    } catch (error) {
      throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Encrypt data synchronously
   */
  encrypt(data: string, password: string): string {
    try {
      this.validateInput(data, password);
      this.validateGCMAlgorithm();

      const salt = crypto.randomBytes(this.config.saltLength);
      const key = this.deriveKey(password, salt);
      const iv = crypto.randomBytes(this.config.ivLength);
      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv) as crypto.CipherGCM;

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      const authTagLength = this.getAuthTagLength();

      // Validate auth tag length
      if (authTag.length !== authTagLength) {
        throw new Error(`Auth tag length mismatch: expected ${authTagLength}, got ${authTag.length}`);
      }

      const result = Buffer.concat([
        salt,
        iv,
        Buffer.from([authTagLength]), // Store auth tag length for dynamic retrieval
        authTag,
        Buffer.from(encrypted, 'hex'),
      ]);

      this.logger?.debug('Data encrypted successfully', {
        algorithm: this.config.algorithm,
        dataLength: data.length,
        encryptedLength: result.length,
      });

      return result.toString('base64');
    } catch (error) {
      this.logger?.error('Encryption failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Encrypt data asynchronously (non-blocking)
   */
  async encryptAsync(data: string, password: string): Promise<string> {
    try {
      this.validateInput(data, password);
      this.validateGCMAlgorithm();

      const salt = crypto.randomBytes(this.config.saltLength);
      const key = await this.deriveKeyAsync(password, salt);
      const iv = crypto.randomBytes(this.config.ivLength);
      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv) as crypto.CipherGCM;

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      const authTagLength = this.getAuthTagLength();

      if (authTag.length !== authTagLength) {
        throw new Error(`Auth tag length mismatch: expected ${authTagLength}, got ${authTag.length}`);
      }

      const result = Buffer.concat([
        salt,
        iv,
        Buffer.from([authTagLength]),
        authTag,
        Buffer.from(encrypted, 'hex'),
      ]);

      this.logger?.debug('Data encrypted asynchronously', {
        algorithm: this.config.algorithm,
        dataLength: data.length,
      });

      return result.toString('base64');
    } catch (error) {
      this.logger?.error('Async encryption failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Decrypt data synchronously
   */
  decrypt(encryptedData: string, password: string): string {
    try {
      this.validateInput(encryptedData, password);
      
      const data = Buffer.from(encryptedData, 'base64');
      const minLength = this.config.saltLength + this.config.ivLength + 1 + this.getAuthTagLength();
      
      if (data.length < minLength) {
        throw new Error('Invalid encrypted data: too short');
      }

      let offset = 0;
      const salt = data.subarray(offset, offset + this.config.saltLength);
      offset += this.config.saltLength;

      const iv = data.subarray(offset, offset + this.config.ivLength);
      offset += this.config.ivLength;

      const authTagLength = data[offset];
      if (authTagLength === undefined) {
        throw new Error('Invalid encrypted data: missing auth tag length');
      }
      offset += 1;

      if (authTagLength < 12 || authTagLength > 16) {
        throw new Error(`Invalid auth tag length: ${authTagLength}`);
      }

      const authTag = data.subarray(offset, offset + authTagLength);
      offset += authTagLength;

      const encrypted = data.subarray(offset);

      const key = this.deriveKey(password, salt);
      this.validateGCMAlgorithm();

      const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      this.logger?.debug('Data decrypted successfully', {
        algorithm: this.config.algorithm,
        decryptedLength: decrypted.length,
      });

      return decrypted;
    } catch (error) {
      this.logger?.error('Decryption failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Decrypt data asynchronously (non-blocking)
   */
  async decryptAsync(encryptedData: string, password: string): Promise<string> {
    try {
      this.validateInput(encryptedData, password);
      
      const data = Buffer.from(encryptedData, 'base64');
      const minLength = this.config.saltLength + this.config.ivLength + 1 + this.getAuthTagLength();
      
      if (data.length < minLength) {
        throw new Error('Invalid encrypted data: too short');
      }

      let offset = 0;
      const salt = data.subarray(offset, offset + this.config.saltLength);
      offset += this.config.saltLength;

      const iv = data.subarray(offset, offset + this.config.ivLength);
      offset += this.config.ivLength;

      const authTagLength = data[offset];
      if (authTagLength === undefined) {
        throw new Error('Invalid encrypted data: missing auth tag length');
      }
      offset += 1;

      if (authTagLength < 12 || authTagLength > 16) {
        throw new Error(`Invalid auth tag length: ${authTagLength}`);
      }

      const authTag = data.subarray(offset, offset + authTagLength);
      offset += authTagLength;

      const encrypted = data.subarray(offset);

      const key = await this.deriveKeyAsync(password, salt);
      this.validateGCMAlgorithm();

      const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      this.logger?.debug('Data decrypted asynchronously', {
        algorithm: this.config.algorithm,
      });

      return decrypted;
    } catch (error) {
      this.logger?.error('Async decryption failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Hash data using SHA-256
   */
  hash(data: string): string {
    if (typeof data !== 'string') {
      throw new Error('Data must be a string');
    }
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Hash data using SHA-256 with salt
   */
  hashWithSalt(data: string, salt: string): string {
    if (typeof data !== 'string' || typeof salt !== 'string') {
      throw new Error('Data and salt must be strings');
    }
    return crypto.createHash('sha256').update(data + salt).digest('hex');
  }

  /**
   * Generate cryptographically secure random token
   */
  generateToken(length: number = 32): string {
    if (length < 16 || length > 256) {
      throw new Error('Token length must be between 16 and 256 bytes');
    }
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate UUID v4
   */
  generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate secure random bytes
   */
  generateRandomBytes(length: number): Buffer {
    if (length < 1 || length > 1024) {
      throw new Error('Length must be between 1 and 1024 bytes');
    }
    return crypto.randomBytes(length);
  }

  /**
   * Constant-time comparison for tokens/keys
   */
  secureCompare(a: string, b: string): boolean {
    return this.constantTimeEquals(a, b);
  }
}

/**
 * Advanced Token Manager with rate limiting and persistent storage support
 */
export class TokenManager {
  private readonly tokens: Map<string, TokenInfo> = new Map();
  private readonly maxTokens: number;
  private readonly enableRateLimiting: boolean;
  private readonly rateLimitWindowMs: number;
  private readonly maxTokensPerWindow: number;
  private readonly storageBackend?: TokenStorageBackend;
  private readonly cleanupIntervalMs: number;
  private rateLimitMap: Map<string, RateLimitInfo> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private logger?: SecurityLogger;

  constructor(config: TokenManagerConfig = {}, logger?: SecurityLogger) {
    this.maxTokens = config.maxTokens ?? 1000;
    this.enableRateLimiting = config.enableRateLimiting ?? true;
    this.rateLimitWindowMs = config.rateLimitWindowMs ?? 60000; // 1 minute
    this.maxTokensPerWindow = config.maxTokensPerWindow ?? 10;
    this.storageBackend = config.storageBackend;
    this.cleanupIntervalMs = config.cleanupIntervalMs ?? 300000; // 5 minutes
    this.logger = logger;

    // Start cleanup interval
    this.startCleanupInterval();

    // Load tokens from storage backend if available
    if (this.storageBackend) {
      this.loadTokensFromStorage().catch((error) => {
        this.logger?.error('Failed to load tokens from storage', { error });
      });
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, this.cleanupIntervalMs);
  }

  /**
   * Load tokens from persistent storage
   */
  private async loadTokensFromStorage(): Promise<void> {
    if (!this.storageBackend) return;
    
    try {
      const storedTokens = await this.storageBackend.getAll();
      for (const [token, info] of storedTokens.entries()) {
        if (Date.now() < info.expiresAt) {
          this.tokens.set(token, info);
        }
      }
      this.logger?.debug('Tokens loaded from storage', { count: this.tokens.size });
    } catch (error) {
      this.logger?.error('Failed to load tokens from storage', { error });
    }
  }

  /**
   * Check rate limit for a given identifier
   */
  private checkRateLimit(identifier: string): boolean {
    if (!this.enableRateLimiting) return true;

    const now = Date.now();
    const limitInfo = this.rateLimitMap.get(identifier);

    if (!limitInfo || now - limitInfo.windowStart >= this.rateLimitWindowMs) {
      // New window or expired window
      this.rateLimitMap.set(identifier, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    if (limitInfo.count >= this.maxTokensPerWindow) {
      this.logger?.warn('Rate limit exceeded', { identifier, count: limitInfo.count });
      return false;
    }

    limitInfo.count++;
    return true;
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimits(): void {
    const now = Date.now();
    for (const [identifier, info] of this.rateLimitMap.entries()) {
      if (now - info.windowStart >= this.rateLimitWindowMs) {
        this.rateLimitMap.delete(identifier);
      }
    }
  }

  /**
   * Create a new token with rate limiting
   */
  createToken(
    payload: Record<string, unknown>,
    expiresInMs: number = 3600000,
    identifier?: string,
    metadata?: Record<string, unknown>
  ): string {
    // Validate inputs
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Payload must be a non-null object');
    }
    if (expiresInMs < 1000 || expiresInMs > 31536000000) { // 1 second to 1 year
      throw new Error('ExpiresInMs must be between 1000 and 31536000000');
    }

    // Check rate limit
    const rateLimitId = identifier || 'default';
    if (!this.checkRateLimit(rateLimitId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + expiresInMs;
    const now = Date.now();

    const tokenInfo: TokenInfo = {
      payload,
      expiresAt,
      createdAt: now,
      lastAccess: now,
      accessCount: 0,
      metadata,
    };

    this.tokens.set(token, tokenInfo);

    // Store in backend if available
    if (this.storageBackend) {
      this.storageBackend.set(token, tokenInfo).catch((error) => {
        this.logger?.error('Failed to store token', { error, token: token.substring(0, 8) });
      });
    }

    this.cleanupExpiredTokens();
    this.cleanupRateLimits();

    // Evict oldest tokens if over limit
    while (this.tokens.size > this.maxTokens) {
      this.evictOldestToken();
    }

    this.logger?.debug('Token created', {
      token: token.substring(0, 8),
      expiresInMs,
      totalTokens: this.tokens.size,
    });

    return token;
  }

  /**
   * Validate token and return payload
   */
  async validateToken(token: string): Promise<Record<string, unknown> | null> {
    if (typeof token !== 'string' || token.length !== 64) {
      return null;
    }

    let tokenInfo = this.tokens.get(token);

    // Try to load from storage if not in memory
    if (!tokenInfo && this.storageBackend) {
      try {
        const info = await this.storageBackend.get(token);
        if (info) {
          this.tokens.set(token, info);
          tokenInfo = info;
        }
      } catch (error) {
        this.logger?.error('Failed to load token from storage', { error });
      }
    }

    if (!tokenInfo) {
      return null;
    }

    if (Date.now() > tokenInfo.expiresAt) {
      this.tokens.delete(token);
      if (this.storageBackend) {
        this.storageBackend.delete(token).catch((error) => {
          this.logger?.error('Failed to delete expired token from storage', { error });
        });
      }
      return null;
    }

    // Update access information
    tokenInfo.lastAccess = Date.now();
    tokenInfo.accessCount = (tokenInfo.accessCount || 0) + 1;

    // Update in storage if available
    if (this.storageBackend) {
      try {
        await this.storageBackend.set(token, tokenInfo);
      } catch (error) {
        this.logger?.error('Failed to update token in storage', { error });
      }
    }

    return tokenInfo.payload;
  }

  /**
   * Revoke a token
   */
  revokeToken(token: string): boolean {
    const deleted = this.tokens.delete(token);
    if (deleted && this.storageBackend) {
      this.storageBackend.delete(token).catch((error) => {
        this.logger?.error('Failed to delete token from storage', { error });
      });
    }
    return deleted;
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens(): void {
    const now = Date.now();
    const expiredTokens: string[] = [];

    for (const [token, info] of this.tokens.entries()) {
      if (now > info.expiresAt) {
        expiredTokens.push(token);
      }
    }

    for (const token of expiredTokens) {
      this.tokens.delete(token);
      if (this.storageBackend) {
        this.storageBackend.delete(token).catch((error) => {
          this.logger?.error('Failed to delete expired token from storage', { error });
        });
      }
    }

    if (expiredTokens.length > 0) {
      this.logger?.debug('Cleaned up expired tokens', { count: expiredTokens.length });
    }
  }

  /**
   * Evict oldest token (LRU)
   */
  private evictOldestToken(): void {
    if (this.tokens.size === 0) {
      return;
    }

    let oldestToken: string | null = null;
    let oldestTimestamp: number = Infinity;

    for (const [token, info] of this.tokens.entries()) {
      const accessTime = info.lastAccess ?? info.createdAt;
      if (accessTime < oldestTimestamp) {
        oldestTimestamp = accessTime;
        oldestToken = token;
      }
    }

    if (oldestToken !== null) {
      this.tokens.delete(oldestToken);
      if (this.storageBackend) {
        this.storageBackend.delete(oldestToken).catch((error) => {
          this.logger?.error('Failed to delete evicted token from storage', { error });
        });
      }
    }
  }

  /**
   * Get all active tokens
   */
  getActiveTokens(): string[] {
    this.cleanupExpiredTokens();
    return Array.from(this.tokens.keys());
  }

  /**
   * Get token information
   */
  getTokenInfo(token: string): TokenInfo | null {
    return this.tokens.get(token) || null;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTokens: number;
    activeTokens: number;
    rateLimitEntries: number;
  } {
    this.cleanupExpiredTokens();
    return {
      totalTokens: this.tokens.size,
      activeTokens: this.tokens.size,
      rateLimitEntries: this.rateLimitMap.size,
    };
  }

  
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.tokens.clear();
    this.rateLimitMap.clear();
  }
}

/**
 * Advanced Secure Storage with key rotation support
 */
export class SecureStorage {
  private readonly encryption: EncryptionUtil;
  private readonly storage: Map<string, string> = new Map();
  private readonly storageBackend?: SecureStorageBackend;
  private readonly enableKeyRotation: boolean;
  private readonly keyRotationIntervalMs: number;
  private keyVersions: Map<string, number> = new Map();
  private logger?: SecurityLogger;

  constructor(config: SecureStorageConfig = {}, logger?: SecurityLogger) {
    this.encryption = new EncryptionUtil({}, logger);
    this.storageBackend = config.storageBackend;
    this.enableKeyRotation = config.enableKeyRotation ?? false;
    this.keyRotationIntervalMs = config.keyRotationIntervalMs ?? 86400000; // 24 hours
    this.logger = logger;

    // Load from storage backend if available
    if (this.storageBackend) {
      this.loadFromStorage().catch((error) => {
        this.logger?.error('Failed to load from storage', { error });
      });
    }
  }

  /**
   * Load data from persistent storage
   */
  private async loadFromStorage(): Promise<void> {
    if (!this.storageBackend) return;
    
    try {
      const stored = await this.storageBackend.getAll();
      for (const [key, value] of stored.entries()) {
        this.storage.set(key, value);
      }
      this.logger?.debug('Data loaded from storage', { count: this.storage.size });
    } catch (error) {
      this.logger?.error('Failed to load from storage', { error });
    }
  }

  /**
   * Set a value with encryption
   */
  set(key: string, value: string, password: string): void {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('Key must be a non-empty string');
    }
    if (typeof value !== 'string') {
      throw new Error('Value must be a string');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Password must be a non-empty string');
    }

    const encrypted = this.encryption.encrypt(value, password);
    this.storage.set(key, encrypted);

    // Update key version for rotation
    if (this.enableKeyRotation) {
      const currentVersion = this.keyVersions.get(key) || 0;
      this.keyVersions.set(key, currentVersion + 1);
    }

    // Store in backend if available
    if (this.storageBackend) {
      this.storageBackend.set(key, encrypted).catch((error) => {
        this.logger?.error('Failed to store in backend', { error, key });
      });
    }

    this.logger?.debug('Value stored', { key, encrypted: true });
  }

  /**
   * Set a value asynchronously
   */
  async setAsync(key: string, value: string, password: string): Promise<void> {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('Key must be a non-empty string');
    }
    if (typeof value !== 'string') {
      throw new Error('Value must be a string');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Password must be a non-empty string');
    }

    const encrypted = await this.encryption.encryptAsync(value, password);
    this.storage.set(key, encrypted);

    if (this.enableKeyRotation) {
      const currentVersion = this.keyVersions.get(key) || 0;
      this.keyVersions.set(key, currentVersion + 1);
    }

    if (this.storageBackend) {
      await this.storageBackend.set(key, encrypted);
    }

    this.logger?.debug('Value stored asynchronously', { key });
  }

  /**
   * Get a value with decryption
   */
  async get(key: string, password: string): Promise<string | null> {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('Key must be a non-empty string');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Password must be a non-empty string');
    }

    let encrypted: string | null = this.storage.get(key) ?? null;

    // Try to load from storage if not in memory
    if (!encrypted && this.storageBackend) {
      try {
        const value = await this.storageBackend.get(key);
        if (value) {
          this.storage.set(key, value);
          encrypted = value;
        }
      } catch (error) {
        this.logger?.error('Failed to load from storage', { error, key });
      }
    }

    if (!encrypted) {
      return null;
    }

    try {
      return this.encryption.decrypt(encrypted, password);
    } catch (error) {
      this.logger?.error('Decryption failed', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      return null;
    }
  }

  /**
   * Get a value asynchronously
   */
  async getAsync(key: string, password: string): Promise<string | null> {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('Key must be a non-empty string');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Password must be a non-empty string');
    }

    let encrypted: string | null = this.storage.get(key) ?? null;

    if (!encrypted && this.storageBackend) {
      const backendValue = await this.storageBackend.get(key);
      if (backendValue) {
        this.storage.set(key, backendValue);
        encrypted = backendValue;
      }
    }

    if (!encrypted) {
      return null;
    }

    try {
      return await this.encryption.decryptAsync(encrypted, password);
    } catch (error) {
      this.logger?.error('Async decryption failed', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      return null;
    }
  }

  /**
   * Delete a value
   */
  delete(key: string): boolean {
    const deleted = this.storage.delete(key);
    this.keyVersions.delete(key);

    if (deleted && this.storageBackend) {
      this.storageBackend.delete(key).catch((error) => {
        this.logger?.error('Failed to delete from storage', { error, key });
      });
    }

    return deleted;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.storage.has(key);
  }

  /**
   * Check if key exists asynchronously
   */
  async hasAsync(key: string): Promise<boolean> {
    if (this.storage.has(key)) {
      return true;
    }
    if (this.storageBackend) {
      return await this.storageBackend.has(key);
    }
    return false;
  }

  /**
   * Clear all values
   */
  clear(): void {
    this.storage.clear();
    this.keyVersions.clear();

    if (this.storageBackend) {
      this.storageBackend.clear().catch((error) => {
        this.logger?.error('Failed to clear storage', { error });
      });
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalKeys: number;
    keyVersions: number;
  } {
    return {
      totalKeys: this.storage.size,
      keyVersions: this.keyVersions.size,
    };
  }
}

/**
 * GDPR Compliance utilities
 */
export class GDPRCompliance {
  private static readonly PII_FIELDS = [
    'email',
    'phone',
    'address',
    'name',
    'ssn',
    'ip',
    'creditcard',
    'passport',
    'driverslicense',
    'bankaccount',
    'routingnumber',
  ] as const;

  /**
   * Anonymize PII data
   */
  static anonymize(data: Record<string, unknown>): Record<string, unknown> {
    const piiFieldsLower = new Set(
      GDPRCompliance.PII_FIELDS.map((field) => field.toLowerCase())
    );

    const isPIIField = (fieldName: string): boolean => {
      return piiFieldsLower.has(fieldName.toLowerCase());
    };

    const isPlainObject = (value: unknown): value is Record<string, unknown> => {
      return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.prototype.toString.call(value) === '[object Object]' &&
        value.constructor === Object
      );
    };

    const deepAnonymize = (
      value: unknown,
      visited: WeakSet<object> = new WeakSet()
    ): unknown => {
      if (value === null || value === undefined) {
        return value;
      }

      if (typeof value !== 'object') {
        return value;
      }

      if (visited.has(value as object)) {
        return '***CIRCULAR***';
      }

      if (Array.isArray(value)) {
        visited.add(value);
        return value.map((item) => deepAnonymize(item, visited));
      }

      if (isPlainObject(value)) {
        visited.add(value);
        const anonymized: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(value)) {
          if (isPIIField(key)) {
            anonymized[key] = '***REDACTED***';
          } else {
            anonymized[key] = deepAnonymize(val, visited);
          }
        }

        return anonymized;
      }

      return value;
    };

    return deepAnonymize(data) as Record<string, unknown>;
  }

  static containsPII(data: Record<string, unknown>): boolean {
    const piiFieldsLower = new Set(
      GDPRCompliance.PII_FIELDS.map((field) => field.toLowerCase())
    );

    const checkObject = (obj: Record<string, unknown>): boolean => {
      for (const key of Object.keys(obj)) {
        if (piiFieldsLower.has(key.toLowerCase())) {
          return true;
        }
        const value = obj[key];
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          Object.prototype.toString.call(value) === '[object Object]'
        ) {
          if (checkObject(value as Record<string, unknown>)) {
            return true;
          }
        }
      }
      return false;
    };

    return checkObject(data);
  }

  /**
   * Remove PII fields from data
   */
  static removePII(data: Record<string, unknown>): Record<string, unknown> {
    const cleaned = { ...data };
    const piiFieldsLower = new Set(
      GDPRCompliance.PII_FIELDS.map((field) => field.toLowerCase())
    );

    const removeFromObject = (obj: Record<string, unknown>): void => {
      for (const key of Object.keys(obj)) {
        if (piiFieldsLower.has(key.toLowerCase())) {
          delete obj[key];
        } else {
          const value = obj[key];
          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            Object.prototype.toString.call(value) === '[object Object]'
          ) {
            removeFromObject(value as Record<string, unknown>);
          }
        }
      }
    };

    removeFromObject(cleaned);
    return cleaned;
  }
}

export const defaultEncryption = new EncryptionUtil();

export const security = {
  encrypt: (data: string, password: string): string =>
    defaultEncryption.encrypt(data, password),
  encryptAsync: (data: string, password: string): Promise<string> =>
    defaultEncryption.encryptAsync(data, password),
  decrypt: (encryptedData: string, password: string): string =>
    defaultEncryption.decrypt(encryptedData, password),
  decryptAsync: (encryptedData: string, password: string): Promise<string> =>
    defaultEncryption.decryptAsync(encryptedData, password),
  hash: (data: string): string => defaultEncryption.hash(data),
  hashWithSalt: (data: string, salt: string): string =>
    defaultEncryption.hashWithSalt(data, salt),
  generateToken: (length?: number): string =>
    defaultEncryption.generateToken(length),
  generateUUID: (): string => defaultEncryption.generateUUID(),
  generateRandomBytes: (length: number): Buffer =>
    defaultEncryption.generateRandomBytes(length),
  secureCompare: (a: string, b: string): boolean =>
    defaultEncryption.secureCompare(a, b),
};