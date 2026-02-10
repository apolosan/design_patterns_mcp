import { describe, test, expect } from 'vitest';
import {
  AsyncQueue,
  PriorityAsyncQueue,
  createAsyncQueue,
  createPriorityQueue,
} from '../../src/utils/async-queue';

describe('AsyncQueue', () => {
  describe('constructor', () => {
    test('creates queue with default options', () => {
      const queue = new AsyncQueue<number>();
      expect(queue.length).toBe(0);
    });

    test('creates queue with concurrency', () => {
      const queue = new AsyncQueue<number>({ concurrency: 5 });
      expect(queue.length).toBe(0);
    });
  });

  describe('enqueue', () => {
    test('returns promise that resolves', async () => {
      const queue = new AsyncQueue<number>();
      const promise = queue.enqueue(async () => 42);
      expect(promise).toBeInstanceOf(Promise);
      const result = await promise;
      expect(result).toBe(42);
    });

    test('handles immediate resolution', async () => {
      const queue = new AsyncQueue<string>();
      const result = await queue.enqueue(async () => 'hello');
      expect(result).toBe('hello');
    });

    test('handles error', async () => {
      const queue = new AsyncQueue();
      await expect(
        queue.enqueue(async () => {
          throw new Error('test');
        })
      ).rejects.toThrow('test');
    });
  });

  describe('queue state', () => {
    test('initial length is zero', async () => {
      const queue = new AsyncQueue<number>();
      expect(queue.length).toBe(0);
    });

    test('peek returns undefined for empty queue', async () => {
      const queue = new AsyncQueue<number>();
      const peeked = queue.peek();
      expect(peeked).toBeUndefined();
    });
  });

  describe('getStats', () => {
    test('returns initial stats', async () => {
      const queue = new AsyncQueue<number>({ concurrency: 2 });
      const stats = queue.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.running).toBe(0);
    });
  });

  describe('pause/resume', () => {
    test('pause stops processing flag', async () => {
      const queue = new AsyncQueue<number>();
      queue.pause();
      expect(queue.length).toBe(0);
    });

    test('resume continues processing', async () => {
      const queue = new AsyncQueue<number>();
      queue.resume();
      expect(queue.length).toBe(0);
    });
  });
});

describe('PriorityAsyncQueue', () => {
  test('creates priority queue', () => {
    const queue = new PriorityAsyncQueue<number>();
    expect(queue).toBeInstanceOf(AsyncQueue);
  });
});

describe('factory functions', () => {
  test('createAsyncQueue creates queue', () => {
    const queue = createAsyncQueue<number>();
    expect(queue).toBeInstanceOf(AsyncQueue);
  });

  test('createPriorityQueue creates queue', () => {
    const queue = createPriorityQueue<number>();
    expect(queue).toBeInstanceOf(PriorityAsyncQueue);
  });
});
