/**
 * Fuzzy Logic Health Check
 * Analogous to embedding-coverage-health: validates that the fuzzy
 * inference pipeline is functional and its thresholds are within bounds.
 */

import { FuzzyInferenceEngine } from './fuzzy-inference.js';

export interface HealthSubCheck {
  name: string;
  status: 'healthy' | 'warning' | 'unhealthy';
  message: string;
  durationMs: number;
}

export interface HealthReport {
  overallStatus: 'healthy' | 'warning' | 'unhealthy';
  checks: HealthSubCheck[];
}

export class FuzzyHealthCheck {
  private inferenceEngine = new FuzzyInferenceEngine();

  async check() {
    const checks = await Promise.all([
      this.checkMembershipFunctionsBound(),
      this.checkInferenceRulesActive(),
      this.checkCalibrationRecord(),
    ]);

    const overallStatus = checks.some((c) => c.status === 'unhealthy')
      ? 'unhealthy'
      : checks.some((c) => c.status === 'warning')
        ? 'warning'
        : 'healthy';

    return { overallStatus, checks };
  }

  private checkMembershipFunctionsBound(): HealthSubCheck {
    const start = Date.now();
    try {
      const result = this.inferenceEngine.evaluatePattern({
        semanticSimilarity: 0.5,
        keywordMatchStrength: 0.5,
        patternComplexity: 'Medium',
        contextualFit: 0.5,
        patternId: '_health_check_',
        originalScore: 0.5,
      });

      const { low, medium, high, very_high } = result.fuzzyScore;
      const allInBounds = [low, medium, high, very_high].every(
        (v) => v >= 0 && v <= 1,
      );

      return {
        name: 'membership-function-bounds',
        status: allInBounds ? 'healthy' : 'warning',
        message: allInBounds
          ? 'All membership outputs within [0, 1]'
          : 'Membership output out of bounds',
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'membership-function-bounds',
        status: 'unhealthy',
        message: `Evaluation failed: ${(error as Error).message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  private checkInferenceRulesActive(): HealthSubCheck {
    const start = Date.now();
    try {
      const highInput = this.inferenceEngine.evaluatePattern({
        semanticSimilarity: 0.95,
        keywordMatchStrength: 0.95,
        patternComplexity: 'Medium',
        contextualFit: 0.95,
        patternId: '_health_check_active_',
        originalScore: 0.95,
      });

      const rulesFired = highInput.ruleFirings.length;
      const confidence = highInput.confidence;

      const status =
        rulesFired > 0 && confidence > 0.5 ? 'healthy' : 'warning';

      return {
        name: 'inference-rules-active',
        status,
        message:
          status === 'healthy'
            ? `${rulesFired} rules fired, confidence ${confidence.toFixed(3)}`
            : `Only ${rulesFired} rules fired, confidence ${confidence.toFixed(3)}`,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'inference-rules-active',
        status: 'unhealthy',
        message: `Rule execution failed: ${(error as Error).message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  private checkCalibrationRecord(): HealthSubCheck {
    const start = Date.now();
    return {
      name: 'calibration-record',
      status: 'warning',
      message:
        'No calibration record found — thresholds are hardcoded defaults',
      durationMs: Date.now() - start,
    };
  }
}
