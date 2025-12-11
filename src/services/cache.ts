/**
 * Caching Service for Design Patterns MCP Server
 * Implements in-memory caching with TTL and LRU eviction
 * Supports pattern search results, embeddings, and frequently accessed data
 */

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  enableMetrics: boolean;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

export class CacheService {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
  };
  private setInProgress = new Set<string>();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      defaultTTL: 3600000, // 1 hour
      enableMetrics: true,
      ...config,
    };
  }

  /**
   * Get cached value by key
   */
  get<T = unknown>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.updateMetrics(false);
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.updateMetrics(false);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.updateMetrics(true);
    return entry.data as T;
  }

  /**
   * Set cached value with optional TTL (Thread-safe with simple lock)
   */
  set<T = unknown>(key: string, data: T, ttl?: number): void {
    // Simple lock to prevent concurrent modifications to same key
    if (this.setInProgress.has(key)) {
      return; // Skip if already being set
    }
    
    this.setInProgress.add(key);
    
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttl ?? this.config.defaultTTL,
        accessCount: 0,
        lastAccessed: Date.now(),
      };

      // Check if we need to evict entries (now race-condition safe)
      if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
        this.evictLRU();
      }

      this.cache.set(key, entry);
      this.metrics.size = this.cache.size;
    } finally {
      this.setInProgress.delete(key);
    }
  }

  /**
   * Delete cached value by key
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
    this.metrics.size = 0;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cache size
   */
  size(): number {
    // Clean expired entries
    this.cleanExpired();
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheMetrics & {
    entries: Array<{
      key: string;
      size: number;
      age: number;
      accessCount: number;
    }>;
  } {
    this.cleanExpired();

    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: this.estimateSize(entry.data),
      age: Date.now() - entry.timestamp,
      accessCount: entry.accessCount,
    }));

    return {
      ...this.metrics,
      size: this.cache.size,
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0,
      entries,
    };
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): void {
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));
    this.metrics.size = this.cache.size;
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.metrics.evictions++;
    }
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(hit: boolean): void {
    if (!this.config.enableMetrics) return;

    if (hit) {
      this.metrics.hits++;
    } else {
      this.metrics.misses++;
    }
  }

  /**
   * Estimate size of cached data (rough approximation)
   */
  private estimateSize(data: unknown): number {
    try {
      const jsonString = JSON.stringify(data);
      return jsonString.length;
    } catch {
      return 0;
    }
  }

  /**
   * Fast hash function for objects (FNV-1a algorithm)
   * Much faster than JSON.stringify for cache key generation
   */
  private hashObject(obj: unknown): string {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    let hash = 2166136261; // FNV offset basis
    
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619); // FNV prime
    }
    
    return (hash >>> 0).toString(36); // Convert to base36 for shorter keys
  }

  /**
   * Get or set pattern (convenience method for pattern caching)
   */
  getPattern(patternId: string): unknown {
    return this.get(`pattern:${patternId}`);
  }

  setPattern(patternId: string, pattern: unknown, ttl?: number): void {
    this.set(`pattern:${patternId}`, pattern, ttl);
  }

  /**
   * Get or set search results (convenience method for search caching)
   */
  getSearchResults(query: string, options?: unknown): unknown {
    const optionsHash = this.hashObject(options ?? {});
    const key = `search:${query}:${optionsHash}`;
    return this.get(key);
  }

  setSearchResults(query: string, options: unknown, results: unknown, ttl?: number): void {
    // Use fast hash for options instead of JSON.stringify for better performance
    const optionsHash = this.hashObject(options || {});
    const key = `search:${query}:${optionsHash}`;
    this.set(key, results, ttl);
  }

  /**
   * Get or set embeddings (convenience method for embedding caching)
   */
  getEmbeddings(text: string): number[] | null {
    return this.get(`embedding:${text}`);
  }

  setEmbeddings(text: string, embeddings: number[], ttl?: number): void {
    this.set(`embedding:${text}`, embeddings, ttl);
  }
}

// Deprecated singleton functions removed - use DI Container instead
// MIGRATION GUIDE:
// - Replace getCacheService() with container.get(TOKENS.CACHE_SERVICE)
// - Replace initializeCacheService() with container.registerSingleton(TOKENS.CACHE_SERVICE, ...)
// - closeCacheService() is managed by DI Container lifecycle
