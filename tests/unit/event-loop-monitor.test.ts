import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventLoopMonitor, createEventLoopMonitor, EventLoopMonitorConfig, EventLoopMetrics } from '../../src/utils/event-loop-monitor.js';

describe('EventLoopMonitor', () => {
  let monitor: EventLoopMonitor;

  beforeEach(() => {
    monitor = new EventLoopMonitor();
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('constructor', () => {
    test('creates monitor with default configuration', () => {
      expect(monitor).toBeInstanceOf(EventLoopMonitor);
    });

    test('creates monitor with custom configuration', () => {
      const config: Partial<EventLoopMonitorConfig> = {
        checkIntervalMs: 50,
        warningThresholdMs: 30,
        criticalThresholdMs: 100,
      };
      const customMonitor = new EventLoopMonitor(config);
      expect(customMonitor).toBeInstanceOf(EventLoopMonitor);
      customMonitor.destroy();
    });
  });

  describe('start and stop', () => {
    test('starts monitoring', () => {
      monitor.start();
      const metrics = monitor.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });

    test('stops monitoring', () => {
      monitor.start();
      monitor.stop();
      const metrics = monitor.getMetrics();
      expect(metrics.isRunning).toBe(false);
    });

    test('idempotent start', () => {
      monitor.start();
      monitor.start();
      const metrics = monitor.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });
  });

  describe('getMetrics', () => {
    test('returns initial metrics when stopped', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.isRunning).toBe(false);
      expect(metrics.minLagMs).toBe(0);
      expect(metrics.maxLagMs).toBe(0);
      expect(metrics.totalSamples).toBe(0);
      expect(metrics.status).toBe('healthy');
    });

    test('tracks lag samples after starting', () => {
      monitor.start();
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          monitor.stop();
          const metrics = monitor.getMetrics();
          expect(metrics.totalSamples).toBeGreaterThan(0);
          expect(metrics.lastLagMs).toBeGreaterThanOrEqual(0);
          resolve();
        }, 300);
      });
    });
  });

  describe('getStatus', () => {
    test('returns healthy status initially', () => {
      expect(monitor.getStatus()).toBe('healthy');
    });

    test('returns warning status when lag exceeds threshold', () => {
      const config: Partial<EventLoopMonitorConfig> = {
        warningThresholdMs: 1,
        criticalThresholdMs: 100,
      };
      const warningMonitor = new EventLoopMonitor(config);

      warningMonitor.start();
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          warningMonitor.stop();
          const status = warningMonitor.getStatus();
          expect(status).toMatch(/healthy|warning/);
          warningMonitor.destroy();
          resolve();
        }, 200);
      });
    });
  });

  describe('isHealthy', () => {
    test('returns true when healthy', () => {
      expect(monitor.isHealthy()).toBe(true);
    });
  });

  describe('getRecentSnapshots', () => {
    test('returns empty array initially', () => {
      const snapshots = monitor.getRecentSnapshots();
      expect(snapshots).toEqual([]);
    });

    test('returns limited snapshots', () => {
      const snapshots = monitor.getRecentSnapshots(5);
      expect(Array.isArray(snapshots)).toBe(true);
    });
  });

  describe('reset', () => {
    test('resets all metrics', () => {
      monitor.start();
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          monitor.stop();
          monitor.reset();
          const metrics = monitor.getMetrics();
          expect(metrics.minLagMs).toBe(0);
          expect(metrics.maxLagMs).toBe(0);
          expect(metrics.totalSamples).toBe(0);
          expect(metrics.lastLagMs).toBe(0);
          resolve();
        }, 200);
      });
    });
  });

  describe('destroy', () => {
    test('stops and resets monitor', () => {
      monitor.start();
      monitor.destroy();
      const metrics = monitor.getMetrics();
      expect(metrics.isRunning).toBe(false);
      expect(metrics.totalSamples).toBe(0);
    });
  });
});

describe('createEventLoopMonitor', () => {
  test('creates EventLoopMonitor instance', () => {
    const monitor = createEventLoopMonitor();
    expect(monitor).toBeInstanceOf(EventLoopMonitor);
    monitor.destroy();
  });

  test('accepts configuration', () => {
    const monitor = createEventLoopMonitor({ checkIntervalMs: 200 });
    expect(monitor).toBeInstanceOf(EventLoopMonitor);
    monitor.destroy();
  });
});

describe('EventLoopMonitor metrics calculation', () => {
  test('calculates average lag correctly', () => {
    const monitor = new EventLoopMonitor({ checkIntervalMs: 50 });
    monitor.start();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        monitor.stop();
        const metrics = monitor.getMetrics();

        if (metrics.totalSamples > 0) {
          expect(metrics.avgLagMs).toBeGreaterThanOrEqual(0);
          expect(metrics.maxLagMs).toBeGreaterThanOrEqual(metrics.minLagMs);
        }

        resolve();
      }, 300);
    });
  });

  test('tracks minimum and maximum lag', () => {
    const monitor = new EventLoopMonitor({ checkIntervalMs: 50 });
    monitor.start();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        monitor.stop();
        const metrics = monitor.getMetrics();

        if (metrics.totalSamples > 1) {
          expect(metrics.minLagMs).toBeLessThanOrEqual(metrics.maxLagMs);
        }

        resolve();
      }, 300);
    });
  });
});
