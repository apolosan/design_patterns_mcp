/**
 * Key-By Utilities - Create maps/indexes from arrays by key selector
 *
 * Provides keyBy and indexBy functions to create lookups from arrays.
 * Complements groupBy by creating single-key lookups instead of grouped arrays.
 */

/**
 * Checks if a value is a function
 */
function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

/**
 * Options for keyBy operation
 */
export interface KeyByOptions<T> {
  /**
   * If true, last occurrence wins instead of first
   */
  lastWins?: boolean;
}

/**
 * Options for indexBy operation
 */
export interface IndexByOptions<T> {
  /**
   * If true, last occurrence wins instead of first
   */
  lastWins?: boolean;
}

/**
 * Creates a map from array by extracting a key from each item
 *
 * @param array - Source array to create lookup from
 * @param keyOrFn - Property name or function to extract key
 * @param options - Optional configuration
 * @returns Object mapping keys to items
 *
 * @example
 * const users = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
 * keyBy(users, 'id');
 * // Returns: { '1': { id: '1', name: 'Alice' }, '2': { id: '2', name: 'Bob' } }
 *
 * keyBy(users, user => user.name.toLowerCase());
 * // Returns: { 'alice': { id: '1', name: 'Alice' }, 'bob': { id: '2', name: 'Bob' } }
 */
export function keyBy<T>(
  array: readonly T[],
  keyOrFn: string | ((item: T, index: number) => string),
  options?: KeyByOptions<T>
): Record<string, T> {
  if (array.length === 0) {
    return {};
  }

  const result: Record<string, T> = {};

  const isKeyFn = isFunction(keyOrFn);
  const lastWins = options?.lastWins ?? true;

  if (lastWins) {
    for (let i = array.length - 1; i >= 0; i--) {
      const item = array[i];
      let key: string;

      if (isKeyFn) {
        key = (keyOrFn as (item: T, index: number) => string)(item, i);
      } else {
        const keyValue = (item as Record<string, unknown>)[keyOrFn as string];
        key = String(keyValue ?? "");
      }

      if (key !== undefined && key !== null) {
        if (!(key in result)) {
          result[key] = item;
        }
      }
    }
  } else {
    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      let key: string;

      if (isKeyFn) {
        key = (keyOrFn as (item: T, index: number) => string)(item, i);
      } else {
        const keyValue = (item as Record<string, unknown>)[keyOrFn as string];
        key = String(keyValue ?? "");
      }

      if (key !== undefined && key !== null) {
        if (!(key in result)) {
          result[key] = item;
        }
      }
    }
  }

  return result;
}

/**
 * Creates a map from array using numeric index as key
 *
 * @param array - Source array to create lookup from
 * @param options - Optional configuration
 * @returns Object mapping stringified index to items
 *
 * @example
 * const items = ['a', 'b', 'c'];
 * indexBy(items);
 * // Returns: { '0': 'a', '1': 'b', '2': 'c' }
 */
export function indexBy<T>(
  array: readonly T[],
  options?: IndexByOptions<T>
): Record<string, T> {
  if (array.length === 0) {
    return {};
  }

  const result: Record<string, T> = {};
  const lastWins = options?.lastWins ?? false;

  const entries = lastWins ? array.entries() : array.entries();

  for (const [index, item] of entries) {
    result[String(index)] = item;
  }

  return result;
}

/**
 * Looks up an item in a keyBy result map
 *
 * @param lookup - KeyBy result to search in
 * @param key - Key to find
 * @returns Item if found, undefined otherwise
 *
 * @example
 * const users = [{ id: '1', name: 'Alice' }];
 * const lookup = keyBy(users, 'id');
 * lookupBy(lookup, '1');
 * // Returns: { id: '1', name: 'Alice' }
 */
export function lookupBy<T>(
  lookup: Record<string, T>,
  key: string
): T | undefined {
  return lookup[key];
}

/**
 * Checks if a key exists in a keyBy result map
 *
 * @param lookup - KeyBy result to check
 * @param key - Key to find
 * @returns True if key exists
 *
 * @example
 * const lookup = keyBy([{ id: '1' }], 'id');
 * hasKey(lookup, '1');
 * // Returns: true
 */
export function hasKey<T>(lookup: Record<string, T>, key: string): boolean {
  return key in lookup;
}

/**
 * Gets all keys from a keyBy result map
 *
 * @param lookup - KeyBy result to get keys from
 * @returns Array of keys
 *
 * @example
 * const lookup = keyBy([{ id: '1' }, { id: '2' }], 'id');
 * getKeys(lookup);
 * // Returns: ['1', '2']
 */
export function getKeys<T>(lookup: Record<string, T>): string[] {
  return Object.keys(lookup);
}

/**
 * Gets all values from a keyBy result map
 *
 * @param lookup - KeyBy result to get values from
 * @returns Array of values
 *
 * @example
 * const lookup = keyBy([{ id: '1' }, { id: '2' }], 'id');
 * getValues(lookup);
 * // Returns: [{ id: '1' }, { id: '2' }]
 */
export function getValues<T>(lookup: Record<string, T>): T[] {
  return Object.values(lookup);
}

/**
 * Gets entries from a keyBy result map
 *
 * @param lookup - KeyBy result to get entries from
 * @returns Array of [key, value] tuples
 *
 * @example
 * const lookup = keyBy([{ id: '1' }], 'id');
 * getEntries(lookup);
 * // Returns: [['1', { id: '1' }]]
 */
export function getEntries<T>(
  lookup: Record<string, T>
): [string, T][] {
  return Object.entries(lookup) as [string, T][];
}
