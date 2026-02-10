/**
 * Dependency Metrics Tracker
 * Monitors external dependencies (DB, APIs, services) for health and performance
 */

export interface DependencyMetrics {
  name: string;
  calls: number;
  errors: number;
  successes: number;
  timeouts: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  lastCalled: Date;
  lastError?: ErrorInfo;
  errorRate: number;
  availability: number;
}

export interface ErrorInfo {
  message: string;
  code?: string;
  timestamp: Date;
}

export interface CallInfo {
  dependency: string;
  latencyMs: number;
  success: boolean;
  error?: Error;
  timestamp: Date;
}

export interface DependencyTrackerOptions {
  windowSizeMs?: number;
  maxLatencySamples?: number;
  trackByEndpoint?: boolean;
}

interface LatencySample {
  value: number;
  timestamp: number;
}

interface DependencyData {
  name: string;
  calls: number;
  errors: number;
  successes: number;
  timeouts: number;
  latencies: LatencySample[];
  lastCalled: Date;
  lastError?: ErrorInfo;
}

const defaultOptions: Required<DependencyTrackerOptions> = {
  windowSizeMs: 60000,
  maxLatencySamples: 1000,
  trackByEndpoint: false,
};

export class DependencyTracker {
  private dependencies: Map<string, DependencyData>;
  private options: Required<DependencyTrackerOptions>;

  constructor(options: DependencyTrackerOptions = {}) {
    this.options = { ...defaultOptions, ...options };
    this.dependencies = new Map();
  }

  trackCall(dependency: string, latencyMs: number, error?: Error): void {
    let data = this.dependencies.get(dependency);

    if (!data) {
      data = this.createDependencyData(dependency);
      this.dependencies.set(dependency, data);
    }

    data.calls++;
    data.lastCalled = new Date();

    if (error) {
      data.errors++;
      data.lastError = {
        message: error.message,
        code: this.extractErrorCode(error),
        timestamp: new Date(),
      };
    } else {
      data.successes++;
    }

    if (latencyMs > 0) {
      this.addLatencySample(data, latencyMs);
    }

    this.cleanupOldSamples(data);
  }

  trackTimeout(dependency: string): void {
    let data = this.dependencies.get(dependency);

    if (!data) {
      data = this.createDependencyData(dependency);
      this.dependencies.set(dependency, data);
    }

    data.calls++;
    data.timeouts++;
    data.lastCalled = new Date();
    data.lastError = {
      message: 'Request timeout',
      code: 'TIMEOUT',
      timestamp: new Date(),
    };
  }

  getMetrics(dependency: string): DependencyMetrics | undefined {
    const data = this.dependencies.get(dependency);

    if (!data) {
      return undefined;
    }

    return this.calculateMetrics(data);
  }

  getAllMetrics(): Map<string, DependencyMetrics> {
    const metrics = new Map<string, DependencyMetrics>();

    for (const [name, data] of this.dependencies) {
      metrics.set(name, this.calculateMetrics(data));
    }

    return metrics;
  }

  getUnhealthyDependencies(): string[] {
    const unhealthy: string[] = [];

    for (const [name, data] of this.dependencies) {
      const metrics = this.calculateMetrics(data);

      if (metrics.errorRate > 0.1) {
        unhealthy.push(`${name} (error rate: ${(metrics.errorRate * 100).toFixed(1)}%)`);
      } else if (metrics.availability < 0.9) {
        unhealthy.push(`${name} (availability: ${(metrics.availability * 100).toFixed(1)}%)`);
      } else if (metrics.p99LatencyMs > 5000) {
        unhealthy.push(`${name} (p99 latency: ${metrics.p99LatencyMs}ms)`);
      }
    }

    return unhealthy;
  }

  getSlowDependencies(thresholdMs: number = 1000): string[] {
    const slow: string[] = [];

    for (const [name, data] of this.dependencies) {
      if (data.latencies.length > 0) {
        const sorted = [...data.latencies].map(l => l.value).sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        const p95 = sorted[p95Index];

        if (p95 > thresholdMs) {
          slow.push(`${name} (p95: ${p95.toFixed(1)}ms)`);
        }
      }
    }

    return slow;
  }

  getErrorSummary(): Map<string, number> {
    const errors = new Map<string, number>();

    for (const data of this.dependencies.values()) {
      if (data.lastError) {
        const code = data.lastError.code ?? data.lastError.message;
        errors.set(code, (errors.get(code) ?? 0) + data.errors);
      }
    }

    return errors;
  }

  reset(): void {
    this.dependencies.clear();
  }

  resetDependency(dependency: string): void {
    this.dependencies.delete(dependency);
  }

  getDependencyNames(): string[] {
    return Array.from(this.dependencies.keys());
  }

  hasDependency(dependency: string): boolean {
    return this.dependencies.has(dependency);
  }

  getTotalCalls(): number {
    let total = 0;

    for (const data of this.dependencies.values()) {
      total += data.calls;
    }

    return total;
  }

  getTotalErrors(): number {
    let total = 0;

    for (const data of this.dependencies.values()) {
      total += data.errors;
    }

    return total;
  }

  getOverallErrorRate(): number {
    const totalCalls = this.getTotalCalls();

    if (totalCalls === 0) {
      return 0;
    }

    return this.getTotalErrors() / totalCalls;
  }

  private createDependencyData(name: string): DependencyData {
    return {
      name,
      calls: 0,
      errors: 0,
      successes: 0,
      timeouts: 0,
      latencies: [],
      lastCalled: new Date(0),
    };
  }

  private addLatencySample(data: DependencyData, latencyMs: number): void {
    data.latencies.push({
      value: latencyMs,
      timestamp: Date.now(),
    });

    while (data.latencies.length > this.options.maxLatencySamples) {
      data.latencies.shift();
    }
  }

  private cleanupOldSamples(data: DependencyData): void {
    const cutoff = Date.now() - this.options.windowSizeMs;

    while (data.latencies.length > 0 && data.latencies[0].timestamp < cutoff) {
      data.latencies.shift();
    }
  }

  private calculateMetrics(data: DependencyData): DependencyMetrics {
    const latencies = data.latencies.map(l => l.value);

    if (latencies.length === 0) {
      return {
        name: data.name,
        calls: data.calls,
        errors: data.errors,
        successes: data.successes,
        timeouts: data.timeouts,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        lastCalled: data.lastCalled,
        lastError: data.lastError,
        errorRate: data.calls > 0 ? data.errors / data.calls : 0,
        availability: data.calls > 0 ? data.successes / data.calls : 1,
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = latencies.reduce((a, b) => a + b, 0);
    const avg = sum / latencies.length;
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      name: data.name,
      calls: data.calls,
      errors: data.errors,
      successes: data.successes,
      timeouts: data.timeouts,
      avgLatencyMs: Math.round(avg * 100) / 100,
      p50LatencyMs: Math.round(sorted[p50Index] * 100) / 100,
      p95LatencyMs: Math.round(sorted[p95Index] * 100) / 100,
      p99LatencyMs: Math.round(sorted[p99Index] * 100) / 100,
      minLatencyMs: Math.round(sorted[0] * 100) / 100,
      maxLatencyMs: Math.round(sorted[sorted.length - 1] * 100) / 100,
      lastCalled: data.lastCalled,
      lastError: data.lastError,
      errorRate: data.calls > 0 ? Math.round((data.errors / data.calls) * 10000) / 10000 : 0,
      availability: data.calls > 0 ? Math.round((data.successes / data.calls) * 10000) / 10000 : 1,
    };
  }

  private extractErrorCode(error: Error): string | undefined {
    if ('code' in error && typeof (error as { code?: string }).code === 'string') {
      return (error as { code?: string }).code;
    }

    if (error.message.includes('ECONNREFUSED')) {
      return 'ECONNREFUSED';
    }
    if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
      return 'TIMEOUT';
    }
    if (error.message.includes('ENOTFOUND') || error.message.includes('not found')) {
      return 'NOT_FOUND';
    }
    if (error.message.includes('ECONNRESET')) {
      return 'ECONNRESET';
    }

    return undefined;
  }
}

export function createDependencyTracker(options?: DependencyTrackerOptions): DependencyTracker {
  return new DependencyTracker(options);
}
