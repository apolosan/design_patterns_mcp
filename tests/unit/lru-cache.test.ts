import { describe, test, expect, vi } from 'vitest';
import {
  LRUCache,
  TTLLRUCache,
  MultiLRUCache,
  createLRUCache,
} from '../../src/utils/lru-cache';

describe('LRUCache', () => {
  describe('basic operations', () => {
    test('stores and retrieves values', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 });

      cache.set('a', 1);
      cache.set('b', 2);

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
    });

    test('returns undefined for missing keys', () => {
      const cache = new LRUCache<string, number>();

      expect(cache.get('missing')).toBeUndefined();
    });

    test('has() returns true for existing keys', () => {
      const cache = new LRUCache<string, string>();

      cache.set('key', 'value');

      expect(cache.has('key')).toBe(true);
      expect(cache.has('missing')).toBe(false);
    });

    test('delete() removes values', () => {
      const cache = new LRUCache<string, number>();

      cache.set('key', 42);
      expect(cache.delete('key')).toBe(true);
      expect(cache.get('key')).toBeUndefined();
      expect(cache.delete('key')).toBe(false);
    });

    test('clear() removes all values', () => {
      const cache = new LRUCache<string, number>();

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      expect(cache.size).toBe(3);

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });
  });

  describe('maxSize eviction', () => {
    test('evicts oldest when size exceeds maxSize', () => {
      const evicted: [string, number][] = [];
      const cache = new LRUCache<string, number>({ 
        maxSize: 3,
        onEvict: (k, v) => evicted.push([k, v])
      });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);

      expect(cache.size).toBe(3);
      expect(evicted).toEqual([['a', 1]]);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    test('evicts oldest on set with existing key', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('a', 10);
      cache.set('d', 4);

      expect(cache.size).toBe(3);
      expect(cache.get('b')).toBeUndefined();
    });

    test('eviction maintains order', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);

      expect(cache.getKeys()).toContain('b');
      expect(cache.getKeys()).toContain('c');
      expect(cache.getKeys()).toContain('d');
      expect(cache.getKeys()).not.toContain('a');
    });
  });

  describe('TTL expiration', () => {
    test('entries expire after TTL', () => {
      const cache = new LRUCache<string, number>({ ttl: 100 });

      cache.set('key', 42);
      expect(cache.has('key')).toBe(true);

      const start = Date.now();
      while (Date.now() - start < 150) {}

      expect(cache.has('key')).toBe(false);
    });

    test('removeExpired() removes expired entries', () => {
      const cache = new LRUCache<string, number>({ ttl: 50 });

      cache.set('a', 1);
      cache.set('b', 2);

      const start = Date.now();
      while (Date.now() - start < 100) {}

      const removed = cache.removeExpired();

      expect(removed).toBe(2);
      expect(cache.size).toBe(0);
    });
  });

  describe('getOrSet', () => {
    test('returns existing value without calling factory', () => {
      const factory = vi.fn().mockReturnValue(42);
      const cache = new LRUCache<string, number>();

      cache.set('key', 1);

      const result = cache.getOrSet('key', factory);

      expect(result).toBe(1);
      expect(factory).not.toHaveBeenCalled();
    });

    test('calls factory when key is missing', () => {
      const factory = vi.fn().mockReturnValue(42);
      const cache = new LRUCache<string, number>();

      const result = cache.getOrSet('key', factory);

      expect(result).toBe(42);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    test('getOrSetAsync works with promises', async () => {
      const cache = new LRUCache<string, number>();

      const result = await cache.getOrSetAsync('key', async () => 42);

      expect(result).toBe(42);
    });
  });

  describe('stats', () => {
    test('tracks hits and misses', () => {
      const cache = new LRUCache<string, number>();

      cache.set('a', 1);
      cache.get('a');
      cache.get('b');
      cache.get('a');

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    test('tracks evictions', () => {
      const cache = new LRUCache<string, number>({ maxSize: 2 });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);

      const stats = cache.getStats();

      expect(stats.evictions).toBe(2);
    });

    test('resetStats() clears stats', () => {
      const cache = new LRUCache<string, number>();

      cache.set('a', 1);
      cache.get('a');
      cache.get('b');

      cache.resetStats();

      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });
  });

  describe('utility methods', () => {
    test('getKeys() returns all keys', () => {
      const cache = new LRUCache<string, number>();

      cache.set('a', 1);
      cache.set('b', 2);

      expect(cache.getKeys()).toEqual(['a', 'b']);
    });

    test('getValues() returns all values', () => {
      const cache = new LRUCache<string, number>();

      cache.set('a', 1);
      cache.set('b', 2);

      expect(cache.getValues()).toEqual([1, 2]);
    });

    test('getEntries() returns key-value pairs', () => {
      const cache = new LRUCache<string, number>();

      cache.set('a', 1);
      cache.set('b', 2);

      const entries = cache.getEntries();
      expect(entries.length).toBe(2);
    });

    test('evictOldestMultiple() removes multiple entries', () => {
      const evicted: [string, number][] = [];
      const cache = new LRUCache<string, number>({ 
        maxSize: 3,
        onEvict: (k, v) => evicted.push([k, v])
      });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);
      cache.set('e', 5);

      expect(cache.size).toBe(3);
      expect(evicted.length).toBe(2);

      cache.evictOldestMultiple(1);

      expect(cache.size).toBe(2);
      expect(evicted.length).toBe(3);
    });
  });
});

describe('TTLLRUCache', () => {
  test('creates cache with maxSize and ttl', () => {
    const cache = new TTLLRUCache<string, number>(5, 1000);

    cache.set('key', 42);

    expect(cache.get('key')).toBe(42);
  });
});

describe('MultiLRUCache', () => {
  test('creates and manages multiple caches', () => {
    interface CacheValue {
      data: string;
    }
    const manager = new MultiLRUCache<string, CacheValue>();

    const cache1 = manager.createCache('users', { maxSize: 100 });
    const cache2 = manager.createCache('sessions', { maxSize: 50 });

    cache1.set('user1', { data: 'John' });
    cache2.set('session1', { data: 'abc' });

    expect(manager.getCache('users')?.get('user1')).toEqual({ data: 'John' });
    expect(manager.getCache('sessions')?.get('session1')).toEqual({ data: 'abc' });
  });

  test('getOrCreate returns existing cache', () => {
    const manager = new MultiLRUCache<string, number>();

    const cache1 = manager.getOrCreate('test', { maxSize: 10 });
    const cache2 = manager.getOrCreate('test', { maxSize: 20 });

    expect(cache1).toBe(cache2);
  });

  test('deleteCache removes cache', () => {
    const manager = new MultiLRUCache<string, number>();

    manager.createCache('test', { maxSize: 10 });
    expect(manager.deleteCache('test')).toBe(true);
    expect(manager.deleteCache('test')).toBe(false);
  });

  test('getAllStats returns stats for all caches', () => {
    const manager = new MultiLRUCache<string, number>();

    manager.createCache('cache1', { maxSize: 10 });
    manager.createCache('cache2', { maxSize: 20 });

    const stats = manager.getAllStats();

    expect(stats.cache1).toBeDefined();
    expect(stats.cache2).toBeDefined();
  });
});

describe('factory function', () => {
  test('createLRUCache creates cache', () => {
    const cache = createLRUCache<string, number>({ maxSize: 50 });

    expect(cache).toBeInstanceOf(LRUCache);
    expect(cache.maxSize).toBe(50);
  });
});
