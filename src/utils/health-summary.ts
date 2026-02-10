/**
 * Health Summary Utility
 * Aggregates health metrics from circuit breakers, requests, and errors
 * Micro-utility: Unified system health overview for monitoring dashboards
 */

import { circuitBreakerMetrics, CircuitBreakerMetrics } from './circuit-breaker-metrics.js';
import { requestMetricsCollector, RequestMetrics } from './request-metrics.js';
import { errorClassifier, ClassifiedError } from './error-classifier.js';

export interface HealthSummary {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  circuitBreakers: {
    total: number;
    open: number;
    healthy: number;
    averageAvailability: number;
  };
  requests: {
    totalRequests: number;
    totalSuccesses: number;
    totalFailures: number;
    averageErrorRate: number;
    requestsPerMinute: number;
  };
  errors: {
    recentErrors: ClassifiedError[];
    topCategories: Array<{ category: string; count: number }>;
    criticalCount: number;
    retryableCount: number;
  };
  recommendations: string[];
}

/**
 * Generates a unified health summary from all monitoring utilities
 */
export class HealthSummaryGenerator {
  /**
   * Generate a comprehensive health summary
   * @param recentErrors - Optional list of recent errors to analyze
   * @param maxErrorCategories - Maximum number of error categories to include (default: 5)
   * @returns Complete health summary for dashboards/monitoring
   */
  generate(recentErrors: Array<Error | string | unknown> = [], maxErrorCategories: number = 5): HealthSummary {
    const circuitMetrics = circuitBreakerMetrics.getAllMetrics();
    const requestMetrics = requestMetricsCollector.getAllMetrics();
    const aggregatedRequests = requestMetricsCollector.getAggregatedMetrics();

    const classifiedErrors = recentErrors.map(e => errorClassifier.classify(e));
    const categoryCounts = errorClassifier.getCategoryCounts(recentErrors);
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxErrorCategories)
      .map(([category, count]) => ({ category, count }));

    const criticalCount = classifiedErrors.filter(e => e.severity === 'critical' || e.severity === 'high').length;
    const retryableCount = classifiedErrors.filter(e => e.isRetryable).length;

    const overall = this.determineOverallStatus(circuitMetrics, aggregatedRequests, criticalCount);
    const recommendations = this.generateRecommendations(circuitMetrics, aggregatedRequests, classifiedErrors);

    return {
      timestamp: new Date().toISOString(),
      overall,
      circuitBreakers: {
        total: circuitMetrics.length,
        open: circuitMetrics.filter(m => m.isCircuitOpen).length,
        healthy: circuitMetrics.filter(m => m.isHealthy).length,
        averageAvailability: this.calculateAverage(circuitMetrics.map(m => m.availability)) || 100,
      },
      requests: {
        totalRequests: aggregatedRequests.totalRequests,
        totalSuccesses: aggregatedRequests.totalSuccesses,
        totalFailures: aggregatedRequests.totalFailures,
        averageErrorRate: aggregatedRequests.averageErrorRate,
        requestsPerMinute: requestMetrics.reduce((sum, m) => sum + m.requestsPerMinute, 0),
      },
      errors: {
        recentErrors: classifiedErrors.slice(0, 10),
        topCategories,
        criticalCount,
        retryableCount,
      },
      recommendations,
    };
  }

  /**
   * Generate a compact one-line status for quick monitoring
   * @returns Single line summary like "OK: 99.9% avail, 0 errors, 150 req/min"
   */
  generateCompact(): string {
    const circuitMetrics = circuitBreakerMetrics.getAllMetrics();
    const aggregatedRequests = requestMetricsCollector.getAggregatedMetrics();

    const openCircuits = circuitMetrics.filter(m => m.isCircuitOpen).length;
    const criticalErrors = errorClassifier.getMostCommonCategory([])?.count || 0;
    const rpm = aggregatedRequests.operationsCount > 0 
      ? aggregatedRequests.totalRequests 
      : 0;

    if (openCircuits > 0) {
      return `DEGRADED: ${openCircuits} circuit(s) open, ${aggregatedRequests.averageErrorRate.toFixed(1)}% errors`;
    }

    if (aggregatedRequests.averageErrorRate > 5) {
      return `DEGRADED: ${aggregatedRequests.averageErrorRate.toFixed(1)}% error rate`;
    }

    return `HEALTHY: ${(100 - aggregatedRequests.averageErrorRate).toFixed(1)}% success, ${rpm} total requests`;
  }

  private determineOverallStatus(
    circuitMetrics: CircuitBreakerMetrics[],
    requests: ReturnType<typeof requestMetricsCollector.getAggregatedMetrics>,
    criticalErrors: number
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (criticalErrors > 0) return 'unhealthy';
    if (circuitMetrics.some(m => m.isCircuitOpen)) return 'unhealthy';
    if (requests.averageErrorRate > 10) return 'degraded';
    if (requests.averageErrorRate > 5) return 'degraded';
    return 'healthy';
  }

  private generateRecommendations(
    circuitMetrics: CircuitBreakerMetrics[],
    requests: ReturnType<typeof requestMetricsCollector.getAggregatedMetrics>,
    errors: ClassifiedError[]
  ): string[] {
    const recommendations: string[] = [];

    const openCircuits = circuitMetrics.filter(m => m.isCircuitOpen);
    if (openCircuits.length > 0) {
      recommendations.push(`Investigate ${openCircuits.length} open circuit breaker(s): ${openCircuits.map(c => c.name).join(', ')}`);
    }

    if (requests.averageErrorRate > 10) {
      recommendations.push('High error rate detected - review recent error classifications');
    }

    const databaseErrors = errors.filter(e => e.category === 'database');
    if (databaseErrors.length > 0) {
      recommendations.push('Database issues detected - check connection pool and query performance');
    }

    const timeoutErrors = errors.filter(e => e.category === 'timeout');
    if (timeoutErrors.length > 0) {
      recommendations.push('Timeout errors detected - consider increasing timeout thresholds');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is operating normally');
    }

    return recommendations;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
}

/** Global singleton instance for convenient health summaries */
export const healthSummary = new HealthSummaryGenerator();
