import { describe, test, expect } from 'vitest';
import {
  noop,
  noopAsync,
  noopPromise,
  createNoopHandler,
  createNoopEventHandler,
  createNoopAsyncEventHandler,
  isNoop,
  getNoopOrValue
} from '../../src/utils/noop.js';

describe('noop', () => {
  describe('noop()', () => {
    test('should return undefined', () => {
      const result = noop();
      expect(result).toBeUndefined();
    });

    test('should accept any arguments without error', () => {
      const result = noop(1, 'string', {}, [], null, undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('noopAsync()', () => {
    test('should return resolved promise', async () => {
      const result = await noopAsync();
      expect(result).toBeUndefined();
    });
  });

  describe('noopPromise()', () => {
    test('should return resolved promise with value', async () => {
      const result = await noopPromise('test value');
      expect(result).toBe('test value');
    });

    test('should work with objects', async () => {
      const obj = { key: 'value' };
      const result = await noopPromise(obj);
      expect(result).toEqual(obj);
    });

    test('should work with null and undefined', async () => {
      const nullResult = await noopPromise(null);
      const undefinedResult = await noopPromise(undefined);
      expect(nullResult).toBeNull();
      expect(undefinedResult).toBeUndefined();
    });
  });

  describe('createNoopHandler()', () => {
    test('should create handler that calls original function', () => {
      let callCount = 0;
      const originalFn = (x: number) => {
        callCount++;
        return x * 2;
      };
      const handler = createNoopHandler(originalFn);

      const result = handler(5);
      expect(callCount).toBe(1);
      expect(result).toBe(10);
    });

    test('should return undefined when no function provided', () => {
      const handler = createNoopHandler();

      const result = handler(1, 2, 3);
      expect(result).toBeUndefined();
    });
  });

  describe('createNoopEventHandler()', () => {
    test('should create handler for string events', () => {
      const handler = createNoopEventHandler<string>();

      expect(() => handler('test event')).not.toThrow();
    });

    test('should create handler for object events', () => {
      const handler = createNoopEventHandler<{ data: string }>();

      expect(() => handler({ data: 'test' })).not.toThrow();
    });
  });

  describe('createNoopAsyncEventHandler()', () => {
    test('should create async handler for events', async () => {
      const handler = createNoopAsyncEventHandler<{ type: string }>();

      await handler({ type: 'click' });
    });
  });

  describe('isNoop()', () => {
    test('should return true for undefined', () => {
      expect(isNoop(undefined)).toBe(true);
    });

    test('should return true for null', () => {
      expect(isNoop(null)).toBe(true);
    });

    test('should return true for noop function', () => {
      expect(isNoop(noop)).toBe(true);
    });

    test('should return false for other functions', () => {
      const fn = () => 'test';
      expect(isNoop(fn)).toBe(false);
    });

    test('should return false for arrow functions', () => {
      const arrowFn = () => 42;
      expect(isNoop(arrowFn)).toBe(false);
    });
  });

  describe('getNoopOrValue()', () => {
    test('should return value when provided', () => {
      expect(getNoopOrValue('actual', 'fallback')).toBe('actual');
    });

    test('should return fallback when value is undefined', () => {
      expect(getNoopOrValue(undefined, 'fallback')).toBe('fallback');
    });

    test('should return fallback when value is null', () => {
      expect(getNoopOrValue(null, 'fallback')).toBe('fallback');
    });

    test('should work with numbers', () => {
      expect(getNoopOrValue(0, 42)).toBe(0);
      expect(getNoopOrValue(undefined, 42)).toBe(42);
    });

    test('should work with objects', () => {
      const obj = { key: 'value' };
      expect(getNoopOrValue(obj, { key: 'fallback' })).toBe(obj);
      expect(getNoopOrValue(undefined, { key: 'fallback' })).toEqual({ key: 'fallback' });
    });
  });
});
