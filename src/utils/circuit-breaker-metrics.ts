/**
 * Circuit Breaker Metrics
 * Provides derived metrics from CircuitBreaker stats for observability
 * Micro-utility: Transform CircuitBreaker statistics into actionable metrics
 */

import { CircuitBreaker, CircuitBreakerStats, CircuitBreakerState } from './circuit-breaker.js';

/**
 * Derived metrics from CircuitBreaker statistics for monitoring and alerting
 */
export interface CircuitBreakerMetrics {
  /** Name identifier for this circuit breaker */
  name: string;
  /** Current state of the circuit (CLOSED, OPEN, HALF_OPEN) */
  state: CircuitBreakerState;
  /** Percentage of requests that failed (0-100) */
  failureRate: number;
  /** Percentage of requests that succeeded (0-100) */
  successRate: number;
  /** Overall availability percentage (0-100) */
  availability: number;
  /** Error rate percentage (0-100) */
  errorRate: number;
  /** Total number of requests processed */
  totalRequests: number;
  /** Total number of failed requests */
  totalFailures: number;
  /** Total number of successful requests */
  totalSuccesses: number;
  /** Timestamp of the last failure (Unix epoch ms) */
  lastFailureTime?: number;
  /** Timestamp of the last success (Unix epoch ms) */
  lastSuccessTime?: number;
  /** Whether the circuit is healthy (CLOSED state) */
  isHealthy: boolean;
  /** Whether the circuit is open (failing fast) */
  isCircuitOpen: boolean;
  /** Time in ms since the last failure */
  timeSinceLastFailure?: number;
  /** Time in ms since the last success */
  timeSinceLastSuccess?: number;
}

/**
 * Collects and aggregates metrics from multiple CircuitBreaker instances
 */
export class CircuitBreakerMetricsCollector {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Register a circuit breaker for metric collection
   * @param name - Unique identifier for this circuit breaker
   * @param breaker - CircuitBreaker instance to monitor
   */
  register(name: string, breaker: CircuitBreaker): void {
    this.breakers.set(name, breaker);
  }

  /**
   * Unregister a circuit breaker from metric collection
   * @param name - Name of the circuit breaker to remove
   */
  unregister(name: string): void {
    this.breakers.delete(name);
  }

  /**
   * Get metrics for a specific circuit breaker by name
   * @param name - Name of the circuit breaker
   * @returns Derived metrics or null if not found
   */
  getMetrics(name: string): CircuitBreakerMetrics | null {
    const breaker = this.breakers.get(name);
    if (!breaker) return null;

    return this.calculateMetrics(name, breaker.getStats());
  }

  /**
   * Get metrics for all registered circuit breakers
   * @returns Array of metrics for each circuit breaker
   */
  getAllMetrics(): CircuitBreakerMetrics[] {
    const metrics: CircuitBreakerMetrics[] = [];

    for (const [name, breaker] of this.breakers.entries()) {
      metrics.push(this.calculateMetrics(name, breaker.getStats()));
    }

    return metrics;
  }

  /**
   * Get aggregated metrics across all circuit breakers
   * @returns Summary statistics for monitoring dashboards
   */
  getAggregatedMetrics(): {
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
    averageAvailability: number;
    openCircuits: number;
    healthyCircuits: number;
  } {
    const allMetrics = this.getAllMetrics();

    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalFailures = allMetrics.reduce((sum, m) => sum + m.totalFailures, 0);
    const totalSuccesses = allMetrics.reduce((sum, m) => sum + m.totalSuccesses, 0);
    const averageAvailability = allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.availability, 0) / allMetrics.length
      : 100;
    const openCircuits = allMetrics.filter(m => m.isCircuitOpen).length;
    const healthyCircuits = allMetrics.filter(m => m.isHealthy).length;

    return {
      totalRequests,
      totalFailures,
      totalSuccesses,
      averageAvailability,
      openCircuits,
      healthyCircuits,
    };
  }

  private calculateMetrics(name: string, stats: CircuitBreakerStats): CircuitBreakerMetrics {
    const now = Date.now();
    const total = stats.totalRequests || 1;

    const failureRate = (stats.totalFailures / total) * 100;
    const successRate = (stats.totalSuccesses / total) * 100;
    const availability = ((total - stats.totalFailures) / total) * 100;
    const errorRate = (stats.totalFailures / total) * 100;

    return {
      name,
      state: stats.state,
      failureRate: Math.round(failureRate * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      availability: Math.round(availability * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      totalRequests: stats.totalRequests,
      totalFailures: stats.totalFailures,
      totalSuccesses: stats.totalSuccesses,
      lastFailureTime: stats.lastFailureTime,
      lastSuccessTime: stats.lastSuccessTime,
      isHealthy: stats.state === CircuitBreakerState.CLOSED,
      isCircuitOpen: stats.state === CircuitBreakerState.OPEN,
      timeSinceLastFailure: stats.lastFailureTime ? now - stats.lastFailureTime : undefined,
      timeSinceLastSuccess: stats.lastSuccessTime ? now - stats.lastSuccessTime : undefined,
    };
  }
}

/** Global singleton instance for convenient metric collection */
export const circuitBreakerMetrics = new CircuitBreakerMetricsCollector();
