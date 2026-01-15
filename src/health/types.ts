/**
 * Health Check Pattern Implementation
 * Provides systematic monitoring and health assessment of system services
 */

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export enum HealthCheckSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message: string;
  timestamp: string;
  duration: number; // milliseconds
  details?: Record<string, unknown>;
  error?: Error;
  severity?: HealthCheckSeverity;
  tags?: string[];
}

export interface HealthCheck {
  name: string;
  description?: string;
  tags?: string[];
  timeout?: number; // milliseconds

  /**
   * Execute health check
   * @returns Promise<HealthCheckResult>
   */
  check(): Promise<HealthCheckResult>;

  /**
   * Optional: Check if health check is enabled
   */
  isEnabled?(): boolean;
}

export interface HealthCheckRegistry {
  register(healthCheck: HealthCheck): void;
  unregister(name: string): void;
  get(name: string): HealthCheck | undefined;
  getAll(): HealthCheck[];
  getByTags(tags: string[]): HealthCheck[];
}

export interface HealthReport {
  overall: HealthStatus;
  timestamp: string;
  duration: number; // milliseconds
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  };
  metadata?: {
    version?: string;
    environment?: string;
    uptime?: number;
  };
}

export interface HealthService {
  /**
   * Run all registered health checks
   */
  checkAll(): Promise<HealthReport>;

  /**
   * Run specific health check by name
   */
  check(name: string): Promise<HealthCheckResult>;

  /**
   * Run health checks by tags
   */
  checkByTags(tags: string[]): Promise<HealthReport>;

  /**
   * Get registry of health checks
   */
  getRegistry(): HealthCheckRegistry;

  /**
   * Get overall system health status
   */
  getOverallStatus(): HealthStatus;
}

/**
 * Configuration for health check service
 */
export interface HealthCheckConfig {
  enabled: boolean;
  timeout: number; // default timeout for checks
  cache?: {
    enabled: boolean;
    ttl: number; // cache TTL in milliseconds
  };
  alerting?: {
    enabled: boolean;
    unhealthyThreshold: number; // consecutive unhealthy checks before alert
  };
}

/**
 * Utility functions for health checks
 */
export class HealthUtils {
  static createResult(
    name: string,
    status: HealthStatus,
    message: string,
    duration: number,
    details?: Record<string, unknown>,
    error?: Error,
    severity?: HealthCheckSeverity,
    tags?: string[]
  ): HealthCheckResult {
    return {
      name,
      status,
      message,
      timestamp: new Date().toISOString(),
      duration,
      details,
      error,
      severity,
      tags
    };
  }

  static calculateOverallStatus(results: HealthCheckResult[]): HealthStatus {
    if (results.length === 0) {
      return HealthStatus.UNKNOWN;
    }

    const hasUnhealthy = results.some(r => r.status === HealthStatus.UNHEALTHY);
    const hasDegraded = results.some(r => r.status === HealthStatus.DEGRADED);
    const hasUnknown = results.some(r => r.status === HealthStatus.UNKNOWN);

    if (hasUnhealthy) {
      return HealthStatus.UNHEALTHY;
    }

    if (hasDegraded) {
      return HealthStatus.DEGRADED;
    }

    if (hasUnknown) {
      return HealthStatus.UNKNOWN;
    }

    return HealthStatus.HEALTHY;
  }

  static createSummary(results: HealthCheckResult[]) {
    return {
      total: results.length,
      healthy: results.filter(r => r.status === HealthStatus.HEALTHY).length,
      degraded: results.filter(r => r.status === HealthStatus.DEGRADED).length,
      unhealthy: results.filter(r => r.status === HealthStatus.UNHEALTHY).length,
      unknown: results.filter(r => r.status === HealthStatus.UNKNOWN).length
    };
  }

  static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }
}