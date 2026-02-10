/**
 * Request Deduplicator (Coalescer)
 * Prevents duplicate concurrent requests by coalescing identical async operations
 * Micro-utility: Reduces redundant work when multiple callers request same resource
 */

export interface DeduplicatorConfig {
  ttlMs: number;
  maxSize: number;
}

export interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  key: string;
  refCount: number;
}

export interface DeduplicatorStats {
  totalRequests: number;
  deduplicated: number;
  cacheHitRate: number;
  activeRequests: number;
  cacheSize: number;
}

export class RequestCoalescer<T = unknown> {
  private config: DeduplicatorConfig;
  private pending: Map<string, PendingRequest<T>> = new Map();
  private totalRequests = 0;
  private deduplicatedCount = 0;

  constructor(config?: Partial<DeduplicatorConfig>) {
    this.config = {
      ttlMs: config?.ttlMs ?? 5000,
      maxSize: config?.maxSize ?? 1000,
    };
  }

  async execute<R extends T>(
    key: string,
    fetcher: () => Promise<R>
  ): Promise<R> {
    this.totalRequests++;

    const existing = this.pending.get(key);

    if (existing) {
      this.deduplicatedCount++;
      existing.refCount++;
      return existing.promise as R;
    }

    if (this.pending.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const promise = fetcher();
    const pendingRequest: PendingRequest<R> = {
      promise,
      timestamp: Date.now(),
      key,
      refCount: 1,
    };

    this.pending.set(key, pendingRequest as PendingRequest<T>);

    try {
      return await promise;
    } finally {
      const entry = this.pending.get(key);
      if (entry) {
        entry.refCount--;
        if (entry.refCount <= 0) {
          this.pending.delete(key);
        }
      }
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, request] of this.pending) {
      if (request.timestamp < oldestTimestamp) {
        oldestTimestamp = request.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.pending.delete(oldestKey);
    }
  }

  getStats(): DeduplicatorStats {
    const cacheHitRate = this.totalRequests > 0
      ? this.deduplicatedCount / this.totalRequests
      : 0;

    return {
      totalRequests: this.totalRequests,
      deduplicated: this.deduplicatedCount,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      activeRequests: this.pending.size,
      cacheSize: this.pending.size,
    };
  }

  clear(): void {
    this.pending.clear();
  }

  clearStats(): void {
    this.totalRequests = 0;
    this.deduplicatedCount = 0;
  }

  getActiveKeys(): string[] {
    return Array.from(this.pending.keys());
  }
}

export function createRequestCoalescer<T = unknown>(
  config?: Partial<DeduplicatorConfig>
): RequestCoalescer<T> {
  return new RequestCoalescer<T>(config);
}
