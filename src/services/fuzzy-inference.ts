/**
 * Fuzzy Inference Engine for Pattern Relevance
 * Implements fuzzy logic rules for combining multiple relevance dimensions
 */

import { FuzzyMembershipResult, PatternMembershipFunctions, PatternMembershipInput } from './fuzzy-membership.js';

export interface FuzzyInferenceInput {
  membershipValues: FuzzyMembershipResult;
  patternId: string;
  originalScore: number;
}

export interface FuzzyInferenceOutput {
  fuzzyScore: {
    low: number;
    medium: number;
    high: number;
    very_high: number;
  };
  confidence: number;
  reasoning: string[];
  ruleFirings: Array<{
    rule: string;
    strength: number;
    contribution: number;
  }>;
}

export class FuzzyInferenceEngine {
  private membershipFunctions: PatternMembershipFunctions;

  constructor() {
    this.membershipFunctions = new PatternMembershipFunctions();
  }

  /**
   * Apply fuzzy inference rules to determine overall pattern relevance
   */
  infer(input: FuzzyInferenceInput): FuzzyInferenceOutput {
    const { membershipValues } = input;
    const ruleFirings: Array<{ rule: string; strength: number; contribution: number }> = [];
    const reasoning: string[] = [];

    // Initialize fuzzy output sets
    let lowOutput = 0;
    let mediumOutput = 0;
    let highOutput = 0;
    let veryHighOutput = 0;

    // Rule 1: IF semantic_similarity IS high AND keyword_match IS strong THEN relevance IS very_high
    const rule1Strength = Math.min(
      membershipValues.semanticSimilarity.high,
      membershipValues.keywordMatchStrength.strong
    );
    if (rule1Strength > 0.7) { // Higher threshold for very high matches
      veryHighOutput = Math.max(veryHighOutput, rule1Strength);
      ruleFirings.push({
        rule: "High semantic similarity AND strong keyword match → Very High Relevance",
        strength: rule1Strength,
        contribution: rule1Strength
      });
      reasoning.push(`Strong semantic and keyword alignment (${(rule1Strength * 100).toFixed(1)}% confidence)`);
    }

    // Rule 2: IF semantic_similarity IS high AND contextual_fit IS excellent THEN relevance IS very_high
    const rule2Strength = Math.min(
      membershipValues.semanticSimilarity.high,
      membershipValues.contextualFit.excellent
    );
    if (rule2Strength > 0.8) { // Much higher threshold for excellent matches
      veryHighOutput = Math.max(veryHighOutput, rule2Strength);
      ruleFirings.push({
        rule: "High semantic similarity AND excellent contextual fit → Very High Relevance",
        strength: rule2Strength,
        contribution: rule2Strength
      });
      reasoning.push(`Excellent semantic-contextual fit (${(rule2Strength * 100).toFixed(1)}% confidence)`);
    }

    // Rule 3: IF semantic_similarity IS medium AND keyword_match IS moderate AND contextual_fit IS good THEN relevance IS high
    const rule3Strength = Math.min(
      membershipValues.semanticSimilarity.medium,
      membershipValues.keywordMatchStrength.moderate,
      membershipValues.contextualFit.good
    );
    if (rule3Strength > 0.4) { // Reasonable threshold
      highOutput = Math.max(highOutput, rule3Strength);
      ruleFirings.push({
        rule: "Medium semantic similarity AND moderate keyword match AND good contextual fit → High Relevance",
        strength: rule3Strength,
        contribution: rule3Strength
      });
      reasoning.push(`Balanced relevance factors (${(rule3Strength * 100).toFixed(1)}% confidence)`);
    }

    // Rule 4: IF semantic_similarity IS medium AND keyword_match IS strong THEN relevance IS high
    const rule4Strength = Math.min(
      membershipValues.semanticSimilarity.medium,
      membershipValues.keywordMatchStrength.strong
    );
    if (rule4Strength > 0.4) { // Reasonable threshold
      highOutput = Math.max(highOutput, rule4Strength);
      ruleFirings.push({
        rule: "Medium semantic similarity AND strong keyword match → High Relevance",
        strength: rule4Strength,
        contribution: rule4Strength
      });
      reasoning.push(`Good semantic-keyword alignment (${(rule4Strength * 100).toFixed(1)}% confidence)`);
    }

    // Rule 5: REMOVED - Low semantic similarity should not result in medium relevance

    // Rule 6: IF contextual_fit IS poor THEN relevance IS low (strong penalty)
    const rule6Strength = membershipValues.contextualFit.poor;
    if (rule6Strength > 0.7) { // Very high threshold - only penalize clearly poor fits
      lowOutput = Math.max(lowOutput, rule6Strength);
      ruleFirings.push({
        rule: "Poor contextual fit → Low Relevance",
        strength: rule6Strength,
        contribution: rule6Strength
      });
      reasoning.push(`Contextual fit concerns (${(rule6Strength * 100).toFixed(1)}% impact)`);
    }

    // Rule 7: IF pattern_complexity IS complex AND semantic_similarity IS high THEN relevance IS high
    const rule7Strength = Math.min(
      membershipValues.patternComplexity.complex,
      membershipValues.semanticSimilarity.high
    );
    if (rule7Strength > 0.5) { // Higher threshold
      highOutput = Math.max(highOutput, rule7Strength);
      ruleFirings.push({
        rule: "Complex pattern with high semantic similarity → High Relevance",
        strength: rule7Strength,
        contribution: rule7Strength
      });
      reasoning.push(`Complex but semantically relevant pattern (${(rule7Strength * 100).toFixed(1)}% confidence)`);
    }

    // Rule 8: IF pattern_complexity IS simple AND semantic_similarity IS high THEN relevance IS medium
    const rule8Strength = Math.min(
      membershipValues.patternComplexity.simple,
      membershipValues.semanticSimilarity.high // Require HIGH semantic similarity even for simple patterns
    );
    if (rule8Strength > 0.7) { // Very high threshold
      mediumOutput = Math.max(mediumOutput, rule8Strength);
      ruleFirings.push({
        rule: "Simple pattern with high semantic similarity → Medium Relevance",
        strength: rule8Strength,
        contribution: rule8Strength
      });
      reasoning.push(`Simple but highly relevant pattern (${(rule8Strength * 100).toFixed(1)}% confidence)`);
    }

    // Default rule: Intelligent fallback based on available evidence
    const maxFiredStrength = Math.max(lowOutput, mediumOutput, highOutput, veryHighOutput);
    if (maxFiredStrength < 0.5) { // Higher threshold for default - require more evidence
      // Smart default based on strongest available evidence
      const semanticStrength = membershipValues.semanticSimilarity.high * 0.6 +
                              membershipValues.semanticSimilarity.medium * 0.3;
      const keywordStrength = membershipValues.keywordMatchStrength.strong * 0.5 +
                             membershipValues.keywordMatchStrength.moderate * 0.2;
      const contextStrength = membershipValues.contextualFit.excellent * 0.4 +
                             membershipValues.contextualFit.good * 0.2;

      const smartDefault = Math.max(
        Math.min(semanticStrength + keywordStrength + contextStrength, 0.7), // Cap at 0.7
        0.1 // Lower minimum baseline
      );

      // Assign to appropriate category based on smart default
      if (smartDefault > 0.55) {
        highOutput = Math.max(highOutput, smartDefault);
        ruleFirings.push({
          rule: "Smart default: High relevance based on combined evidence",
          strength: smartDefault,
          contribution: smartDefault
        });
        reasoning.push(`High relevance from combined evidence (${(smartDefault * 100).toFixed(1)}% confidence)`);
      } else if (smartDefault > 0.35) {
        mediumOutput = Math.max(mediumOutput, smartDefault);
        ruleFirings.push({
          rule: "Smart default: Medium relevance based on available evidence",
          strength: smartDefault,
          contribution: smartDefault
        });
        reasoning.push(`Medium relevance from available evidence (${(smartDefault * 100).toFixed(1)}% confidence)`);
      } else if (smartDefault > 0.2) {
        lowOutput = Math.max(lowOutput, smartDefault);
        ruleFirings.push({
          rule: "Smart default: Low relevance - limited matching evidence",
          strength: smartDefault,
          contribution: smartDefault
        });
        reasoning.push(`Low-moderate relevance (${(smartDefault * 100).toFixed(1)}% confidence)`);
      } else {
        lowOutput = Math.max(lowOutput, 0.15); // Very low baseline
        ruleFirings.push({
          rule: "Smart default: Very low relevance - minimal matching evidence",
          strength: 0.15,
          contribution: 0.15
        });
        reasoning.push(`Very low baseline relevance (15.0% confidence)`);
      }
    }

    const fuzzyScore = {
      low: lowOutput,
      medium: mediumOutput,
      high: highOutput,
      very_high: veryHighOutput
    };

    // Calculate crisp confidence score (will be refined by defuzzification)
    const preliminaryConfidence = this.calculatePreliminaryConfidence(fuzzyScore);

    return {
      fuzzyScore,
      confidence: preliminaryConfidence,
      reasoning,
      ruleFirings
    };
  }

  /**
   * Calculate preliminary confidence from fuzzy outputs using weighted average
   */
  private calculatePreliminaryConfidence(fuzzyScore: { low: number; medium: number; high: number; very_high: number }): number {
    const weights = {
      low: 0.1,      // Very low weight for low relevance
      medium: 0.4,   // Moderate weight for medium relevance
      high: 0.7,     // High weight for high relevance
      very_high: 0.9 // Very high weight for very high relevance
    };

    const weightedSum = fuzzyScore.low * weights.low +
                       fuzzyScore.medium * weights.medium +
                       fuzzyScore.high * weights.high +
                       fuzzyScore.very_high * weights.very_high;

    const totalMembership = fuzzyScore.low + fuzzyScore.medium + fuzzyScore.high + fuzzyScore.very_high;

    // More conservative: require at least 0.3 total membership for meaningful confidence
    if (totalMembership < 0.3) {
      return Math.max(0.1, weightedSum / totalMembership);
    }

    return totalMembership > 0 ? weightedSum / totalMembership : 0.5;
  }

  /**
   * Evaluate pattern with full fuzzy inference
   */
  evaluatePattern(input: PatternMembershipInput & { patternId: string; originalScore: number }): FuzzyInferenceOutput {
    const membershipValues = this.membershipFunctions.evaluate(input);

    const inferenceInput: FuzzyInferenceInput = {
      membershipValues,
      patternId: input.patternId,
      originalScore: input.originalScore
    };

    return this.infer(inferenceInput);
  }

  /**
   * Get rule statistics for analysis
   */
  getRuleStatistics(results: FuzzyInferenceOutput[]): {
    mostFiredRules: Array<{ rule: string; count: number; avgStrength: number }>;
    averageConfidence: number;
    ruleDistribution: { [rule: string]: number };
  } {
    const ruleCounts: { [rule: string]: { count: number; totalStrength: number } } = {};
    const confidences: number[] = [];

    results.forEach(result => {
      confidences.push(result.confidence);
      result.ruleFirings.forEach(firing => {
        if (!ruleCounts[firing.rule]) {
          ruleCounts[firing.rule] = { count: 0, totalStrength: 0 };
        }
        ruleCounts[firing.rule].count++;
        ruleCounts[firing.rule].totalStrength += firing.strength;
      });
    });

    const mostFiredRules = Object.entries(ruleCounts)
      .map(([rule, stats]) => ({
        rule,
        count: stats.count,
        avgStrength: stats.totalStrength / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const ruleDistribution: { [rule: string]: number } = {};
    Object.entries(ruleCounts).forEach(([rule, stats]) => {
      ruleDistribution[rule] = stats.count;
    });

    return {
      mostFiredRules,
      averageConfidence: confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0,
      ruleDistribution
    };
  }
}