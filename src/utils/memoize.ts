import { isString } from './type-guards.js';

interface MemoizeOptions<TArgs extends unknown[], TReturn> {
  maxSize?: number;
  ttl?: number;
  hashFn?: (...args: TArgs) => string;
}

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  accessedAt: number;
}

class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 100, ttl: number = 0) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (entry === undefined) {
      return undefined;
    }

    if (this.ttl > 0 && Date.now() - entry.createdAt > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    entry.accessedAt = Date.now();
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.findOldestKey();
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
    });
  }

  private findOldestKey(): K | undefined {
    let oldestKey: K | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export function memoize<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  options?: MemoizeOptions<TArgs, TReturn>
): (...args: TArgs) => TReturn {
  if (typeof fn !== 'function') {
    throw new TypeError('Memoize requires a function');
  }

  const maxSize = options?.maxSize ?? 100;
  const ttl = options?.ttl ?? 0;
  const customHashFn = options?.hashFn;

  const cache = new LRUCache<string, TReturn>(maxSize, ttl);

  return function (this: unknown, ...args: TArgs): TReturn {
    const key = customHashFn
      ? customHashFn(...args)
      : JSON.stringify(args);

    const cachedValue = cache.get(key);

    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

export function memoizeAsync<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options?: MemoizeOptions<TArgs, TReturn>
): (...args: TArgs) => Promise<TReturn> {
  if (typeof fn !== 'function') {
    throw new TypeError('Memoize requires an async function');
  }

  const maxSize = options?.maxSize ?? 100;
  const ttl = options?.ttl ?? 0;
  const customHashFn = options?.hashFn;

  const cache = new LRUCache<string, TReturn>(maxSize, ttl);
  const pending = new Map<string, Promise<TReturn>>();

  return async function (this: unknown, ...args: TArgs): Promise<TReturn> {
    const key = customHashFn
      ? customHashFn(...args)
      : JSON.stringify(args);

    const cachedValue = cache.get(key);

    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const existingPromise = pending.get(key);

    if (existingPromise !== undefined) {
      return existingPromise;
    }

    const promise = fn.apply(this, args).then((result) => {
      pending.delete(key);
      cache.set(key, result);
      return result;
    });

    pending.set(key, promise);
    return promise;
  };
}

export type { MemoizeOptions };
