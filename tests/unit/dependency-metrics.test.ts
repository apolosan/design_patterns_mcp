/**
 * Unit Tests for Dependency Metrics Tracker
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  DependencyTracker,
  createDependencyTracker,
} from '../../src/utils/dependency-metrics.js';

describe('DependencyTracker', () => {
  let tracker: DependencyTracker;

  beforeEach(() => {
    tracker = new DependencyTracker({
      windowSizeMs: 60000,
      maxLatencySamples: 100,
    });
  });

  describe('trackCall', () => {
    test('should track successful call', () => {
      tracker.trackCall('database', 50);

      const metrics = tracker.getMetrics('database');

      expect(metrics).toBeDefined();
      expect(metrics?.calls).toBe(1);
      expect(metrics?.successes).toBe(1);
      expect(metrics?.errors).toBe(0);
      expect(metrics?.avgLatencyMs).toBe(50);
    });

    test('should track failed call', () => {
      tracker.trackCall('api', 100, new Error('Connection failed'));

      const metrics = tracker.getMetrics('api');

      expect(metrics).toBeDefined();
      expect(metrics?.calls).toBe(1);
      expect(metrics?.successes).toBe(0);
      expect(metrics?.errors).toBe(1);
      expect(metrics?.lastError?.message).toBe('Connection failed');
    });

    test('should track multiple calls', () => {
      tracker.trackCall('database', 10);
      tracker.trackCall('database', 20);
      tracker.trackCall('database', 30);

      const metrics = tracker.getMetrics('database');

      expect(metrics?.calls).toBe(3);
      expect(metrics?.successes).toBe(3);
      expect(metrics?.avgLatencyMs).toBe(20);
    });

    test('should handle multiple dependencies', () => {
      tracker.trackCall('database', 50);
      tracker.trackCall('api', 100, new Error('API error'));
      tracker.trackCall('cache', 5);

      expect(tracker.getDependencyNames()).toEqual(['database', 'api', 'cache']);
      expect(tracker.getTotalCalls()).toBe(3);
      expect(tracker.getTotalErrors()).toBe(1);
    });

    test('should calculate latency percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        tracker.trackCall('api', i * 10);
      }

      const metrics = tracker.getMetrics('api');

      expect(metrics?.p50LatencyMs).toBe(510);
      expect(metrics?.p95LatencyMs).toBe(960);
      expect(metrics?.p99LatencyMs).toBe(1000);
      expect(metrics?.minLatencyMs).toBe(10);
      expect(metrics?.maxLatencyMs).toBe(1000);
    });

    test('should calculate error rate', () => {
      for (let i = 0; i < 9; i++) {
        tracker.trackCall('service', 50);
      }
      tracker.trackCall('service', 100, new Error('Failed'));

      const metrics = tracker.getMetrics('service');

      expect(metrics?.calls).toBe(10);
      expect(metrics?.errorRate).toBe(0.1);
    });

    test('should calculate availability', () => {
      for (let i = 0; i < 8; i++) {
        tracker.trackCall('service', 50);
      }
      tracker.trackCall('service', 100, new Error('Failed'));

      const metrics = tracker.getMetrics('service');

      expect(metrics?.calls).toBe(9);
      expect(metrics?.errorRate).toBeCloseTo(0.1111, 4);
      expect(metrics?.availability).toBeCloseTo(0.8889, 4);
    });
  });

  describe('trackTimeout', () => {
    test('should track timeout as failed call', () => {
      tracker.trackTimeout('api');

      const metrics = tracker.getMetrics('api');

      expect(metrics).toBeDefined();
      expect(metrics?.calls).toBe(1);
      expect(metrics?.timeouts).toBe(1);
      expect(metrics?.errors).toBe(0);
      expect(metrics?.successes).toBe(0);
      expect(metrics?.lastError?.code).toBe('TIMEOUT');
    });
  });

  describe('getMetrics', () => {
    test('should return undefined for unknown dependency', () => {
      const metrics = tracker.getMetrics('unknown');

      expect(metrics).toBeUndefined();
    });

    test('should return all metrics for known dependency', () => {
      tracker.trackCall('db', 25);
      tracker.trackCall('db', 75);

      const metrics = tracker.getMetrics('db');

      expect(metrics).toBeDefined();
      expect(metrics?.name).toBe('db');
      expect(metrics?.calls).toBe(2);
      expect(metrics?.avgLatencyMs).toBe(50);
      expect(metrics?.p50LatencyMs).toBe(75);
      expect(metrics?.p95LatencyMs).toBe(75);
    });
  });

  describe('getAllMetrics', () => {
    test('should return metrics for all dependencies', () => {
      tracker.trackCall('db', 50);
      tracker.trackCall('api', 100, new Error('Err'));

      const allMetrics = tracker.getAllMetrics();

      expect(allMetrics.size).toBe(2);
      expect(allMetrics.get('db')?.calls).toBe(1);
      expect(allMetrics.get('api')?.calls).toBe(1);
    });

    test('should return empty map when no dependencies', () => {
      const allMetrics = tracker.getAllMetrics();

      expect(allMetrics.size).toBe(0);
    });
  });

  describe('getUnhealthyDependencies', () => {
    test('should identify high error rate dependencies', () => {
      for (let i = 0; i < 5; i++) {
        tracker.trackCall('healthy', 50);
      }
      for (let i = 0; i < 2; i++) {
        tracker.trackCall('unhealthy', 50, new Error('Err'));
      }

      const unhealthy = tracker.getUnhealthyDependencies();

      expect(unhealthy.length).toBe(1);
      expect(unhealthy[0]).toContain('unhealthy');
    });

    test('should identify slow dependencies', () => {
      tracker.trackCall('fast', 50);

      for (let i = 0; i < 100; i++) {
        tracker.trackCall('slow', 6000);
      }

      const unhealthy = tracker.getUnhealthyDependencies();

      expect(unhealthy.length).toBe(1);
      expect(unhealthy[0]).toContain('slow');
    });

    test('should return empty array when all healthy', () => {
      for (let i = 0; i < 10; i++) {
        tracker.trackCall('service', 50);
      }

      const unhealthy = tracker.getUnhealthyDependencies();

      expect(unhealthy.length).toBe(0);
    });
  });

  describe('getSlowDependencies', () => {
    test('should identify dependencies exceeding threshold', () => {
      tracker.trackCall('fast', 100);
      tracker.trackCall('slow', 2000);

      const slow = tracker.getSlowDependencies(1000);

      expect(slow.length).toBe(1);
      expect(slow[0]).toContain('slow');
    });

    test('should return empty array when none exceed threshold', () => {
      tracker.trackCall('fast1', 100);
      tracker.trackCall('fast2', 500);

      const slow = tracker.getSlowDependencies(1000);

      expect(slow.length).toBe(0);
    });
  });

  describe('getErrorSummary', () => {
    test('should aggregate errors by code', () => {
      tracker.trackCall('api1', 100, Object.assign(new Error('timeout'), { code: 'TIMEOUT' }));
      tracker.trackCall('api2', 100, Object.assign(new Error('timeout'), { code: 'TIMEOUT' }));
      tracker.trackCall('api3', 100, Object.assign(new Error('not found'), { code: 'NOT_FOUND' }));

      const summary = tracker.getErrorSummary();

      expect(summary.get('TIMEOUT')).toBe(2);
      expect(summary.get('NOT_FOUND')).toBe(1);
    });
  });

  describe('reset', () => {
    test('should clear all tracked dependencies', () => {
      tracker.trackCall('db', 50);
      tracker.trackCall('api', 100);

      tracker.reset();

      expect(tracker.getDependencyNames().length).toBe(0);
      expect(tracker.getTotalCalls()).toBe(0);
    });
  });

  describe('resetDependency', () => {
    test('should remove specific dependency', () => {
      tracker.trackCall('db', 50);
      tracker.trackCall('api', 100);

      tracker.resetDependency('db');

      expect(tracker.hasDependency('db')).toBe(false);
      expect(tracker.hasDependency('api')).toBe(true);
      expect(tracker.getTotalCalls()).toBe(1);
    });
  });

  describe('getDependencyNames', () => {
    test('should return all tracked dependency names', () => {
      tracker.trackCall('db', 50);
      tracker.trackCall('api', 100);
      tracker.trackCall('cache', 5);

      const names = tracker.getDependencyNames();

      expect(names).toEqual(['db', 'api', 'cache']);
    });
  });

  describe('hasDependency', () => {
    test('should return true for tracked dependency', () => {
      tracker.trackCall('db', 50);

      expect(tracker.hasDependency('db')).toBe(true);
      expect(tracker.hasDependency('unknown')).toBe(false);
    });
  });

  describe('getTotalCalls', () => {
    test('should sum calls across all dependencies', () => {
      tracker.trackCall('db', 50);
      tracker.trackCall('api', 100);
      tracker.trackCall('cache', 5);

      expect(tracker.getTotalCalls()).toBe(3);
    });
  });

  describe('getTotalErrors', () => {
    test('should sum errors across all dependencies', () => {
      tracker.trackCall('db', 50);
      tracker.trackCall('api', 100, new Error('Err1'));
      tracker.trackCall('cache', 5);
      tracker.trackCall('queue', 50, new Error('Err2'));

      expect(tracker.getTotalErrors()).toBe(2);
    });
  });

  describe('getOverallErrorRate', () => {
    test('should calculate combined error rate', () => {
      tracker.trackCall('db', 50);
      tracker.trackCall('api', 100, new Error('Err'));

      expect(tracker.getOverallErrorRate()).toBe(0.5);
    });

    test('should return 0 when no calls', () => {
      expect(tracker.getOverallErrorRate()).toBe(0);
    });
  });

  describe('windowSizeMs option', () => {
    test('should respect window size for latency calculation', () => {
      const windowedTracker = new DependencyTracker({
        windowSizeMs: 100,
        maxLatencySamples: 1000,
      });

      windowedTracker.trackCall('service', 10);

      const metrics1 = windowedTracker.getMetrics('service');
      expect(metrics1?.calls).toBe(1);

      setTimeout(() => {
        windowedTracker.trackCall('service', 100);

        const metrics2 = windowedTracker.getMetrics('service');
        expect(metrics2?.calls).toBe(2);
      }, 150);
    });
  });

  describe('createDependencyTracker factory', () => {
    test('should create tracker with options', () => {
      const factoryTracker = createDependencyTracker({
        windowSizeMs: 30000,
        maxLatencySamples: 500,
      });

      factoryTracker.trackCall('test', 100);

      const metrics = factoryTracker.getMetrics('test');
      expect(metrics?.calls).toBe(1);
    });
  });

  describe('error code extraction', () => {
    test('should extract ECONNREFUSED code', () => {
      tracker.trackCall('db', 50, new Error('connect ECONNREFUSED'));

      const metrics = tracker.getMetrics('db');

      expect(metrics?.lastError?.code).toBe('ECONNREFUSED');
    });

    test('should extract TIMEOUT code', () => {
      tracker.trackCall('api', 5000, new Error('Request timeout'));

      const metrics = tracker.getMetrics('api');

      expect(metrics?.lastError?.code).toBe('TIMEOUT');
    });

    test('should preserve explicit error code', () => {
      const error = new Error('Custom error') as Error & { code?: string };
      error.code = 'CUSTOM_CODE';

      tracker.trackCall('service', 50, error);

      const metrics = tracker.getMetrics('service');

      expect(metrics?.lastError?.code).toBe('CUSTOM_CODE');
    });
  });

  describe('latency sample management', () => {
    test('should limit latency samples to maxLatencySamples', () => {
      const limitedTracker = new DependencyTracker({
        windowSizeMs: 60000,
        maxLatencySamples: 5,
      });

      for (let i = 0; i < 10; i++) {
        limitedTracker.trackCall('service', i * 10);
      }

      const metrics = limitedTracker.getMetrics('service');
      expect(metrics?.calls).toBe(10);
    });
  });
});
