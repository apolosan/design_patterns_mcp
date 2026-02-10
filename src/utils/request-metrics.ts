/**
 * Request Metrics Collector
 * Collects and aggregates metrics for MCP requests and operations
 * Micro-utility: Performance monitoring with percentiles and aggregations
 */

export interface RequestMetrics {
  /** Operation name/identifier */
  operation: string;
  /** Total number of requests processed */
  totalRequests: number;
  /** Number of successful requests */
  successfulRequests: number;
  /** Number of failed requests */
  failedRequests: number;
  /** Average duration in milliseconds */
  averageDuration: number;
  /** Minimum duration observed (ms) */
  minDuration: number;
  /** Maximum duration observed (ms) */
  maxDuration: number;
  /** 50th percentile duration (ms) - median */
  p50Duration: number;
  /** 95th percentile duration (ms) */
  p95Duration: number;
  /** 99th percentile duration (ms) */
  p99Duration: number;
  /** Error rate percentage (0-100) */
  errorRate: number;
  /** Timestamp of last request (Unix epoch ms) */
  lastRequestTime?: number;
  /** Timestamp of last success (Unix epoch ms) */
  lastSuccessTime?: number;
  /** Timestamp of last failure (Unix epoch ms) */
  lastFailureTime?: number;
  /** Requests per minute (rolling window) */
  requestsPerMinute: number;
}

export interface RequestMetricsConfig {
  /** Rolling window size for rate calculation (ms) */
  windowSizeMs: number;
  /** Whether metrics collection is enabled */
  enabled: boolean;
}

/**
 * Collects and aggregates request metrics with percentile calculations
 */
export class RequestMetricsCollector {
  private metrics: Map<string, RequestMetrics> = new Map();
  private durations: Map<string, number[]> = new Map();
  private config: RequestMetricsConfig;
  private requestCounts: Map<string, { count: number; windowStart: number }> = new Map();

  constructor(config?: Partial<RequestMetricsConfig>) {
    this.config = {
      windowSizeMs: config?.windowSizeMs ?? 60000,
      enabled: config?.enabled ?? true,
    };
  }

  /**
   * Record a request for metric collection
   * @param operation - Name/identifier for the operation
   * @param success - Whether the request succeeded
   * @param durationMs - Request duration in milliseconds
   * @param timestamp - Optional timestamp (defaults to now)
   */
  recordRequest(
    operation: string,
    success: boolean,
    durationMs: number,
    timestamp?: number
  ): void {
    if (!this.config.enabled) return;

    const now = timestamp ?? Date.now();
    const metrics = this.getOrCreateMetrics(operation);
    const durationList = this.getOrCreateDurations(operation);

    metrics.totalRequests++;
    metrics.lastRequestTime = now;

    if (success) {
      metrics.successfulRequests++;
      metrics.lastSuccessTime = now;
    } else {
      metrics.failedRequests++;
      metrics.lastFailureTime = now;
    }

    durationList.push(durationMs);

    this.updateDurationsMetrics(durationList, metrics);
    this.updateRequestRate(operation, now);

    metrics.errorRate = (metrics.failedRequests / metrics.totalRequests) * 100;
    metrics.averageDuration = this.calculateAverage(durationList);
  }

  /**
   * Get metrics for a specific operation
   * @param operation - Operation name
   * @returns Metrics object or null if not found
   */
  getMetrics(operation: string): RequestMetrics | null {
    const metrics = this.metrics.get(operation);
    if (!metrics) return null;

    return this.calculateCurrentMetrics(operation, metrics);
  }

  /**
   * Get metrics for all tracked operations
   * @returns Array of metrics for each operation
   */
  getAllMetrics(): RequestMetrics[] {
    const result: RequestMetrics[] = [];

    for (const [operation, metrics] of this.metrics.entries()) {
      result.push(this.calculateCurrentMetrics(operation, metrics));
    }

    return result;
  }

  /**
   * Get operations with highest request counts
   * @param limit - Maximum number of results (default: 10)
   * @returns Operations sorted by request count
   */
  getTopOperationsByRequestCount(limit: number = 10): RequestMetrics[] {
    return this.getAllMetrics()
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, limit);
  }

  /**
   * Get operations with highest error rates (min 10 requests)
   * @param limit - Maximum number of results (default: 10)
   * @returns Operations sorted by error rate
   */
  getTopOperationsByErrorRate(limit: number = 10): RequestMetrics[] {
    return this.getAllMetrics()
      .filter(m => m.totalRequests > 10)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit);
  }

  /**
   * Get aggregated metrics across all operations
   * @returns Summary statistics for dashboards
   */
  getAggregatedMetrics(): {
    totalRequests: number;
    totalSuccesses: number;
    totalFailures: number;
    averageErrorRate: number;
    operationsCount: number;
    slowestOperation?: RequestMetrics;
    mostFailingOperation?: RequestMetrics;
  } {
    const allMetrics = this.getAllMetrics();

    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalSuccesses = allMetrics.reduce((sum, m) => sum + m.successfulRequests, 0);
    const totalFailures = allMetrics.reduce((sum, m) => sum + m.failedRequests, 0);
    const averageErrorRate = allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.errorRate, 0) / allMetrics.length
      : 0;

    const slowestOperation = allMetrics.length > 0
      ? allMetrics.reduce((max, m) => m.averageDuration > max.averageDuration ? m : max)
      : undefined;

    const mostFailingOperation = allMetrics.length > 0
      ? allMetrics.filter(m => m.totalRequests > 10)
          .reduce((max, m) => m.errorRate > max.errorRate ? m : max, allMetrics[0])
      : undefined;

    return {
      totalRequests,
      totalSuccesses,
      totalFailures,
      averageErrorRate: Math.round(averageErrorRate * 100) / 100,
      operationsCount: allMetrics.length,
      slowestOperation,
      mostFailingOperation,
    };
  }

  /**
   * Reset metrics for an operation or all operations
   * @param operation - Optional specific operation to reset
   */
  reset(operation?: string): void {
    if (operation) {
      this.metrics.delete(operation);
      this.durations.delete(operation);
      this.requestCounts.delete(operation);
    } else {
      this.metrics.clear();
      this.durations.clear();
      this.requestCounts.clear();
    }
  }

  private getOrCreateMetrics(operation: string): RequestMetrics {
    let metrics = this.metrics.get(operation);
    if (!metrics) {
      metrics = {
        operation,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        errorRate: 0,
        requestsPerMinute: 0,
      };
      this.metrics.set(operation, metrics);
    }
    return metrics;
  }

  private getOrCreateDurations(operation: string): number[] {
    let durations = this.durations.get(operation);
    if (!durations) {
      durations = [];
      this.durations.set(operation, durations);
    }
    return durations;
  }

  private updateDurationsMetrics(durations: number[], metrics: RequestMetrics): void {
    if (durations.length === 0) return;

    const sorted = [...durations].sort((a, b) => a - b);

    metrics.minDuration = sorted[0];
    metrics.maxDuration = sorted[sorted.length - 1];
    metrics.p50Duration = this.percentile(sorted, 50);
    metrics.p95Duration = this.percentile(sorted, 95);
    metrics.p99Duration = this.percentile(sorted, 99);
  }

  private updateRequestRate(operation: string, now: number): void {
    const record = this.requestCounts.get(operation);
    const windowStart = now - this.config.windowSizeMs;

    if (record && record.windowStart >= windowStart) {
      record.count++;
    } else {
      this.requestCounts.set(operation, { count: 1, windowStart });
    }

    const currentRecord = this.requestCounts.get(operation);
    if (currentRecord) {
      const metrics = this.metrics.get(operation);
      if (metrics) {
        metrics.requestsPerMinute = currentRecord.count;
      }
    }
  }

  private calculateCurrentMetrics(operation: string, metrics: RequestMetrics): RequestMetrics {
    const currentDurations = this.durations.get(operation) ?? [];
    const currentRate = this.requestCounts.get(operation);

    return {
      ...metrics,
      requestsPerMinute: currentRate?.count ?? 0,
      p50Duration: metrics.p50Duration || 0,
      p95Duration: metrics.p95Duration || 0,
      p99Duration: metrics.p99Duration || 0,
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }
}

/** Global singleton instance for convenient metrics collection */
export const requestMetricsCollector = new RequestMetricsCollector();
