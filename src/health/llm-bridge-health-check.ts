/**
 * LLM Bridge Health Check Implementation
 * Monitors LLM service availability and basic operations
 */

import { HealthCheck, HealthCheckResult, HealthStatus, HealthUtils, HealthCheckSeverity } from './types.js';
import { LLMBridgeService } from '../services/llm-bridge.js';

export class LLMBridgeHealthCheck implements HealthCheck {
  name = 'llm-bridge';
  description = 'LLM Bridge service health check - AI model connectivity and responses';
  tags = ['llm', 'ai', 'external-service', 'optional'];
  timeout = 15000; // 15 seconds (LLM calls can be slow)

  constructor(private llmBridge: LLMBridgeService | null) {}

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check if LLM is configured
      if (!this.llmBridge) {
        return HealthUtils.createResult(
          this.name,
          HealthStatus.UNKNOWN,
          'LLM Bridge service is not configured (optional feature disabled)',
          Date.now() - startTime,
          { configured: false },
          undefined,
          HealthCheckSeverity.LOW,
          this.tags
        );
      }

      // Test LLM service health using existing health check method
      const healthStatus = await this.llmBridge.getHealthStatus();

      const duration = Date.now() - startTime;

      if (healthStatus.healthy) {
        return HealthUtils.createResult(
          this.name,
          HealthStatus.HEALTHY,
          `LLM service is healthy (${healthStatus.provider}/${healthStatus.model})`,
          duration,
          {
            provider: healthStatus.provider,
            model: healthStatus.model,
            lastTest: healthStatus.lastTest?.toISOString(),
            responseTime: duration
          },
          undefined,
          HealthCheckSeverity.LOW,
          this.tags
        );
      } else {
        return HealthUtils.createResult(
          this.name,
          HealthStatus.UNHEALTHY,
          `LLM service is unhealthy: ${healthStatus.error ?? 'Unknown error'}`,
          duration,
          {
            provider: healthStatus.provider,
            model: healthStatus.model,
            error: healthStatus.error,
            lastTest: healthStatus.lastTest?.toISOString()
          },
            new Error(healthStatus.error ?? 'LLM service unhealthy'),
          HealthCheckSeverity.MEDIUM,
          this.tags
        );
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      return HealthUtils.createResult(
        this.name,
        HealthStatus.UNHEALTHY,
        `LLM Bridge health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        {
          error: error instanceof Error ? error.message : String(error),
          configured: !!this.llmBridge
        },
        error instanceof Error ? error : new Error(String(error)),
        HealthCheckSeverity.MEDIUM,
        this.tags
      );
    }
  }

  isEnabled(): boolean {
    // LLM Bridge is optional - only enabled if configured
    return !!this.llmBridge;
  }
}