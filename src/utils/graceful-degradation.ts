/**
 * Graceful Degradation Handler
 *
 * Provides fallback mechanisms when services or features become unavailable,
 * allowing the system to continue functioning with reduced functionality.
 * This complements circuit breaker by providing degraded responses instead of errors.
 *
 * Best Practice 2025: Progressive degradation for resilient systems
 * Reference: https://thenewstack.io/15-best-practices-for-building-mcp-servers-in-production/
 */

export enum DegradationLevel {
  FULL = 'full',
  REDUCED = 'reduced',
  MINIMAL = 'minimal',
  OFFLINE = 'offline'
}

export interface DegradationConfig {
  featureName: string;
  level: DegradationLevel;
  fallback?: () => unknown;
  cacheFallback?: boolean;
  fallbackTTL?: number;
}

export interface DegradationState {
  featureName: string;
  level: DegradationLevel;
  lastDegradedAt?: number;
  degradationCount: number;
  recoveryCount: number;
}

export interface DegradationMetrics {
  totalRequests: number;
  degradedRequests: number;
  fullRequests: number;
  degradationRate: number;
}

export class GracefulDegradationError extends Error {
  constructor(
    message: string,
    public readonly featureName: string,
    public readonly level: DegradationLevel
  ) {
    super(message);
    this.name = 'GracefulDegradationError';
  }
}

export class GracefulDegradation {
  private states: Map<string, DegradationState> = new Map();
  private metrics: Map<string, DegradationMetrics> = new Map();
  private fallbacks: Map<string, () => unknown> = new Map();
  private fallbackCache: Map<string, { value: unknown; expiry: number }> = new Map();

  configure(config: DegradationConfig): void {
    this.states.set(config.featureName, {
      featureName: config.featureName,
      level: config.level,
      degradationCount: 0,
      recoveryCount: 0
    });

    if (config.fallback) {
      this.fallbacks.set(config.featureName, config.fallback);
    }

    if (config.cacheFallback && config.fallbackTTL) {
      this.fallbackCache.set(config.featureName, {
        value: config.fallback,
        expiry: Date.now() + config.fallbackTTL
      });
    }
  }

  setLevel(featureName: string, level: DegradationLevel): void {
    const state = this.states.get(featureName);
    if (!state) {
      this.states.set(featureName, {
        featureName,
        level,
        degradationCount: 0,
        recoveryCount: 0
      });
      return;
    }

    const previousLevel = state.level;
    state.level = level;

    if (previousLevel !== DegradationLevel.FULL && level === DegradationLevel.FULL) {
      state.recoveryCount++;
    }

    if (level !== DegradationLevel.FULL) {
      state.lastDegradedAt = Date.now();
      state.degradationCount++;
    }
  }

  getLevel(featureName: string): DegradationLevel {
    return this.states.get(featureName)?.level ?? DegradationLevel.FULL;
  }

  async execute<T>(
    featureName: string,
    primary: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    this.initMetrics(featureName);
    const metrics = this.metrics.get(featureName);
    if (!metrics) {
      throw new Error(`Metrics not initialized for feature: ${featureName}`);
    }
    metrics.totalRequests++;

    const level = this.getLevel(featureName);

    if (level === DegradationLevel.FULL) {
      metrics.fullRequests++;
      return primary();
    }

    metrics.degradedRequests++;

    const cachedFallback = this.fallbackCache.get(featureName);
    if (cachedFallback && cachedFallback.expiry > Date.now()) {
      return cachedFallback.value as T;
    }

    const registeredFallback = this.fallbacks.get(featureName);
    const fallbackFn = fallback ?? registeredFallback;

    if (!fallbackFn) {
      throw new GracefulDegradationError(
        `No fallback available for feature '${featureName}' at level '${level}'`,
        featureName,
        level
      );
    }

    return fallbackFn() as T;
  }

  getMetrics(featureName: string): DegradationMetrics | undefined {
    return this.metrics.get(featureName);
  }

  getAllMetrics(): Map<string, DegradationMetrics> {
    return this.metrics;
  }

  getState(featureName: string): DegradationState | undefined {
    return this.states.get(featureName);
  }

  getAllStates(): Map<string, DegradationState> {
    return this.states;
  }

  isDegraded(featureName: string): boolean {
    const level = this.getLevel(featureName);
    return level !== DegradationLevel.FULL;
  }

  getOverallHealth(): { healthy: number; degraded: number; offline: number } {
    let healthy = 0;
    let degraded = 0;
    let offline = 0;

    for (const state of this.states.values()) {
      if (state.level === DegradationLevel.FULL) {
        healthy++;
      } else if (state.level === DegradationLevel.OFFLINE) {
        offline++;
      } else {
        degraded++;
      }
    }

    return { healthy, degraded, offline };
  }

  reset(featureName?: string): void {
    if (featureName) {
      this.states.delete(featureName);
      this.metrics.delete(featureName);
      this.fallbacks.delete(featureName);
      this.fallbackCache.delete(featureName);
    } else {
      this.states.clear();
      this.metrics.clear();
      this.fallbacks.clear();
      this.fallbackCache.clear();
    }
  }

  private initMetrics(featureName: string): void {
    if (!this.metrics.has(featureName)) {
      this.metrics.set(featureName, {
        totalRequests: 0,
        degradedRequests: 0,
        fullRequests: 0,
        degradationRate: 0
      });
    }
  }
}

export const degradationHandler = new GracefulDegradation();
