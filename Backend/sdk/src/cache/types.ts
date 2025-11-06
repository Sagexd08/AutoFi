export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
export interface CacheInterface {
  get<T>(key: string): Promise<T | undefined> | T | undefined;
  set<T>(key: string, value: T, ttl?: number): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
  has(key: string): Promise<boolean> | boolean;
  getStats(): CacheStats;
}
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}
