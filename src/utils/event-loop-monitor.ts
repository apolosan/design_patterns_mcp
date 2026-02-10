/**
 * Event Loop Monitor
 * Monitors Node.js event loop lag using perf_hooks API
 * Micro-utility: Tracks event loop delays for production monitoring
 */

import perf_hooks from 'perf_hooks';

export interface EventLoopMonitorConfig {
  checkIntervalMs: number;
  warningThresholdMs: number;
  criticalThresholdMs: number;
}

export interface EventLoopMetrics {
  isRunning: boolean;
  minLagMs: number;
  maxLagMs: number;
  avgLagMs: number;
  totalSamples: number;
  lastLagMs: number;
  lastCheckTimestamp: number | null;
  status: 'healthy' | 'warning' | 'critical';
}

export interface EventLoopSnapshot {
  timestamp: number;
  lagMs: number;
  status: 'healthy' | 'warning' | 'critical';
}

const DEFAULT_CONFIG: EventLoopMonitorConfig = {
  checkIntervalMs: 100,
  warningThresholdMs: 50,
  criticalThresholdMs: 200,
};

export class EventLoopMonitor {
  private config: EventLoopMonitorConfig;
  private isRunning: boolean;
  private intervalId: NodeJS.Timeout | null;
  private minLagMs: number;
  private maxLagMs: number;
  private totalLagMs: number;
  private totalSamples: number;
  private lastLagMs: number;
  private lastCheckTimestamp: number | null;
  private snapshots: EventLoopSnapshot[];

  constructor(config?: Partial<EventLoopMonitorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.isRunning = false;
    this.intervalId = null;
    this.minLagMs = Infinity;
    this.maxLagMs = 0;
    this.totalLagMs = 0;
    this.totalSamples = 0;
    this.lastLagMs = 0;
    this.lastCheckTimestamp = null;
    this.snapshots = [];
  }

  private calculateStatus(lagMs: number): 'healthy' | 'warning' | 'critical' {
    if (lagMs >= this.config.criticalThresholdMs) {
      return 'critical';
    }
    if (lagMs >= this.config.warningThresholdMs) {
      return 'warning';
    }
    return 'healthy';
  }

  private checkEventLoopLag(): void {
    const start = perf_hooks.performance.now();
    setImmediate(() => {
      const end = perf_hooks.performance.now();
      const lag = end - start;
      this.recordLag(lag);
    });
  }

  private recordLag(lagMs: number): void {
    if (lagMs < this.minLagMs) {
      this.minLagMs = lagMs;
    }
    if (lagMs > this.maxLagMs) {
      this.maxLagMs = lagMs;
    }
    this.totalLagMs += lagMs;
    this.totalSamples += 1;
    this.lastLagMs = lagMs;
    this.lastCheckTimestamp = Date.now();

    const status = this.calculateStatus(lagMs);
    this.snapshots.push({
      timestamp: Date.now(),
      lagMs,
      status,
    });

    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }
  }

  start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.checkEventLoopLag();
    }, this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  getMetrics(): EventLoopMetrics {
    const avgLagMs = this.totalSamples > 0 ? this.totalLagMs / this.totalSamples : 0;
    const status = this.calculateStatus(this.lastLagMs);

    return {
      isRunning: this.isRunning,
      minLagMs: this.minLagMs === Infinity ? 0 : this.minLagMs,
      maxLagMs: this.maxLagMs,
      avgLagMs: Math.round(avgLagMs * 100) / 100,
      totalSamples: this.totalSamples,
      lastLagMs: this.lastLagMs,
      lastCheckTimestamp: this.lastCheckTimestamp,
      status,
    };
  }

  getStatus(): 'healthy' | 'warning' | 'critical' {
    return this.calculateStatus(this.lastLagMs);
  }

  isHealthy(): boolean {
    return this.getStatus() === 'healthy';
  }

  getRecentSnapshots(count: number = 10): EventLoopSnapshot[] {
    return this.snapshots.slice(-count);
  }

  reset(): void {
    this.minLagMs = Infinity;
    this.maxLagMs = 0;
    this.totalLagMs = 0;
    this.totalSamples = 0;
    this.lastLagMs = 0;
    this.lastCheckTimestamp = null;
    this.snapshots = [];
  }

  destroy(): void {
    this.stop();
    this.reset();
  }
}

export function createEventLoopMonitor(config?: Partial<EventLoopMonitorConfig>): EventLoopMonitor {
  return new EventLoopMonitor(config);
}
