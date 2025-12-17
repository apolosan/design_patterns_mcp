/**
 * Health Check Service Implementation
 * Orchestrates all health checks and provides aggregated health status
 */

import {
  HealthService,
  HealthReport,
  HealthCheckResult,
  HealthCheckRegistry,
  HealthStatus,
  HealthUtils,
  HealthCheckConfig,
  HealthCheckSeverity
} from './types.js';
import { HealthCheck } from './types.js';

class SimpleHealthCheckRegistry implements HealthCheckRegistry {
  private checks = new Map<string, HealthCheck>();

  register(healthCheck: HealthCheck): void {
    this.checks.set(healthCheck.name, healthCheck);
  }

  unregister(name: string): void {
    this.checks.delete(name);
  }

  get(name: string): HealthCheck | undefined {
    return this.checks.get(name);
  }

  getAll(): HealthCheck[] {
    return Array.from(this.checks.values());
  }

  getByTags(tags: string[]): HealthCheck[] {
    return this.getAll().filter(check =>
      tags.some(tag => check.tags?.includes(tag))
    );
  }
}

export class HealthCheckService implements HealthService {
  private registry: HealthCheckRegistry;
  private config: HealthCheckConfig;

  constructor(config: HealthCheckConfig = { enabled: true, timeout: 30000 }) {
    this.registry = new SimpleHealthCheckRegistry();
    this.config = config;
  }

  async checkAll(): Promise<HealthReport> {
    const startTime = Date.now();
    const checks = this.registry.getAll().filter(check => check.isEnabled?.() ?? true);

    const results: HealthCheckResult[] = [];

    // Run all checks in parallel with timeout
    const checkPromises = checks.map(async (check) => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Health check timeout: ${check.name}`)), check.timeout || this.config.timeout);
        });

        const result = await Promise.race([check.check(), timeoutPromise]);
        results.push(result);
      } catch (error) {
        // Create failed result for timed out or errored checks
        const failedResult: HealthCheckResult = {
          name: check.name,
          status: HealthStatus.UNHEALTHY,
          message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          error: error instanceof Error ? error : new Error(String(error)),
          severity: HealthCheckSeverity.HIGH,
          tags: check.tags
        };
        results.push(failedResult);
      }
    });

    await Promise.allSettled(checkPromises);

    const duration = Date.now() - startTime;
    const overall = HealthUtils.calculateOverallStatus(results);
    const summary = HealthUtils.createSummary(results);

    return {
      overall,
      timestamp: new Date().toISOString(),
      duration,
      checks: results,
      summary,
      metadata: {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }

  async check(name: string): Promise<HealthCheckResult> {
    const check = this.registry.get(name);
    if (!check) {
      throw new Error(`Health check not found: ${name}`);
    }

    if (!(check.isEnabled?.() ?? true)) {
      return {
        name,
        status: HealthStatus.UNKNOWN,
        message: 'Health check is disabled',
        timestamp: new Date().toISOString(),
        duration: 0,
        tags: check.tags
      };
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Health check timeout: ${name}`)), check.timeout || this.config.timeout);
      });

      return await Promise.race([check.check(), timeoutPromise]);
    } catch (error) {
      return {
        name,
        status: HealthStatus.UNHEALTHY,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        duration: 0,
        error: error instanceof Error ? error : new Error(String(error)),
        severity: HealthCheckSeverity.HIGH,
        tags: check.tags
      };
    }
  }

  async checkByTags(tags: string[]): Promise<HealthReport> {
    const checks = this.registry.getByTags(tags);
    const startTime = Date.now();

    const results: HealthCheckResult[] = [];

    // Run filtered checks
    const checkPromises = checks
      .filter(check => check.isEnabled?.() ?? true)
      .map(async (check) => {
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Health check timeout: ${check.name}`)), check.timeout || this.config.timeout);
          });

          const result = await Promise.race([check.check(), timeoutPromise]);
          results.push(result);
        } catch (error) {
          const failedResult: HealthCheckResult = {
            name: check.name,
            status: HealthStatus.UNHEALTHY,
            message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            error: error instanceof Error ? error : new Error(String(error)),
            severity: HealthCheckSeverity.HIGH,
            tags: check.tags
          };
          results.push(failedResult);
        }
      });

    await Promise.allSettled(checkPromises);

    const duration = Date.now() - startTime;
    const overall = HealthUtils.calculateOverallStatus(results);
    const summary = HealthUtils.createSummary(results);

    return {
      overall,
      timestamp: new Date().toISOString(),
      duration,
      checks: results,
      summary,
      metadata: {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }

  getRegistry(): HealthCheckRegistry {
    return this.registry;
  }

  getOverallStatus(): HealthStatus {
    // Quick overall status check without running full health checks
    // This could be optimized with caching if needed
    const criticalChecks = this.registry.getByTags(['critical']);
    const enabledCriticalChecks = criticalChecks.filter(check => check.isEnabled?.() ?? true);

    if (enabledCriticalChecks.length === 0) {
      return HealthStatus.UNKNOWN;
    }

    // For now, return unknown since we don't want to run checks synchronously
    // In production, this could be cached from periodic health checks
    return HealthStatus.UNKNOWN;
  }

  // Convenience methods for registering checks
  registerHealthCheck(check: HealthCheck): void {
    this.registry.register(check);
  }

  unregisterHealthCheck(name: string): void {
    this.registry.unregister(name);
  }
}