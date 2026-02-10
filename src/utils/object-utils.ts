/**
 * Object Utilities - Type-safe object manipulation utilities
 * 
 * Provides essential object operations: pick, omit, deepMerge, and deepClone
 * using native JavaScript/TypeScript features where possible.
 */

import { isPlainObject } from './type-guards.js';

/**
 * Options for deepClone operation
 */
export interface DeepCloneOptions {
  transfer?: Array<Transferable>;
  cloneFunctions?: boolean;
}

/**
 * Extracts specific properties from an object
 * 
 * @param obj - Source object to pick from
 * @param keys - Array of keys to extract
 * @returns New object with only the specified keys
 * 
 * @example
 * const user = { name: 'John', age: 30, email: 'john@example.com' };
 * pick(user, ['name', 'email']);
 * // Returns: { name: 'John', email: 'john@example.com' }
 */
export function pick<T extends Record<string, unknown>>(
  obj: T | null | undefined,
  keys: (keyof T)[]
): Partial<T> {
  if (obj === null || obj === undefined) {
    return {};
  }

  const result = {} as Partial<T>;

  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Removes specific properties from an object
 * 
 * @param obj - Source object to omit from
 * @param keys - Array of keys to remove
 * @returns New object without the specified keys
 * 
 * @example
 * const user = { name: 'John', age: 30, password: 'secret' };
 * omit(user, ['password']);
 * // Returns: { name: 'John', age: 30 }
 */
export function omit<T extends Record<string, unknown>>(
  obj: T | null | undefined,
  keys: (keyof T)[]
): Partial<T> {
  if (obj === null || obj === undefined) {
    return {};
  }

  const result = { ...obj };

  for (const key of keys) {
    delete result[key];
  }

  return result;
}

/**
 * Deeply merges multiple objects together
 * 
 * @param objects - Array of objects to merge (left to right)
 * @returns New object with all properties deeply merged
 * 
 * @example
 * const a = { name: 'John', address: { city: 'NYC' } };
 * const b = { age: 30, address: { zip: '10001' } };
 * deepMerge(a, b);
 * // Returns: { name: 'John', age: 30, address: { city: 'NYC', zip: '10001' } }
 */
export function deepMerge<T extends Record<string, unknown>>(
  ...objects: (T | null | undefined)[]
): T {
  const validObjects = objects.filter(
    (obj): obj is T => obj !== null && obj !== undefined
  );

  if (validObjects.length === 0) {
    return {} as T;
  }

  const result: Record<string, unknown> = { ...validObjects[0] };

  for (let i = 1; i < validObjects.length; i++) {
    const source = validObjects[i];

    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const resultValue = result[key];

      if (isPlainObject(sourceValue) && isPlainObject(resultValue)) {
        result[key] = deepMerge(
          resultValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue;
      }
    }
  }

  return result as T;
}

/**
 * Deeply clones an object using the native structuredClone API
 * 
 * @param obj - Object to clone
 * @param options - Optional cloning options
 * @returns Deep clone of the object
 * @throws {Error} If cloning fails
 * 
 * @example
 * const user = { name: 'John', hobbies: ['reading', 'coding'] };
 * const cloned = deepClone(user);
 * cloned.hobbies.push('gaming');
 * // user.hobbies remains: ['reading', 'coding']
 */
export function deepClone<T>(obj: T, options?: DeepCloneOptions): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'object' || typeof obj === 'function') {
    try {
      if (options?.transfer && typeof structuredClone === 'function') {
        return structuredClone(obj, { transfer: options.transfer }) as T;
      }

      return structuredClone(obj) as T;
    } catch {
      const result: Record<string, unknown> = {};

      if (Array.isArray(obj)) {
        return obj.map(item => {
          if (isPlainObject(item) || Array.isArray(item)) {
            return deepClone(item, options);
          }
          return item;
        }) as unknown as T;
      }

      for (const key of Object.keys(obj)) {
        const value = (obj as Record<string, unknown>)[key];

        if (isPlainObject(value) || Array.isArray(value)) {
          result[key] = deepClone(value, options);
        } else if (typeof value === 'function' && options?.cloneFunctions) {
          (result as Record<string, unknown>)[key] = value;
        } else if (!(value instanceof Date) && !(value instanceof RegExp)) {
          result[key] = value;
        } else if (value instanceof Date) {
          result[key] = new Date((value as Date).getTime());
        } else if (value instanceof RegExp) {
          result[key] = new RegExp(
            (value as RegExp).source,
            (value as RegExp).flags
          );
        }
      }

      return result as T;
    }
  }

  return obj;
}

/**
 * Creates a shallow clone of an object with only specified properties
 * Type-safe alternative to pick with union types
 * 
 * @param obj - Source object
 * @param keys - Keys to include
 * @returns Object with only specified keys
 */
export function pickStrict<T extends Record<string, unknown>>(
  obj: T | null | undefined,
  keys: (keyof T)[]
): Partial<T> {
  return pick(obj, keys);
}

/**
 * Recursively removes all undefined values from an object
 * 
 * @param obj - Object to compact
 * @returns New object without undefined values
 * 
 * @example
 * const data = { name: 'John', age: undefined, city: 'NYC' };
 * compactObject(data);
 * // Returns: { name: 'John', city: 'NYC' }
 */
export function compactObject(
  obj: Record<string, unknown>
): Record<string, unknown> {
  if (obj === null || obj === undefined) {
    return obj;
  }

  const result: Record<string, unknown> = { ...obj };

  for (const key of Object.keys(result)) {
    const value = result[key];

    if (value === undefined) {
      delete result[key];
    } else if (isPlainObject(value)) {
      result[key] = compactObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = (value as unknown[]).filter(item => item !== undefined);
    }
  }

  return result;
}

/**
 * Checks if two objects are deeply equal
 * Uses structuredClone comparison for primitives and objects
 * 
 * @param obj1 - First object
 * @param obj2 - Second object
 * @returns true if objects are deeply equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false;
  }

  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
