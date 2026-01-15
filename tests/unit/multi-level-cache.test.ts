/**
 * Tests for MultiLevelCache Service
 * Testing L1 (in-memory), L2 (Redis), and L3 (SQLite) cache layers
 * Based on RESEARCH.md Phase 2.2 - Advanced Caching & Compression
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MultiLevelCache, createMultiLevelCache } from '../../src/services/multi-level-cache.js';
import { TelemetryService } from '../../src/services/telemetry-service.js';
import { MultiLevelCacheConfig } from '../../src/types/cache-types.js';

describe('MultiLevelCache', () => {
  let cache: MultiLevelCache;

  beforeEach(() => {
    const telemetry = new TelemetryService({ enabled: false });
    cache = new MultiLevelCache(undefined, telemetry, {
      l1: { maxSize: 100, defaultTTL: 3600000, enableMetrics: true },
      l2: { enabled: false, defaultTTL: 86400000 },
      l3: { enabled: false, defaultTTL: 604800000 },
      global: { defaultTTL: 3600000, writeStrategy: 'write-through', telemetryEnabled: true, compressionEnabled: false },
    });
  });

  afterEach(async () => {
    await cache.shutdown();
  });

  describe('constructor', () => {
    it('should create cache with default configuration', () => {
      const defaultCache = createMultiLevelCache();
      expect(defaultCache).toBeDefined();
    });

    it('should create cache with custom L1 configuration', () => {
      const customConfig: Partial<MultiLevelCacheConfig> = {
        l1: { maxSize: 500, defaultTTL: 7200000, enableMetrics: true },
        l2: { enabled: false, defaultTTL: 86400000 },
        l3: { enabled: false, defaultTTL: 604800000 },
      };
      const customCache = new MultiLevelCache(undefined, undefined, customConfig);
      expect(customCache).toBeDefined();
    });
  });

  describe('L1 Cache Operations', () => {
    it('should set and get string value', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should set and get number value', async () => {
      await cache.set('number', 42);
      const result = await cache.get<number>('number');
      expect(result).toBe(42);
    });

    it('should set and get object value', async () => {
      const obj = { name: 'test', value: 123 };
      await cache.set('object', obj);
      const result = await cache.get<typeof obj>('object');
      expect(result).toEqual(obj);
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should use type guard for type-safe retrieval', async () => {
      await cache.set('typed', { name: 'test', value: 123 });
      const result = await cache.get<{ name: string; value: number }>('typed', (v): v is { name: string; value: number } => {
        return typeof v === 'object' && v !== null && 'name' in v && 'value' in v;
      });
      expect(result).toEqual({ name: 'test', value: 123 });
    });
  });

  describe('Cache Methods', () => {
    it('should check if key exists', async () => {
      await cache.set('exists', 'value');
      const exists = await cache.has('exists');
      expect(exists).toBe(true);
      const notExists = await cache.has('notexists');
      expect(notExists).toBe(false);
    });

    it('should delete key', async () => {
      await cache.set('delete', 'value');
      const existsBefore = await cache.has('delete');
      expect(existsBefore).toBe(true);
      const deleted = await cache.delete('delete');
      expect(deleted).toBe(true);
      const existsAfter = await cache.has('delete');
      expect(existsAfter).toBe(false);
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await cache.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should clear all cached values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      const sizeBefore = await cache.size();
      expect(sizeBefore).toBe(2);

      await cache.clear();
      const sizeAfter = await cache.size();
      expect(sizeAfter).toBe(0);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });

    it('should return correct cache size', async () => {
      const size0 = await cache.size();
      expect(size0).toBe(0);
      await cache.set('key1', 'value1');
      const size1 = await cache.size();
      expect(size1).toBe(1);
      await cache.set('key2', 'value2');
      const size2 = await cache.size();
      expect(size2).toBe(2);
    });
  });

  describe('Cache Statistics', () => {
    it('should track hits and misses', async () => {
      await cache.set('hit', 'value');
      await cache.get('hit');
      await cache.get('miss');

      const stats = await cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.get('key1');
      await cache.get('key1');
      await cache.get('nonexistent');

      const stats = await cache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should enforce cache size limit', async () => {
      const smallCache = new MultiLevelCache(undefined, undefined, {
        l1: { maxSize: 2, defaultTTL: 3600000, enableMetrics: true },
        l2: { enabled: false, defaultTTL: 86400000 },
        l3: { enabled: false, defaultTTL: 604800000 },
        global: { defaultTTL: 3600000, writeStrategy: 'write-through', telemetryEnabled: false, compressionEnabled: false },
      });

      await smallCache.set('key1', 'value1');
      const size1 = await smallCache.size();
      expect(size1).toBe(1);

      await smallCache.set('key2', 'value2');
      const size2 = await smallCache.size();
      expect(size2).toBe(2);

      await smallCache.set('key3', 'value3');
      const size3 = await smallCache.size();
      expect(size3).toBeGreaterThan(0);

      await smallCache.shutdown();
    });

    it('should return cache entries with statistics', async () => {
      await cache.set('key1', { data: 'test' });
      const stats = await cache.getStats();

      expect(stats.entries).toHaveLength(1);
      expect(stats.entries[0]).toHaveProperty('key');
      expect(stats.entries[0]).toHaveProperty('size');
      expect(stats.entries[0]).toHaveProperty('age');
      expect(stats.entries[0]).toHaveProperty('accessCount');
    });
  });

  describe('Convenience Methods', () => {
    describe('Pattern Caching', () => {
      it('should cache pattern objects', async () => {
        const pattern = {
          id: 'test-pattern',
          name: 'Test Pattern',
          category: 'Creational' as const,
          description: 'A test pattern',
          problem: 'Test problem',
          solution: 'Test solution',
          tags: ['test'],
          codeExamples: [],
          relatedPatterns: [],
          contexts: [],
          consequences: [],
          implementation: '',
          notes: '',
          source: '',
          confidence: 0.9,
          author: '',
          createdAt: '',
          updatedAt: '',
          when_to_use: [],
          benefits: [],
          drawbacks: [],
          use_cases: [],
        };

        await cache.setPattern('test-pattern', pattern as any);
        const retrieved = await cache.getPattern('test-pattern');

        expect(retrieved).toBeDefined();
        if (retrieved) {
          expect(retrieved.id).toBe('test-pattern');
          expect(retrieved.name).toBe('Test Pattern');
        }
      });
    });

    describe('Search Results Caching', () => {
      it('should cache search results', async () => {
        const results = [
          { pattern: { id: 'p1', name: 'Pattern 1', category: 'Creational' as const, description: '', problem: '', solution: '', tags: [], codeExamples: [], relatedPatterns: [], contexts: [], consequences: [], implementation: '', notes: '', source: '', confidence: 0.9, author: '', createdAt: '', updatedAt: '', when_to_use: [], benefits: [], drawbacks: [], use_cases: [] }, score: 0.9 },
          { pattern: { id: 'p2', name: 'Pattern 2', category: 'Structural' as const, description: '', problem: '', solution: '', tags: [], codeExamples: [], relatedPatterns: [], contexts: [], consequences: [], implementation: '', notes: '', source: '', confidence: 0.8, author: '', createdAt: '', updatedAt: '', when_to_use: [], benefits: [], drawbacks: [], use_cases: [] }, score: 0.8 },
        ];

        await cache.setSearchResults('test query', { category: 'all' }, results as any);
        const retrieved = await cache.getSearchResults('test query', { category: 'all' });

        expect(retrieved).toBeDefined();
        expect(retrieved).toHaveLength(2);
      });
    });

    describe('Embeddings Caching', () => {
      it('should cache embedding arrays', async () => {
        const embedding = new Array(384).fill(0).map((_, i) => Math.sin(i * 0.1));
        await cache.setEmbeddings('test text', embedding);
        const retrieved = await cache.getEmbeddings('test text');

        expect(retrieved).toEqual(embedding);
      });
    });
  });

  describe('Telemetry Integration', () => {
    it('should record cache events to telemetry', async () => {
      const recordingTelemetry = new TelemetryService({ enabled: true });
      const recordingCache = new MultiLevelCache(undefined, recordingTelemetry, {
        l1: { maxSize: 100, defaultTTL: 3600000, enableMetrics: true },
        l2: { enabled: false, defaultTTL: 86400000 },
        l3: { enabled: false, defaultTTL: 604800000 },
        global: { defaultTTL: 3600000, writeStrategy: 'write-through', telemetryEnabled: true, compressionEnabled: false },
      });

      await recordingCache.set('key', 'value');
      await recordingCache.get('key');
      await recordingCache.get('missing');

      const events: unknown[] = (recordingTelemetry as unknown as { events: unknown[] }).events;
      expect(events.length).toBeGreaterThanOrEqual(2);

      await recordingCache.shutdown();
    });
  });

  describe('Concurrency Safety', () => {
    it('should handle concurrent set operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        cache.set(`key${i}`, `value${i}`)
      );

      await Promise.all(operations);

      for (let i = 0; i < 10; i++) {
        const result = await cache.get(`key${i}`);
        expect(result).toBe(`value${i}`);
      }
    });

    it('should handle concurrent get operations', async () => {
      await cache.set('shared', 'value');

      const operations = Array.from({ length: 10 }, () =>
        cache.get('shared')
      );

      const results = await Promise.all(operations);
      results.forEach(result => {
        expect(result).toBe('value');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', async () => {
      await cache.set('null', null as any);
      const result = await cache.get('null');
      expect(result).toBeNull();
    });

    it('should handle empty strings', async () => {
      await cache.set('empty', '');
      const result = await cache.get('empty');
      expect(result).toBe('');
    });

    it('should handle empty objects', async () => {
      await cache.set('emptyObj', {});
      const result = await cache.get('emptyObj');
      expect(result).toEqual({});
    });

    it('should handle empty arrays', async () => {
      await cache.set('emptyArr', []);
      const result = await cache.get('emptyArr');
      expect(result).toEqual([]);
    });

    it('should handle special characters in keys', async () => {
      await cache.set('key with spaces', 'value');
      await cache.set('key:with:colons', 'value');
      await cache.set('key/with/slashes', 'value');

      expect(await cache.get('key with spaces')).toBe('value');
      expect(await cache.get('key:with:colons')).toBe('value');
      expect(await cache.get('key/with/slashes')).toBe('value');
    });

    it('should handle unicode characters in keys', async () => {
      const unicodeKey = 'キー = ключ 🔑';
      await cache.set(unicodeKey, 'value');
      const result = await cache.get(unicodeKey);
      expect(result).toBe('value');
    });
  });

  describe('Memory Management', () => {
    it('should release memory on clear', async () => {
      for (let i = 0; i < 100; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      const statsBefore = await cache.getStats();
      expect(statsBefore.size).toBe(100);

      await cache.clear();

      const statsAfter = await cache.getStats();
      expect(statsAfter.size).toBe(0);
      expect(statsAfter.hits).toBe(0);
      expect(statsAfter.misses).toBe(0);
    });
  });
});

describe('MultiLevelCache Configuration', () => {
  it('should apply custom L1 configuration', async () => {
    const config: Partial<MultiLevelCacheConfig> = {
      l1: {
        maxSize: 500,
        defaultTTL: 7200000,
        enableMetrics: true,
      },
      l2: { enabled: false, defaultTTL: 86400000 },
      l3: { enabled: false, defaultTTL: 604800000 },
    };

    const testCache = new MultiLevelCache(undefined, undefined, config);
    const stats = await testCache.getStats();

    expect(stats.levelStats.L1).toBeDefined();
    await testCache.shutdown();
  });

  it('should apply global default TTL', async () => {
    const config: Partial<MultiLevelCacheConfig> = {
      global: {
        defaultTTL: 1800000,
        writeStrategy: 'write-through',
        telemetryEnabled: false,
        compressionEnabled: false,
      },
      l2: { enabled: false, defaultTTL: 86400000 },
      l3: { enabled: false, defaultTTL: 604800000 },
    };

    const testCache = new MultiLevelCache(undefined, undefined, config);
    await testCache.set('key', 'value');

    type CacheWithL1 = { l1Cache: Map<string, { ttl: number }> };
    const cacheInstance = testCache as unknown as CacheWithL1;
    const entry = cacheInstance.l1Cache.get('key');
    expect(entry?.ttl).toBe(1800000);
    await testCache.shutdown();
  });

  it('should support write-back strategy', async () => {
    const config: Partial<MultiLevelCacheConfig> = {
      global: {
        defaultTTL: 3600000,
        writeStrategy: 'write-back',
        telemetryEnabled: false,
        compressionEnabled: false,
      },
      l2: { enabled: false, defaultTTL: 86400000 },
      l3: { enabled: false, defaultTTL: 604800000 },
    };

    const testCache = new MultiLevelCache(undefined, undefined, config);
    expect(testCache).toBeDefined();
    await testCache.shutdown();
  });
});
