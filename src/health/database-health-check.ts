/**
 * Database Health Check Implementation
 * Monitors database connectivity, performance, and basic operations
 */

import { HealthCheck, HealthCheckResult, HealthStatus, HealthUtils, HealthCheckSeverity } from './types.js';
import { DatabaseManager } from '../services/database-manager.js';

interface ConnectivityTestResult {
  test_value: number;
  version: string;
}

interface PerformanceTestResult {
  pattern_count: number;
  relationship_count?: number;
  vector_count?: number;
}

export class DatabaseHealthCheck implements HealthCheck {
  name = 'database';
  description = 'Database connectivity and performance health check';
  tags = ['database', 'storage', 'critical'];
  timeout = 5000; // 5 seconds

  constructor(private db: DatabaseManager) {}

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const connectivityResult = await this.testConnectivity();
      const duration = Date.now() - startTime;

      if (!connectivityResult.success) {
        return HealthUtils.createResult(
          this.name,
          HealthStatus.UNHEALTHY,
          connectivityResult.message,
          duration,
          { error: connectivityResult.error },
          connectivityResult.error,
          HealthCheckSeverity.CRITICAL,
          this.tags
        );
      }

      const performanceResult = this.testPerformance();

      let overallStatus = HealthStatus.HEALTHY;
      let message = 'Database is healthy and responsive';
      let severity = HealthCheckSeverity.LOW;

      if (performanceResult.duration > 1000) {
        overallStatus = HealthStatus.DEGRADED;
        message = `Database is responsive but slow (${performanceResult.duration}ms)`;
        severity = HealthCheckSeverity.MEDIUM;
      }

      return HealthUtils.createResult(
        this.name,
        overallStatus,
        message,
        duration,
        {
          connectivity: connectivityResult,
          performance: performanceResult,
          totalDuration: duration
        },
        undefined,
        severity,
        this.tags
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      return HealthUtils.createResult(
        this.name,
        HealthStatus.UNHEALTHY,
        `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        { error: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : new Error(String(error)),
        HealthCheckSeverity.CRITICAL,
        this.tags
      );
    }
  }

  private testConnectivity(): Promise<{ success: boolean; message: string; error?: Error }> {
    try {
      const result = this.db.queryOne<ConnectivityTestResult>('SELECT 1 as test_value, sqlite_version() as version');

      if (!result) {
        return Promise.resolve({
          success: false,
          message: 'Database query returned no result',
        });
      }

      if (result.test_value !== 1) {
        return Promise.resolve({
          success: false,
          message: `Unexpected test value: ${result.test_value}`,
        });
      }

      return Promise.resolve({
        success: true,
        message: `Database connected successfully (SQLite ${result.version})`,
      });

    } catch (error) {
      return Promise.resolve({
        success: false,
        message: `Database connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  private testPerformance(): { duration: number; queryCount: number; message: string } {
    const testQueries = [
      'SELECT COUNT(*) as pattern_count FROM patterns',
      'SELECT COUNT(*) as relationship_count FROM relationships',
      'SELECT COUNT(*) as vector_count FROM vectors WHERE pattern_id IS NOT NULL LIMIT 10'
    ];

    const results: number[] = [];
    let totalQueries = 0;

    for (const query of testQueries) {
      try {
        const startTime = Date.now();
        const result = this.db.queryOne<PerformanceTestResult>(query);
        const duration = Date.now() - startTime;
        results.push(duration);
        totalQueries++;

        if (result === null || result === undefined) {
          // This is acceptable for empty databases
        }
      } catch (error) {
        results.push(100);
        totalQueries++;
      }
    }

    const avgDuration = results.length > 0 ? results.reduce((a, b) => a + b, 0) / results.length : 0;

    return {
      duration: Math.round(avgDuration),
      queryCount: totalQueries,
      message: `Average query time: ${Math.round(avgDuration)}ms over ${totalQueries} queries`
    };
  }

  isEnabled(): boolean {
    return true;
  }
}
