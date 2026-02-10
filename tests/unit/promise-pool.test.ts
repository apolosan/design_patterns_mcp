import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromisePool, createPromisePool } from '../../src/utils/promise-pool.js';

describe('PromisePool', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    test('should create pool with default concurrency', () => {
      const pool = new PromisePool();
      expect(pool.getConcurrency()).toBe(10);
    });

    test('should create pool with custom concurrency', () => {
      const pool = new PromisePool({ concurrency: 5 });
      expect(pool.getConcurrency()).toBe(5);
    });

    test('should create pool with custom timeout', () => {
      const pool = new PromisePool({ timeout: 60000 });
      expect(pool).toBeDefined();
    });

    test('should enforce minimum concurrency of 1', () => {
      const pool = new PromisePool({ concurrency: 0 });
      expect(pool.getConcurrency()).toBe(1);
    });
  });

  describe('add', () => {
    test('should execute promise immediately when under concurrency limit', async () => {
      const pool = new PromisePool({ concurrency: 2 });
      const fn = vi.fn().mockResolvedValue('result');

      const result = await pool.add(fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should queue promise when at concurrency limit', async () => {
      const pool = new PromisePool({ concurrency: 1 });
      const executionOrder: string[] = [];

      const fn1 = vi.fn().mockImplementation(async () => {
        executionOrder.push('fn1-start');
        await new Promise((resolve) => setTimeout(resolve, 100));
        executionOrder.push('fn1-end');
        return 'result1';
      });

      const fn2 = vi.fn().mockResolvedValue('result2');

      const promise1 = pool.add(fn1);
      const promise2 = pool.add(fn2);

      expect(pool.getActiveCount()).toBe(1);
      expect(pool.getQueueSize()).toBe(1);

      await promise1;
      await promise2;

      expect(executionOrder).toEqual(['fn1-start', 'fn1-end']);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    test('should reject on promise error', async () => {
      const pool = new PromisePool();
      const error = new Error('test error');

      await expect(pool.add(() => Promise.reject(error))).rejects.toThrow('test error');
    });
  });

  describe('runAll', () => {
    test('should execute all tasks with default concurrency', async () => {
      const pool = new PromisePool();
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        () => Promise.resolve(3),
      ];

      const result = await pool.runAll(tasks);

      expect(result.results).toEqual([1, 2, 3]);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    test('should collect errors without failing entire run', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error('error at index 1')),
        () => Promise.resolve(3),
      ];

      const pool = new PromisePool();
      const result = await pool.runAll(tasks);

      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
      expect(result.errors[0].error).toBeInstanceOf(Error);
      expect((result.errors[0].error as Error).message).toBe('error at index 1');
    });

    test('should respect custom concurrency in runAll', async () => {
      const executionOrder: string[] = [];
      const concurrency = 2;

      const createTask = (name: string): (() => Promise<number>) => {
        return vi.fn().mockImplementation(async () => {
          executionOrder.push(`${name}-start`);
          await Promise.resolve();
          executionOrder.push(`${name}-end`);
          return 1;
        });
      };

      const tasks = [createTask('task1'), createTask('task2'), createTask('task3')];

      const pool = new PromisePool({ concurrency });
      const result = await pool.runAll(tasks);

      expect(result.results).toHaveLength(3);
      expect(executionOrder[0]).toBe('task1-start');
      expect(executionOrder[1]).toBe('task2-start');
    });

    test('should return duration of execution', async () => {
      const tasks = [() => Promise.resolve('done')];

      const pool = new PromisePool();
      const result = await pool.runAll(tasks);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getActiveCount', () => {
    test('should return 0 for idle pool', () => {
      const pool = new PromisePool();
      expect(pool.getActiveCount()).toBe(0);
    });

    test('should return correct count during execution', async () => {
      const pool = new PromisePool({ concurrency: 2 });

      const promise1 = pool.add(vi.fn().mockResolvedValue('result1'));
      expect(pool.getActiveCount()).toBe(1);

      const promise2 = pool.add(vi.fn().mockResolvedValue('result2'));
      expect(pool.getActiveCount()).toBe(2);

      await Promise.all([promise1, promise2]);
      expect(pool.getActiveCount()).toBe(0);
    });
  });

  describe('getQueueSize', () => {
    test('should return 0 for empty queue', () => {
      const pool = new PromisePool();
      expect(pool.getQueueSize()).toBe(0);
    });

    test('should return correct queue size', async () => {
      const pool = new PromisePool({ concurrency: 1 });
      let resolveFirst!: (value?: unknown) => void;

      const promise1 = pool.add(
        vi.fn().mockImplementation(() => new Promise((r) => (resolveFirst = r)))
      );
      const promise2 = pool.add(vi.fn().mockResolvedValue('result2'));

      expect(pool.getQueueSize()).toBe(1);

      resolveFirst();
      await promise1;
      await promise2;

      expect(pool.getQueueSize()).toBe(0);
    });
  });

  describe('setConcurrency', () => {
    test('should update concurrency value', () => {
      const pool = new PromisePool({ concurrency: 5 });
      expect(pool.getConcurrency()).toBe(5);

      pool.setConcurrency(10);
      expect(pool.getConcurrency()).toBe(10);
    });

    test('should enforce minimum concurrency', () => {
      const pool = new PromisePool({ concurrency: 5 });
      pool.setConcurrency(0);
      expect(pool.getConcurrency()).toBe(1);
    });
  });

  describe('createPromisePool factory', () => {
    test('should create pool with options', () => {
      const pool = createPromisePool<number>({ concurrency: 3, timeout: 5000 });
      expect(pool.getConcurrency()).toBe(3);
    });

    test('should work with type parameter', async () => {
      const pool = createPromisePool<string>({ concurrency: 2 });
      const result = await pool.add(() => Promise.resolve('test'));
      expect(result).toBe('test');
    });
  });
});
