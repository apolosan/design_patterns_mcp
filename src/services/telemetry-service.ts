/**
 * Telemetry Service
 * Implements comprehensive metrics, traces, and evaluators
 * Based on arXiv 2506.11019 (Telemetry-Aware IDEs) and 2508.14704 (MCP-Universe)
 */

import { logger } from './logger.js';
import { SearchMetrics, SearchTrace, EvaluationMetrics } from '../types/search-strategy.js';
import { EventEmitter } from 'events';

/**
 * Telemetry event types
 */
export type TelemetryEventType = 
  | 'search_start'
  | 'search_complete'
  | 'search_error'
  | 'embeddings_generated'
  | 'cache_hit'
  | 'cache_miss'
  | 'vector_search'
  | 'keyword_search'
  | 'graph_traversal'
  | 'compression'
  | 'evaluation_complete';

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  enabled: boolean;
  logTraces: boolean;
  logMetrics: boolean;
  logEvaluations: boolean;
  sampleRate: number; // 0.0 to 1.0
  retentionHours: number;
}

/**
 * Search evaluation result
 */
export interface EvaluationResult {
  query: string;
  metrics: EvaluationMetrics;
  recommendations: Array<{
    patternId: string;
    score: number;
    rank: number;
    relevance: number; // Human-labeled or computed
  }>;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

/**
 * Trace step for detailed execution tracking
 */
export interface TraceStep {
  name: string;
  timestamp: number;
  duration: number;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  error?: string;
  embeddingsUsed?: number;
  cacheHit?: boolean;
}

/**
 * Performance metrics aggregator
 */
export interface PerformanceMetrics {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  count: number;
}

/**
 * Quality metrics for search results
 */
export interface QualityMetrics {
  precisionAtK: number[];
  recallAtK: number[];
  ndcgAtK: number[];
  diversityScore: number;
  semanticCoverage: number;
  userSatisfaction?: number;
}

/**
 * Telemetry Event
 */
export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: Date;
  context: Record<string, unknown>;
  metrics?: SearchMetrics;
  trace?: SearchTrace;
  evaluation?: EvaluationResult;
}

/**
 * Telemetry Service
 * Central service for collecting and analyzing system telemetry
 */
export class TelemetryService extends EventEmitter {
  private config: TelemetryConfig;
  private events: TelemetryEvent[] = [];
  private metricsBuffer: SearchMetrics[] = [];
  private tracesBuffer: SearchTrace[] = [];
  private evaluationsBuffer: EvaluationResult[] = [];

  // Aggregated metrics
  private performanceAggregates: Map<string, number[]> = new Map();
  private qualityAggregates: Map<string, QualityMetrics> = new Map();
  private usagePatterns: Map<string, number> = new Map();

  constructor(config?: Partial<TelemetryConfig>) {
    super();
    this.config = {
      enabled: config?.enabled ?? true,
      logTraces: config?.logTraces ?? true,
      logMetrics: config?.logMetrics ?? true,
      logEvaluations: config?.logEvaluations ?? true,
      sampleRate: config?.sampleRate ?? 1.0,
      retentionHours: config?.retentionHours ?? 24,
    };

    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Record a telemetry event
   */
  recordEvent(event: TelemetryEvent): void {
    if (!this.config.enabled) return;
    
    // Sampling
    if (Math.random() > this.config.sampleRate) return;

    // Add to buffer
    this.events.push(event);

    // Also emit for real-time listeners
    this.emit(event.type, event);

    // Update aggregates
    if (event.metrics) {
      this.updateMetricsAggregates(event.metrics);
    }
    if (event.trace) {
      this.tracesBuffer.push(event.trace);
    }
    if (event.evaluation) {
      this.evaluationsBuffer.push(event.evaluation);
    }

    // Log for debugging
    if (this.config.logTraces && event.trace) {
      logger.debug('telemetry', `Trace: ${event.type}`, {
        contextId: event.trace.contextId,
        steps: event.trace.steps.length,
      });
    }
  }

  /**
   * Record search metrics
   */
  recordSearchMetrics(metrics: SearchMetrics): void {
    this.metricsBuffer.push(metrics);
    
    this.recordEvent({
      type: 'search_complete',
      timestamp: new Date(),
      context: {
        query: metrics.query.substring(0, 50),
        strategy: metrics.strategy,
      },
      metrics,
    });
  }

  /**
   * Record execution trace
   */
  recordTrace(trace: SearchTrace): void {
    if (!this.config.logTraces) return;
    
    this.recordEvent({
      type: 'search_complete',
      timestamp: new Date(),
      context: { contextId: trace.contextId },
      trace,
    });
  }

  /**
   * Record evaluation
   */
  recordEvaluation(evaluation: EvaluationResult): void {
    if (!this.config.logEvaluations) return;
    
    this.recordEvent({
      type: 'evaluation_complete',
      timestamp: new Date(),
      context: {
        query: evaluation.query.substring(0, 50),
        userId: evaluation.userId,
      },
      evaluation,
    });
  }

  /**
   * Record cache hit/miss
   */
  recordCacheHit(key: string, hit: boolean): void {
    this.recordEvent({
      type: hit ? 'cache_hit' : 'cache_miss',
      timestamp: new Date(),
      context: { cacheKey: key },
    });
  }

  /**
   * Calculate performance percentiles
   */
  getPerformancePercentiles(): Map<string, PerformanceMetrics> {
    const results = new Map<string, PerformanceMetrics>();

    Array.from(this.performanceAggregates.entries()).forEach(([key, durations]) => {
      if (durations.length === 0) return;

      const sorted = [...durations].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const mean = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
      const min = sorted[0];
      const max = sorted[sorted.length - 1];

      results.set(key, {
        p50,
        p95,
        p99,
        mean,
        min,
        max,
        count: sorted.length,
      });
    });

    return results;
  }

  /**
   * Get quality metrics
   */
  getQualityMetrics(): Map<string, QualityMetrics> {
    return new Map(this.qualityAggregates);
  }

  /**
   * Evaluate search results
   * Implements metrics from MCP-Universe (2508.14704)
   */
  evaluateSearch(
    query: string,
    recommendations: Array<{ patternId: string; score: number; rank: number }>,
    groundTruth?: string[] // Expected pattern IDs
  ): EvaluationResult {
    const k = Math.min(10, recommendations.length);
    
    // Precision@K
    const precisionAtK: number[] = [];
    for (let i = 1; i <= k; i++) {
      if (groundTruth) {
        const hits = recommendations.slice(0, i).filter(r => groundTruth.includes(r.patternId)).length;
        precisionAtK.push(hits / i);
      } else {
        // Use score-based heuristic
        precisionAtK.push(recommendations.slice(0, i).reduce((sum, r) => sum + r.score, 0) / i);
      }
    }

    // Recall@K
    const recallAtK: number[] = [];
    if (groundTruth) {
      for (let i = 1; i <= k; i++) {
        const hits = recommendations.slice(0, i).filter(r => groundTruth.includes(r.patternId)).length;
        recallAtK.push(hits / groundTruth.length);
      }
    }

    // NDCG@K (Normalized Discounted Cumulative Gain)
    const ndcgAtK: number[] = [];
    for (let i = 1; i <= k; i++) {
      let dcg = 0;
      let idcg = 0;
      
      for (let j = 0; j < i; j++) {
        const relevance = groundTruth?.includes(recommendations[j].patternId) ? 1 : recommendations[j].score;
        dcg += relevance / Math.log2(j + 2);
        idcg += 1 / Math.log2(j + 2); // Perfect ranking
      }
      
      ndcgAtK.push(idcg > 0 ? dcg / idcg : 0);
    }

    // Diversity score (unique categories)
    const categories = new Set<string>();
    // Would need to fetch categories from database
    const diversityScore = 0.5; // Placeholder

    // Semantic coverage
    const semanticCoverage = recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length;

    const metrics: EvaluationMetrics = {
      precisionAtK: precisionAtK[precisionAtK.length - 1] ?? 0,
      recallAtK: recallAtK[recallAtK.length - 1] ?? 0,
      ndcgAtK: ndcgAtK[ndcgAtK.length - 1] ?? 0,
      mapAtK: precisionAtK.reduce((sum, val, i) => sum + val * (recallAtK[i] ?? 0), 0) / k,
      diversityScore,
      latencyP50: 0,
      latencyP95: 0,
      latencyP99: 0,
    };

    const evaluation: EvaluationResult = {
      query,
      metrics,
      recommendations: recommendations.map(r => ({
        patternId: r.patternId,
        score: r.score,
        rank: r.rank,
        relevance: groundTruth?.includes(r.patternId) ? 1.0 : r.score,
      })),
      timestamp: new Date(),
    };

    this.recordEvaluation(evaluation);
    return evaluation;
  }

  /**
   * Update metrics aggregates
   */
  private updateMetricsAggregates(metrics: SearchMetrics): void {
    // Track performance by strategy
    const key = `search_${metrics.strategy}`;
    if (!this.performanceAggregates.has(key)) {
      this.performanceAggregates.set(key, []);
    }
    this.performanceAggregates.get(key)!.push(metrics.durationMs);

    // Track by query type (extract from context)
    const queryType = this.inferQueryType(metrics.query);
    const typeKey = `search_${queryType}`;
    if (!this.performanceAggregates.has(typeKey)) {
      this.performanceAggregates.set(typeKey, []);
    }
    this.performanceAggregates.get(typeKey)!.push(metrics.durationMs);

    // Track quality metrics
    const qualityKey = `quality_${metrics.strategy}`;
    if (!this.qualityAggregates.has(qualityKey)) {
      this.qualityAggregates.set(qualityKey, {
        precisionAtK: [],
        recallAtK: [],
        ndcgAtK: [],
        diversityScore: 0,
        semanticCoverage: 0,
      });
    }

    const quality = this.qualityAggregates.get(qualityKey)!;
    quality.semanticCoverage = (quality.semanticCoverage + (metrics.avgRelevance ?? 0)) / 2;
    if (metrics.diversityScore !== undefined) {
      quality.diversityScore = (quality.diversityScore + metrics.diversityScore) / 2;
    }

    // Track usage patterns
    const queryKey = this.normalizeQuery(metrics.query);
    this.usagePatterns.set(queryKey, (this.usagePatterns.get(queryKey) ?? 0) + 1);
  }

  /**
   * Infer query type from text
   */
  private inferQueryType(query: string): string {
    const words = query.split(/\s+/);
    if (words.length <= 3) return 'specific';
    if (query.includes('how') || query.includes('what') || query.includes('explain')) return 'exploratory';
    return 'balanced';
  }

  /**
   * Normalize query for pattern tracking
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 50);
  }

  /**
   * Generate report
   */
  generateReport(): {
    summary: string;
    metrics: Map<string, PerformanceMetrics>;
    quality: Map<string, QualityMetrics>;
    usage: Map<string, number>;
    events: number;
  } {
    const performance = this.getPerformancePercentiles();
    const quality = this.getQualityMetrics();
    const usageEntries = Array.from(this.usagePatterns.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const usage = new Map(usageEntries as [string, number][]);

    const totalSearches = this.metricsBuffer.length;
    const avgDuration = performance.get('search_hybrid')?.mean ?? 0;

    const summary = `Telemetry Report:
- Total searches: ${totalSearches}
- Average duration (hybrid): ${avgDuration.toFixed(2)}ms
- Performance tracked for ${performance.size} query types
- Quality metrics for ${quality.size} strategies
- Top 20 queries tracked`;

    return {
      summary,
      metrics: performance,
      quality,
      usage,
      events: this.events.length,
    };
  }

  /**
   * Get metrics for health check
   */
  getHealthMetrics(): {
    searchRate: number;
    avgLatency: number;
    errorRate: number;
    cacheHitRate: number;
  } {
    const recentMetrics = this.metricsBuffer.filter(m => 
      Date.now() - m.timestamp.getTime() < 3600000 // Last hour
    );

    const searchRate = recentMetrics.length / 3600; // per second
    const avgLatency = recentMetrics.reduce((sum, m) => sum + m.durationMs, 0) / (recentMetrics.length || 1);
    
    const errors = this.events.filter(e => e.type === 'search_error').length;
    const total = this.events.filter(e => e.type === 'search_complete').length || 1;
    const errorRate = errors / total;

    const cacheHits = this.events.filter(e => e.type === 'cache_hit').length;
    const cacheLooks = this.events.filter(e => 
      e.type === 'cache_hit' || e.type === 'cache_miss'
    ).length || 1;
    const cacheHitRate = cacheHits / cacheLooks;

    return {
      searchRate,
      avgLatency,
      errorRate,
      cacheHitRate,
    };
  }

  /**
   * Start periodic flush to persistent storage
   */
  private startPeriodicFlush(): void {
    setInterval(() => {
      this.flush();
    }, 60000); // Every minute

    // Also flush on process exit
    process.on('beforeExit', () => {
      this.flush();
    });
  }

  /**
   * Flush buffers to storage
   */
  private flush(): void {
    if (this.events.length === 0) return;

    // In production, this would write to database or file
    // For now, log aggregated stats
    
    const report = this.generateReport();
    logger.info('telemetry', 'Periodic telemetry flush', {
      eventsFlushed: this.events.length,
      metricsCount: this.metricsBuffer.length,
      report: report.summary,
    });

    // Clear old events based on retention
    const cutoff = Date.now() - (this.config.retentionHours * 3600000);
    this.events = this.events.filter(e => e.timestamp.getTime() >= cutoff);
    this.metricsBuffer = this.metricsBuffer.filter(m => m.timestamp.getTime() >= cutoff);
    this.tracesBuffer = this.tracesBuffer.filter(t => {
      const firstStep = t.steps[0];
      return firstStep && firstStep.startTime >= cutoff;
    });
    this.evaluationsBuffer = this.evaluationsBuffer.filter(e => e.timestamp.getTime() >= cutoff);
  }

  /**
   * Create evaluators for automated testing
   */
  createEvaluators() {
    return {
      /**
       * Format compliance evaluator
       */
      formatCompliance: (result: any): boolean => {
        return result && Array.isArray(result) && result.every(r => 
          typeof r.patternId === 'string' && typeof r.score === 'number'
        );
      },

      /**
       * Semantic correctness evaluator
       */
      semanticCorrectness: (query: string, results: Array<{ patternId: string; score: number }>): number => {
        // Check if top results are semantically related to query
        // This would use embedding similarity in production
        const score = results.slice(0, 3).reduce((sum, r) => sum + r.score, 0) / 3;
        return score;
      },

      /**
       * Diversity evaluator
       */
      diversity: (results: Array<{ patternId: string }>): number => {
        const unique = new Set(results.map(r => r.patternId)).size;
        return unique / results.length;
      },

      /**
       * Relevance evaluator
       */
      relevance: (results: Array<{ score: number }>): number => {
        if (results.length === 0) return 0;
        return results.reduce((sum, r) => sum + r.score, 0) / results.length;
      },
    };
  }

  /**
   * Clear all telemetry data
   */
  clear(): void {
    this.events = [];
    this.metricsBuffer = [];
    this.tracesBuffer = [];
    this.evaluationsBuffer = [];
    this.performanceAggregates.clear();
    this.qualityAggregates.clear();
    this.usagePatterns.clear();
    logger.info('telemetry', 'All telemetry data cleared');
  }

  /**
   * Get summary statistics
   */
  getSummary(): Record<string, unknown> {
    const health = this.getHealthMetrics();
    const report = this.generateReport();

    return {
      totalEvents: this.events.length,
      totalSearches: this.metricsBuffer.length,
      activeStrategies: Array.from(this.qualityAggregates.keys()),
      health,
      report: report.summary,
      topQueries: Array.from(report.usage.entries()).slice(0, 5),
    };
  }
}

/**
 * Global telemetry singleton
 */
export const telemetry = new TelemetryService();