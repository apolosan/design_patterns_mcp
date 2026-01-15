/**
 * Tests for Health Events (Publish-Subscribe Pattern)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  healthEventBus,
  getHealthEventBus,
  HealthCheckStartedEvent,
} from '../../src/events/health-events.js';
import { HealthStatus, HealthCheckResult } from '../../src/health/types.js';

// Helper to create a full HealthCheckResult
function createHealthCheckResult(
  name: string,
  status: HealthStatus,
  message: string,
  duration: number,
  extra?: Partial<HealthCheckResult>
): HealthCheckResult {
  return {
    name,
    status,
    message,
    duration,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

describe('Health Events', () => {
  beforeEach(() => {
    healthEventBus.clear();
  });

  afterEach(() => {
    healthEventBus.clear();
  });

  describe('getHealthEventBus', () => {
    it('should return the singleton instance', () => {
      const bus1 = getHealthEventBus();
      const bus2 = getHealthEventBus();
      expect(bus1).toBe(bus2);
    });
  });

  describe('onCheckStarted', () => {
    it('should subscribe to check started events', async () => {
      const handler = vi.fn();
      const subscription = healthEventBus.onCheckStarted(handler);

      healthEventBus.emitCheckStarted('test-check');

      await new Promise((resolve) => setTimeout(resolve, 50));

      const calls = handler.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const event = calls[0][0] as HealthCheckStartedEvent;
      expect(event.checkName).toBe('test-check');
      expect(event.timestamp).toBeInstanceOf(Date);

      subscription.unsubscribe();
    });
  });

  describe('onCheckCompleted', () => {
    it('should subscribe to check completed events', async () => {
      const handler = vi.fn();
      const subscription = healthEventBus.onCheckCompleted(handler);

      const result = createHealthCheckResult('test-check', HealthStatus.HEALTHY, 'All good', 10);

      await healthEventBus.emitCheckCompleted(result, 10);

      expect(handler).toHaveBeenCalledWith({
        result,
        duration: 10,
      });

      subscription.unsubscribe();
    });
  });

  describe('onStatusChanged', () => {
    it('should emit status changed when status changes', async () => {
      const handler = vi.fn();
      const subscription = healthEventBus.onStatusChanged(handler);

      // First call to set initial status
      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.HEALTHY, 'Initial', 10),
        10
      );

      // Second call with different status
      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.DEGRADED, 'Degraded', 10),
        10
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          checkName: 'test-check',
          previousStatus: HealthStatus.HEALTHY,
          currentStatus: HealthStatus.DEGRADED,
        })
      );

      subscription.unsubscribe();
    });

    it('should not emit when status stays the same', async () => {
      const handler = vi.fn();
      const subscription = healthEventBus.onStatusChanged(handler);

      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.HEALTHY, 'OK', 10),
        10
      );

      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.HEALTHY, 'Still OK', 10),
        10
      );

      expect(handler).not.toHaveBeenCalled();

      subscription.unsubscribe();
    });
  });

  describe('onDegraded', () => {
    it('should emit degraded event when status becomes degraded', async () => {
      const handler = vi.fn();
      const subscription = healthEventBus.onDegraded(handler);

      // Set initial status
      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.HEALTHY, 'OK', 10),
        10
      );

      // Transition to degraded
      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.DEGRADED, 'Slow response', 100, { details: { latency: 500 } }),
        100
      );

      expect(handler).toHaveBeenCalledWith({
        checkName: 'test-check',
        message: 'Slow response',
        details: { latency: 500 },
      });

      subscription.unsubscribe();
    });
  });

  describe('onUnhealthy', () => {
    it('should emit unhealthy event when status becomes unhealthy', async () => {
      const handler = vi.fn();
      const subscription = healthEventBus.onUnhealthy(handler);

      // Set initial status
      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.HEALTHY, 'OK', 10),
        10
      );

      // Transition to unhealthy
      const error = new Error('Connection failed');
      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.UNHEALTHY, 'Connection failed', 100, { error }),
        100
      );

      expect(handler).toHaveBeenCalledWith({
        checkName: 'test-check',
        message: 'Connection failed',
        error,
      });

      subscription.unsubscribe();
    });
  });

  describe('onRecovered', () => {
    it('should emit recovered event when status becomes healthy from degraded', async () => {
      const handler = vi.fn();
      const subscription = healthEventBus.onRecovered(handler);

      // Set initial status to degraded
      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.DEGRADED, 'Slow', 100),
        100
      );

      // Recover to healthy
      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.HEALTHY, 'Back to normal', 10),
        10
      );

      expect(handler).toHaveBeenCalledWith({
        checkName: 'test-check',
        previousStatus: HealthStatus.DEGRADED,
        message: 'Back to normal',
      });

      subscription.unsubscribe();
    });

    it('should emit recovered event when status becomes healthy from unhealthy', async () => {
      const handler = vi.fn();
      const subscription = healthEventBus.onRecovered(handler);

      // Set initial status to unhealthy
      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.UNHEALTHY, 'Down', 100),
        100
      );

      // Recover to healthy
      await healthEventBus.emitCheckCompleted(
        createHealthCheckResult('test-check', HealthStatus.HEALTHY, 'Recovered', 10),
        10
      );

      expect(handler).toHaveBeenCalledWith({
        checkName: 'test-check',
        previousStatus: HealthStatus.UNHEALTHY,
        message: 'Recovered',
      });

      subscription.unsubscribe();
    });
  });

  describe('onReportGenerated', () => {
    it('should subscribe to report generated events', async () => {
      const handler = vi.fn();
      const subscription = healthEventBus.onReportGenerated(handler);

      const report = {
        overall: HealthStatus.HEALTHY,
        timestamp: new Date().toISOString(),
        duration: 50,
        checks: [],
        summary: {
          total: 3,
          healthy: 3,
          degraded: 0,
          unhealthy: 0,
          unknown: 0,
        },
      };

      healthEventBus.emitReportGenerated(report);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledWith({ report });

      subscription.unsubscribe();
    });
  });

  describe('getEventBus', () => {
    it('should return the underlying event bus', () => {
      const eventBus = healthEventBus.getEventBus();
      expect(eventBus).toBeDefined();
      expect(typeof eventBus.subscribe).toBe('function');
      expect(typeof eventBus.publish).toBe('function');
    });
  });

  describe('clear', () => {
    it('should clear all subscriptions and status history', async () => {
      const handler = vi.fn();
      healthEventBus.onCheckStarted(handler);

      healthEventBus.clear();

      healthEventBus.emitCheckStarted('test');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
