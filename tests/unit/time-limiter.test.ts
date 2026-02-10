import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimeLimiter, createTimeLimiter } from '../../src/utils/time-limiter.js';

describe('TimeLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    test('should create with default options', () => {
      const limiter = new TimeLimiter();
      expect(limiter).toBeDefined();
    });

    test('should create with custom default timeout', () => {
      const limiter = new TimeLimiter({ defaultTimeout: 60000 });
      expect(limiter).toBeDefined();
    });

    test('should create with custom default error message', () => {
      const limiter = new TimeLimiter({ defaultErrorMessage: 'Custom timeout' });
      expect(limiter).toBeDefined();
    });
  });

  describe('execute with Promise', () => {
    test('should return value when promise resolves within timeout', async () => {
      const limiter = new TimeLimiter({ defaultTimeout: 1000 });
      const promise = Promise.resolve('success');

      const result = await limiter.execute(promise);

      expect(result.timedOut).toBe(false);
      expect(result.value).toBe('success');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    test('should return timedOut true when promise exceeds timeout', async () => {
      const limiter = new TimeLimiter({ defaultTimeout: 50 });
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('slow'), 100);
      });

      const result = await limiter.execute(promise);

      expect(result.timedOut).toBe(true);
      expect(result.value).toBeUndefined();
    });

    test('should throw error when promise rejects within timeout', async () => {
      const limiter = new TimeLimiter({ defaultTimeout: 1000 });

      let thrownError: Error | null = null;
      try {
        await limiter.execute(async () => {
          await Promise.reject(new Error('rejected'));
        });
      } catch (e) {
        thrownError = e as Error;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError!.message).toBe('rejected');
    });

    test('should use custom error message', async () => {
      const limiter = new TimeLimiter({ defaultErrorMessage: 'Custom error' });
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('slow'), 100);
      });

      const result = await limiter.execute(promise, { timeout: 10, errorMessage: 'Custom error' });

      expect(result.timedOut).toBe(true);
    });

    test('should call onTimeout callback', async () => {
      const limiter = new TimeLimiter();
      const onTimeout = vi.fn();
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('slow'), 100);
      });

      await limiter.execute(promise, { timeout: 10, onTimeout });

      expect(onTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute with function', () => {
    test('should execute function and return result', async () => {
      const limiter = new TimeLimiter({ defaultTimeout: 1000 });
      const fn = vi.fn().mockResolvedValue('function result');

      const result = await limiter.execute(fn);

      expect(result.timedOut).toBe(false);
      expect(result.value).toBe('function result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should timeout function execution', async () => {
      const limiter = new TimeLimiter({ defaultTimeout: 50 });
      const fn = vi.fn().mockImplementation(() => {
        return new Promise<string>((resolve) => {
          setTimeout(() => resolve('slow'), 100);
        });
      });

      const result = await limiter.execute(fn);

      expect(result.timedOut).toBe(true);
    });
  });

  describe('race', () => {
    test('should return first fulfilled promise', async () => {
      const limiter = new TimeLimiter();
      const promises = [
        new Promise<string>((resolve) => setTimeout(() => resolve('first'), 50)),
        new Promise<string>((resolve) => setTimeout(() => resolve('second'), 100)),
      ];

      const result = await limiter.race(promises, 1000);

      expect(result.timedOut).toBe(false);
      expect(result.value).toBe('first');
      expect(result.values).toContain('first');
      expect(result.values).toContain('second');
    });

    test('should timeout all promises', async () => {
      const limiter = new TimeLimiter();
      const promises = [
        new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 100)),
        new Promise<string>((resolve) => setTimeout(() => resolve('slower'), 200)),
      ];

      const result = await limiter.race(promises, 50);

      expect(result.timedOut).toBe(true);
      expect(result.value).toBeUndefined();
    });

    test('should collect all settled results', async () => {
      const limiter = new TimeLimiter();
      const promises = [
        Promise.resolve('success'),
        Promise.reject(new Error('failure')),
        Promise.resolve('another success'),
      ];

      const result = await limiter.race(promises, 1000);

      expect(result.timedOut).toBe(false);
      expect(result.values).toHaveLength(2);
      expect(result.values).toContain('success');
      expect(result.values).toContain('another success');
    });
  });

  describe('createTimeLimiter factory', () => {
    test('should create time limiter with options', () => {
      const limiter = createTimeLimiter({ defaultTimeout: 5000, defaultErrorMessage: 'Timeout!' });
      expect(limiter).toBeDefined();
    });

    test('should use factory created limiter', async () => {
      const limiter = createTimeLimiter({ defaultTimeout: 1000 });
      const result = await limiter.execute(Promise.resolve('test'));

      expect(result.value).toBe('test');
    });
  });
});
