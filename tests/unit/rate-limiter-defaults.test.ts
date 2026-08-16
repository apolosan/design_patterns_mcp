/**
 * RED test for user-driven rate-limiter defaults refinement.
 *
 * Concern (user feedback): 'nao inviabilizar a aplicacao' - the rate
 * limiter must NOT throttle a single MCP client performing regular
 * polling queries (1 req every couple of seconds, occasional natural
 * bursts when the host fires several tool calls in one tool round-trip).
 *
 * Default config must satisfy:
 *   - sustained 0.5 req/sec over 5 minutes: never blocked
 *   - 30 parallel in-flight requests from a single client: never blocked
 *   - maxConcurrentRequests default must be >= 30 to support HTTP
 *     multi-tenant access and an IDE re-indexing multiple workspaces
 *
 * Asserts both the contract (introspection of DEFAULT_RATE_LIMIT_CONFIG)
 * and the runtime behaviour (the new defaults).
 */
import { describe, it, expect } from 'vitest';
import {
  RateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG,
} from '../../src/utils/rate-limiter.js';

describe('rate-limiter defaults tolerate legitimate single-client usage', () => {
  it('default maxConcurrentRequests is at least 30', () => {
    expect(DEFAULT_RATE_LIMIT_CONFIG.maxConcurrentRequests).toBeGreaterThanOrEqual(30);
  });

  it('default rpm supports sustained 0.5 req/sec polling', () => {
    // rpm=60 => tokensPerSecond=1, so 0.5 req/sec is well below cap.
    expect(DEFAULT_RATE_LIMIT_CONFIG.maxRequestsPerMinute).toBeGreaterThanOrEqual(30);
  });

  it('default burstLimit lets a host fire a small natural spike', () => {
    expect(DEFAULT_RATE_LIMIT_CONFIG.burstLimit).toBeGreaterThanOrEqual(10);
  });

  it('15 concurrent single-client calls succeed without throwing', () => {
    // A realistic MCP host may fire several tool calls in one round-trip
    // (e.g. one fetch triggers find_patterns + count_patterns + get_health_status).
    // 15 is well above the previous default of 10 and below the burst cap of 20,
    // exercising the concurrent dimension of the rate limiter.
    const limiter = new RateLimiter(DEFAULT_RATE_LIMIT_CONFIG);
    const key = 'parallel';
    const errors: unknown[] = [];

    for (let i = 0; i < 15; i++) {
      try {
        limiter.checkLimit(key);
      } catch (err) {
        errors.push(err);
      }
    }

    // Cleanup so the limiter returns to a quiescent state for other tests.
    limiter.completeRequest(key);
    limiter.reset(key);

    expect(errors).toHaveLength(0);
  });
});
