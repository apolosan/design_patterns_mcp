/**
 * Request Coalescer Tests
 * Tests for concurrent request deduplication (coalescing)
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  RequestCoalescer,
  createRequestCoalescer,
} from '../../src/utils/request-coalescer.js';

describe('RequestCoalescer', () => {
  let coalescer: RequestCoalescer<string>;

  beforeEach(() => {
    coalescer = new RequestCoalescer<string>({
      ttlMs: 1000,
      maxSize: 10,
    });
  });

  test('executes fetcher on first request', async () => {
    const fetcher = vi.fn().mockResolvedValue('result');

    const result = await coalescer.execute('key1', fetcher);

    expect(result).toBe('result');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('returns cached promise for concurrent duplicate requests', async () => {
    const fetcher = vi.fn().mockResolvedValue('shared-result');

    const [result1, result2, result3] = await Promise.all([
      coalescer.execute('key1', fetcher),
      coalescer.execute('key1', fetcher),
      coalescer.execute('key1', fetcher),
    ]);

    expect(result1).toBe('shared-result');
    expect(result2).toBe('shared-result');
    expect(result3).toBe('shared-result');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('handles different keys separately', async () => {
    const fetcher1 = vi.fn().mockResolvedValue('result1');
    const fetcher2 = vi.fn().mockResolvedValue('result2');

    const [result1, result2] = await Promise.all([
      coalescer.execute('key1', fetcher1),
      coalescer.execute('key2', fetcher2),
    ]);

    expect(result1).toBe('result1');
    expect(result2).toBe('result2');
    expect(fetcher1).toHaveBeenCalledTimes(1);
    expect(fetcher2).toHaveBeenCalledTimes(1);
  });

  test('handles concurrent mixed requests with duplicates', async () => {
    const fetcher1 = vi.fn().mockResolvedValue('result1');
    const fetcher2 = vi.fn().mockResolvedValue('result2');

    const [r1, r2, r3, r4] = await Promise.all([
      coalescer.execute('key1', fetcher1),
      coalescer.execute('key1', fetcher1),
      coalescer.execute('key2', fetcher2),
      coalescer.execute('key2', fetcher2),
    ]);

    expect(r1).toBe('result1');
    expect(r2).toBe('result1');
    expect(r3).toBe('result2');
    expect(r4).toBe('result2');
    expect(fetcher1).toHaveBeenCalledTimes(1);
    expect(fetcher2).toHaveBeenCalledTimes(1);
  });

  test('handles errors correctly', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('test-error'));

    const results = await Promise.allSettled([
      coalescer.execute('key1', fetcher),
      coalescer.execute('key1', fetcher),
    ]);

    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('tracks stats correctly for concurrent requests', async () => {
    const fetcher = vi.fn().mockResolvedValue('result');

    await Promise.all([
      coalescer.execute('key1', fetcher),
      coalescer.execute('key1', fetcher),
      coalescer.execute('key2', fetcher),
      coalescer.execute('key2', fetcher),
    ]);

    const stats = coalescer.getStats();

    expect(stats.totalRequests).toBe(4);
    expect(stats.deduplicated).toBe(2);
    expect(stats.cacheHitRate).toBe(0.5);
  });

  test('evicts oldest when cache is full', async () => {
    const smallCoalescer = new RequestCoalescer<string>({
      ttlMs: 1000,
      maxSize: 3,
    });

    const fetcher = vi.fn().mockResolvedValue('result');

    const promises: Promise<string>[] = [];
    for (let i = 0; i < 5; i++) {
      promises.push(smallCoalescer.execute(`key${i}`, fetcher));
    }
    await Promise.all(promises);

    expect(smallCoalescer.getStats().cacheSize).toBeLessThanOrEqual(3);
  });

  test('clears stats without clearing pending requests', async () => {
    let resolveFetcher: () => void;
    const fetcherPromise = new Promise<string>((resolve) => {
      resolveFetcher = () => resolve('result');
    });
    const fetcher = vi.fn().mockImplementation(() => fetcherPromise);

    const p1 = coalescer.execute('key1', fetcher);
    const p2 = coalescer.execute('key1', fetcher);

    coalescer.clearStats();

    const stats = coalescer.getStats();

    expect(stats.totalRequests).toBe(0);
    expect(stats.deduplicated).toBe(0);
    expect(coalescer.getActiveKeys()).toContain('key1');

    resolveFetcher!();
    await Promise.all([p1, p2]);
  });

  test('clears all data', async () => {
    const fetcher = vi.fn().mockResolvedValue('result');

    await coalescer.execute('key1', fetcher);
    await coalescer.execute('key2', fetcher);

    coalescer.clear();

    expect(coalescer.getStats().cacheSize).toBe(0);
    expect(coalescer.getActiveKeys()).toEqual([]);
  });

  test('returns correct active keys during execution', async () => {
    let resolveP1: () => void;
    const p1Promise = new Promise<string>((resolve) => {
      resolveP1 = () => resolve('result1');
    });
    const fetcher1 = vi.fn().mockImplementation(() => p1Promise);

    const p1 = coalescer.execute('key1', fetcher1);
    const p2 = coalescer.execute('key1', fetcher1);

    expect(coalescer.getActiveKeys()).toContain('key1');
    expect(coalescer.getActiveKeys().length).toBe(1);

    resolveP1!();
    await Promise.all([p1, p2]);
  });

  test('factory function creates coalescer', () => {
    const factoryCoalescer = createRequestCoalescer<string>({
      ttlMs: 2000,
      maxSize: 500,
    });

    expect(factoryCoalescer).toBeInstanceOf(RequestCoalescer);
  });

  test('handles various key types', async () => {
    const fetcher = vi.fn().mockResolvedValue('result');

    const promises: Promise<string>[] = [];
    const keys = [
      'simple-key',
      'key:with:colons',
      'key/with/slashes',
      'key.with.dots',
      'key-with-dashes',
      'KEY_UPPER_CASE',
      'key123withnumbers',
    ];

    for (const key of keys) {
      promises.push(coalescer.execute(key, fetcher));
    }
    await Promise.all(promises);

    expect(coalescer.getStats().totalRequests).toBe(7);
  });

  test('prevents duplicate work under high concurrency', async () => {
    let callCount = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'computed';
    });

    const promises: Promise<string>[] = [];

    for (let i = 0; i < 10; i++) {
      promises.push(coalescer.execute('concurrent-key', fetcher));
    }

    const results = await Promise.all(promises);

    expect(callCount).toBe(1);
    expect(results.every(r => r === 'computed')).toBe(true);
  });

  test('multiple concurrent groups to same key are independent', async () => {
    const callCount = vi.fn().mockResolvedValue('result');

    await coalescer.execute('key1', callCount);
    await coalescer.execute('key1', callCount);

    expect(callCount).toHaveBeenCalledTimes(2);
  });

  test('tracks high deduplication rate correctly', async () => {
    const fetcher = vi.fn().mockResolvedValue('shared');

    await Promise.all([
      coalescer.execute('dup', fetcher),
      coalescer.execute('dup', fetcher),
      coalescer.execute('dup', fetcher),
      coalescer.execute('dup', fetcher),
      coalescer.execute('dup', fetcher),
      coalescer.execute('dup', fetcher),
      coalescer.execute('dup', fetcher),
      coalescer.execute('dup', fetcher),
      coalescer.execute('dup', fetcher),
      coalescer.execute('dup', fetcher),
    ]);

    const stats = coalescer.getStats();

    expect(stats.totalRequests).toBe(10);
    expect(stats.deduplicated).toBe(9);
    expect(stats.cacheHitRate).toBe(0.9);
  });
});
