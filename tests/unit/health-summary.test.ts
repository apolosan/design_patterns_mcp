/**
 * Health Summary Utility Tests
 */

import { describe, test, expect } from 'vitest';
import { HealthSummaryGenerator, healthSummary } from '../../src/utils/health-summary.js';

describe('HealthSummaryGenerator', () => {
  describe('generateCompact', () => {
    test('returns HEALTHY when no issues', () => {
      const result = healthSummary.generateCompact();
      expect(result).toContain('HEALTHY');
    });
  });

  describe('generate', () => {
    test('returns basic structure with no data', () => {
      const result = healthSummary.generate([]);

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('circuitBreakers');
      expect(result).toHaveProperty('requests');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('recommendations');
    });

    test('classifies errors correctly', () => {
      const errors = [
        new Error('Database connection failed'),
        new Error('Request timeout'),
        'Authentication failed',
      ];

      const result = healthSummary.generate(errors);

      expect(result.errors.recentErrors).toHaveLength(3);
      expect(result.errors.topCategories.length).toBeGreaterThan(0);
    });

    test('includes recommendations', () => {
      const result = healthSummary.generate([]);

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('limits error categories', () => {
      const errors = Array(20).fill(null).map((_, i) => new Error(`Error ${i}`));

      const result = healthSummary.generate(errors, 3);

      expect(result.errors.topCategories.length).toBeLessThanOrEqual(3);
    });
  });

  describe('overall status determination', () => {
    test('returns unhealthy for database errors', () => {
      const result = healthSummary.generate([
        new Error('Database connection refused'),
      ]);

      expect(result.overall).toBe('unhealthy');
    });

    test('returns degraded for high error rates', () => {
      const errors = Array(15).fill(null).map(() => new Error('Database error'));

      const result = healthSummary.generate(errors);

      expect(result.overall).toMatch(/degraded|unhealthy/);
    });
  });

  describe('recommendations generation', () => {
    test('includes system normal recommendation when healthy', () => {
      const result = healthSummary.generate([]);

      expect(result.recommendations).toContain('System is operating normally');
    });

    test('provides actionable recommendations', () => {
      const errors = [new Error('Database connection failed')];

      const result = healthSummary.generate(errors);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('error classification', () => {
    test('counts error categories', () => {
      const errors = [
        new Error('DB error 1'),
        new Error('DB error 2'),
        new Error('Timeout error'),
      ];

      const result = healthSummary.generate(errors);

      expect(result.errors.topCategories.length).toBeGreaterThan(0);
    });

    test('identifies retryable errors', () => {
      const errors = [
        new Error('Timeout waiting for response'),
        new Error('Database connection failed'),
      ];

      const result = healthSummary.generate(errors);

      expect(result.errors.retryableCount).toBeGreaterThan(0);
    });
  });

  describe('timestamp format', () => {
    test('returns ISO 8601 timestamp', () => {
      const result = healthSummary.generate([]);

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });
});

describe('healthSummary singleton', () => {
  test('is an instance of HealthSummaryGenerator', () => {
    expect(healthSummary).toBeInstanceOf(HealthSummaryGenerator);
  });

  test('generate returns consistent structure', () => {
    const result = healthSummary.generate([]);

    expect(result.overall).toMatch(/^healthy|degraded|unhealthy$/);
    expect(typeof result.timestamp).toBe('string');
    expect(result.circuitBreakers).toHaveProperty('total');
    expect(result.circuitBreakers).toHaveProperty('open');
    expect(result.circuitBreakers).toHaveProperty('healthy');
    expect(result.requests).toHaveProperty('totalRequests');
    expect(result.errors).toHaveProperty('recentErrors');
  });

  test('compact format is a string', () => {
    const result = healthSummary.generateCompact();

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
