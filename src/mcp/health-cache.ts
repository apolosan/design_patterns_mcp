/**
 * Simple in-memory TTL cache for HTTP /health responses.
 * Prevents repeated checkAll() invocations when load balancers and orchestrators
 * probe the endpoint frequently (e.g., every 1-10s in Kubernetes).
 */

import type { HealthReport } from '../health/types.js';

export interface HealthCache {
  /** Returns the cached report if still within TTL, otherwise undefined. */
  get(): HealthReport | undefined;
  /** Stores a report and resets the TTL clock. */
  set(report: HealthReport): void;
  /** Removes the cached entry. */
  clear(): void;
}

export interface HealthCacheOptions {
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 5_000;

export function createHealthCache(options: HealthCacheOptions = {}): HealthCache {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  let cached: { report: HealthReport; cachedAt: number } | null = null;

  return {
    get(): HealthReport | undefined {
      if (!cached) return undefined;
      if (Date.now() - cached.cachedAt >= ttlMs) {
        cached = null;
        return undefined;
      }
      return cached.report;
    },
    set(report: HealthReport): void {
      cached = { report, cachedAt: Date.now() };
    },
    clear(): void {
      cached = null;
    },
  };
}
