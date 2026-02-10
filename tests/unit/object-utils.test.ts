/**
 * Object Utilities Tests
 * 
 * Tests for pick, omit, deepMerge, deepClone, and other object utilities
 */

import { describe, test, expect } from 'vitest';
import {
  pick,
  omit,
  deepMerge,
  deepClone,
  pickStrict,
  compactObject,
  deepEqual
} from '../../src/utils/object-utils.js';

describe('pick', () => {
  test('should extract specified keys from object', () => {
    const obj = { name: 'John', age: 30, email: 'john@example.com' };
    const result = pick(obj, ['name', 'email']);
    
    expect(result).toEqual({ name: 'John', email: 'john@example.com' });
  });

  test('should return empty object for null input', () => {
    const result = pick(null as unknown as Record<string, unknown>, ['name' as keyof Record<string, unknown>]);
    expect(result).toEqual({});
  });

  test('should return empty object for undefined input', () => {
    const result = pick(undefined as unknown as Record<string, unknown>, ['name' as keyof Record<string, unknown>]);
    expect(result).toEqual({});
  });

  test('should ignore keys not present in object', () => {
    const obj = { name: 'John' };
    const result = pick(obj, ['name', 'age', 'email']);
    
    expect(result).toEqual({ name: 'John' });
  });

  test('should preserve types correctly', () => {
    const obj = { id: 1, name: 'Test', active: true };
    const result = pick(obj, ['id', 'name']);
    
    expect(result.id).toBe(1);
    expect(result.name).toBe('Test');
    expect('active' in result).toBe(false);
  });

  test('should handle array of keys', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const keys: Array<'a' | 'c'> = ['a', 'c'];
    const result = pick(obj, keys);
    
    expect(result).toEqual({ a: 1, c: 3 });
  });
});

describe('omit', () => {
  test('should remove specified keys from object', () => {
    const obj = { name: 'John', age: 30, password: 'secret' };
    const result = omit(obj, ['password']);
    
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  test('should return empty object for null input', () => {
    const result = omit(null as unknown as Record<string, unknown>, ['name']);
    expect(result).toEqual({});
  });

  test('should return empty object for undefined input', () => {
    const result = omit(undefined as unknown as Record<string, unknown>, ['name']);
    expect(result).toEqual({});
  });

  test('should remove multiple keys', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const result = omit(obj, ['b', 'd']);
    
    expect(result).toEqual({ a: 1, c: 3 });
  });

  test('should ignore keys not present in object', () => {
    const obj = { name: 'John' };
    const result = omit(obj, ['age', 'password']);
    
    expect(result).toEqual({ name: 'John' });
  });

  test('should not mutate original object', () => {
    const obj = { name: 'John', age: 30 };
    const result = omit(obj, ['age']);
    
    expect(obj).toEqual({ name: 'John', age: 30 });
    expect(result).not.toBe(obj);
  });
});

describe('deepMerge', () => {
  test('should merge two flat objects', () => {
    const a = { name: 'John' };
    const b = { age: 30 };
    const result = deepMerge(a, b);
    
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  test('should override values from left to right', () => {
    const a = { name: 'John', age: 25 };
    const b = { name: 'Jane', age: 30 };
    const result = deepMerge(a, b);
    
    expect(result).toEqual({ name: 'Jane', age: 30 });
  });

  test('should deeply merge nested objects', () => {
    const a = { name: 'John', address: { city: 'NYC', zip: '10001' } };
    const b = { age: 30, address: { zip: '10002', country: 'USA' } };
    const result = deepMerge(a, b);
    
    expect(result).toEqual({
      name: 'John',
      age: 30,
      address: {
        city: 'NYC',
        zip: '10002',
        country: 'USA'
      }
    });
  });

  test('should handle multiple objects', () => {
    const a = { a: 1 };
    const b = { b: 2 };
    const c = { c: 3 };
    const result = deepMerge(a, b, c);
    
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('should handle undefined and null sources', () => {
    const a = { name: 'John' };
    const b = null;
    const c = { age: 30 };
    const result = deepMerge(a, b, c);
    
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  test('should not include undefined values', () => {
    const a = { name: 'John' };
    const b = { age: undefined };
    const result = deepMerge(a, b);
    
    expect(result).toEqual({ name: 'John' });
    expect('age' in result).toBe(false);
  });

  test('should handle deeply nested objects with multiple levels', () => {
    const a = {
      level1: {
        level2: {
          level3: {
            value: 'deep'
          }
        }
      }
    };
    const b = {
      level1: {
        level2: {
          level3: {
            extra: 'value'
          }
        }
      }
    };
    const result = deepMerge(a, b);
    
    expect(result.level1.level2.level3.value).toBe('deep');
    expect((result.level1.level2.level3 as Record<string, unknown>).extra).toBe('value');
  });
});

describe('deepClone', () => {
  test('should clone primitive values', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(true)).toBe(true);
    expect(deepClone(null)).toBe(null);
    expect(deepClone(undefined)).toBe(undefined);
  });

  test('should clone arrays', () => {
    const original = [1, 2, 3];
    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  test('should clone objects', () => {
    const original = { name: 'John', age: 30 };
    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  test('should deeply clone nested objects', () => {
    const original = {
      name: 'John',
      address: {
        city: 'NYC',
        zip: '10001'
      }
    };
    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned.address).not.toBe(original.address);
    expect(cloned.address.city).toBe(original.address.city);
  });

  test('should clone arrays with objects', () => {
    const original = [{ name: 'John' }, { name: 'Jane' }];
    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[0]).not.toBe(original[0]);
  });

  test('should preserve Date objects', () => {
    const date = new Date('2024-01-01');
    const obj = { created: date };
    const cloned = deepClone(obj);
    
    expect(cloned.created).toEqual(date);
    expect(cloned.created).not.toBe(date);
  });

  test('should preserve RegExp objects', () => {
    const regex = /test/gi;
    const obj = { pattern: regex };
    const cloned = deepClone(obj);
    
    expect(cloned.pattern.source).toBe(regex.source);
    expect(cloned.pattern.flags).toBe(regex.flags);
  });

  test('should handle nested Dates', () => {
    const original = {
      events: [
        { name: 'Event1', date: new Date('2024-01-01') },
        { name: 'Event2', date: new Date('2024-02-01') }
      ]
    };
    const cloned = deepClone(original);
    
    expect(cloned.events[0].date).toEqual(original.events[0].date);
    expect(cloned.events[0].date).not.toBe(original.events[0].date);
  });

  test('should handle object with self reference', () => {
    const obj: Record<string, unknown> = { name: 'John' };
    obj.self = obj;
    
    const cloned = deepClone(obj);
    
    expect(cloned).not.toBe(obj);
    expect((cloned as Record<string, unknown>).name).toBe('John');
  });
});

describe('pickStrict', () => {
  test('should work like pick with type safety', () => {
    const obj = { id: 1, name: 'Test', active: true };
    const result = pickStrict(obj, ['id', 'name'] as const);
    
    expect(result.id).toBe(1);
    expect(result.name).toBe('Test');
  });
});

describe('compactObject', () => {
  test('should remove undefined values', () => {
    const obj = { name: 'John', age: undefined, city: 'NYC' };
    const result = compactObject(obj);
    
    expect(result).toEqual({ name: 'John', city: 'NYC' });
    expect('age' in result).toBe(false);
  });

  test('should remove undefined from nested objects', () => {
    const obj = {
      name: 'John',
      address: {
        city: 'NYC',
        zip: undefined
      }
    };
    const result = compactObject(obj);
    
    expect(result.address).toEqual({ city: 'NYC' });
  });

  test('should filter undefined from arrays', () => {
    const obj = { values: [1, undefined, 3, undefined] };
    const result = compactObject(obj);
    
    expect(result.values).toEqual([1, 3]);
  });

  test('should handle null input', () => {
    const result = compactObject(null);
    expect(result).toBe(null);
  });

  test('should handle already compact objects', () => {
    const obj = { name: 'John', age: 30 };
    const result = compactObject(obj);
    
    expect(result).toEqual(obj);
  });
});

describe('deepEqual', () => {
  test('should return true for identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('hello', 'hello')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
  });

  test('should return false for different primitives', () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('hello', 'world')).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
  });

  test('should return true for equal objects', () => {
    expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  test('should return false for different objects', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  test('should return true for equal arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  test('should return false for different arrays', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  test('should return true for deeply nested objects', () => {
    const a = {
      level1: {
        level2: {
          level3: 'value'
        }
      }
    };
    const b = {
      level1: {
        level2: {
          level3: 'value'
        }
      }
    };
    expect(deepEqual(a, b)).toBe(true);
  });

  test('should return false for different nested objects', () => {
    const a = {
      level1: {
        level2: 'value1'
      }
    };
    const b = {
      level1: {
        level2: 'value2'
      }
    };
    expect(deepEqual(a, b)).toBe(false);
  });

  test('should handle object vs null comparison', () => {
    expect(deepEqual({}, null)).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });

  test('should handle arrays vs objects', () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual([1], { 0: 1 })).toBe(false);
  });
});
