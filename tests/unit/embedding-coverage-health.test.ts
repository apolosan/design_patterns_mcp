/**
 * RED→GREEN test for EmbeddingCoverageHealthCheck (L1+L7 fix).
 *
 * Bug: vector-operations check reports HEALTHY when totalVectors=0.
 * Fix: dedicated single-responsibility EmbeddingCoverageHealthCheck.
 */
import { describe, test, expect } from 'vitest';
import {
  EmbeddingCoverageHealthCheck,
  DEFAULT_COVERAGE_THRESHOLD,
  DEGRADED_COVERAGE_THRESHOLD,
} from '../../src/health/embedding-coverage-health-check.js';
import { HealthStatus } from '../../src/health/types.js';

class FakeStats {
  constructor(
    public totalVectors: number,
    public patternCount: number
  ) {}
  getTotalVectors(): number { return this.totalVectors; }
  getPatternCount(): number { return this.patternCount; }
}

describe('EmbeddingCoverageHealthCheck (L1+L7 fix)', () => {
  test('REGRESSION: reports UNHEALTHY when totalVectors=0 with patterns present', async () => {
    const check = new EmbeddingCoverageHealthCheck(new FakeStats(0, 686));
    const result = await check.check();
    expect(result.status).toBe(HealthStatus.UNHEALTHY);
    expect(result.message).toMatch(/EMPTY/i);
    expect(result.details?.['totalVectors']).toBe(0);
    expect(result.details?.['patternCount']).toBe(686);
    expect(result.details?.['coverageRatio']).toBe(0);
  });

  test('reports HEALTHY when coverage >= 95%', async () => {
    const check = new EmbeddingCoverageHealthCheck(new FakeStats(700, 686));
    const result = await check.check();
    expect(result.status).toBe(HealthStatus.HEALTHY);
    expect(result.details?.['coverageRatio']).toBeGreaterThanOrEqual(DEFAULT_COVERAGE_THRESHOLD);
  });

  test('reports DEGRADED when coverage is between 50% and 95%', async () => {
    const check = new EmbeddingCoverageHealthCheck(new FakeStats(400, 686));
    const result = await check.check();
    expect(result.status).toBe(HealthStatus.DEGRADED);
    expect(result.details?.['coverageRatio']).toBeGreaterThanOrEqual(DEGRADED_COVERAGE_THRESHOLD);
    expect(result.details?.['coverageRatio']).toBeLessThan(DEFAULT_COVERAGE_THRESHOLD);
  });

  test('edge case: empty catalog (0 patterns, 0 vectors) is HEALTHY', async () => {
    const check = new EmbeddingCoverageHealthCheck(new FakeStats(0, 0));
    const result = await check.check();
    expect(result.status).toBe(HealthStatus.HEALTHY);
  });

  test('edge case: custom thresholds honored (600/686 = 87.5% with threshold 80% -> HEALTHY)', async () => {
    const check = new EmbeddingCoverageHealthCheck(
      new FakeStats(600, 686),
      { coverageThreshold: 0.80, degradedThreshold: 0.30 }
    );
    const result = await check.check();
    expect(result.status).toBe(HealthStatus.HEALTHY);
  });
});
