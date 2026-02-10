/**
 * Circuit Breaker Metrics Tests
 * Tests for CircuitBreakerMetricsCollector
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitBreakerState } from '../../src/utils/circuit-breaker.js';
import {
  CircuitBreakerMetricsCollector,
  CircuitBreakerMetrics
} from '../../src/utils/circuit-breaker-metrics.js';

describe('CircuitBreakerMetricsCollector', () => {
  let collector: CircuitBreakerMetricsCollector;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    collector = new CircuitBreakerMetricsCollector();
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 5000,
      successThreshold: 2,
      name: 'test-breaker',
    });
  });

  describe('Registration', () => {
    it('should register a circuit breaker', () => {
      collector.register('test', breaker);

      const metrics = collector.getMetrics('test');
      expect(metrics).not.toBeNull();
      expect(metrics?.name).toBe('test');
    });

    it('should return null for unregistered breaker', () => {
      const metrics = collector.getMetrics('unknown');
      expect(metrics).toBeNull();
    });

    it('should unregister a circuit breaker', () => {
      collector.register('test', breaker);
      collector.unregister('test');

      const metrics = collector.getMetrics('test');
      expect(metrics).toBeNull();
    });

    it('should return all metrics', () => {
      const breaker2 = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 1000,
        monitoringPeriod: 5000,
        successThreshold: 2,
        name: 'test-breaker-2',
      });

      collector.register('breaker1', breaker);
      collector.register('breaker2', breaker2);

      const allMetrics = collector.getAllMetrics();
      expect(allMetrics).toHaveLength(2);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate failure rate correctly', async () => {
      collector.register('test', breaker);

      const succeedOp = async () => 'success';
      const failOp = async () => { throw new Error('fail'); };

      await breaker.execute(succeedOp);
      await expect(breaker.execute(failOp)).rejects.toThrow();
      await expect(breaker.execute(failOp)).rejects.toThrow();

      const metrics = collector.getMetrics('test');
      expect(metrics?.totalRequests).toBe(3);
      expect(metrics?.totalSuccesses).toBe(1);
      expect(metrics?.totalFailures).toBe(2);
      expect(metrics?.failureRate).toBeCloseTo(66.67, 1);
      expect(metrics?.successRate).toBeCloseTo(33.33, 1);
    });

    it('should indicate healthy state correctly', async () => {
      collector.register('test', breaker);

      const succeedOp = async () => 'success';
      await breaker.execute(succeedOp);

      const metrics = collector.getMetrics('test');
      expect(metrics?.isHealthy).toBe(true);
      expect(metrics?.isCircuitOpen).toBe(false);
      expect(metrics?.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should indicate open circuit correctly', async () => {
      collector.register('test', breaker);

      const failOp = async () => { throw new Error('fail'); };

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failOp)).rejects.toThrow();
      }

      const metrics = collector.getMetrics('test');
      expect(metrics?.isHealthy).toBe(false);
      expect(metrics?.isCircuitOpen).toBe(true);
      expect(metrics?.state).toBe(CircuitBreakerState.OPEN);
    });

    it('should calculate availability', async () => {
      collector.register('test', breaker);

      const succeedOp = async () => 'success';
      const failOp = async () => { throw new Error('fail'); };

      await breaker.execute(succeedOp);
      await breaker.execute(succeedOp);
      await expect(breaker.execute(failOp)).rejects.toThrow();

      const metrics = collector.getMetrics('test');
      expect(metrics?.availability).toBeCloseTo(66.67, 1);
      expect(metrics?.errorRate).toBeCloseTo(33.33, 1);
    });

    it('should track time since last events', async () => {
      collector.register('test', breaker);

      const succeedOp = async () => 'success';
      await breaker.execute(succeedOp);

      const metrics = collector.getMetrics('test');
      expect(metrics?.timeSinceLastSuccess).toBeDefined();
      expect(metrics?.timeSinceLastSuccess).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Aggregated Metrics', () => {
    it('should calculate aggregated metrics correctly', async () => {
      const succeedOp = async () => 'success';

      await breaker.execute(succeedOp);

      collector.register('breaker1', breaker);

      const aggregated = collector.getAggregatedMetrics();

      expect(aggregated.totalRequests).toBe(1);
      expect(aggregated.totalSuccesses).toBe(1);
      expect(aggregated.totalFailures).toBe(0);
      expect(aggregated.healthyCircuits).toBe(1);
    });

    it('should handle empty collector', () => {
      const emptyCollector = new CircuitBreakerMetricsCollector();
      const aggregated = emptyCollector.getAggregatedMetrics();

      expect(aggregated.totalRequests).toBe(0);
      expect(aggregated.totalSuccesses).toBe(0);
      expect(aggregated.totalFailures).toBe(0);
      expect(aggregated.averageAvailability).toBe(100);
      expect(aggregated.openCircuits).toBe(0);
      expect(aggregated.healthyCircuits).toBe(0);
    });
  });
});
