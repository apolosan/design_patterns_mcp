/**
 * Multi-Level Cache Types
 * Defines interfaces for L1 (memory), L2 (Redis), and L3 (persistent) cache layers
 * Based on RESEARCH.md Phase 2.2 requirements
 */

import type { Pattern } from '../models/pattern.js';
import type { SearchResult } from '../repositories/interfaces.js';

export type CacheLevel = 'L1' | 'L2' | 'L3';

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  level: CacheLevel;
}

export interface MultiLevelCacheConfig {
  l1: {
    maxSize: number;
    defaultTTL: number;
    enableMetrics: boolean;
  };
  l2: {
    enabled: boolean;
    host?: string;
    port?: number;
    keyPrefix?: string;
    defaultTTL: number;
    maxConnections?: number;
    connectionTimeout?: number;
  };
  l3: {
    enabled: boolean;
    tableName?: string;
    defaultTTL: number;
    maxSize?: number;
  };
  global: {
    defaultTTL: number;
    writeStrategy: 'write-through' | 'write-back';
    telemetryEnabled: boolean;
    compressionEnabled: boolean;
  };
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  levelStats: Record<CacheLevel, {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
  }>;
}

export interface CompressedData {
  compressed: Uint8Array;
  algorithm: 'lz4' | 'zstd' | 'none';
  originalSize: number;
  compressedSize: number;
}

export interface CacheResult<T = unknown> {
  data: T | null;
  level: CacheLevel;
  latencyMs: number;
  fromCache: boolean;
}

export interface TelemetryCacheEvent {
  type: 'cache_hit' | 'cache_miss';
  key: string;
  level: CacheLevel;
  latencyMs: number;
  keyType: 'pattern' | 'search' | 'embedding' | 'generic';
}

export type CacheKeyType = 'pattern' | 'search' | 'embedding' | 'generic';

export function inferKeyType(key: string): CacheKeyType {
  if (key.startsWith('pattern:')) return 'pattern';
  if (key.startsWith('search:')) return 'search';
  if (key.startsWith('embedding:')) return 'embedding';
  return 'generic';
}

export interface PatternCacheEntry {
  patternId: string;
  data: Pattern;
  timestamp: number;
  ttl: number;
}

export interface SearchCacheEntry {
  query: string;
  optionsHash: string;
  data: SearchResult[];
  timestamp: number;
  ttl: number;
}

export interface EmbeddingCacheEntry {
  text: string;
  data: number[];
  timestamp: number;
  ttl: number;
}

export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
  commandTimeout?: number;
}

export interface L2CacheStats {
  connected: boolean;
  pingMs: number;
  memoryUsage: number;
  keyCount: number;
}

export interface L3CacheStats {
  tableSize: number;
  rowCount: number;
  indexSize: number;
}

export interface MultiLevelCacheStats extends CacheMetrics {
  l2?: L2CacheStats;
  l3?: L3CacheStats;
  compressionRatio: number;
  totalLatencyMs: number;
}
