import { describe, test, expect } from 'vitest';
import {
  deepMerge,
  deepMergeAll,
  deepOmit,
  deepPick,
  deepFreeze,
  type DeepMergeOptions,
} from '../../src/utils/deep-merge.js';

describe('deepMerge', () => {
  test('should merge simple objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  test('should merge nested objects', () => {
    const target = { a: { x: 1 }, b: 2 };
    const source = { a: { y: 2 }, c: 3 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: { x: 1, y: 2 }, b: 2, c: 3 });
  });

  test('should overwrite primitive values', () => {
    const target = { a: 1, b: 'old' };
    const source = { a: 2, b: 'new' };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 2, b: 'new' });
  });

  test('should handle null values', () => {
    const target = { a: null, b: 2 };
    const source = { a: 1, c: 3 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('should handle undefined in source', () => {
    const target = { a: 1, b: 2 };
    const source = { a: undefined, c: 3 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('should merge arrays with concat strategy', () => {
    const target = { a: [1, 2] };
    const source = { a: [3, 4] };
    const result = deepMerge(target, source, { strategy: 'concat' });
    expect(result).toEqual({ a: [1, 2, 3, 4] });
  });

  test('should overwrite arrays with overwrite strategy', () => {
    const target = { a: [1, 2] };
    const source = { a: [3, 4] };
    const result = deepMerge(target, source, { strategy: 'overwrite' });
    expect(result).toEqual({ a: [3, 4] });
  });

  test('should preserve Date objects', () => {
    const target = { a: new Date('2024-01-01') };
    const source = { b: new Date('2024-12-31') };
    const result = deepMerge(target, source);
    expect(result.a).toEqual(new Date('2024-01-01'));
    expect(result.b).toEqual(new Date('2024-12-31'));
  });

  test('should preserve RegExp objects', () => {
    const target = { a: /test/gi };
    const source = { b: /other/y };
    const result = deepMerge(target, source);
    expect(result.a).toEqual(/test/gi);
    expect(result.b).toEqual(/other/y);
  });

  test('should preserve Set objects', () => {
    const target = { a: new Set([1, 2]) };
    const source = { b: new Set([3, 4]) };
    const result = deepMerge(target, source);
    expect(result.a).toEqual(new Set([1, 2]));
    expect(result.b).toEqual(new Set([3, 4]));
  });

  test('should preserve Map objects', () => {
    const target = { a: new Map([['key', 'value']]) };
    const source = { b: new Map([['other', 'data']]) };
    const result = deepMerge(target, source);
    expect(result.a).toEqual(new Map([['key', 'value']]));
    expect(result.b).toEqual(new Map([['other', 'data']]));
  });

  test('should handle deeply nested objects', () => {
    const target = { a: { b: { c: { d: 1 } } } };
    const source = { a: { b: { c: { e: 2 } } } };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: { b: { c: { d: 1, e: 2 } } } });
  });

  test('should handle different types at same key', () => {
    const target = { a: { x: 1 } };
    const source = { a: 'string' };
    const result = deepMerge(target, source);
    expect(result.a).toBe('string');
  });

  test('should handle arrays as objects when treatArraysAsObjects is true', () => {
    const target = { arr: [1, 2, 3] };
    const source = { arr: { length: 3, nested: true } };
    const result = deepMerge(target, source, { treatArraysAsObjects: true });
    expect(result.arr).toEqual({ length: 3, nested: true });
  });
});

describe('deepMergeAll', () => {
  test('should merge multiple objects', () => {
    const objects = [{ a: 1 }, { b: 2 }, { c: 3 }];
    const result = deepMergeAll(objects);
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('should merge nested objects from multiple sources', () => {
    const objects = [
      { a: { x: 1 } },
      { a: { y: 2 }, b: 3 },
      { a: { z: 3 } },
    ];
    const result = deepMergeAll(objects);
    expect(result).toEqual({ a: { x: 1, y: 2, z: 3 }, b: 3 });
  });

  test('should return empty object for empty array', () => {
    const result = deepMergeAll([]);
    expect(result).toEqual({});
  });

  test('should handle single object', () => {
    const objects = [{ a: 1, b: 2 }];
    const result = deepMergeAll(objects);
    expect(result).toEqual({ a: 1, b: 2 });
  });
});

describe('deepOmit', () => {
  test('should omit single key', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = deepOmit(obj, ['b'] as any);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  test('should omit multiple keys', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const result = deepOmit(obj, ['b', 'c'] as any);
    expect(result).toEqual({ a: 1, d: 4 });
  });

  test('should omit nested keys', () => {
    const obj = { a: { x: 1, y: 2, z: 3 }, b: 4 };
    const result = deepOmit(obj, ['y'] as any);
    expect(result).toEqual({ a: { x: 1, z: 3 }, b: 4 });
  });

  test('should handle deeply nested keys', () => {
    const obj = { a: { b: { c: { d: 1, e: 2 } } } };
    const result = deepOmit(obj, ['d'] as any);
    expect(result).toEqual({ a: { b: { c: { e: 2 } } } });
  });

  test('should preserve Date objects', () => {
    const obj = { a: new Date('2024-01-01'), b: 2 };
    const result = deepOmit(obj, ['a'] as const);
    expect((result as { b: number }).b).toBe(2);
  });

  test('should preserve Set and Map', () => {
    const obj = { a: new Set([1, 2]), b: new Map([['k', 'v']]), c: 3 };
    const result = deepOmit(obj, ['a'] as const);
    expect((result as { b: Map<string, string>; c: number }).b).toEqual(new Map([['k', 'v']]));
    expect((result as { c: number }).c).toBe(3);
  });

  test('should handle null/undefined', () => {
    expect(deepOmit(null as any, ['a'])).toBeNull();
    expect(deepOmit(undefined as any, ['a'])).toBeUndefined();
  });

  test('should handle non-existent keys', () => {
    const obj = { a: 1, b: 2 };
    const result = deepOmit(obj, ['c'] as any);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test('should omit from arrays of objects', () => {
    const obj = { items: [{ a: 1, b: 2 }, { c: 3, d: 4 }] };
    const result = deepOmit(obj, ['b', 'd'] as any);
    expect(result).toEqual({ items: [{ a: 1 }, { c: 3 }] });
  });
});

describe('deepPick', () => {
  test('should pick single key', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = deepPick(obj, ['b'] as any);
    expect(result).toEqual({ b: 2 });
  });

  test('should pick multiple keys', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const result = deepPick(obj, ['a', 'c'] as any);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  test('should pick nested keys', () => {
    const obj = { a: { x: 1, y: 2, z: 3 }, b: 4 };
    const result = deepPick(obj, ['y'] as any);
    expect(result).toEqual({ a: { y: 2 } });
  });

  test('should handle deeply nested keys', () => {
    const obj = { a: { b: { c: { d: 1, e: 2 } } } };
    const result = deepPick(obj, ['d'] as any);
    expect(result).toEqual({ a: { b: { c: { d: 1 } } } });
  });

  test('should preserve Date objects', () => {
    const obj = { a: new Date('2024-01-01'), b: 2 };
    const result = deepPick(obj, ['a'] as const);
    expect(result?.a).toEqual(new Date('2024-01-01'));
  });

  test('should handle null/undefined', () => {
    expect(deepPick(null, ['a'] as const)).toBeNull();
    expect(deepPick(undefined, ['a'] as const)).toBeUndefined();
  });

  test('should return empty object when no keys match', () => {
    const obj = { a: 1, b: 2 };
    const result = deepPick(obj, ['z'] as any);
    expect(result).toEqual({});
  });

  test('should pick from arrays of objects', () => {
    const obj = { items: [{ a: 1, b: 2 }, { c: 3, d: 4 }] };
    const result = deepPick(obj, ['a', 'c'] as any);
    expect(result).toEqual({ items: [{ a: 1 }, { c: 3 }] });
  });
});

describe('deepFreeze', () => {
  test('should freeze simple object', () => {
    const obj = { a: 1, b: 2 };
    const result = deepFreeze(obj);
    expect(Object.isFrozen(result)).toBe(true);
  });

  test('should freeze nested object', () => {
    const obj = { a: { b: { c: 1 } } };
    const result = deepFreeze(obj);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.a)).toBe(true);
    expect(Object.isFrozen(result.a.b)).toBe(true);
  });

  test('should freeze arrays', () => {
    const obj = { arr: [1, 2, 3] };
    const result = deepFreeze(obj);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.arr)).toBe(true);
  });

  test('should freeze Date objects', () => {
    const obj = { date: new Date('2024-01-01') };
    const result = deepFreeze(obj);
    expect(Object.isFrozen(result.date)).toBe(true);
  });

  test('should preserve RegExp, Error, Set, Map', () => {
    const obj = {
      regexp: /test/gi,
      error: new Error('test'),
      set: new Set([1, 2]),
      map: new Map([['k', 'v']]),
    };
    const result = deepFreeze(obj);
    expect(Object.isFrozen(result.regexp)).toBe(false);
    expect(Object.isFrozen(result.error)).toBe(false);
    expect(Object.isFrozen(result.set)).toBe(false);
    expect(Object.isFrozen(result.map)).toBe(false);
  });

  test('should handle nested arrays with objects', () => {
    const obj = { items: [{ a: 1 }, { b: 2 }] };
    const result = deepFreeze(obj);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.items)).toBe(true);
    expect(Object.isFrozen(result.items[0])).toBe(true);
    expect(Object.isFrozen(result.items[1])).toBe(true);
  });

  test('should handle null/undefined', () => {
    expect(deepFreeze(null as unknown as object)).toBeNull();
    expect(deepFreeze(undefined as unknown as object)).toBeUndefined();
  });

  test('should respect maxDepth option', () => {
    const obj = { a: { b: { c: 1 } } };
    const result = deepFreeze(obj, { maxDepth: 1 });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.a)).toBe(true);
    expect(Object.isFrozen(result.a.b)).toBe(false);
  });
});
