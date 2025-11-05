/**
 * Cache entry with TTL support.
 */
export interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** Expiration timestamp */
  expiresAt: number;
}

/**
 * Cache interface for different cache implementations.
 */
export interface CacheInterface {
  /**
   * Gets a value from cache.
   * 
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get<T>(key: string): Promise<T | undefined> | T | undefined;

  /**
   * Sets a value in cache.
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void> | void;

  /**
   * Deletes a value from cache.
   * 
   * @param key - Cache key
   */
  delete(key: string): Promise<void> | void;

  /**
   * Clears all cache entries.
   */
  clear(): Promise<void> | void;

  /**
   * Checks if a key exists in cache.
   * 
   * @param key - Cache key
   * @returns True if key exists and is not expired
   */
  has(key: string): Promise<boolean> | boolean;

  /**
   * Gets cache statistics.
   */
  getStats(): CacheStats;
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  /** Total number of entries */
  size: number;
  /** Number of hits */
  hits: number;
  /** Number of misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
}
