/**
 * Health Check Components Tests
 * Tests for health check types and utilities
 */
import { describe, test, expect } from 'vitest';
import { HealthStatus, HealthUtils, HealthCheckSeverity, HealthCheckResult } from '../../src/health/types.js';

describe('Health Check Types and Utilities', () => {

  // Helper to create minimal result for testing status calculations
  const createStatusResult = (status: HealthStatus): HealthCheckResult => ({
    name: 'test-check',
    status,
    message: 'test message',
    timestamp: new Date().toISOString(),
    duration: 100
  });

  test('should calculate overall status correctly', () => {
    const results: HealthCheckResult[] = [
      createStatusResult(HealthStatus.HEALTHY),
      createStatusResult(HealthStatus.HEALTHY),
      createStatusResult(HealthStatus.DEGRADED),
    ];

    const overall = HealthUtils.calculateOverallStatus(results);
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
    const results: HealthCheckResult[] = [
      createStatusResult(HealthStatus.HEALTHY),
      createStatusResult(HealthStatus.HEALTHY),
      createStatusResult(HealthStatus.DEGRADED),
      createStatusResult(HealthStatus.UNHEALTHY),
      createStatusResult(HealthStatus.UNKNOWN),
    ];

    const summary = HealthUtils.createSummary(results);
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
