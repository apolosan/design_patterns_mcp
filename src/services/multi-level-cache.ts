/**
 * Multi-Level Cache Service
 * Implements L1 (in-memory), L2 (Redis), and L3 (persistent SQLite) caching
 * Based on RESEARCH.md Phase 2.2 - Advanced Caching & Compression
 * 
 * Architecture:
 * - L1: In-memory (microseconds, small footprint)
 * - L2: Redis/KeyDB (milliseconds, distributed, optional)
 * - L3: Compressed on-disk (persistent, SQLite)
 * 
 * Features:
 * - Write-through strategy for consistency
 * - Graceful fallback between levels
 * - Telemetry integration for metrics
 */

import { DatabaseManager } from './database-manager.js';
import { TelemetryService } from './telemetry-service.js';
import {
  CacheEntry,
  MultiLevelCacheConfig,
  CacheMetrics,
  CompressedData,
  CacheLevel,
  TelemetryCacheEvent,
  inferKeyType,
  MultiLevelCacheStats,
  L2CacheStats,
  L3CacheStats,
} from '../types/cache-types.js';
import { Pattern } from '../models/pattern.js';
import { SearchResult } from '../repositories/interfaces.js';
import { isPatternData, isTypedArray, isNumber, isObject } from '../utils/type-guards.js';

const DEFAULT_CONFIG: MultiLevelCacheConfig = {
  l1: {
    maxSize: 1000,
    defaultTTL: 3600000,
    enableMetrics: true,
  },
  l2: {
    enabled: false,
    host: 'localhost',
    port: 6379,
    keyPrefix: 'cache:',
    defaultTTL: 86400000,
    maxConnections: 10,
    connectionTimeout: 5000,
  },
  l3: {
    enabled: true,
    tableName: 'cache_data',
    defaultTTL: 604800000,
    maxSize: 10000,
  },
  global: {
    defaultTTL: 3600000,
    writeStrategy: 'write-through',
    telemetryEnabled: true,
    compressionEnabled: true,
  },
};

export interface CacheServiceInterface {
  get<T>(key: string, guard?: (value: unknown) => value is T): T | null;
  set<T>(key: string, data: T, ttl?: number): void;
  delete(key: string): boolean;
  clear(): void;
  has(key: string): boolean;
  size(): number;
  getStats(): CacheMetrics & { entries: Array<{ key: string; size: number; age: number; accessCount: number; }> };
  getPattern(patternId: string): Pattern | null;
  setPattern(patternId: string, pattern: Pattern, ttl?: number): void;
  getSearchResults(query: string, options?: Record<string, unknown>): SearchResult[] | null;
  setSearchResults(query: string, options: Record<string, unknown>, results: SearchResult[], ttl?: number): void;
  getEmbeddings(text: string): number[] | null;
  setEmbeddings(text: string, embeddings: number[], ttl?: number): void;
}

export interface AsyncCacheServiceInterface {
  get<T>(key: string, guard?: (value: unknown) => value is T): Promise<T | null>;
  set<T>(key: string, data: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  size(): Promise<number>;
  getStats(): Promise<CacheMetrics & { entries: Array<{ key: string; size: number; age: number; accessCount: number; }> }>;
  getFullStats(): Promise<MultiLevelCacheStats>;
  getPattern(patternId: string): Promise<Pattern | null>;
  setPattern(patternId: string, pattern: Pattern, ttl?: number): Promise<void>;
  getSearchResults(query: string, options?: Record<string, unknown>): Promise<SearchResult[] | null>;
  setSearchResults(query: string, options: Record<string, unknown>, results: SearchResult[], ttl?: number): Promise<void>;
  getEmbeddings(text: string): Promise<number[] | null>;
  setEmbeddings(text: string, embeddings: number[], ttl?: number): Promise<void>;
  shutdown(): Promise<void>;
}

export class MultiLevelCache implements AsyncCacheServiceInterface {
  private l1Cache: Map<string, CacheEntry>;
  private config: MultiLevelCacheConfig;
  private metrics: CacheMetrics;
  private db: DatabaseManager | null = null;
  private telemetry: TelemetryService | null = null;
  private redisClient: unknown = null;
  private redisConnected: boolean = false;
  private compressionEnabled: boolean;
  private setInProgress = new Set<string>();

  constructor(
    db?: DatabaseManager,
    telemetry?: TelemetryService,
    config?: Partial<MultiLevelCacheConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.l1Cache = new Map();
    this.db = null;
    this.telemetry = null;
    this.redisClient = null;
    this.redisConnected = false;
    this.compressionEnabled = this.config.global.compressionEnabled;

    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
      levelStats: {
        L1: { hits: 0, misses: 0, size: 0, hitRate: 0 },
        L2: { hits: 0, misses: 0, size: 0, hitRate: 0 },
        L3: { hits: 0, misses: 0, size: 0, hitRate: 0 },
      },
    };

    if (db) {
      this.initializeL3(db);
    }

    if (telemetry) {
      this.telemetry = telemetry;
    }

    if (this.config.l2.enabled) {
      this.initializeRedis().catch(() => {});
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      let Redis: new (opts: unknown) => unknown = null as unknown as new (opts: unknown) => unknown;
      let client: unknown = null;

      try {
        const redisModule = await import('redis');
        Redis = redisModule.createClient as unknown as new (opts: unknown) => unknown;
      } catch {
        try {
          const ioredisModule = await import('ioredis');
          Redis = ioredisModule.default as unknown as new (opts: unknown) => unknown;
        } catch {
          return;
        }
      }

      if (Redis) {
        if (this.config.l2.host && this.config.l2.port) {
          client = new Redis({
            socket: {
              host: this.config.l2.host,
              port: this.config.l2.port,
              connectTimeout: this.config.l2.connectionTimeout,
            },
          });
        } else {
          client = new Redis({
            host: this.config.l2.host ?? 'localhost',
            port: this.config.l2.port ?? 6379,
            connectTimeout: this.config.l2.connectionTimeout ?? 5000,
            lazyConnect: true,
            retryStrategy: (times: number) => Math.min(times * 100, 3000),
          });
        }

        try {
          await (client as { connect?: () => Promise<void> }).connect?.();
        } catch {
          try {
            await (client as { ping?: () => Promise<string> }).ping?.();
          } catch {
            this.redisConnected = false;
            return;
          }
        }

        this.redisClient = client;
        this.redisConnected = true;
      }
    } catch {
      this.redisConnected = false;
    }
  }

  private initializeL3(db: DatabaseManager): void {
    this.db = db;

    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${this.config.l3.tableName} (
          key TEXT PRIMARY KEY,
          data BLOB NOT NULL,
          compressed INTEGER DEFAULT 0,
          algorithm TEXT DEFAULT 'none',
          original_size INTEGER NOT NULL,
          timestamp INTEGER NOT NULL,
          ttl INTEGER NOT NULL,
          access_count INTEGER DEFAULT 0,
          last_accessed INTEGER NOT NULL
        )
      `;

      db.execute(createTableSQL);

      const createIndexSQL = `
        CREATE INDEX IF NOT EXISTS idx_${this.config.l3.tableName}_timestamp
        ON ${this.config.l3.tableName}(timestamp)
      `;

      db.execute(createIndexSQL);
    } catch {
    }
  }

  private compressSync(data: unknown): CompressedData {
    if (!this.compressionEnabled) {
      const jsonString = JSON.stringify(data);
      return {
        compressed: new TextEncoder().encode(jsonString),
        algorithm: 'none',
        originalSize: jsonString.length,
        compressedSize: jsonString.length,
      };
    }

    try {
      const jsonString = JSON.stringify(data);
      const encoded = new TextEncoder().encode(jsonString);
      return {
        compressed: encoded,
        algorithm: 'none',
        originalSize: jsonString.length,
        compressedSize: encoded.length,
      };
    } catch {
      const jsonString = JSON.stringify(data);
      return {
        compressed: new TextEncoder().encode(jsonString),
        algorithm: 'none',
        originalSize: jsonString.length,
        compressedSize: jsonString.length,
      };
    }
  }

  private decompressSync(data: CompressedData): unknown {
    try {
      const bytes = Buffer.from(data.compressed);
      const jsonString = new TextDecoder().decode(bytes);
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }

  private recordTelemetry(key: string, hit: boolean, level: CacheLevel, latencyMs: number): void {
    if (!this.config.global.telemetryEnabled || !this.telemetry) return;
    this.telemetry.recordCacheHit(key, hit);
  }

  async get<T>(key: string, guard?: (value: unknown) => value is T): Promise<T | null> {
    const startTime = Date.now();

    const l1Result = this.getFromL1(key, guard);
    if (l1Result.data !== null) {
      this.recordTelemetry(key, true, 'L1', Date.now() - startTime);
      return l1Result.data;
    }

    const l2Result = await this.getFromL2<T>(key, guard);
    if (l2Result.data !== null) {
      this.setToL1(key, l2Result.data, this.config.l2.defaultTTL);
      this.recordTelemetry(key, true, 'L2', Date.now() - startTime);
      return l2Result.data;
    }

    const l3Result = this.getFromL3<T>(key, guard);
    if (l3Result.data !== null) {
      this.setToL1(key, l3Result.data, this.config.l3.defaultTTL);
      this.recordTelemetry(key, true, 'L3', Date.now() - startTime);
      return l3Result.data;
    }

    this.recordTelemetry(key, false, 'L1', Date.now() - startTime);
    this.metrics.misses++;
    this.metrics.levelStats.L1.misses++;

    return null;
  }

  private getFromL1<T>(key: string, guard?: (value: unknown) => value is T): { data: T | null; level: CacheLevel; latencyMs: number } {
    const startTime = Date.now();
    const entry = this.l1Cache.get(key);

    if (!entry) {
      return { data: null, level: 'L1', latencyMs: Date.now() - startTime };
    }

    if (this.isExpired(entry)) {
      this.l1Cache.delete(key);
      this.metrics.misses++;
      this.metrics.levelStats.L1.misses++;
      return { data: null, level: 'L1', latencyMs: Date.now() - startTime };
    }

    if (guard && !guard(entry.data)) {
      this.metrics.misses++;
      this.metrics.levelStats.L1.misses++;
      return { data: null, level: 'L1', latencyMs: Date.now() - startTime };
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.metrics.hits++;
    this.metrics.levelStats.L1.hits++;

    return { data: entry.data as T, level: 'L1', latencyMs: Date.now() - startTime };
  }

  private async getFromL2<T>(key: string, guard?: (value: unknown) => value is T): Promise<{ data: T | null; level: CacheLevel; latencyMs: number }> {
    const startTime = Date.now();

    if (!this.redisConnected || !this.redisClient) {
      this.metrics.levelStats.L2.misses++;
      return { data: null, level: 'L2', latencyMs: Date.now() - startTime };
    }

    try {
      const prefixedKey = `${this.config.l2.keyPrefix}${key}`;
      const getAsync = (this.redisClient as { getAsync?: (k: string) => Promise<string | null> }).getAsync;
      const getFn = (this.redisClient as { get?: (k: string) => Promise<string | null> }).get;

      let data: string | null = null;
      if (typeof getAsync === 'function') {
        data = await getAsync.call(this.redisClient, prefixedKey);
      } else if (typeof getFn === 'function') {
        data = await getFn.call(this.redisClient, prefixedKey);
      }

      if (!data) {
        this.metrics.levelStats.L2.misses++;
        return { data: null, level: 'L2', latencyMs: Date.now() - startTime };
      }

      let parsedData: unknown;
      try {
        parsedData = JSON.parse(data);
      } catch {
        parsedData = data;
      }

      if (guard && !guard(parsedData)) {
        this.metrics.levelStats.L2.misses++;
        return { data: null, level: 'L2', latencyMs: Date.now() - startTime };
      }

      this.metrics.hits++;
      this.metrics.levelStats.L2.hits++;

      return { data: parsedData as T, level: 'L2', latencyMs: Date.now() - startTime };
    } catch {
      this.metrics.levelStats.L2.misses++;
      return { data: null, level: 'L2', latencyMs: Date.now() - startTime };
    }
  }

  private getFromL3<T>(key: string, guard?: (value: unknown) => value is T): { data: T | null; level: CacheLevel; latencyMs: number } {
    const startTime = Date.now();

    if (!this.db) {
      this.metrics.levelStats.L3.misses++;
      return { data: null, level: 'L3', latencyMs: Date.now() - startTime };
    }

    try {
      const selectSQL = `
        SELECT data, compressed, algorithm, original_size, access_count
        FROM ${this.config.l3.tableName}
        WHERE key = ? AND (timestamp + ttl) > ?
      `;

      const result = this.db.query(selectSQL, [key, Date.now()]);

      if (!result || result.length === 0) {
        this.metrics.levelStats.L3.misses++;
        return { data: null, level: 'L3', latencyMs: Date.now() - startTime };
      }

      const row = result[0] as Record<string, unknown>;
      const compressedData: CompressedData = {
        compressed: new Uint8Array(row.data as ArrayBuffer),
        algorithm: (row.compressed as number) ? (row.algorithm as CompressedData['algorithm']) : 'none',
        originalSize: row.original_size as number,
        compressedSize: (row.data as ArrayBuffer).byteLength,
      };

      const data = this.decompressSync(compressedData);

      if (!data) {
        this.metrics.levelStats.L3.misses++;
        return { data: null, level: 'L3', latencyMs: Date.now() - startTime };
      }

      if (guard && !guard(data)) {
        this.metrics.levelStats.L3.misses++;
        return { data: null, level: 'L3', latencyMs: Date.now() - startTime };
      }

      this.metrics.hits++;
      this.metrics.levelStats.L3.hits++;

      const updateAccessSQL = `
        UPDATE ${this.config.l3.tableName}
        SET access_count = ?, last_accessed = ?
        WHERE key = ?
      `;
      this.db.execute(updateAccessSQL, [(row.access_count as number) + 1, Date.now(), key]);

      return { data: data as T, level: 'L3', latencyMs: Date.now() - startTime };
    } catch {
      this.metrics.levelStats.L3.misses++;
      return { data: null, level: 'L3', latencyMs: Date.now() - startTime };
    }
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl ?? this.config.global.defaultTTL;

    if (this.setInProgress.has(key)) {
      return;
    }

    this.setInProgress.add(key);

    try {
      this.setToL1(key, data, effectiveTTL);
      await this.setToL2(key, data, effectiveTTL);
      this.setToL3(key, data, effectiveTTL);
    } finally {
      this.setInProgress.delete(key);
    }
  }

  private setToL1<T>(key: string, data: T, ttl: number): void {
    if (this.l1Cache.size >= this.config.l1.maxSize && !this.l1Cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
      level: 'L1',
    };

    this.l1Cache.set(key, entry);
    this.metrics.size = this.l1Cache.size;
    this.metrics.levelStats.L1.size = this.l1Cache.size;
  }

  private async setToL2<T>(key: string, data: T, ttl: number): Promise<void> {
    if (!this.redisConnected || !this.redisClient) return;

    try {
      const prefixedKey = `${this.config.l2.keyPrefix}${key}`;
      const serialized = JSON.stringify(data);
      const ttlSeconds = Math.floor(ttl / 1000);

      const setExAsync = (this.redisClient as { setExAsync?: (k: string, t: number, v: string) => Promise<void> }).setExAsync;
      const setexAsync = (this.redisClient as { setexAsync?: (k: string, t: number, v: string) => Promise<void> }).setexAsync;
      const setAsync = (this.redisClient as { setAsync?: (k: string, v: string, ex: string, ttl: number) => Promise<void> }).setAsync;

      if (typeof setExAsync === 'function') {
        await setExAsync.call(this.redisClient, prefixedKey, ttlSeconds, serialized);
      } else if (typeof setexAsync === 'function') {
        await setexAsync.call(this.redisClient, prefixedKey, ttlSeconds, serialized);
      } else if (typeof setAsync === 'function') {
        await setAsync.call(this.redisClient, prefixedKey, serialized, 'EX', ttlSeconds);
      }
    } catch {
    }
  }

  private setToL3<T>(key: string, data: T, ttl: number): void {
    if (!this.db || !this.config.l3.enabled) return;

    try {
      const compressed = this.compressSync(data);

      const upsertSQL = `
        INSERT INTO ${this.config.l3.tableName}
        (key, data, compressed, algorithm, original_size, timestamp, ttl, access_count, last_accessed)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        ON CONFLICT(key) DO UPDATE SET
          data = excluded.data,
          compressed = excluded.compressed,
          algorithm = excluded.algorithm,
          original_size = excluded.original_size,
          timestamp = excluded.timestamp,
          ttl = excluded.ttl,
          last_accessed = excluded.last_accessed
      `;

      this.db.execute(upsertSQL, [
        key,
        compressed.compressed,
        compressed.algorithm !== 'none' ? 1 : 0,
        compressed.algorithm,
        compressed.originalSize,
        Date.now(),
        ttl,
        Date.now(),
      ]);
    } catch {
    }
  }

  async delete(key: string): Promise<boolean> {
    let deleted = false;

    if (this.l1Cache.delete(key)) {
      deleted = true;
    }

    if (this.redisConnected && this.redisClient) {
      try {
        const prefixedKey = `${this.config.l2.keyPrefix}${key}`;
        const delAsync = (this.redisClient as { delAsync?: (k: string) => Promise<number> }).delAsync;
        const deleteAsync = (this.redisClient as { deleteAsync?: (k: string) => Promise<number> }).deleteAsync;

        if (typeof delAsync === 'function') {
          await delAsync.call(this.redisClient, prefixedKey);
        } else if (typeof deleteAsync === 'function') {
          await deleteAsync.call(this.redisClient, prefixedKey);
        }
      } catch {
      }
    }

    if (this.db) {
      try {
        const deleteSQL = `DELETE FROM ${this.config.l3.tableName} WHERE key = ?`;
        this.db.execute(deleteSQL, [key]);
      } catch {
      }
    }

    return deleted;
  }

  async clear(): Promise<void> {
    this.l1Cache.clear();

    if (this.redisConnected && this.redisClient) {
      try {
        const flushDbAsync = (this.redisClient as { flushDbAsync?: () => Promise<void> }).flushDbAsync;
        const flushdbAsync = (this.redisClient as { flushdbAsync?: () => Promise<void> }).flushdbAsync;

        if (typeof flushDbAsync === 'function') {
          await flushDbAsync.call(this.redisClient);
        } else if (typeof flushdbAsync === 'function') {
          await flushdbAsync.call(this.redisClient);
        }
      } catch {
      }
    }

    if (this.db) {
      try {
        const deleteSQL = `DELETE FROM ${this.config.l3.tableName}`;
        this.db.execute(deleteSQL);
      } catch {
      }
    }

    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
      levelStats: {
        L1: { hits: 0, misses: 0, size: 0, hitRate: 0 },
        L2: { hits: 0, misses: 0, size: 0, hitRate: 0 },
        L3: { hits: 0, misses: 0, size: 0, hitRate: 0 },
      },
    };
  }

  async has(key: string): Promise<boolean> {
    const entry = this.l1Cache.get(key);
    if (entry && !this.isExpired(entry)) {
      return true;
    }
    if (entry && this.isExpired(entry)) {
      this.l1Cache.delete(key);
    }
    return false;
  }

  async size(): Promise<number> {
    this.cleanExpiredL1();
    return this.l1Cache.size;
  }

  async getStats(): Promise<CacheMetrics & { entries: Array<{ key: string; size: number; age: number; accessCount: number; }> }> {
    this.cleanExpiredL1();

    const totalHits = this.metrics.hits;
    const totalMisses = this.metrics.misses;

    const updateLevelStats = (level: CacheLevel) => {
      const levelHits = this.metrics.levelStats[level].hits;
      const levelTotal = levelHits + this.metrics.levelStats[level].misses;
      this.metrics.levelStats[level].hitRate = levelTotal > 0 ? levelHits / levelTotal : 0;
    };

    updateLevelStats('L1');
    updateLevelStats('L2');
    updateLevelStats('L3');

    const entries = Array.from(this.l1Cache.entries()).map(([key, entry]) => ({
      key,
      size: this.estimateSize(entry.data),
      age: Date.now() - entry.timestamp,
      accessCount: entry.accessCount,
    }));

    return {
      ...this.metrics,
      size: this.l1Cache.size,
      hitRate: totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0,
      levelStats: this.metrics.levelStats,
      entries,
    };
  }

  async getL2Stats(): Promise<L2CacheStats | null> {
    if (!this.redisConnected || !this.redisClient) return null;

    try {
      const startTime = Date.now();
      const pingAsync = (this.redisClient as { pingAsync?: () => Promise<string> }).pingAsync;

      if (typeof pingAsync === 'function') {
        await pingAsync.call(this.redisClient);
      }

      const pingMs = Date.now() - startTime;

      return {
        connected: this.redisConnected,
        pingMs,
        memoryUsage: 0,
        keyCount: 0,
      };
    } catch {
      return { connected: false, pingMs: 0, memoryUsage: 0, keyCount: 0 };
    }
  }

  async getL3Stats(): Promise<L3CacheStats | null> {
    if (!this.db) return null;

    try {
      const countResult = this.db.query(`SELECT COUNT(*) as count FROM ${this.config.l3.tableName}`);
      const countRow = countResult?.[0] as { count?: number } | undefined;
      const rowCount = countRow?.count ?? 0;

      return { tableSize: 0, rowCount, indexSize: 0 };
    } catch {
      return null;
    }
  }

  async getFullStats(): Promise<MultiLevelCacheStats> {
    const stats = await this.getStats();
    const l2Stats = await this.getL2Stats();
    const l3Stats = await this.getL3Stats();

    return {
      ...stats,
      l2: l2Stats ?? undefined,
      l3: l3Stats ?? undefined,
      compressionRatio: 1,
      totalLatencyMs: 0,
    };
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.l1Cache.delete(lruKey);
      this.metrics.evictions++;
      this.metrics.levelStats.L1.size = this.l1Cache.size;
    }
  }

  private cleanExpiredL1(): void {
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.l1Cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.l1Cache.delete(key));
    this.metrics.size = this.l1Cache.size;
    this.metrics.levelStats.L1.size = this.l1Cache.size;
  }

  private estimateSize(data: unknown): number {
    try {
      const jsonString = JSON.stringify(data);
      return jsonString.length;
    } catch {
      return 0;
    }
  }

  private hashObject(obj: unknown): string {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    let hash = 2166136261;

    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(36);
  }

  async getPattern(patternId: string): Promise<Pattern | null> {
    const result = await this.get<Pattern>(`pattern:${patternId}`, (v): v is Pattern => {
      return isPatternData(v) &&
        'problem' in v &&
        typeof (v as Record<string, unknown>).problem === 'string' &&
        'solution' in v &&
        typeof (v as Record<string, unknown>).solution === 'string';
    });
    return result;
  }

  async setPattern(patternId: string, pattern: Pattern, ttl?: number): Promise<void> {
    await this.set(`pattern:${patternId}`, pattern, ttl);
  }

  async getSearchResults(query: string, options?: Record<string, unknown>): Promise<SearchResult[] | null> {
    const optionsHash = this.hashObject(options ?? {});
    const key = `search:${query}:${optionsHash}`;

    const result = await this.get<SearchResult[]>(key, (v): v is SearchResult[] => {
      return isTypedArray(v, (item): item is SearchResult => {
        return isObject(item) && 'pattern' in item && isPatternData(item.pattern) && 'score' in item && isNumber(item.score);
      });
    });
    return result;
  }

  async setSearchResults(query: string, options: Record<string, unknown>, results: SearchResult[], ttl?: number): Promise<void> {
    const optionsHash = this.hashObject(options || {});
    const key = `search:${query}:${optionsHash}`;
    await this.set(key, results, ttl);
  }

  async getEmbeddings(text: string): Promise<number[] | null> {
    const result = await this.get<number[]>(`embedding:${text}`, (v): v is number[] => Array.isArray(v) && v.every(item => typeof item === 'number'));
    return result;
  }

  async setEmbeddings(text: string, embeddings: number[], ttl?: number): Promise<void> {
    await this.set(`embedding:${text}`, embeddings, ttl);
  }

  async shutdown(): Promise<void> {
    if (this.redisClient) {
      try {
        const quitAsync = (this.redisClient as { quitAsync?: () => Promise<void> }).quitAsync;
        const quit = (this.redisClient as { quit?: () => Promise<void> }).quit;

        if (typeof quitAsync === 'function') {
          await quitAsync.call(this.redisClient);
        } else if (typeof quit === 'function') {
          await quit.call(this.redisClient);
        }
      } catch {
      }
      this.redisConnected = false;
    }
  }
}

export function createMultiLevelCache(
  db?: DatabaseManager,
  telemetry?: TelemetryService,
  config?: Partial<MultiLevelCacheConfig>
): MultiLevelCache {
  return new MultiLevelCache(db, telemetry, config);
}
