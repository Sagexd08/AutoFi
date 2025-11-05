import type { CacheInterface, CacheEntry, CacheStats } from './types';

/**
 * In-memory cache implementation with TTL support.
 */
export class MemoryCache implements CacheInterface {
  private cache = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Creates a new memory cache instance.
   * 
   * @param defaultTTL - Default TTL in milliseconds
   * @param cleanupInterval - Cleanup interval in milliseconds
   */
  constructor(
    private readonly defaultTTL: number = 60000,
    cleanupInterval: number = 60000
  ) {
    this.startCleanup(cleanupInterval);
  }

  /**
   * Starts automatic cleanup of expired entries.
   */
  private startCleanup(interval: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  /**
   * Cleans up expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Gets a value from cache.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    const now = Date.now();
    if (now >= entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * Sets a value in cache.
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Deletes a value from cache.
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clears all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Checks if a key exists in cache.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now >= entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Gets cache statistics.
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Destroys the cache and cleans up resources.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}
