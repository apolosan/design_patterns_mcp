import { monitorEventLoopDelay } from "perf_hooks";
import { loadavg, totalmem, freemem } from "os";

const DEFAULT_EVENT_LOOP_LAG_THRESHOLD_MS = 200;
const DEFAULT_MEMORY_USAGE_THRESHOLD_PERCENT = 80;
const DEFAULT_CACHE_TTL_MS = 5000;
const DEFAULT_MIN_UPTIME_MS = 15000;

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  checks: Record<string, CheckResult>;
  summary: string;
}

export interface CheckResult {
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export interface LiveCheckOptions {
  includeUptime?: boolean;
  minUptimeMs?: number;
}

export interface ReadyCheckOptions {
  includeEventLoop?: boolean;
  includeMemory?: boolean;
  eventLoopLagThresholdMs?: number;
  memoryUsageThresholdPercent?: number;
  cacheTtlMs?: number;
}

export interface DependencyCheck {
  name: string;
  check: () => Promise<CheckResult> | CheckResult;
  cached?: boolean;
  cacheTtlMs?: number;
  lastResult?: CheckResult;
  lastCheckTime?: number;
}

export class HealthCheckManager {
  private liveChecks: Map<string, () => Promise<CheckResult> | CheckResult> = new Map();
  private readyChecks: Map<string, DependencyCheck> = new Map();
  private eventLoopMonitor?: ReturnType<typeof monitorEventLoopDelay>;
  private startTime: number;
  private eventLoopEnabled: boolean = false;
  private eventLoopLagThresholdMs: number;
  private memoryUsageThresholdPercent: number;
  private cacheTtlMs: number;
  private minUptimeMs: number;

  constructor(options?: {
    eventLoopLagThresholdMs?: number;
    memoryUsageThresholdPercent?: number;
    cacheTtlMs?: number;
    minUptimeMs?: number;
    enableEventLoopMonitoring?: boolean;
  }) {
    this.startTime = Date.now();
    this.eventLoopLagThresholdMs = options?.eventLoopLagThresholdMs ?? DEFAULT_EVENT_LOOP_LAG_THRESHOLD_MS;
    this.memoryUsageThresholdPercent = options?.memoryUsageThresholdPercent ?? DEFAULT_MEMORY_USAGE_THRESHOLD_PERCENT;
    this.cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.minUptimeMs = options?.minUptimeMs ?? DEFAULT_MIN_UPTIME_MS;

    if (options?.enableEventLoopMonitoring) {
      this.enableEventLoopMonitoring();
    }
  }

  public enableEventLoopMonitoring(): void {
    if (!this.eventLoopMonitor) {
      this.eventLoopMonitor = monitorEventLoopDelay();
      this.eventLoopMonitor.enable();
      this.eventLoopEnabled = true;
    }
  }

  public disableEventLoopMonitoring(): void {
    if (this.eventLoopMonitor) {
      this.eventLoopMonitor.disable();
      this.eventLoopMonitor = undefined;
      this.eventLoopEnabled = false;
    }
  }

  public registerLiveCheck(
    name: string,
    check: () => Promise<CheckResult> | CheckResult
  ): void {
    this.liveChecks.set(name, check);
  }

  public registerReadyCheck(
    name: string,
    check: () => Promise<CheckResult> | CheckResult,
    options?: {
      cached?: boolean;
      cacheTtlMs?: number;
    }
  ): void {
    const dependencyCheck: DependencyCheck = {
      name,
      check,
      cached: options?.cached ?? false,
      cacheTtlMs: options?.cacheTtlMs ?? this.cacheTtlMs,
    };

    this.readyChecks.set(name, dependencyCheck);
  }

  public async getLiveness(options?: LiveCheckOptions): Promise<CheckResult> {
    const includeUptime = options?.includeUptime ?? true;
    const minUptimeMs = options?.minUptimeMs ?? this.minUptimeMs;

    const uptimeMs = Date.now() - this.startTime;
    const uptimeOk = uptimeMs >= minUptimeMs;

    if (!uptimeOk) {
      return {
        status: "unhealthy",
        message: `Process uptime ${uptimeMs}ms is less than minimum ${minUptimeMs}ms`,
        metadata: { uptimeMs, minUptimeMs },
      };
    }

    if (this.liveChecks.size === 0) {
      return {
        status: "healthy",
        message: "Process is running",
        metadata: { uptimeMs },
      };
    }

    const results: CheckResult[] = [];
    for (const [name, check] of this.liveChecks) {
      try {
        const result = await check();
        results.push({ ...result, message: `${name}: ${result.message}` });
      } catch {
        results.push({
          status: "unhealthy",
          message: `${name}: check failed`,
        });
      }
    }

    const hasUnhealthy = results.some((r) => r.status === "unhealthy");
    const hasDegraded = results.some((r) => r.status === "degraded");

    if (hasUnhealthy) {
      return {
        status: "unhealthy",
        message: `Liveness check failed: ${results.filter((r) => r.status === "unhealthy").length} checks failed`,
        metadata: { uptimeMs, results: results.map((r) => r.status) },
      };
    }

    if (hasDegraded) {
      return {
        status: "degraded",
        message: `Liveness check degraded: ${results.filter((r) => r.status === "degraded").length} checks degraded`,
        metadata: { uptimeMs, results: results.map((r) => r.status) },
      };
    }

    return {
      status: "healthy",
      message: "Process is alive and running",
      metadata: { uptimeMs },
    };
  }

  public async getReadiness(options?: ReadyCheckOptions): Promise<HealthCheckResult> {
    const includeEventLoop = options?.includeEventLoop ?? true;
    const includeMemory = options?.includeMemory ?? true;
    const eventLoopLagThresholdMs = options?.eventLoopLagThresholdMs ?? this.eventLoopLagThresholdMs;
    const memoryUsageThresholdPercent = options?.memoryUsageThresholdPercent ?? this.memoryUsageThresholdPercent;

    const checks: Record<string, CheckResult> = {};
    let hasUnhealthy = false;
    let hasDegraded = false;

    if (includeEventLoop && this.eventLoopEnabled && this.eventLoopMonitor) {
      const lagMean = this.eventLoopMonitor.mean / 1e6;
      const lagP95 = this.eventLoopMonitor.percentile(95) / 1e6;

      if (lagMean > eventLoopLagThresholdMs) {
        checks.eventLoop = {
          status: "unhealthy",
          message: `Event loop lag ${lagMean.toFixed(2)}ms exceeds threshold ${eventLoopLagThresholdMs}ms`,
          latencyMs: lagMean,
          metadata: { mean: lagMean, p95: lagP95, threshold: eventLoopLagThresholdMs },
        };
        hasUnhealthy = true;
      } else if (lagMean > eventLoopLagThresholdMs * 0.5) {
        checks.eventLoop = {
          status: "degraded",
          message: `Event loop lag ${lagMean.toFixed(2)}ms is elevated`,
          latencyMs: lagMean,
          metadata: { mean: lagMean, p95: lagP95, threshold: eventLoopLagThresholdMs },
        };
        hasDegraded = true;
      } else {
        checks.eventLoop = {
          status: "healthy",
          message: `Event loop lag ${lagMean.toFixed(2)}ms is normal`,
          latencyMs: lagMean,
          metadata: { mean: lagMean, p95: lagP95, threshold: eventLoopLagThresholdMs },
        };
      }
    }

    if (includeMemory) {
      const usedMem = totalmem() - freemem();
      const usagePercent = (usedMem / totalmem()) * 100;

      if (usagePercent > memoryUsageThresholdPercent) {
        checks.memory = {
          status: "unhealthy",
          message: `Memory usage ${usagePercent.toFixed(1)}% exceeds threshold ${memoryUsageThresholdPercent}%`,
          metadata: { usagePercent, threshold: memoryUsageThresholdPercent, usedBytes: usedMem, totalBytes: totalmem() },
        };
        hasUnhealthy = true;
      } else if (usagePercent > memoryUsageThresholdPercent * 0.8) {
        checks.memory = {
          status: "degraded",
          message: `Memory usage ${usagePercent.toFixed(1)}% is elevated`,
          metadata: { usagePercent, threshold: memoryUsageThresholdPercent, usedBytes: usedMem, totalBytes: totalmem() },
        };
        hasDegraded = true;
      } else {
        checks.memory = {
          status: "healthy",
          message: `Memory usage ${usagePercent.toFixed(1)}% is normal`,
          metadata: { usagePercent, usedBytes: usedMem, totalBytes: totalmem() },
        };
      }
    }

    for (const [name, dependency] of this.readyChecks) {
      let result: CheckResult;

      if (dependency.cached && dependency.lastResult && dependency.lastCheckTime) {
        const isExpired = Date.now() - dependency.lastCheckTime > (dependency.cacheTtlMs ?? this.cacheTtlMs);

        if (!isExpired) {
          result = dependency.lastResult;
          checks[name] = result;
          continue;
        }
      }

      const startTime = Date.now();
      try {
        result = await dependency.check();
        result.latencyMs = Date.now() - startTime;
      } catch (error) {
        result = {
          status: "unhealthy",
          message: `Check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          latencyMs: Date.now() - startTime,
        };
      }

      if (dependency.cached) {
        dependency.lastResult = result;
        dependency.lastCheckTime = Date.now();
      }

      checks[name] = result;

      if (result.status === "unhealthy") {
        hasUnhealthy = true;
      } else if (result.status === "degraded") {
        hasDegraded = true;
      }
    }

    let overallStatus: HealthStatus;
    if (hasUnhealthy) {
      overallStatus = "unhealthy";
    } else if (hasDegraded) {
      overallStatus = "degraded";
    } else {
      overallStatus = "healthy";
    }

    const healthyCount = Object.values(checks).filter((c) => c.status === "healthy").length;
    const totalCount = Object.keys(checks).length;
    const summary = `${overallStatus.toUpperCase()}: ${healthyCount}/${totalCount} checks healthy`;

    return {
      status: overallStatus,
      timestamp: new Date(),
      checks,
      summary,
    };
  }

  public clearCache(): void {
    for (const dependency of this.readyChecks.values()) {
      dependency.lastResult = undefined;
      dependency.lastCheckTime = undefined;
    }
  }

  public getUptimeMs(): number {
    return Date.now() - this.startTime;
  }

  public getEventLoopStats(): { enabled: boolean; mean?: number; p95?: number } {
    if (!this.eventLoopEnabled || !this.eventLoopMonitor) {
      return { enabled: false };
    }

    return {
      enabled: true,
      mean: this.eventLoopMonitor.mean / 1e6,
      p95: this.eventLoopMonitor.percentile(95) / 1e6,
    };
  }

  public getMemoryStats(): { usagePercent: number; usedBytes: number; totalBytes: number } {
    const usedBytes = totalmem() - freemem();
    return {
      usagePercent: (usedBytes / totalmem()) * 100,
      usedBytes,
      totalBytes: totalmem(),
    };
  }
}

export function createHealthCheckManager(
  options?: ConstructorParameters<typeof HealthCheckManager>[0]
): HealthCheckManager {
  return new HealthCheckManager(options);
}
