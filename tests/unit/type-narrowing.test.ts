/**
 * Type Narrowing Utilities Tests
 */

import { describe, test, expect } from 'vitest';
import {
  narrowWithPredicate,
  narrowOrUndefined,
  narrowOrThrow,
  excludeValue,
  hasProperty,
  hasNonNullProperty,
  hasTypedProperty,
  filterWithGuard,
  excludeNull,
  excludeUndefined,
  excludeNil,
  narrowInstance,
  findWithGuard,
  discriminate,
  narrowWithDefault,
  narrowToType
} from '../../src/utils/type-narrowing.js';

interface User {
  id: number;
  name: string;
}

interface Admin {
  id: number;
  role: 'admin';
}

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in (value as Record<string, unknown>) &&
    'name' in (value as Record<string, unknown>)
  );
}

function isAdmin(value: unknown): value is Admin {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in (value as Record<string, unknown>) &&
    (value as Record<string, unknown>).role === 'admin'
  );
}

describe('Type Narrowing Utilities', () => {
  describe('narrowWithPredicate', () => {
    test('narrows successfully with valid predicate', () => {
      const value = { id: 1, name: 'John' };
      const result = narrowWithPredicate(value, (v): v is User => v.id > 0, 'User');
      expect(result).toEqual(value);
      expect(result.id).toBe(1);
    });

    test('throws when predicate fails', () => {
      const value = { id: 0, name: 'John' };
      expect(() => narrowWithPredicate(value, (v): v is User => v.id > 0, 'User')).toThrow('Expected User');
    });
  });

  describe('narrowOrUndefined', () => {
    test('returns value when guard passes', () => {
      const value = { id: 1, name: 'John' };
      const result = narrowOrUndefined(value, isUser);
      expect(result).toEqual(value);
    });

    test('returns undefined when guard fails', () => {
      const value = { id: 1, role: 'admin' };
      const result = narrowOrUndefined(value, isUser);
      expect(result).toBeUndefined();
    });
  });

  describe('narrowOrThrow', () => {
    test('returns value when guard passes', () => {
      const value = { id: 1, name: 'John' };
      const result = narrowOrThrow(value, isUser, 'Valid user required');
      expect(result).toEqual(value);
    });

    test('throws with custom message when guard fails', () => {
      const value = { id: 1, role: 'admin' };
      expect(() => narrowOrThrow(value, isUser, 'Valid user required')).toThrow('Valid user required');
    });
  });

  describe('excludeValue', () => {
    test('returns value when not excluded', () => {
      const value = 'active' as 'active' | 'inactive' | 'pending';
      const result = excludeValue(value, 'inactive', 'pending');
      expect(result).toBe('active');
    });

    test('throws when value is excluded', () => {
      const value = 'inactive' as 'active' | 'inactive' | 'pending';
      expect(() => excludeValue(value, 'inactive', 'pending')).toThrow('inactive');
    });
  });

  describe('hasProperty', () => {
    test('narrows when property exists', () => {
      const obj = { name: 'John', age: 30 };
      const result = hasProperty(obj, 'name');
      expect(result).toBe(true);
      expect('name' in obj).toBe(true);
    });

    test('returns false when property does not exist', () => {
      const obj = { name: 'John' };
      const result = hasProperty(obj, 'age');
      expect(result).toBe(false);
    });
  });

  describe('hasNonNullProperty', () => {
    test('narrows when property is not null', () => {
      const obj = { name: 'John', age: 30 };
      const result = hasNonNullProperty(obj, 'age');
      expect(result).toBe(true);
    });

    test('returns false when property is null', () => {
      const obj = { name: 'John', age: null };
      const result = hasNonNullProperty(obj, 'age');
      expect(result).toBe(false);
    });

    test('returns false when property is undefined', () => {
      const obj = { name: 'John' };
      const result = hasNonNullProperty(obj, 'age');
      expect(result).toBe(false);
    });
  });

  describe('hasTypedProperty', () => {
    test('narrows when property has correct type', () => {
      const obj = { name: 'John', age: 30 };
      const result = hasTypedProperty(obj, 'name', 'string');
      expect(result).toBe(true);
    });

    test('returns false when property has wrong type', () => {
      const obj = { name: 123, age: 30 };
      const result = hasTypedProperty(obj, 'name', 'string');
      expect(result).toBe(false);
    });
  });

  describe('filterWithGuard', () => {
    test('filters array to matching types', () => {
      const arr: unknown[] = [
        { id: 1, name: 'John' },
        { id: 2, role: 'admin' },
        { id: 3, name: 'Jane' }
      ];
      const result = filterWithGuard(arr, isUser);
      expect(result).toHaveLength(2);
      expect((result[0] as User).name).toBe('John');
      expect((result[1] as User).name).toBe('Jane');
    });
  });

  describe('excludeNull', () => {
    test('removes null from union type', () => {
      const value = 'hello' as string | null;
      const result = excludeNull(value);
      expect(result).toBe('hello');
    });

    test('throws when value is null', () => {
      const value = null as string | null;
      expect(() => excludeNull(value)).toThrow('null');
    });
  });

  describe('excludeUndefined', () => {
    test('removes undefined from union type', () => {
      const value = 'hello' as string | undefined;
      const result = excludeUndefined(value);
      expect(result).toBe('hello');
    });

    test('throws when value is undefined', () => {
      const value = undefined as string | undefined;
      expect(() => excludeUndefined(value)).toThrow('undefined');
    });
  });

  describe('excludeNil', () => {
    test('removes null and undefined from union type', () => {
      const value = 'hello' as string | null | undefined;
      const result = excludeNil(value);
      expect(result).toBe('hello');
    });

    test('throws when value is null', () => {
      const value = null as string | null | undefined;
      expect(() => excludeNil(value)).toThrow('null or undefined');
    });

    test('throws when value is undefined', () => {
      const value = undefined as string | null | undefined;
      expect(() => excludeNil(value)).toThrow('null or undefined');
    });
  });

  describe('narrowInstance', () => {
    test('narrows when value is instance of class', () => {
      const error = new Error('test');
      const result = narrowInstance(error, Error);
      expect(result).toBe(true);
    });

    test('returns false when value is not instance', () => {
      const result = narrowInstance('not an error', Error);
      expect(result).toBe(false);
    });
  });

  describe('findWithGuard', () => {
    test('finds first matching element', () => {
      const arr: unknown[] = [
        { id: 1, role: 'user' },
        { id: 2, role: 'admin' },
        { id: 3, role: 'user' }
      ];
      const result = findWithGuard(arr, isAdmin);
      expect(result).toEqual({ id: 2, role: 'admin' });
    });

    test('returns undefined when no match', () => {
      const arr: unknown[] = [
        { id: 1, role: 'user' },
        { id: 2, role: 'user' }
      ];
      const result = findWithGuard(arr, isAdmin);
      expect(result).toBeUndefined();
    });
  });

  describe('discriminate', () => {
    test('narrows when discriminant matches', () => {
      const obj = { status: 'success', data: 'hello' };
      const result = discriminate(obj, 'status', 'success');
      expect(result).toBe(true);
    });

    test('returns false when discriminant does not match', () => {
      const obj = { status: 'error', data: 'hello' };
      const result = discriminate(obj, 'status', 'success');
      expect(result).toBe(false);
    });
  });

  describe('narrowWithDefault', () => {
    test('returns value when guard passes', () => {
      const value = { id: 1, name: 'John' };
      const defaultUser = { id: 0, name: 'Guest' } as User;
      const result = narrowWithDefault(value, isUser, defaultUser);
      expect(result).toEqual(value);
    });

    test('returns default when guard fails', () => {
      const value = { id: 1, role: 'admin' };
      const defaultUser = { id: 0, name: 'Guest' } as User;
      const result = narrowWithDefault(value, isUser, defaultUser);
      expect(result).toEqual(defaultUser);
    });
  });

  describe('narrowToType', () => {
    test('returns value when guard passes', () => {
      const value = { id: 1, name: 'John' };
      const result = narrowToType(value, isUser, 'Expected User');
      expect(result).toEqual(value);
    });

    test('throws with error message when guard fails', () => {
      const value = { id: 1, role: 'admin' };
      expect(() => narrowToType(value, isUser, 'Expected User')).toThrow('Expected User');
    });
  });
});
