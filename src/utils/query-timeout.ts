/**
 * Query Timeout Handler
 *
 * Enforces timeouts specifically for database queries, protecting against
 * slow queries that could degrade system performance. Complements the
 * general-purpose TimeLimiter with database-specific optimizations.
 *
 * Best Practice 2025: SQLite query optimization and timeout enforcement
 * Reference: https://github.com/forwardemail/sqlite-benchmarks
 */

export interface QueryTimeoutConfig {
  defaultTimeout: number;
  slowQueryThreshold: number;
  logSlowQueries: boolean;
  maxConcurrentQueries: number;
}

export interface QueryExecutionResult<T> {
  rows: T[];
  duration: number;
  timedOut: boolean;
  query: string;
}

export interface SlowQueryInfo {
  query: string;
  duration: number;
  threshold: number;
  timestamp: number;
}

export class QueryTimeoutError extends Error {
  constructor(
    message: string,
    public readonly query: string,
    public readonly duration: number,
    public readonly timeout: number
  ) {
    super(message);
    this.name = 'QueryTimeoutError';
  }
}

export class QueryTimeoutHandler {
  private config: QueryTimeoutConfig;
  private activeQueries: Map<string, { startTime: number; query: string }> = new Map();
  private slowQueries: SlowQueryInfo[] = [];
  private queryCount = 0;
  private timeoutCount = 0;
  private totalDuration = 0;

  constructor(config?: Partial<QueryTimeoutConfig>) {
    this.config = {
      defaultTimeout: config?.defaultTimeout ?? 5000,
      slowQueryThreshold: config?.slowQueryThreshold ?? 1000,
      logSlowQueries: config?.logSlowQueries ?? true,
      maxConcurrentQueries: config?.maxConcurrentQueries ?? 10
    };
  }

  async execute<T>(
    query: string,
    queryFn: () => Promise<T>,
    timeout?: number
  ): Promise<QueryExecutionResult<T>> {
    const effectiveTimeout = timeout ?? this.config.defaultTimeout;
    const queryId = this.generateQueryId();
    const startTime = Date.now();

    if (this.activeQueries.size >= this.config.maxConcurrentQueries) {
      throw new QueryTimeoutError(
        'Maximum concurrent queries exceeded',
        query,
        0,
        effectiveTimeout
      );
    }

    this.activeQueries.set(queryId, { startTime, query });

    let timeoutId: ReturnType<typeof setTimeout>;
    let settled = false;

    const cleanup = (): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
      }
      this.activeQueries.delete(queryId);
    };

    const timeoutPromise = new Promise<never>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        cleanup();
        this.timeoutCount++;
        reject(new QueryTimeoutError(
          `Query exceeded timeout of ${effectiveTimeout}ms`,
          query,
          Date.now() - startTime,
          effectiveTimeout
        ));
      }, effectiveTimeout);
    });

    const queryPromise = (async () => {
      try {
        const result = await queryFn();
        return result;
      } finally {
        cleanup();
      }
    })();

    try {
      const result = await Promise.race([queryPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      this.recordQuery(duration, query);

      if (duration >= this.config.slowQueryThreshold && this.config.logSlowQueries) {
        this.recordSlowQuery(query, duration);
      }

      return {
        rows: Array.isArray(result) ? result : [result],
        duration,
        timedOut: false,
        query
      };
    } catch (error) {
      if (error instanceof QueryTimeoutError) {
        const duration = Date.now() - startTime;
        this.recordQuery(duration, query);
        throw error;
      }
      throw error;
    }
  }

  async executeWithTimeout<T>(
    queryFn: () => Promise<T>,
    timeout?: number
  ): Promise<QueryExecutionResult<T>> {
    return this.execute('anonymous', queryFn, timeout);
  }

  getActiveQueries(): Array<{ query: string; duration: number }> {
    const now = Date.now();
    return Array.from(this.activeQueries.entries()).map(([_id, info]) => ({
      query: info.query,
      duration: now - info.startTime
    }));
  }

  getSlowQueries(limit?: number): SlowQueryInfo[] {
    const sorted = [...this.slowQueries].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getStats(): {
    totalQueries: number;
    timedOutQueries: number;
    averageDuration: number;
    slowQueryCount: number;
    activeQueryCount: number;
  } {
    return {
      totalQueries: this.queryCount,
      timedOutQueries: this.timeoutCount,
      averageDuration: this.queryCount > 0 ? this.totalDuration / this.queryCount : 0,
      slowQueryCount: this.slowQueries.length,
      activeQueryCount: this.activeQueries.size
    };
  }

  clearSlowQueries(): void {
    this.slowQueries = [];
  }

  reset(): void {
    this.activeQueries.clear();
    this.slowQueries = [];
    this.queryCount = 0;
    this.timeoutCount = 0;
    this.totalDuration = 0;
  }

  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private recordQuery(duration: number, _query: string): void {
    this.queryCount++;
    this.totalDuration += duration;
  }

  private recordSlowQuery(query: string, duration: number): void {
    this.slowQueries.push({
      query,
      duration,
      threshold: this.config.slowQueryThreshold,
      timestamp: Date.now()
    });

    if (this.slowQueries.length > 100) {
      this.slowQueries.shift();
    }
  }
}

export const queryTimeoutHandler = new QueryTimeoutHandler();
