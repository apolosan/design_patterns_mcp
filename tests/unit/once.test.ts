import { describe, test, expect } from 'vitest';
import { once, oncePromise } from '../../src/utils/once.js';

describe('once', () => {
  describe('once()', () => {
    test('should execute function only once', () => {
      let callCount = 0;
      const fn = once(() => {
        callCount++;
        return 'result';
      });

      const result1 = fn();
      const result2 = fn();
      const result3 = fn();

      expect(callCount).toBe(1);
      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(result3).toBe('result');
    });

    test('should pass arguments to function', () => {
      const fn = once((a: unknown, b: unknown) => (a as number) + (b as number));

      const result1 = fn(2, 3);
      const result2 = fn(100, 200);

      expect(result1).toBe(5);
      expect(result2).toBe(5);
    });

    test('should throw on subsequent calls if function throws', () => {
      const error = new Error('test error');
      const fn = once(() => {
        throw error;
      });

      expect(() => fn()).toThrow('test error');
      expect(() => fn()).toThrow('test error');
    });

    test('should expose called property', () => {
      const fn = once(() => 'test');
      expect(fn.called).toBe(false);

      fn();
      expect(fn.called).toBe(true);
    });

    test('should expose pending property', () => {
      const fn = once(() => 'test');
      expect(fn.pending).toBe(false);

      fn();
      expect(fn.pending).toBe(false);
    });

    test('should reset function state', () => {
      let callCount = 0;
      const fn = once(() => {
        callCount++;
        return 'result';
      });

      fn();
      expect(callCount).toBe(1);
      expect(fn.called).toBe(true);

      fn.reset();
      expect(fn.called).toBe(false);
      expect(fn.pending).toBe(false);

      fn();
      expect(callCount).toBe(2);
    });

    test('should handle void functions', () => {
      let callCount = 0;
      const fn = once(() => {
        callCount++;
      });

      const result = fn();

      expect(callCount).toBe(1);
      expect(result).toBeUndefined();
    });
  });

  describe('oncePromise()', () => {
    test('should execute promise only once', async () => {
      let callCount = 0;
      const fn = oncePromise(async () => {
        callCount++;
        return 'promise result';
      });

      const result1 = await fn();
      const result2 = await fn();
      const result3 = await fn();

      expect(callCount).toBe(1);
      expect(result1).toBe('promise result');
      expect(result2).toBe('promise result');
      expect(result3).toBe('promise result');
    });

    test('should expose called property', async () => {
      const fn = oncePromise(async () => 'test');
      expect(fn.called).toBe(false);

      await fn();
      expect(fn.called).toBe(true);
    });

    test('should expose pending property', async () => {
      const fn = oncePromise(async () => 'test');
      expect(fn.pending).toBe(false);
    });

    test('should reset function state', async () => {
      let callCount = 0;
      const fn = oncePromise(async () => {
        callCount++;
        return 'result';
      });

      await fn();
      expect(callCount).toBe(1);
      expect(fn.called).toBe(true);

      fn.reset();
      expect(fn.called).toBe(false);

      await fn();
      expect(callCount).toBe(2);
    });

    test('should handle promise rejection', async () => {
      const error = new Error('promise error');
      const fn = oncePromise(async () => {
        throw error;
      });

      await expect(fn()).rejects.toThrow('promise error');
    });
  });
});
