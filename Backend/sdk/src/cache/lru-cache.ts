import type { CacheInterface, CacheEntry, CacheStats } from './types';

class LRUNode<T> {

  constructor(

    public key: string,

    public value: T,

    public expiresAt: number,

    public prev: LRUNode<T> | null = null,

    public next: LRUNode<T> | null = null

  ) {}

}

export class LRUCache implements CacheInterface {

  private cache = new Map<string, LRUNode<unknown>>();

  private head: LRUNode<unknown> | null = null;

  private tail: LRUNode<unknown> | null = null;

  private hits = 0;

  private misses = 0;

  private cleanupInterval?: NodeJS.Timeout;

  constructor(

    private readonly maxSize: number = 100,

    private readonly defaultTTL: number = 60000,

    cleanupInterval: number = 60000

  ) {

    this.startCleanup(cleanupInterval);

  }

  private startCleanup(interval: number): void {

    this.cleanupInterval = setInterval(() => {

      this.cleanup();

    }, interval);

    if (this.cleanupInterval) {

      this.cleanupInterval.unref();

    }

  }

  private cleanup(): void {

    const now = Date.now();

    let node = this.tail;

    while (node) {

      const next = node.prev;

      if (now >= node.expiresAt) {

        this.removeNode(node as LRUNode<unknown>);

        this.cache.delete(node.key);

      }

      node = next;

    }

  }

  private addToHead<T>(node: LRUNode<T>): void {

    node.prev = null;

    node.next = this.head as LRUNode<T> | null;

    if (this.head) {

      (this.head as LRUNode<T>).prev = node;

    } else {

      this.tail = node;

    }

    this.head = node;

  }

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

  private moveToHead<T>(node: LRUNode<T>): void {

    this.removeNode(node);

    this.addToHead(node);

  }

  get<T>(key: string): T | undefined {

    const node = this.cache.get(key) as LRUNode<T> | undefined;

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

  set<T>(key: string, value: T, ttl?: number): void {

    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);

    let node = this.cache.get(key) as LRUNode<T> | undefined;

    if (node) {

      node.value = value;

      node.expiresAt = expiresAt;

      this.moveToHead(node);

    } else {

      if (this.cache.size >= this.maxSize) {


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

  delete(key: string): void {

    const node = this.cache.get(key);

    if (node) {

      this.removeNode(node as LRUNode<unknown>);

      this.cache.delete(key);

    }

  }

  clear(): void {

    this.cache.clear();

    this.head = null;

    this.tail = null;

    this.hits = 0;

    this.misses = 0;

  }

  has(key: string): boolean {

    const node = this.cache.get(key);

    if (!node) {

      return false;

    }

    const now = Date.now();

    if (now >= node.expiresAt) {

      this.removeNode(node as LRUNode<unknown>);

      this.cache.delete(key);

      return false;

    }

    return true;

  }

  getStats(): CacheStats {

    const total = this.hits + this.misses;

    return {

      size: this.cache.size,

      hits: this.hits,

      misses: this.misses,

      hitRate: total > 0 ? this.hits / total : 0,

    };

  }

  destroy(): void {

    if (this.cleanupInterval) {

      clearInterval(this.cleanupInterval);

    }

    this.clear();

  }

}

