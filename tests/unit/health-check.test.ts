/**
 * Health Check Components Tests
 * Tests for health check types and utilities
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, test, expect } from 'vitest';
import { HealthStatus, HealthUtils, HealthCheckSeverity } from '../../src/health/types.js';

describe('Health Check Types and Utilities', () => {

  test('should calculate overall status correctly', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
    const results = [
      { status: HealthStatus.HEALTHY },
      { status: HealthStatus.HEALTHY },
      { status: HealthStatus.DEGRADED },
    ] as any[];

    const overall = HealthUtils.calculateOverallStatus(results);
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
    expect(overall).toBe(HealthStatus.DEGRADED);
  });

  test('should create proper result objects', () => {
    const result = HealthUtils.createResult(
      'test-check',
      HealthStatus.HEALTHY,
      'Test message',
      100,
      { key: 'value' },
      undefined,
      HealthCheckSeverity.LOW,
      ['test']
    );

    expect(result.name).toBe('test-check');
    expect(result.status).toBe(HealthStatus.HEALTHY);
    expect(result.message).toBe('Test message');
    expect(result.duration).toBe(100);
    expect(result.details).toEqual({ key: 'value' });
    expect(result.severity).toBe(HealthCheckSeverity.LOW);
    expect(result.tags).toEqual(['test']);
  });

  test('should create proper summary', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
    const results = [
      { status: HealthStatus.HEALTHY },
      { status: HealthStatus.HEALTHY },
      { status: HealthStatus.DEGRADED },
      { status: HealthStatus.UNHEALTHY },
      { status: HealthStatus.UNKNOWN },
    ] as any[];

    const summary = HealthUtils.createSummary(results);
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
    expect(summary.total).toBe(5);
    expect(summary.healthy).toBe(2);
    expect(summary.degraded).toBe(1);
    expect(summary.unhealthy).toBe(1);
    expect(summary.unknown).toBe(1);
  });

  test('should format duration correctly', () => {
    expect(HealthUtils.formatDuration(500)).toBe('500ms');
    expect(HealthUtils.formatDuration(1500)).toBe('1.50s');
    expect(HealthUtils.formatDuration(10000)).toBe('10.00s');
  });
});