/**
 * T9: Fuzzy health check — RED test.
 * Asserts that a FuzzyHealthCheck class exposes a `check()` method that
 * returns a structured HealthReport with sub-checks (membership bounds,
 * rule activation, calibration record).
 */
import { describe, it, expect } from 'vitest';
import { FuzzyHealthCheck } from '../../src/services/fuzzy-health-check.js';

describe('FuzzyHealthCheck', () => {
  it('returns a report with three sub-checks', async () => {
    const checker = new FuzzyHealthCheck();
    const report = await checker.check();

    expect(report).toBeDefined();
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.checks.length).toBeGreaterThanOrEqual(3);

    const names = report.checks.map((c) => c.name);
    expect(names).toContain('membership-function-bounds');
    expect(names).toContain('inference-rules-active');
    expect(names).toContain('calibration-record');

    for (const c of report.checks) {
      expect(['healthy', 'warning', 'unhealthy']).toContain(c.status);
      expect(typeof c.durationMs).toBe('number');
    }
  });

  it('reports overall status aggregating the sub-checks', async () => {
    const checker = new FuzzyHealthCheck();
    const report = await checker.check();
    expect(['healthy', 'warning', 'unhealthy']).toContain(report.overallStatus);
  });
});
