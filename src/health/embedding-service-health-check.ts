/**
 * Embedding Service Health Check
 * Monitors embedding service adapter and external API connectivity
 */

import { HealthCheck, HealthStatus, HealthCheckResult, HealthCheckSeverity } from './types.js';
import { EmbeddingServiceAdapter } from '../adapters/embedding-service-adapter.js';

export class EmbeddingServiceHealthCheck implements HealthCheck {
  name = 'embedding-service';
  description = 'Checks embedding service adapter and external API connectivity';
  tags = ['embeddings', 'external-service', 'ml'];
  timeout = 12000; // 12 seconds

  constructor(private embeddingAdapter: EmbeddingServiceAdapter) {}

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Test if service is ready
      const isReady = await this.embeddingAdapter.isReady();

      if (!isReady) {
        return {
          name: this.name,
          status: HealthStatus.UNHEALTHY,
          message: 'Embedding service adapter is not ready',
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          severity: HealthCheckSeverity.HIGH,
          tags: this.tags
        };
      }

      // Test actual embedding generation
      const testEmbedding = await this.embeddingAdapter.generateEmbedding('test pattern for health check');

      if (!testEmbedding || testEmbedding.length === 0) {
        return {
          name: this.name,
          status: HealthStatus.UNHEALTHY,
          message: 'Embedding service returned empty or invalid result',
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          severity: HealthCheckSeverity.HIGH,
          tags: this.tags
        };
      }

      // Get strategy info for additional details
      const strategyInfo = this.embeddingAdapter.getStrategyInfo();

      return {
        name: this.name,
        status: HealthStatus.HEALTHY,
        message: `Embedding service healthy - using ${strategyInfo?.name || 'unknown'} strategy`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: {
          strategy: strategyInfo?.name,
          model: strategyInfo?.model,
          dimensions: strategyInfo?.dimensions,
          embeddingLength: testEmbedding.length,
          circuitBreakerStats: this.embeddingAdapter.getCircuitBreakerStats()
        },
        severity: HealthCheckSeverity.HIGH,
        tags: this.tags
      };
    } catch (error) {
      return {
        name: this.name,
        status: HealthStatus.UNHEALTHY,
        message: `Embedding service check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
        severity: HealthCheckSeverity.HIGH,
        tags: this.tags
      };
    }
  }
}