/**
 * Noop Utility
 * Provides a no-operation (no-op) function for placeholders, defaults, and stubbing.
 * Useful for optional callbacks, event handlers, and initialization patterns.
 */

export function noop(..._args: unknown[]): undefined {
  return undefined;
}

export function noopAsync(): Promise<void> {
  return Promise.resolve();
}

export function noopPromise<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

export function createNoopHandler<TArgs extends readonly unknown[], TReturn>(
  _fn?: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  return (..._args: TArgs): TReturn => {
    return _fn?.(..._args) as TReturn;
  };
}

export function createNoopEventHandler<T = unknown>(): (event: T) => void {
  return (_event: T): void => {
    // Intentionally empty
  };
}

export function createNoopAsyncEventHandler<T = unknown>(): (event: T) => Promise<void> {
  return async (_event: T): Promise<void> => {
    // Intentionally empty
  };
}

export function isNoop<T extends (...args: readonly unknown[]) => unknown>(
  fn: T | undefined | null
): fn is undefined | null {
  return fn === undefined || fn === null || fn === noop;
}

export function getNoopOrValue<T>(
  value: T | undefined | null,
  fallback: T
): T {
  return value ?? fallback;
}
