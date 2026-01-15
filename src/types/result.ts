/**
 * Result Pattern - Functional Error Handling
 * Represents either a successful value or an error, providing type-safe error handling
 * Based on Either/Result patterns from functional programming
 */

/**
 * Success result containing a value
 */
export interface Success<T> {
  readonly success: true;
  readonly value: T;
}

/**
 * Failure result containing an error
 */
export interface Failure<E = Error> {
  readonly success: false;
  readonly error: E;
}

/**
 * Result type - represents either success or failure
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * Create a success result
 */
export function ok<T>(value: T): Success<T> {
  return { success: true, value };
}

/**
 * Create a failure result
 */
export function err<E = Error>(error: E): Failure<E> {
  return { success: false, error };
}

/**
 * Check if result is success
 */
export function isOk<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success === true;
}

/**
 * Check if result is failure
 */
export function isErr<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.success === false;
}

/**
 * Map over a successful result
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Map over a failed result
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * FlatMap (chain) over a successful result
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Unwrap a result, throwing if it's an error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwrap a result with a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Unwrap a result with a lazy default value
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  if (isOk(result)) {
    return result.value;
  }
  return fn(result.error);
}

/**
 * Try to execute a function and wrap the result
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Try to execute an async function and wrap the result
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Combine multiple results into a single result
 * Returns the first error if any, or an array of all values
 */
export function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Match on a result, providing handlers for both cases
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }
): U {
  if (isOk(result)) {
    return handlers.ok(result.value);
  }
  return handlers.err(result.error);
}

/**
 * Result utilities namespace
 */
export const Result = {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  tryCatch,
  tryCatchAsync,
  combine,
  match,
};
