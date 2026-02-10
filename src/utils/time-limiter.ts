/**
 * Time Limiter - Enforce maximum execution time for async operations
 *
 * Provides timeout enforcement for promises, with options for
 * custom error messages and fallback behavior.
 */

export interface TimeLimitOptions {
  timeout: number;
  errorMessage?: string;
  onTimeout?: () => unknown;
}

export interface TimeLimitedResult<T> {
  value?: T;
  values?: T[];
  timedOut: boolean;
  duration: number;
}

export class TimeLimiter {
  private defaultTimeout: number;
  private defaultErrorMessage: string;

  constructor(options: { defaultTimeout?: number; defaultErrorMessage?: string } = {}) {
    this.defaultTimeout = options.defaultTimeout ?? 30000;
    this.defaultErrorMessage = options.defaultErrorMessage ?? 'Operation timed out';
  }

  async execute<T>(
    promise: Promise<T>,
    options?: TimeLimitOptions
  ): Promise<TimeLimitedResult<T>>;
  async execute<T>(
    promise: () => Promise<T>,
    options?: TimeLimitOptions
  ): Promise<TimeLimitedResult<T>>;
  async execute<T>(
    promiseOrFn: Promise<T> | (() => Promise<T>),
    options?: TimeLimitOptions
  ): Promise<TimeLimitedResult<T>> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const errorMessage = options?.errorMessage ?? this.defaultErrorMessage;
    const startTime = Date.now();

    const promise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;

    let timeoutId: ReturnType<typeof setTimeout>;
    let settled = false;

    const cleanup = (): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
      }
    };

    const timeoutPromise = new Promise<never>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(errorMessage));
      }, timeout);
    });

    const racePromise = Promise.race([promise, timeoutPromise]);

    return racePromise
      .then((value) => {
        cleanup();
        return {
          value,
          timedOut: false,
          duration: Date.now() - startTime,
        } as TimeLimitedResult<T>;
      })
      .catch((error) => {
        cleanup();
        if (error instanceof Error && error.message === errorMessage) {
          if (options?.onTimeout) {
            options.onTimeout();
          }
          return {
            timedOut: true,
            duration: Date.now() - startTime,
          } as TimeLimitedResult<T>;
        }
        return Promise.reject(error);
      });
  }

  race<T>(promises: Array<Promise<T>>, timeout: number): Promise<TimeLimitedResult<T>> {
    const startTime = Date.now();
    let timedOutFlag = false;

    const timeoutId = setTimeout(() => {
      timedOutFlag = true;
    }, timeout);

    return Promise.allSettled(promises).then((settled) => {
      clearTimeout(timeoutId);

      if (timedOutFlag) {
        return {
          timedOut: true,
          duration: Date.now() - startTime,
        } as TimeLimitedResult<T>;
      }

      const values: T[] = [];
      for (const result of settled) {
        if (result.status === 'fulfilled') {
          values.push(result.value as T);
        }
      }

      return {
        value: values[0],
        values,
        timedOut: false,
        duration: Date.now() - startTime,
      } as TimeLimitedResult<T>;
    });
  }
}

export function createTimeLimiter(options?: {
  defaultTimeout?: number;
  defaultErrorMessage?: string;
}): TimeLimiter {
  return new TimeLimiter(options);
}
