/**
 * Request Metrics Collector Tests
 * Tests for RequestMetricsCollector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RequestMetricsCollector,
  RequestMetrics
} from '../../src/utils/request-metrics.js';

describe('RequestMetricsCollector', () => {
  let collector: RequestMetricsCollector;

  beforeEach(() => {
    collector = new RequestMetricsCollector({
      windowSizeMs: 60000,
      enabled: true,
    });
  });

  describe('Recording Requests', () => {
    it('should record successful request', () => {
      collector.recordRequest('test-operation', true, 150);

      const metrics = collector.getMetrics('test-operation');
      expect(metrics?.totalRequests).toBe(1);
      expect(metrics?.successfulRequests).toBe(1);
      expect(metrics?.failedRequests).toBe(0);
      expect(metrics?.errorRate).toBe(0);
    });

    it('should record failed request', () => {
      collector.recordRequest('test-operation', false, 200);

      const metrics = collector.getMetrics('test-operation');
      expect(metrics?.totalRequests).toBe(1);
      expect(metrics?.successfulRequests).toBe(0);
      expect(metrics?.failedRequests).toBe(1);
      expect(metrics?.errorRate).toBe(100);
    });

    it('should accumulate metrics for multiple requests', () => {
      collector.recordRequest('test-operation', true, 100);
      collector.recordRequest('test-operation', true, 200);
      collector.recordRequest('test-operation', false, 150);

      const metrics = collector.getMetrics('test-operation');
      expect(metrics?.totalRequests).toBe(3);
      expect(metrics?.successfulRequests).toBe(2);
      expect(metrics?.failedRequests).toBe(1);
      expect(metrics?.errorRate).toBeCloseTo(33.33, 1);
    });
  });

  describe('Duration Tracking', () => {
    it('should track min and max duration', () => {
      collector.recordRequest('test-operation', true, 50);
      collector.recordRequest('test-operation', true, 200);
      collector.recordRequest('test-operation', true, 100);

      const metrics = collector.getMetrics('test-operation');
      expect(metrics?.minDuration).toBe(50);
      expect(metrics?.maxDuration).toBe(200);
    });

    it('should calculate average duration', () => {
      collector.recordRequest('test-operation', true, 100);
      collector.recordRequest('test-operation', true, 200);
      collector.recordRequest('test-operation', true, 300);

      const metrics = collector.getMetrics('test-operation');
      expect(metrics?.averageDuration).toBe(200);
    });

    it('should calculate percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordRequest('test-operation', true, i);
      }

      const metrics = collector.getMetrics('test-operation');
      expect(metrics?.p50Duration).toBe(50);
      expect(metrics?.p95Duration).toBe(95);
      expect(metrics?.p99Duration).toBe(99);
    });
  });

  describe('Request Rate', () => {
    it('should track requests per minute', () => {
      const now = Date.now();
      collector.recordRequest('test-operation', true, 100, now);
      collector.recordRequest('test-operation', true, 100, now);
      collector.recordRequest('test-operation', true, 100, now);

      const metrics = collector.getMetrics('test-operation');
      expect(metrics?.requestsPerMinute).toBe(3);
    });
  });

  describe('Multiple Operations', () => {
    it('should track metrics for different operations separately', () => {
      collector.recordRequest('operation-a', true, 100);
      collector.recordRequest('operation-a', true, 100);
      collector.recordRequest('operation-b', false, 200);
      collector.recordRequest('operation-c', true, 300);

      const metricsA = collector.getMetrics('operation-a');
      const metricsB = collector.getMetrics('operation-b');
      const metricsC = collector.getMetrics('operation-c');

      expect(metricsA?.totalRequests).toBe(2);
      expect(metricsB?.totalRequests).toBe(1);
      expect(metricsC?.totalRequests).toBe(1);
    });

    it('should return all metrics', () => {
      collector.recordRequest('operation-a', true, 100);
      collector.recordRequest('operation-b', false, 200);

      const allMetrics = collector.getAllMetrics();
      expect(allMetrics).toHaveLength(2);
    });
  });

  describe('Top Operations', () => {
    it('should return top operations by request count', () => {
      collector.recordRequest('low', true, 100);
      collector.recordRequest('medium', true, 100);
      collector.recordRequest('medium', true, 100);
      collector.recordRequest('high', true, 100);
      collector.recordRequest('high', true, 100);
      collector.recordRequest('high', true, 100);

      const top = collector.getTopOperationsByRequestCount(2);
      expect(top).toHaveLength(2);
      expect(top[0].operation).toBe('high');
      expect(top[1].operation).toBe('medium');
    });

    it('should return top operations by error rate with enough requests', () => {
      for (let i = 0; i < 15; i++) {
        collector.recordRequest('good-op', true, 100);
      }
      for (let i = 0; i < 15; i++) {
        collector.recordRequest('bad-op', false, 100);
      }

      const top = collector.getTopOperationsByErrorRate(1);
      expect(top).toHaveLength(1);
      expect(top[0]?.operation).toBe('bad-op');
    });
  });

  describe('Aggregated Metrics', () => {
    it('should calculate aggregated metrics correctly', () => {
      collector.recordRequest('operation-a', true, 100);
      collector.recordRequest('operation-a', false, 100);
      collector.recordRequest('operation-b', true, 200);
      collector.recordRequest('operation-b', true, 200);

      const aggregated = collector.getAggregatedMetrics();

      expect(aggregated.totalRequests).toBe(4);
      expect(aggregated.totalSuccesses).toBe(3);
      expect(aggregated.totalFailures).toBe(1);
    });

    it('should identify slowest operation', () => {
      collector.recordRequest('fast', true, 50);
      collector.recordRequest('slow', true, 500);

      const aggregated = collector.getAggregatedMetrics();
      expect(aggregated.slowestOperation?.operation).toBe('slow');
    });

    it('should handle empty collector', () => {
      const emptyCollector = new RequestMetricsCollector();
      const aggregated = emptyCollector.getAggregatedMetrics();

      expect(aggregated.totalRequests).toBe(0);
      expect(aggregated.operationsCount).toBe(0);
    });
  });

  describe('Reset', () => {
    it('should reset specific operation', () => {
      collector.recordRequest('operation-a', true, 100);
      collector.recordRequest('operation-b', true, 100);

      collector.reset('operation-a');

      expect(collector.getMetrics('operation-a')).toBeNull();
      expect(collector.getMetrics('operation-b')).not.toBeNull();
    });

    it('should reset all operations', () => {
      collector.recordRequest('operation-a', true, 100);
      collector.recordRequest('operation-b', true, 100);

      collector.reset();

      const allMetrics = collector.getAllMetrics();
      expect(allMetrics).toHaveLength(0);
    });
  });

  describe('Disabled Collector', () => {
    it('should not record when disabled', () => {
      const disabledCollector = new RequestMetricsCollector({
        enabled: false,
      });

      disabledCollector.recordRequest('test', true, 100);

      const metrics = disabledCollector.getMetrics('test');
      expect(metrics).toBeNull();
    });
  });
});
