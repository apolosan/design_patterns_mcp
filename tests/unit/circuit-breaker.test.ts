/**
 * Circuit Breaker Tests
 * Tests for Circuit Breaker pattern implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitBreakerState, CircuitBreakerError } from '../../src/utils/circuit-breaker.js';

describe('Circuit Breaker', () => {
  let circuitBreaker: CircuitBreaker;
  const config = {
    failureThreshold: 3,
    recoveryTimeout: 1000, // 1 second for testing
    monitoringPeriod: 5000,
    successThreshold: 2,
    name: 'test-circuit',
  };

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(config);
  });

  describe('Initial State', () => {
    it('should start in closed state', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitBreakerState.CLOSED);
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('Successful Operations', () => {
    it('should stay closed on successful operations', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      await circuitBreaker.execute(operation);
      const stats = circuitBreaker.getStats();

      expect(stats.state).toBe(CircuitBreakerState.CLOSED);
      expect(stats.successCount).toBe(1);
      expect(stats.totalSuccesses).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should reset failure count on success', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      // First operation fails
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      expect(circuitBreaker.getStats().failureCount).toBe(1);

      // Second operation succeeds and resets failure count
      await circuitBreaker.execute(operation);
      expect(circuitBreaker.getStats().failureCount).toBe(0);
    });
  });

  describe('Failure Handling', () => {
    it('should open circuit after reaching failure threshold', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      // Fail threshold times
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      }

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitBreakerState.OPEN);
      expect(stats.failureCount).toBe(config.failureThreshold);
    });

    it('should throw CircuitBreakerError when open', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      }

      // Next call should fail fast with CircuitBreakerError
      await expect(circuitBreaker.execute(operation)).rejects.toThrow(CircuitBreakerError);
      expect(operation).toHaveBeenCalledTimes(config.failureThreshold); // No additional calls
    });
  });

  describe('Recovery', () => {
    it('should transition to half-open after recovery timeout', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitBreakerState.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, config.recoveryTimeout + 100));

      // Next call should attempt recovery (half-open)
      const recoveryOperation = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(recoveryOperation);

      expect(recoveryOperation).toHaveBeenCalledTimes(1);
    });

    it('should close circuit after success threshold in half-open state', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      }

      // Wait for recovery and succeed required times
      await new Promise(resolve => setTimeout(resolve, config.recoveryTimeout + 100));

      const recoveryOperation = vi.fn().mockResolvedValue('success');
      for (let i = 0; i < config.successThreshold; i++) {
        await circuitBreaker.execute(recoveryOperation);
      }

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitBreakerState.CLOSED);
      expect(stats.successCount).toBe(config.successThreshold);
    });

    it('should reopen circuit if failure occurs in half-open state', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      }

      // Wait for recovery and fail
      await new Promise(resolve => setTimeout(resolve, config.recoveryTimeout + 100));

      await expect(circuitBreaker.execute(operation)).rejects.toThrow();

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('Statistics', () => {
    it('should track all request statistics', async () => {
      const successOp = vi.fn().mockResolvedValue('success');
      const failOp = vi.fn().mockRejectedValue(new Error('fail'));

      // Mix of success and failure
      await circuitBreaker.execute(successOp);
      await expect(circuitBreaker.execute(failOp)).rejects.toThrow();
      await circuitBreaker.execute(successOp);

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.totalFailures).toBe(1);
    });

    it('should track timing information', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const before = Date.now();
      await circuitBreaker.execute(operation);
      const after = Date.now();

      const stats = circuitBreaker.getStats();
      expect(stats.lastSuccessTime).toBeGreaterThanOrEqual(before);
      expect(stats.lastSuccessTime).toBeLessThanOrEqual(after);
    });
  });
});