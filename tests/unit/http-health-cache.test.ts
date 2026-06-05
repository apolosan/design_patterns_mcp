import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthStatus, type HealthReport } from '../../src/health/types.js';
import { createHealthCache } from '../../src/mcp/health-cache.js';

function report(overall: HealthStatus): HealthReport {
  return {
    overall,
    timestamp: new Date().toISOString(),
    duration: 1,
    checks: [],
    summary: { total: 1, healthy: overall === HealthStatus.HEALTHY ? 1 : 0, degraded: overall === HealthStatus.DEGRADED ? 1 : 0, unhealthy: overall === HealthStatus.UNHEALTHY ? 1 : 0, unknown: 0 },
  };
}

describe('createHealthCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined when empty', () => {
    const cache = createHealthCache({ ttlMs: 1000 });
    expect(cache.get()).toBeUndefined();
  });

  it('stores and returns the latest report', () => {
    const cache = createHealthCache({ ttlMs: 1000 });
    const r = report(HealthStatus.HEALTHY);
    cache.set(r);
    expect(cache.get()).toBe(r);
  });

  it('returns undefined when TTL has elapsed', () => {
    const cache = createHealthCache({ ttlMs: 1000 });
    cache.set(report(HealthStatus.HEALTHY));
    vi.advanceTimersByTime(1001);
    expect(cache.get()).toBeUndefined();
  });

  it('returns cached report within TTL', () => {
    const cache = createHealthCache({ ttlMs: 1000 });
    const r = report(HealthStatus.HEALTHY);
    cache.set(r);
    vi.advanceTimersByTime(500);
    expect(cache.get()).toBe(r);
  });

  it('overwrites previous report on subsequent set', () => {
    const cache = createHealthCache({ ttlMs: 1000 });
    const a = report(HealthStatus.HEALTHY);
    const b = report(HealthStatus.DEGRADED);
    cache.set(a);
    cache.set(b);
    expect(cache.get()).toBe(b);
  });

  it('clear() removes cached entry', () => {
    const cache = createHealthCache({ ttlMs: 1000 });
    cache.set(report(HealthStatus.HEALTHY));
    cache.clear();
    expect(cache.get()).toBeUndefined();
  });

  it('uses default TTL of 5000ms when no option given', () => {
    const cache = createHealthCache();
    cache.set(report(HealthStatus.HEALTHY));
    vi.advanceTimersByTime(4999);
    expect(cache.get()).toBeDefined();
    vi.advanceTimersByTime(2);
    expect(cache.get()).toBeUndefined();
  });
});
