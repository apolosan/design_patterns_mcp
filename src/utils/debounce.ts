interface DebounceOptions {
  maxWait?: number;
  leading?: boolean;
  trailing?: boolean;
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  options?: DebounceOptions
): (...args: Parameters<T>) => void {
  if (typeof fn !== 'function') {
    throw new TypeError('Debounce requires a function');
  }

  if (delay < 0) {
    throw new TypeError('Delay must be non-negative');
  }

  const maxWait = options?.maxWait ?? 0;
  const leading = options?.leading ?? false;
  const trailing = options?.trailing ?? true;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime = 0;
  let lastArgs: any[] | null = null;
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

  const invokeFunction = (args: any[]): void => {
    if (leading && lastCallTime === 0) {
      lastCallTime = Date.now();
      fn(...args);
    } else if (trailing && args.length > 0) {
      fn(...args);
    }
    lastCallTime = 0;
    lastArgs = null;
  };

  const clearTimers = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (maxWaitTimer !== null) {
      clearTimeout(maxWaitTimer);
      maxWaitTimer = null;
    }
  };

  return function (this: unknown, ...args: Parameters<T>): void {
    const now = Date.now();
    const isLeadingCall = leading && lastCallTime === 0;

    lastArgs = args;

    if (timer !== null) {
      clearTimeout(timer);
    }

    if (isLeadingCall) {
      invokeFunction(args);
      if (maxWait > 0) {
        maxWaitTimer = setTimeout(() => {
          if (lastArgs !== null) {
            invokeFunction(lastArgs);
          }
          clearTimers();
        }, maxWait);
      }
    } else {
      timer = setTimeout(() => {
        if (maxWait > 0 && maxWaitTimer !== null) {
          clearTimeout(maxWaitTimer);
        }
        if (lastArgs !== null) {
          invokeFunction(lastArgs);
        }
        timer = null;
      }, delay);
    }
  };
}

export type { DebounceOptions };
