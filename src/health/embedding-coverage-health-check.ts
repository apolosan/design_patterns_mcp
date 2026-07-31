/**
 * Embedding Coverage Health Check - L1+L7 fix.
 *
 * Bug: vector-operations health check reported HEALTHY with totalVectors=0,
 * because it only tested the storage interface, not data presence.
 *
 * Fix: dedicated single-responsibility check that asserts:
 *   totalVectors / patternCount >= COVERAGE_THRESHOLD (default 0.95).
 *
 * Status mapping:
 *   coverage >= threshold  -> HEALTHY
 *   0.50 <= coverage < threshold -> DEGRADED (severity MEDIUM)
 *   coverage < 0.50 (incl. 0) -> UNHEALTHY (severity HIGH)
 */

import { HealthCheck, HealthCheckResult, HealthStatus, HealthCheckSeverity } from './types.js';

export const DEFAULT_COVERAGE_THRESHOLD = 0.95;
export const DEGRADED_COVERAGE_THRESHOLD = 0.50;

export interface CoverageStatsProvider {
  /** Returns the number of stored embeddings. */
  getTotalVectors(): number;
  /** Returns the number of patterns in the catalog. */
  getPatternCount(): number;
}

export interface EmbeddingCoverageCheckOptions {
  coverageThreshold?: number;
  degradedThreshold?: number;
}

export class EmbeddingCoverageHealthCheck implements HealthCheck {
  readonly name = 'embedding-coverage';
  readonly description = 'Asserts vector store coverage matches pattern catalog (L1+L7 fix)';
  readonly tags = ['embeddings', 'coverage', 'observability', 'data-quality'];
  readonly timeout = 5000;

  private readonly coverageThreshold: number;
  private readonly degradedThreshold: number;

  constructor(
    private readonly statsProvider: CoverageStatsProvider,
    options: EmbeddingCoverageCheckOptions = {}
  ) {
    this.coverageThreshold = options.coverageThreshold ?? DEFAULT_COVERAGE_THRESHOLD;
    this.degradedThreshold = options.degradedThreshold ?? DEGRADED_COVERAGE_THRESHOLD;
  }

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const totalVectors = this.statsProvider.getTotalVectors();
      const patternCount = this.statsProvider.getPatternCount();
      const coverageRatio = patternCount > 0 ? totalVectors / patternCount : (totalVectors === 0 ? 1 : 0);

      let status: HealthStatus;
      let severity: HealthCheckSeverity;
      let message: string;

      if (coverageRatio >= this.coverageThreshold) {
        status = HealthStatus.HEALTHY;
        severity = HealthCheckSeverity.LOW;
        message = `Embedding coverage OK: ${totalVectors}/${patternCount} (${(coverageRatio * 100).toFixed(1)}%)`;
      } else if (coverageRatio >= this.degradedThreshold) {
        status = HealthStatus.DEGRADED;
        severity = HealthCheckSeverity.MEDIUM;
        message = `Embedding coverage degraded: ${totalVectors}/${patternCount} (${(coverageRatio * 100).toFixed(1)}%) < ${(this.coverageThreshold * 100).toFixed(0)}%`;
      } else {
        status = HealthStatus.UNHEALTHY;
        severity = HealthCheckSeverity.HIGH;
        message = totalVectors === 0
          ? `Embedding store is EMPTY while ${patternCount} patterns exist (semantic search is non-functional)`
          : `Embedding coverage critical: ${totalVectors}/${patternCount} (${(coverageRatio * 100).toFixed(1)}%) < ${(this.degradedThreshold * 100).toFixed(0)}%`;
      }

      return {
        name: this.name,
        status,
        message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        severity,
        tags: this.tags,
        details: {
          totalVectors,
          patternCount,
          coverageRatio,
          coveragePercent: `${(coverageRatio * 100).toFixed(2)}%`,
          coverageThreshold: this.coverageThreshold,
          degradedThreshold: this.degradedThreshold,
        },
      };
    } catch (error) {
      return {
        name: this.name,
        status: HealthStatus.UNHEALTHY,
        message: `Embedding coverage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        severity: HealthCheckSeverity.HIGH,
        tags: this.tags,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  isEnabled(): boolean {
    return true;
  }
}
