/**
 * Object Pool Pattern Implementation for Prepared Statements
 * Prevents memory leaks by limiting the number of cached prepared statements
 * Uses LRU (Least Recently Used) eviction strategy
 */

export interface PooledStatement {
  statement: any;
  lastUsed: number;
  useCount: number;
}

export interface StatementPoolConfig {
  maxSize: number;
  enableMetrics: boolean;
}

export interface PoolMetrics {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

export class StatementPool {
  private pool = new Map<string, PooledStatement>();
  private config: StatementPoolConfig;
  private metrics: PoolMetrics = {
    size: 0,
    hits: 0,
    misses: 0,
    evictions: 0,
    hitRate: 0,
  };

  constructor(config: Partial<StatementPoolConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 100,
      enableMetrics: config.enableMetrics ?? true,
    };
  }

  /**
   * Get or create a prepared statement (with error recovery)
   */
  getOrCreate(sql: string, factory: () => any): any {
    const pooled = this.pool.get(sql);

    if (pooled) {
      // Statement exists in pool - verify it's still valid
      try {
        // Test statement validity if possible
        if (pooled.statement && typeof pooled.statement.safeIntegers === 'function') {
          pooled.statement.safeIntegers(); // SQLite test call
        }
        pooled.lastUsed = Date.now();
        pooled.useCount++;
        this.updateMetrics(true);
        return pooled.statement;
      } catch (error) {
        // Statement corrupted - remove and recreate
        this.pool.delete(sql);
        // Fall through to create new one
      }
    }

    // Statement not in pool, create new one
    this.updateMetrics(false);

    // Check if we need to evict
    if (this.pool.size >= this.config.maxSize) {
      this.evictLRU();
    }

    // Create and store new statement with error handling
    try {
      const statement = factory();
      this.pool.set(sql, {
        statement,
        lastUsed: Date.now(),
        useCount: 1,
      });

      this.metrics.size = this.pool.size;
      return statement;
    } catch (error) {
      // Factory failed - propagate error but don't corrupt pool
      throw new Error(
        `Failed to create prepared statement: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if statement exists in pool
   */
  has(sql: string): boolean {
    return this.pool.has(sql);
  }

  /**
   * Remove statement from pool
   */
  remove(sql: string): boolean {
    const pooled = this.pool.get(sql);
    if (pooled) {
      // Free the statement if it has a free method
      if (pooled.statement && typeof pooled.statement.free === 'function') {
        pooled.statement.free();
      }
      this.pool.delete(sql);
      this.metrics.size = this.pool.size;
      return true;
    }
    return false;
  }

  /**
   * Clear all statements from pool
   */
  clear(): void {
    // Free all statements
    for (const [_, pooled] of this.pool) {
      if (pooled.statement && typeof pooled.statement.free === 'function') {
        pooled.statement.free();
      }
    }
    this.pool.clear();
    this.metrics.size = 0;
  }

  /**
   * Get pool size
   */
  size(): number {
    return this.pool.size;
  }

  /**
   * Get pool metrics
   */
  getMetrics(): PoolMetrics & {
    statements: Array<{ sql: string; useCount: number; age: number }>;
  } {
    const statements = Array.from(this.pool.entries()).map(([sql, pooled]) => ({
      sql: sql.substring(0, 50) + (sql.length > 50 ? '...' : ''),
      useCount: pooled.useCount,
      age: Date.now() - pooled.lastUsed,
    }));

    return {
      ...this.metrics,
      size: this.pool.size,
      hitRate: this.calculateHitRate(),
      statements,
    };
  }

  /**
   * Evict least recently used statement
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [sql, pooled] of this.pool.entries()) {
      if (pooled.lastUsed < lruTime) {
        lruTime = pooled.lastUsed;
        lruKey = sql;
      }
    }

    if (lruKey) {
      this.remove(lruKey);
      this.metrics.evictions++;
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(hit: boolean): void {
    if (!this.config.enableMetrics) return;

    if (hit) {
      this.metrics.hits++;
    } else {
      this.metrics.misses++;
    }
  }

  /**
   * Calculate hit rate
   */
  private calculateHitRate(): number {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      size: this.pool.size,
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0,
    };
  }
}
