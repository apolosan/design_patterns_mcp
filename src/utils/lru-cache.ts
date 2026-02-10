export interface LRUCacheOptions<K = string, V = unknown> {
  maxSize?: number;
  ttl?: number;
  onEvict?: (key: K, value: V) => void;
  updateTtlOnHit?: boolean;
}

export interface CacheEntry<V> {
  value: V;
  expiresAt?: number;
  lastAccessed: number;
}

export interface LRUCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

export class LRUCache<K = string, V = unknown> {
  private cache = new Map<K, CacheEntry<V>>();
  private options: Required<LRUCacheOptions<K, V>>;
  private stats: LRUCacheStats;

  constructor(options: LRUCacheOptions<K, V> = {}) {
    this.options = {
      maxSize: options.maxSize ?? 100,
      ttl: options.ttl ?? 0,
      onEvict: options.onEvict ?? (() => {}),
      updateTtlOnHit: options.updateTtlOnHit ?? false,
    };
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize: this.options.maxSize,
      hitRate: 0,
    };
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    entry.lastAccessed = Date.now();

    if (this.options.updateTtlOnHit && this.options.ttl > 0) {
      entry.expiresAt = Date.now() + this.options.ttl;
    }

    this.stats.hits++;
    this.updateHitRate();

    return entry.value;
  }

  set(key: K, value: V): this {
    const existing = this.cache.get(key);

    if (existing) {
      existing.value = value;
      existing.lastAccessed = Date.now();
      if (this.options.ttl > 0) {
        existing.expiresAt = Date.now() + this.options.ttl;
      }
      this.cache.delete(key);
      this.cache.set(key, existing);
      return this;
    }

    const entry: CacheEntry<V> = {
      value,
      lastAccessed: Date.now(),
      expiresAt: this.options.ttl > 0 ? Date.now() + this.options.ttl : undefined,
    };

    this.cache.set(key, entry);

    while (this.cache.size > this.options.maxSize) {
      this.evictOldest();
    }

    this.stats.size = this.cache.size;

    return this;
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);

    if (!entry) return false;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  peek(key: K): V | undefined {
    const entry = this.cache.get(key);
    return entry?.value;
  }

  getOrSet(key: K, factory: () => V): V {
    const existing = this.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const value = factory();
    this.set(key, value);
    return value;
  }

  async getOrSetAsync(key: K, factory: () => Promise<V>): Promise<V> {
    const existing = this.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const value = await factory();
    this.set(key, value);
    return value;
  }

  private evictOldest(): void {
    const iterator = this.cache.keys();
    const first = iterator.next().value as K | undefined;

    if (first !== undefined) {
      const entry = this.cache.get(first)!;
      this.options.onEvict(first, entry.value);
      this.cache.delete(first);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }

  evictOldestMultiple(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.cache.size === 0) break;
      this.evictOldest();
    }
  }

  removeExpired(): number {
    if (this.options.ttl === 0) return 0;

    const now = Date.now();
    const toDelete: K[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      const entry = this.cache.get(key)!;
      this.options.onEvict(key, entry.value);
      this.cache.delete(key);
      this.stats.evictions++;
    }

    this.stats.size = this.cache.size;

    return toDelete.length;
  }

  getKeys(): K[] {
    return Array.from(this.cache.keys());
  }

  getValues(): V[] {
    const now = Date.now();
    return Array.from(this.cache.values())
      .filter((entry) => !entry.expiresAt || now < entry.expiresAt)
      .map((entry) => entry.value);
  }

  getEntries(): [K, V][] {
    const now = Date.now();
    return Array.from(this.cache.entries())
      .filter(([, entry]) => !entry.expiresAt || now < entry.expiresAt)
      .map(([key, entry]) => [key, entry.value] as [K, V]);
  }

  getStats(): LRUCacheStats {
    return { ...this.stats, size: this.cache.size };
  }

  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.stats.hitRate = 0;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  get size(): number {
    return this.cache.size;
  }

  get maxSize(): number {
    return this.options.maxSize;
  }
}

export class TTLLRUCache<K = string, V = unknown> extends LRUCache<K, V> {
  constructor(maxSize: number, ttlMs: number, onEvict?: (key: K, value: V) => void) {
    super({ maxSize, ttl: ttlMs, onEvict });
  }
}

export class MultiLRUCache<K = string, V = unknown> {
  private caches: Map<string, LRUCache<K, V>> = new Map();

  createCache(name: string, options: LRUCacheOptions<K, V>): LRUCache<K, V> {
    const cache = new LRUCache<K, V>(options);
    this.caches.set(name, cache);
    return cache;
  }

  getCache(name: string): LRUCache<K, V> | undefined {
    return this.caches.get(name);
  }

  getOrCreate(name: string, options: LRUCacheOptions<K, V>): LRUCache<K, V> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = this.createCache(name, options);
    }
    return cache;
  }

  deleteCache(name: string): boolean {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
      return this.caches.delete(name);
    }
    return false;
  }

  getAllStats(): Record<string, LRUCacheStats> {
    const stats: Record<string, LRUCacheStats> = {};
    for (const [name, cache] of this.caches) {
      stats[name] = cache.getStats();
    }
    return stats;
  }
}

export function createLRUCache<K = string, V = unknown>(options?: LRUCacheOptions<K, V>): LRUCache<K, V> {
  return new LRUCache<K, V>(options);
}
