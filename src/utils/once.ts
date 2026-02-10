/**
 * Once Utility
 * Ensures a function is executed only once, returning the result of the first call for all subsequent calls.
 * Useful for initialization logic, event handlers, and singleton patterns.
 */

export interface OnceFunction<T extends (...args: readonly unknown[]) => unknown> {
  (this: unknown, ...args: Parameters<T>): ReturnType<T>;
  called: boolean;
  pending: boolean;
  reset: () => void;
}

export function once<T extends (...args: readonly unknown[]) => unknown>(
  fn: T
): OnceFunction<T> {
  let called = false;
  let pending = false;
  let result: ReturnType<T> | undefined;
  let error: unknown;

  const state = {
    get called() { return called; },
    get pending() { return pending; },
    reset: () => {
      called = false;
      pending = false;
      result = undefined;
      error = undefined;
    }
  };

  function wrapper(this: unknown, ...args: Parameters<T>): ReturnType<T> {
    if (called) {
      if (error !== undefined) {
        throw error;
      }
      return result as ReturnType<T>;
    }

    if (pending) {
      throw new Error('once(): concurrent calls detected');
    }

    pending = true;

    try {
      const callResult = fn.apply(this, args);
      result = callResult as ReturnType<T>;
      called = true;
      pending = false;
      return result;
    } catch (e) {
      error = e as Error;
      called = true;
      pending = false;
      throw error;
    }
  }

  Object.defineProperty(wrapper, 'called', { get: () => called });
  Object.defineProperty(wrapper, 'pending', { get: () => pending });
  Object.defineProperty(wrapper, 'reset', { value: state.reset });

  return wrapper as unknown as OnceFunction<T>;
}

export function oncePromise<T>(
  fn: () => Promise<T>
): (() => Promise<T>) & { called: boolean; pending: boolean; reset: () => void } {
  let called = false;
  let pending = false;
  let promiseResult: Promise<T> | undefined;

  const state = {
    get called() { return called; },
    get pending() { return pending; },
    reset: () => {
      called = false;
      pending = false;
      promiseResult = undefined;
    }
  };

  function wrapper(): Promise<T> {
    if (called) {
      return promiseResult as Promise<T>;
    }

    if (pending) {
      throw new Error('oncePromise(): concurrent calls detected');
    }

    pending = true;
    promiseResult = fn().finally(() => {
      called = true;
      pending = false;
    });

    return promiseResult;
  }

  Object.defineProperty(wrapper, 'called', { get: () => called });
  Object.defineProperty(wrapper, 'pending', { get: () => pending });
  Object.defineProperty(wrapper, 'reset', { value: state.reset });

  return wrapper as unknown as (() => Promise<T>) & { called: boolean; pending: boolean; reset: () => void };
}
