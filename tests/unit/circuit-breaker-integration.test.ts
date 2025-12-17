/**
 * Circuit Breaker Integration Tests
 * Tests for Circuit Breaker integration with EmbeddingServiceAdapter
 */

import { describe, it, expect } from 'vitest';
import { EmbeddingServiceAdapter } from '../../src/adapters/embedding-service-adapter.js';
import { CircuitBreakerState } from '../../src/utils/circuit-breaker.js';

describe('Circuit Breaker Integration', () => {
  describe('Circuit Breaker Configuration', () => {
    it('should initialize with circuit breaker by default', () => {
      const adapter = new EmbeddingServiceAdapter();
      const stats = adapter.getCircuitBreakerStats();
      expect(stats).toBeDefined();
      expect(stats?.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should allow disabling circuit breaker', () => {
      const adapter = new EmbeddingServiceAdapter({ circuitBreakerEnabled: false });
      const stats = adapter.getCircuitBreakerStats();
      expect(stats).toBeUndefined();
    });

    it('should allow manual circuit breaker reset', () => {
      const adapter = new EmbeddingServiceAdapter();
      adapter.resetCircuitBreaker();

      const stats = adapter.getCircuitBreakerStats();
      expect(stats?.state).toBe(CircuitBreakerState.CLOSED);
      expect(stats?.failureCount).toBe(0);
    });
  });
});