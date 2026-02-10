/**
 * Try Utilities - Safe try/catch wrappers for sync and async operations
 *
 * Provides utilities to safely execute functions with error handling.
 * Complements the Result pattern by providing simpler try/catch semantics.
 */

/**
 * Error caught by try utility
 */
export class TryError extends Error {
  public readonly originalError: unknown;
  public readonly caughtAt: Date;

  constructor(
    message: string,
    originalError: unknown,
    caughtAt: Date = new Date()
  ) {
    super(message);
    this.name = "TryError";
    this.originalError = originalError;
    this.caughtAt = caughtAt;
  }
}

/**
 * Options for try operation
 */
export interface TryOptions {
  /**
   * Custom error message
   */
  message?: string;

  /**
   * Error types to catch (others re-thrown)
   */
  catchTypes?: unknown[];

  /**
   * Default value to return on error
   */
  fallback?: unknown;

  /**
   * Function to handle the error
   */
  onError?: (error: TryError) => unknown;
}

/**
 * Options for tryAsync operation
 */
export interface TryAsyncOptions extends TryOptions {
  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Signal to abort the operation
   */
  abortSignal?: AbortSignal;
}

/**
 * Safely executes a synchronous function
 *
 * @param fn - Function to execute
 * @param options - Optional configuration
 * @returns Result of function or error object
 *
 * @example
 * const result = try(() => JSON.parse('{"name": "John"}'));
 * if (result instanceof TryError) {
 *   console.log('Failed:', result.message);
 * } else {
 *   console.log('Success:', result);
 * }
 */
export function try_<T>(
  fn: () => T,
  options?: TryOptions
): T | TryError {
  try {
    return fn();
  } catch (error) {
    if (options?.catchTypes && options.catchTypes.length > 0) {
      const isMatchingType = options.catchTypes.some(
        (type) =>
          typeof type === "function" &&
          (error instanceof type ||
            (type.prototype && error instanceof type.prototype.constructor))
      );

      if (!isMatchingType) {
        throw error;
      }
    }

    const tryError = new TryError(
      options?.message ?? "Operation failed",
      error
    );

    if (options?.onError) {
      return options.onError(tryError) as T;
    }

    if (options?.fallback !== undefined) {
      return options.fallback as T;
    }

    return tryError;
  }
}

/**
 * Safely executes an async function
 *
 * @param fn - Async function to execute
 * @param options - Optional configuration
 * @returns Promise resolving to result or error object
 *
 * @example
 * const result = await tryAsync(async () => {
 *   const response = await fetch('https://api.example.com/data');
 *   return response.json();
 * });
 */
export async function tryAsync<T>(
  fn: () => Promise<T>,
  options?: TryAsyncOptions
): Promise<T | TryError> {
  try {
    if (options?.timeout !== undefined) {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Operation timed out")), options.timeout)
        ),
      ]);
    }

    return await fn();
  } catch (error) {
    if (options?.catchTypes && !options.catchTypes.includes(error)) {
      throw error;
    }

    const tryError = new TryError(
      options?.message ?? "Async operation failed",
      error
    );

    if (options?.onError) {
      return options.onError(tryError) as T;
    }

    if (options?.fallback !== undefined) {
      return options.fallback as T;
    }

    return tryError;
  }
}

/**
 * Checks if a value is a TryError
 *
 * @param value - Value to check
 * @returns True if value is a TryError
 *
 * @example
 * const result = try(() => throw new Error('fail'));
 * if (isTryError(result)) {
 *   console.log('Error:', result.originalError);
 * }
 */
export function isTryError(value: unknown): value is TryError {
  return value instanceof TryError;
}

/**
 * Safely executes a function and returns a boolean indicating success
 *
 * @param fn - Function to execute
 * @returns Tuple of [success, resultOrError]
 *
 * @example
 * const [success, result] = attempt(() => JSON.parse('{"name": "John"}'));
 * if (success) {
 *   console.log('Parsed:', result);
 * } else {
 *   console.log('Failed:', result);
 * }
 */
export function attempt<T>(
  fn: () => T
): [true, T] | [false, TryError] {
  try {
    return [true, fn()];
  } catch (error) {
    return [false, new TryError("Operation failed", error)];
  }
}

/**
 * Safely executes an async function and returns a boolean indicating success
 *
 * @param fn - Async function to execute
 * @returns Promise of tuple [success, resultOrError]
 *
 * @example
 * const [success, result] = await attemptAsync(async () => {
 *   const response = await fetch('https://api.example.com/data');
 *   return response.json();
 * });
 */
export async function attemptAsync<T>(
  fn: () => Promise<T>
): Promise<[true, T] | [false, TryError]> {
  try {
    return [true, await fn()];
  } catch (error) {
    return [false, new TryError("Async operation failed", error)];
  }
}

/**
 * Retries a function a specified number of times
 *
 * @param fn - Function to retry
 * @param options - Retry configuration
 * @returns Result of the function
 *
 * @example
 * const result = retry(
 *   () => fetchData(),
 *   { attempts: 3, delay: 1000, backoff: 2 }
 * );
 */
export function retry<T>(
  fn: () => T,
  options: {
    attempts?: number;
    delay?: number;
    backoff?: number;
    onRetry?: (error: TryError, attemptNumber: number) => void;
  } = {}
): T | TryError {
  const {
    attempts = 3,
    delay = 1000,
    backoff = 2,
    onRetry,
  } = options;

  let lastError: TryError | null = null;
  let currentDelay = delay;

  for (let i = 1; i <= attempts; i++) {
    try {
      return fn();
    } catch (error) {
      lastError = new TryError(`Attempt ${i} failed`, error);

      if (i < attempts && onRetry) {
        onRetry(lastError, i);
      }

      if (i < attempts) {
        if (currentDelay > 0) {
          const start = Date.now();
          while (Date.now() - start < currentDelay) {
            // Busy wait
          }
        }
        currentDelay *= backoff;
      }
    }
  }

  return lastError!;
}

/**
 * Safely applies a function with multiple arguments
 *
 * @param fn - Function to apply
 * @param args - Arguments to pass
 * @returns Result or TryError
 *
 * @example
 * const result = apply(JSON.parse, ['{"name": "John"}']);
 */
export function apply<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  args: TArgs
): TReturn | TryError {
  try {
    return fn(...args);
  } catch (error) {
    return new TryError("Function application failed", error);
  }
}

/**
 * Safely gets a property from an object
 *
 * @param obj - Object to get property from
 * @param path - Property path (dot notation)
 * @param fallback - Fallback value if property not found
 * @returns Property value or fallback
 *
 * @example
 * const value = get({ a: { b: 'c' } }, 'a.b', 'default');
 */
export function get<T = unknown>(
  obj: Record<string, unknown>,
  path: string,
  fallback?: T
): T | TryError {
  try {
    const keys = path.split(".");
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return fallback as T;
      }

      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[key];
      } else {
        return fallback as T;
      }
    }

    return (current as T) ?? fallback as T;
  } catch (error) {
    return new TryError(`Failed to get path "${path}"`, error);
  }
}
