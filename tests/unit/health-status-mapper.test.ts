/**
 * RED test for IMPROVEMENTS_03.md BUG-009.
 *
 * Bug: src/mcp/http-transport.ts line 70 maps every non-HEALTHY overall
 * status to HTTP 503, including DEGRADED which is a recoverable state.
 * Kubernetes liveness probes treat a 503 response as a failed liveness
 * check and restart the container, which is wrong for DEGRADED: the
 * service is alive and partially functional, it just needs operator
 * attention.
 *
 * Domain contract: only UNHEALTHY MUST produce a 5xx response from
 * /health. DEGRADED, HEALTHY and UNKNOWN-like recoverable states
 * MUST return 200 so k8s liveness does not flap on degraded operation.
 *
 * The contract is small enough to encode as a single pure function:
 * HealthStatus -> HTTP status code. Unit-testable in isolation.
 */
import { describe, it, expect } from 'vitest';
import { HealthStatus } from '../../src/health/types.js';
import { mapHealthOverallToHttp } from '../../src/mcp/health-status-mapper.js';

describe('health-status-mapper (BUG-009)', () => {
  it('maps HEALTHY to 200', () => {
    expect(mapHealthOverallToHttp(HealthStatus.HEALTHY)).toBe(200);
  });

  it('maps DEGRADED to 200 (k8s liveness compatible)', () => {
    expect(mapHealthOverallToHttp(HealthStatus.DEGRADED)).toBe(200);
  });

  it('maps UNHEALTHY to 503 (k8s liveness will restart container)', () => {
    expect(mapHealthOverallToHttp(HealthStatus.UNHEALTHY)).toBe(503);
  });

  it('maps UNKNOWN to 503 (conservative)', () => {
    expect(mapHealthOverallToHttp(HealthStatus.UNKNOWN)).toBe(503);
  });
});
