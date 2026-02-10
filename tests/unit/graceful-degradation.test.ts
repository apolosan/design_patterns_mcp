import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  GracefulDegradation,
  GracefulDegradationError,
  DegradationLevel
} from '../../src/utils/graceful-degradation.js';

describe('GracefulDegradation', () => {
  let degradation: GracefulDegradation;

  beforeEach(() => {
    degradation = new GracefulDegradation();
  });

  describe('configure', () => {
    test('should configure feature with default level', () => {
      degradation.configure({
        featureName: 'search',
        level: DegradationLevel.FULL
      });

      const state = degradation.getState('search');
      expect(state).toBeDefined();
      expect(state?.level).toBe(DegradationLevel.FULL);
    });

    test('should register fallback function', () => {
      const fallback = vi.fn();
      degradation.configure({
        featureName: 'search',
        level: DegradationLevel.REDUCED,
        fallback
      });

      degradation.setLevel('search', DegradationLevel.MINIMAL);
      const result = degradation.execute('search', async () => 'primary', async () => 'fallback');
      expect(result).resolves.toBe('fallback');
    });
  });

  describe('setLevel', () => {
    test('should change degradation level', () => {
      degradation.configure({ featureName: 'api', level: DegradationLevel.FULL });

      degradation.setLevel('api', DegradationLevel.REDUCED);

      expect(degradation.getLevel('api')).toBe(DegradationLevel.REDUCED);
    });

    test('should track degradation count', () => {
      degradation.configure({ featureName: 'api', level: DegradationLevel.FULL });

      degradation.setLevel('api', DegradationLevel.REDUCED);
      degradation.setLevel('api', DegradationLevel.MINIMAL);

      const state = degradation.getState('api');
      expect(state?.degradationCount).toBe(2);
    });

    test('should track recovery count', () => {
      degradation.configure({ featureName: 'api', level: DegradationLevel.FULL });

      degradation.setLevel('api', DegradationLevel.REDUCED);
      degradation.setLevel('api', DegradationLevel.FULL);

      const state = degradation.getState('api');
      expect(state?.recoveryCount).toBe(1);
    });
  });

  describe('execute', () => {
    test('should execute primary function when level is FULL', async () => {
      degradation.configure({ featureName: 'search', level: DegradationLevel.FULL });

      const result = await degradation.execute('search', async () => 'primary');
      expect(result).toBe('primary');
    });

    test('should execute fallback when level is REDUCED', async () => {
      degradation.configure({
        featureName: 'search',
        level: DegradationLevel.REDUCED,
        fallback: async () => 'fallback'
      });

      const result = await degradation.execute('search', async () => 'primary');
      expect(result).toBe('fallback');
    });

    test('should throw error when no fallback available', async () => {
      degradation.configure({ featureName: 'search', level: DegradationLevel.MINIMAL });

      await expect(
        degradation.execute('search', async () => 'primary')
      ).rejects.toThrow(GracefulDegradationError);
    });

    test('should prefer inline fallback over registered fallback', async () => {
      degradation.configure({
        featureName: 'search',
        level: DegradationLevel.REDUCED,
        fallback: async () => 'registered'
      });

      const result = await degradation.execute('search', async () => 'primary', async () => 'inline');
      expect(result).toBe('inline');
    });
  });

  describe('metrics', () => {
    test('should track request metrics', async () => {
      degradation.configure({ featureName: 'search', level: DegradationLevel.FULL });

      await degradation.execute('search', async () => 'primary');
      await degradation.execute('search', async () => 'primary');

      const metrics = degradation.getMetrics('search');
      expect(metrics?.totalRequests).toBe(2);
      expect(metrics?.fullRequests).toBe(2);
    });

    test('should track degraded requests', async () => {
      degradation.configure({
        featureName: 'search',
        level: DegradationLevel.REDUCED,
        fallback: async () => 'fallback'
      });

      await degradation.execute('search', async () => 'primary');

      const metrics = degradation.getMetrics('search');
      expect(metrics?.degradedRequests).toBe(1);
    });
  });

  describe('health checks', () => {
    test('should report degraded status correctly', () => {
      degradation.configure({ featureName: 'api', level: DegradationLevel.FULL });
      degradation.configure({ featureName: 'cache', level: DegradationLevel.REDUCED });

      expect(degradation.isDegraded('api')).toBe(false);
      expect(degradation.isDegraded('cache')).toBe(true);
    });

    test('should report overall health', () => {
      degradation.configure({ featureName: 'api', level: DegradationLevel.FULL });
      degradation.configure({ featureName: 'cache', level: DegradationLevel.REDUCED });
      degradation.configure({ featureName: 'db', level: DegradationLevel.OFFLINE });

      const health = degradation.getOverallHealth();
      expect(health.healthy).toBe(1);
      expect(health.degraded).toBe(1);
      expect(health.offline).toBe(1);
    });
  });

  describe('reset', () => {
    test('should reset specific feature', () => {
      degradation.configure({ featureName: 'api', level: DegradationLevel.REDUCED });
      degradation.setLevel('api', DegradationLevel.MINIMAL);

      degradation.reset('api');

      expect(degradation.getLevel('api')).toBe(DegradationLevel.FULL);
    });

    test('should reset all features', () => {
      degradation.configure({ featureName: 'api', level: DegradationLevel.REDUCED });
      degradation.configure({ featureName: 'cache', level: DegradationLevel.REDUCED });

      degradation.reset();

      expect(degradation.isDegraded('api')).toBe(false);
      expect(degradation.isDegraded('cache')).toBe(false);
    });
  });
});
