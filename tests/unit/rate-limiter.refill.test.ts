/**
 * RED test for IMPROVEMENTS_03.md BUG-002.
 *
 * Bug: src/utils/rate-limiter.ts:160 refills tokens via
 *   Math.floor((timePassed / 60000) * (rpm / 60))
 * For rpm=60 and timePassed=1s, this returns floor(0.0166…) = 0.
 * The rate-limiter starves for the first 60 seconds after the burst
 * is exhausted, regardless of how many requests actually fire.
 *
 * Domain contract: with rpm=60, a healthy refill MUST yield ~1 token
 * per second elapsed since the last refill. Fractional accumulation is
 * the only correct behaviour; integer flooring violates the documented
 * rate and produces burst-then-starve.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../../src/utils/rate-limiter.js';

describe('RateLimiter — fractional refill (BUG-002)', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:00:00.000Z'));
    limiter = new RateLimiter({
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      maxConcurrentRequests: 100,
      burstLimit: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    limiter.reset('k');
  });

  it('refills approximately 1 token after 1 second elapses (rpm=60)', () => {
    const key = 'k';

    // Consume the initial burst so refill is observable.
    limiter.checkLimit(key);
    limiter.completeRequest(key);

    // Advance wall clock by 1 second.
    vi.setSystemTime(new Date('2026-08-01T00:00:01.000Z'));

    const status = limiter.getStatus(key);
    // Should have refilled ~1 token. Buggy floor returns 0.
    expect(status.remainingTokens).toBeGreaterThanOrEqual(0.95);
  });

  it('refills approximately 30 tokens after 30 seconds elapses (rpm=60)', () => {
    // Use a higher burst limit so the refill window is observable.
    const localLimiter = new RateLimiter({
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      maxConcurrentRequests: 200,
      burstLimit: 50,
    });
    const key = 'k2';

    // Drain the entire burst.
    for (let i = 0; i < 50; i++) {
      localLimiter.checkLimit(key);
      localLimiter.completeRequest(key);
    }

    vi.setSystemTime(new Date('2026-08-01T00:00:30.000Z'));

    const status = localLimiter.getStatus(key);
    expect(status.remainingTokens).toBeGreaterThanOrEqual(29);
    localLimiter.reset(key);
  });

  it('does not exceed burstLimit when refilling long-idle state', () => {
    const key = 'k';
    // Drain to zero
    limiter.checkLimit(key);
    limiter.completeRequest(key);

    // Long idle (1 hour)
    vi.setSystemTime(new Date('2026-08-01T01:00:00.000Z'));

    const status = limiter.getStatus(key);
    expect(status.remainingTokens).toBeLessThanOrEqual(1);
  });
});
