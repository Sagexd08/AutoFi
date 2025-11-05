import type { CacheInterface, CacheEntry, CacheStats } from './types';

/**
 * LRU (Least Recently Used) cache node.
 */
class LRUNode<T> {
  constructor(
    public key: string,
    public value: T,
    public expiresAt: number,
    public prev: LRUNode<T> | null = null,
    public next: LRUNode<T> | null = null
  ) {}
}

/**
 * LRU cache implementation with TTL support.
 */
export class LRUCache implements CacheInterface {
  private cache = new Map<string, LRUNode<unknown>>();
  private head: LRUNode<unknown> | null = null;
  private tail: LRUNode<unknown> | null = null;
  private hits = 0;
  private misses = 0;
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Creates a new LRU cache instance.
   * 
   * @param maxSize - Maximum number of entries
   * @param defaultTTL - Default TTL in milliseconds
   * @param cleanupInterval - Cleanup interval in milliseconds
   */
  constructor(
    private readonly maxSize: number = 100,
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
    let node = this.tail;
    while (node) {
      const next = node.prev;
      if (now >= node.expiresAt) {
        this.removeNode(node);
        this.cache.delete(node.key);
      }
      node = next;
    }
  }

  /**
   * Adds a node to the head of the list.
   */
  private addToHead<T>(node: LRUNode<T>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    } else {
      this.tail = node;
    }

    this.head = node;
  }

  /**
   * Removes a node from the list.
   */
  private removeNode<T>(node: LRUNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * Moves a node to the head (most recently used).
   */
  private moveToHead<T>(node: LRUNode<T>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * Gets a value from cache.
   */
  get<T>(key: string): T | undefined {
    const node = this.cache.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }

    const now = Date.now();
    if (now >= node.expiresAt) {
      this.removeNode(node);
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.moveToHead(node);
    this.hits++;
    return node.value as T;
  }

  /**
   * Sets a value in cache.
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    let node = this.cache.get(key);

    if (node) {
      node.value = value;
      node.expiresAt = expiresAt;
      this.moveToHead(node);
    } else {
      if (this.cache.size >= this.maxSize) {
        // Remove least recently used (tail)
        if (this.tail) {
          this.cache.delete(this.tail.key);
          this.removeNode(this.tail);
        }
      }

      node = new LRUNode(key, value, expiresAt);
      this.addToHead(node);
      this.cache.set(key, node);
    }
  }

  /**
   * Deletes a value from cache.
   */
  delete(key: string): void {
    const node = this.cache.get(key);
    if (node) {
      this.removeNode(node);
      this.cache.delete(key);
    }
  }

  /**
   * Clears all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Checks if a key exists in cache.
   */
  has(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) {
      return false;
    }

    const now = Date.now();
    if (now >= node.expiresAt) {
      this.removeNode(node);
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
