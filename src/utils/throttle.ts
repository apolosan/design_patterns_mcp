interface ThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
  options?: ThrottleOptions
): (...args: Parameters<T>) => void {
  if (typeof fn !== 'function') {
    throw new TypeError('Throttle requires a function');
  }

  if (limit < 0) {
    throw new TypeError('Limit must be non-negative');
  }

  const leading = options?.leading ?? true;
  const trailing = options?.trailing ?? true;

  let lastFunc: ReturnType<typeof setTimeout> | null = null;
  let lastRan = 0;
  let pendingArgs: any[] | null = null;

  return function (this: unknown, ...args: Parameters<T>): void {
    const now = Date.now();

    if (lastRan === 0) {
      if (leading) {
        fn.apply(this, args);
      }
      lastRan = now;
    } else {
      const remaining = limit - (now - lastRan);

      if (remaining <= 0) {
        if (lastFunc !== null) {
          clearTimeout(lastFunc);
          lastFunc = null;
        }
        fn.apply(this, args);
        lastRan = now;
        pendingArgs = null;
      } else if (trailing && pendingArgs === null) {
        pendingArgs = args;
        lastFunc = setTimeout(() => {
          if (pendingArgs !== null) {
            fn.apply(this, pendingArgs);
          }
          lastRan = Date.now();
          pendingArgs = null;
          lastFunc = null;
        }, remaining);
      }
    }
  };
}

export type { ThrottleOptions };
