/**
 * Promise Pool - Control concurrency of multiple promises
 *
 * Allows limiting the number of concurrent promises running at once,
 * preventing system overload while maintaining throughput.
 */

export interface PoolOptions {
  concurrency?: number;
  timeout?: number;
}

export interface PoolResult<T> {
  results: T[];
  errors: Array<{ index: number; error: unknown }>;
  duration: number;
}

export class PromisePool<T> {
  private concurrency: number;
  private timeout: number;
  private activeCount = 0;
  private queue: Array<{
    promise: () => Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (error: unknown) => void;
  }> = [];
  private running: Array<Promise<T>> = [];

  constructor(options: PoolOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 10);
    this.timeout = options.timeout ?? 30000;
  }

  async add(promise: () => Promise<T>): Promise<T> {
    if (this.activeCount < this.concurrency) {
      return this.execute(promise);
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ promise, resolve, reject });
    });
  }

  private async execute(promiseFn: () => Promise<T>): Promise<T> {
    this.activeCount++;

    const timeoutId = setTimeout(() => {
      throw new Error(`Promise execution timeout after ${this.timeout}ms`);
    }, this.timeout);

    try {
      const result = await promiseFn();
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }

  private processNext(): void {
    if (this.queue.length === 0) return;

    const next = this.queue.shift();
    if (!next) return;

    this.execute(next.promise).then(next.resolve).catch(next.reject);
  }

  async runAll(
    tasks: Array<() => Promise<T>>,
    options?: PoolOptions
  ): Promise<PoolResult<T>> {
    const startTime = Date.now();
    const concurrency = options?.concurrency ?? this.concurrency;
    const timeout = options?.timeout ?? this.timeout;

    const pool = new PromisePool<T>({ concurrency, timeout });
    const promises = tasks.map((task) => pool.add(task));

    const results: T[] = [];
    const errors: Array<{ index: number; error: unknown }> = [];

    await Promise.allSettled(promises).then((settled) => {
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push({ index, error: result.reason });
        }
      });
    });

    return {
      results,
      errors,
      duration: Date.now() - startTime,
    };
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getConcurrency(): number {
    return this.concurrency;
  }

  setConcurrency(value: number): void {
    this.concurrency = Math.max(1, value);
  }
}

export function createPromisePool<T = unknown>(options?: PoolOptions): PromisePool<T> {
  return new PromisePool<T>(options);
}
