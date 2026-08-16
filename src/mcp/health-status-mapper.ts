/**
 * Pure mapping from overall HealthStatus to HTTP status code for the
 * /health endpoint exposed by the HTTP transport.
 *
 * Kubernetes liveness probes treat any 5xx as a failed liveness check
 * and restart the container. DEGRADED is a recoverable operational
 * state (one subsystem below ideal but service still serves traffic)
 * and MUST NOT trigger container restarts. Only UNHEALTHY (and
 * UNKNOWN as a conservative fallback) MUST yield a 5xx.
 *
 * See IMPROVEMENTS_03.md §3.B.2 (BUG-009).
 */
import { HealthStatus } from '../health/types.js';

export function mapHealthOverallToHttp(status: HealthStatus): number {
  switch (status) {
    case HealthStatus.HEALTHY:
    case HealthStatus.DEGRADED:
      return 200;
    case HealthStatus.UNHEALTHY:
    case HealthStatus.UNKNOWN:
      return 503;
  }
}
