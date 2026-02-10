/**
 * Type Narrowing Utilities - TypeScript type narrowing helpers
 *
 * Provides utilities for narrowing TypeScript types at runtime,
 * complementing type-guards with advanced narrowing techniques.
 */

/**
 * Narrows a value using a predicate function
 *
 * @param value - Value to narrow
 * @param predicate - Predicate function that returns true for desired type
 * @param guardName - Name of the guard for error messages
 * @returns Narrowed value or throws
 *
 * @example
 * const result = narrowWithPredicate(user, (u): u is User => u.id > 0, 'User');
 * // result is User
 */
export function narrowWithPredicate<T, S extends T>(
  value: T,
  predicate: (value: T) => value is S,
  guardName: string
): S {
  if (!predicate(value)) {
    throw new Error(`Expected ${guardName}, but value failed predicate check`);
  }
  return value;
}

/**
 * Narrows a value using a type guard that may return false
 *
 * @param value - Value to narrow
 * @param guard - Type guard function
 * @returns Narrowed value or undefined
 *
 * @example
 * const user = narrowOrUndefined(input, isUser);
 * // user is User | undefined
 */
export function narrowOrUndefined<T, S extends T>(
  value: T,
  guard: (value: T) => value is S
): S | undefined {
  return guard(value) ? value : undefined;
}

/**
 * Narrows a value using a type guard with a custom error message
 *
 * @param value - Value to narrow
 * @param guard - Type guard function
 * @param message - Custom error message
 * @returns Narrowed value or throws
 *
 * @example
 * const user = narrowOrThrow(input, isUser, 'Valid user required');
 */
export function narrowOrThrow<T, S extends T>(
  value: T,
  guard: (value: T) => value is S,
  message: string
): S {
  if (!guard(value)) {
    throw new Error(message);
  }
  return value;
}

/**
 * Narrows a value by excluding specific values from union
 *
 * @param value - Value to narrow
 * @param excluded - Array of values to exclude
 * @returns Value with excluded values removed from type
 *
 * @example
 * const nonNull = excludeValue(input, null, undefined);
 * // nonNull is string
 */
export function excludeValue<T, E extends T>(
  value: T,
  ...excluded: E[]
): Exclude<T, E> {
  const shouldExclude = excluded.some(ex => Object.is(value, ex));
  if (shouldExclude) {
    throw new Error(`Value ${String(value)} is excluded`);
  }
  return value as Exclude<T, E>;
}

/**
 * Narrows by checking property existence
 *
 * @param obj - Object to check
 * @param prop - Property name to check
 * @returns Object with property in type
 *
 * @example
 * const withName = hasProperty(user, 'name');
 * // withName is { name: unknown }
 */
export function hasProperty<T extends Record<string, unknown>, K extends string>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return prop in obj;
}

/**
 * Narrows by checking property is not null/undefined
 *
 * @param obj - Object to check
 * @param prop - Property name to check
 * @returns Object with non-null property in type
 *
 * @example
 * const withValidAge = hasNonNullProperty(user, 'age');
 * // withValidAge is { age: number }
 */
export function hasNonNullProperty<
  T extends Record<string, unknown>,
  K extends string
>(
  obj: T,
  prop: K
): obj is T & Record<K, NonNullable<unknown>> {
  return obj[prop] !== null && obj[prop] !== undefined;
}

/**
 * Narrows by checking property type
 *
 * @param obj - Object to check
 * @param prop - Property name to check
 * @param type - Expected type name
 * @returns Object with typed property in type
 *
 * @example
 * const withStringName = hasTypedProperty(user, 'name', 'string');
 */
export function hasTypedProperty<
  T extends Record<string, unknown>,
  K extends string,
  TypeName extends string
>(
  obj: T,
  prop: K,
  type: TypeName
): obj is T & Record<K, TypeScriptType<TypeName>> {
  const value = obj[prop];
  if (value === null || value === undefined) {
    return false;
  }
  return typeof value === mapTypeName(type);
}

type TypeScriptType<T extends string> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : T extends 'boolean'
      ? boolean
      : T extends 'bigint'
        ? bigint
        : T extends 'symbol'
          ? symbol
          : T extends 'function'
            ? Function
            : T extends 'object'
              ? object
              : unknown;

function mapTypeName(type: string): string {
  const mapping: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    bigint: 'bigint',
    symbol: 'symbol',
    function: 'function',
    object: 'object'
  };
  return mapping[type] || 'unknown';
}

/**
 * Narrows array to only include matching elements
 *
 * @param arr - Array to filter
 * @param guard - Type guard function
 * @returns Array with narrowed type
 *
 * @example
 * const users = filterWithGuard(allItems, isUser);
 * // users is User[]
 */
export function filterWithGuard<T, S extends T>(
  arr: T[],
  guard: (value: T) => value is S
): S[] {
  return arr.filter(guard);
}

/**
 * Narrows union to exclude false
 *
 * @param value - Boolean-like value
 * @returns True boolean value
 *
 * @example
 * const bool = excludeFalse(input as boolean | false);
 */
export function excludeFalse<T>(value: T): T extends false ? never : T {
  if (value === false) {
    throw new Error('Value cannot be false');
  }
  return value as T extends false ? never : T;
}

/**
 * Narrows union to exclude null
 *
 * @param value - Nullable value
 * @returns Non-null value
 *
 * @example
 * const nonNull = excludeNull(input as string | null);
 */
export function excludeNull<T>(value: T): Exclude<T, null> {
  if (value === null) {
    throw new Error('Value cannot be null');
  }
  return value as Exclude<T, null>;
}

/**
 * Narrows union to exclude undefined
 *
 * @param value - Possibly undefined value
 * @returns Defined value
 *
 * @example
 * const defined = excludeUndefined(input as string | undefined);
 */
export function excludeUndefined<T>(value: T): Exclude<T, undefined> {
  if (value === undefined) {
    throw new Error('Value cannot be undefined');
  }
  return value as Exclude<T, undefined>;
}

/**
 * Narrows union to exclude null and undefined
 *
 * @param value - Possibly null/undefined value
 * @returns Non-null, defined value
 *
 * @example
 * const present = excludeNil(input as string | null | undefined);
 */
export function excludeNil<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error('Value cannot be null or undefined');
  }
  return value as NonNullable<T>;
}

/**
 * Narrows using instanceof check
 *
 * @param value - Value to check
 * @param klass - Class constructor
 * @returns Instance of class
 *
 * @example
 * const error = narrowInstance(error, Error);
 */
export function narrowInstance<T extends object>(
  value: unknown,
  klass: new (...args: never[]) => T
): value is T {
  return value instanceof klass;
}

/**
 * Narrows array by finding first matching element
 *
 * @param arr - Array to search
 * @param guard - Type guard function
 * @returns First matching element or undefined
 *
 * @example
 * const firstUser = findWithGuard(items, isUser);
 */
export function findWithGuard<T, S extends T>(
  arr: T[],
  guard: (value: T) => value is S
): S | undefined {
  return arr.find(guard);
}

/**
 * Narrows using discriminated union check
 *
 * @param obj - Object with discriminant
 * @param key - Discriminant property key
 * @param value - Expected discriminant value
 * @returns Object with narrowed type
 *
 * @example
 * const success = discriminate(result, 'status', 'success');
 */
export function discriminate<
  T extends Record<string, unknown>,
  K extends keyof T,
  V extends T[K]
>(
  obj: T,
  key: K,
  value: V
): obj is T & Record<K, V> {
  return obj[key] === value;
}

/**
 * Narrows with default fallback
 *
 * @param value - Value to narrow
 * @param guard - Type guard function
 * @param defaultValue - Fallback value
 * @returns Narrowed value or default
 *
 * @example
 * const user = narrowWithDefault(input, isUser, guestUser);
 */
export function narrowWithDefault<T, S extends T>(
  value: T,
  guard: (value: T) => value is S,
  defaultValue: S
): S {
  return guard(value) ? value : defaultValue;
}

/**
 * Narrows union to single type
 *
 * @param value - Value to narrow
 * @param guard - Type guard
 * @param errorMessage - Error if not matching
 * @returns Single typed value
 *
 * @example
 * const specific = narrowToType(input, isSpecificType, 'Expected specific type');
 */
export function narrowToType<T, S extends T>(
  value: T,
  guard: (value: T) => value is S,
  errorMessage: string
): S {
  if (!guard(value)) {
    throw new Error(errorMessage);
  }
  return value;
}
