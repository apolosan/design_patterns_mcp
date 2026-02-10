import { describe, test, expect } from 'vitest';
import { memoize, memoizeAsync } from '../../src/utils/memoize.js';

describe('memoize', () => {
  test('should cache function results', () => {
    let callCount = 0;
    const fn = (x: number) => {
      callCount++;
      return x * 2;
    };
    const memoized = memoize(fn);

    expect(memoized(5)).toBe(10);
    expect(callCount).toBe(1);

    expect(memoized(5)).toBe(10);
    expect(callCount).toBe(1);
  });

  test('should call function for different arguments', () => {
    let callCount = 0;
    const fn = (x: number) => {
      callCount++;
      return x * 2;
    };
    const memoized = memoize(fn);

    expect(memoized(5)).toBe(10);
    expect(memoized(10)).toBe(20);
    expect(callCount).toBe(2);
  });

  test('should support custom hash function', () => {
    let callCount = 0;
    const fn = (a: number, b: number) => {
      callCount++;
      return a + b;
    };
    const memoized = memoize(fn, { hashFn: (a, b) => `${a}-${b}` });

    expect(memoized(1, 2)).toBe(3);
    expect(memoized(1, 2)).toBe(3);
    expect(callCount).toBe(1);

    expect(memoized(2, 1)).toBe(3);
    expect(callCount).toBe(2);
  });

  test('should support maxSize option', () => {
    let callCount = 0;
    const fn = (x: number) => {
      callCount++;
      return x * 2;
    };
    const memoized = memoize(fn, { maxSize: 2 });

    memoized(1);
    memoized(2);
    memoized(3);

    expect(callCount).toBe(3);

    memoized(1);
    expect(callCount).toBe(4);
  });

  test('should throw for non-function', () => {
    expect(() => memoize('not a function' as any)).toThrow(TypeError);
  });

  test('should handle object arguments', () => {
    let callCount = 0;
    const obj = { x: 42 };
    const fn = (o: { x: number }) => {
      callCount++;
      return o.x;
    };
    const memoized = memoize(fn);

    expect(memoized(obj)).toBe(42);
    expect(memoized(obj)).toBe(42);
    expect(callCount).toBe(1);
  });

  test('should handle array arguments', () => {
    let callCount = 0;
    const arr = [1, 2, 3];
    const fn = (a: number[]) => {
      callCount++;
      return a.reduce((sum, n) => sum + n, 0);
    };
    const memoized = memoize(fn);

    expect(memoized(arr)).toBe(6);
    expect(memoized(arr)).toBe(6);
    expect(callCount).toBe(1);
  });
});

describe('memoizeAsync', () => {
  test('should cache async function results', async () => {
    let callCount = 0;
    const fn = async (x: number) => {
      callCount++;
      return x * 2;
    };
    const memoized = memoizeAsync(fn);

    const result1 = await memoized(5);
    expect(result1).toBe(10);
    expect(callCount).toBe(1);

    const result2 = await memoized(5);
    expect(result2).toBe(10);
    expect(callCount).toBe(1);
  });

  test('should handle concurrent calls for same key', async () => {
    let callCount = 0;
    const fn = async (_x: number) => {
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 10));
      return _x * 2;
    };
    const memoized = memoizeAsync(fn);

    const results = await Promise.all([
      memoized(5),
      memoized(5),
      memoized(5),
    ]);

    expect(results[0]).toBe(10);
    expect(results[1]).toBe(10);
    expect(results[2]).toBe(10);
    expect(callCount).toBe(1);
  });

  test('should support maxSize option', async () => {
    let callCount = 0;
    const fn = async (x: number) => {
      callCount++;
      return x * 2;
    };
    const memoized = memoizeAsync(fn, { maxSize: 2 });

    await memoized(1);
    await memoized(2);
    await memoized(3);

    expect(callCount).toBe(3);

    await memoized(1);
    expect(callCount).toBe(4);
  });

  test('should throw for non-async-function', () => {
    expect(() => memoizeAsync('not a function' as any)).toThrow(TypeError);
  });

  test('should handle errors gracefully', async () => {
    let callCount = 0;
    const fn = async (_?: number) => {
      callCount++;
      throw new Error('Test error');
    };
    const memoized = memoizeAsync(fn);

    try {
      await memoized(1);
    } catch {}

    try {
      await memoized(1);
    } catch {}

    expect(callCount).toBe(1);
  });
});
