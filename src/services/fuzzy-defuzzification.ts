/**
 * Fuzzy Defuzzification Engine
 * Converts fuzzy outputs back to crisp values as the membership-weighted
 * average of each term's representative value (labelled "centroid"; the
 * max-membership form only survives as the empty-denominator fallback)
 */

export interface DefuzzificationInput {
  fuzzyOutputs: {
    [outputVariable: string]: {
      [linguisticTerm: string]: number; // membership degree for each term
    };
  };
  outputRanges: {
    [outputVariable: string]: {
      [linguisticTerm: string]: {
        min: number;
        max: number;
        representativeValue: number; // crisp value representing the term
      };
    };
  };
}

export interface DefuzzificationResult {
  crispValues: {
    [outputVariable: string]: number;
  };
  method: string;
  confidence: number;
  explanation: string;
}

/**
 * Consequent term shapes for the pattern relevance variable: one crisp
 * representative value plus the span the term may occupy. Kept in one place so
 * the plain and the anchored defuzzifiers cannot drift apart.
 */
/**
 * The relevance reported when nothing supports a pattern.
 *
 * Deliberately NOT the medium representative value (0.45): "I have no evidence"
 * and "I have moderate evidence" must not report the same number, otherwise a
 * conclusion cannot be told apart from ignorance. 0.35 sits between the low
 * (0.15) and medium (0.45) terms, so the ordering reads correctly and a moderate
 * conclusion outranks ignorance.
 */
export const NEUTRAL_RELEVANCE = 0.35;

const RELEVANCE_OUTPUT_RANGES = {
  low: { min: 0.0, max: 0.3, representativeValue: 0.15 },
  medium: { min: 0.3, max: 0.7, representativeValue: 0.45 },
  high: { min: 0.7, max: 0.9, representativeValue: 0.8 },
  very_high: { min: 0.9, max: 1.0, representativeValue: 0.95 },
} as const;

export class FuzzyDefuzzificationEngine {
  /**
   * Defuzzify using the membership-weighted average of representative values
   */
  defuzzify(input: DefuzzificationInput): DefuzzificationResult {
    const crispValues: { [outputVariable: string]: number } = {};

    for (const [outputVar, fuzzyOutput] of Object.entries(input.fuzzyOutputs)) {
      const range = input.outputRanges[outputVar];
      if (!range) {
        throw new Error(`No range defined for output variable: ${outputVar}`);
      }

      crispValues[outputVar] = this.centroidDefuzzification(fuzzyOutput, range);
    }

    // Calculate overall confidence
    const confidence = this.calculateConfidence(input.fuzzyOutputs);

    return {
      crispValues,
      method: 'centroid',
      confidence,
      explanation: this.generateExplanation(crispValues, confidence)
    };
  }

  /**
   * Centroid defuzzification method for better accuracy
   */
  private centroidDefuzzification(
    fuzzyOutput: { [term: string]: number },
    range: { [term: string]: { min: number; max: number; representativeValue: number } }
  ): number {
    let numerator = 0;
    let denominator = 0;

    for (const [term, membership] of Object.entries(fuzzyOutput)) {
      if (membership > 0 && range[term]) {
        const representativeValue = range[term].representativeValue;
        numerator += membership * representativeValue;
        denominator += membership;
      }
    }

    if (denominator > 0) {
      return numerator / denominator;
    }

    // Fallback to max membership if centroid fails
    return this.maxMembershipDefuzzification(fuzzyOutput, range);
  }

  /**
   * Max membership defuzzification method (fallback)
   */
  private maxMembershipDefuzzification(
    fuzzyOutput: { [term: string]: number },
    range: { [term: string]: { min: number; max: number; representativeValue: number } }
  ): number {
    let maxMembership = 0;
    let bestTerm = '';

    for (const [term, membership] of Object.entries(fuzzyOutput)) {
      if (membership > maxMembership) {
        maxMembership = membership;
        bestTerm = term;
      }
    }

    if (bestTerm && range[bestTerm]) {
      return range[bestTerm].representativeValue;
    }

    return 0.5; // Default moderate value
  }

  /**
   * Calculate confidence in the defuzzification result
   */
  private calculateConfidence(fuzzyOutputs: { [outputVariable: string]: { [linguisticTerm: string]: number } }): number {
    let totalMembership = 0;
    let maxMembership = 0;

    for (const fuzzyOutput of Object.values(fuzzyOutputs)) {
      for (const membership of Object.values(fuzzyOutput)) {
        totalMembership += membership;
        maxMembership = Math.max(maxMembership, membership);
      }
    }

    if (totalMembership === 0) return 0;

    // Confidence based on strength of maximum membership
    return Math.min(maxMembership * 0.9 + 0.1, 0.95);
  }

  /**
   * Generate explanation for the defuzzification result
   */
  private generateExplanation(crispValues: { [outputVariable: string]: number }, confidence: number): string {
    const explanations: string[] = [];

    for (const [variable, value] of Object.entries(crispValues)) {
      let level = 'unknown';
      if (value < 0.3) level = 'low';
      else if (value < 0.7) level = 'medium';
      else level = 'high';

      explanations.push(`${variable}: ${level} (${(value * 100).toFixed(1)}%)`);
    }

    const confidenceLevel = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';

    return `Defuzzified values: ${explanations.join(', ')}. Confidence: ${confidenceLevel} (${(confidence * 100).toFixed(1)}%).`;
  }

  /**
   * Specialized defuzzification for pattern relevance scores
   */
  defuzzifyPatternRelevance(fuzzyScore: {
    low: number;
    medium: number;
    high: number;
    very_high: number;
  }): DefuzzificationResult {
    const input: DefuzzificationInput = {
      fuzzyOutputs: {
        relevance: fuzzyScore
      },
      outputRanges: { relevance: RELEVANCE_OUTPUT_RANGES }
    };

    return this.defuzzify(input);
  }

  /**
   * Certainty-anchored centre-of-sets defuzzification.
   *
   * Plain centre-of-sets returns sum(mu times v) divided by sum(mu), which
   * cancels the firing strength when a single term is active: very_high fired
   * at 0.2 and very_high fired at 1.0 both return 0.95. Clipping a symmetric
   * triangle does not help either, because the clipped shape stays symmetric
   * around the apex and its centroid is still the apex.
   *
   * This method adds the completeness rule "if nothing fires then relevance is
   * neutral" with the residual mass (1 minus the dominant membership). Weak
   * evidence is therefore pulled towards neutral instead of being reported as
   * certain, and the output becomes continuous in the rule strengths instead
   * of snapping between the four representative values.
   */
  defuzzifyPatternRelevanceAnchored(
    fuzzyScore: { low: number; medium: number; high: number; very_high: number },
    options?: { noEvidenceValue?: number }
  ): DefuzzificationResult {
    const neutral = options?.noEvidenceValue ?? NEUTRAL_RELEVANCE;
    const terms = Object.entries(RELEVANCE_OUTPUT_RANGES) as Array<
      [string, { min: number; max: number; representativeValue: number }]
    >;

    let numerator = 0;
    let membershipSum = 0;
    let maxMembership = 0;
    for (const [term, shape] of terms) {
      const membership = Math.max(0, fuzzyScore[term as keyof typeof fuzzyScore]);
      numerator += membership * shape.representativeValue;
      membershipSum += membership;
      maxMembership = Math.max(maxMembership, membership);
    }

    const residual = Math.max(0, 1 - Math.min(maxMembership, 1));
    const denominator = membershipSum + residual;
    const raw = denominator > 0 ? (numerator + residual * neutral) / denominator : neutral;

    // The declared spans bound the valid output; anything outside means the
    // caller handed in malformed memberships.
    const lowerBound = RELEVANCE_OUTPUT_RANGES.low.min;
    const upperBound = RELEVANCE_OUTPUT_RANGES.very_high.max;
    const relevance = Math.min(Math.max(raw, lowerBound), upperBound);
    const confidence = Math.min(maxMembership * 0.9 + 0.1, 0.95);

    return {
      crispValues: { relevance },
      method: 'centroid-anchored',
      confidence,
      explanation: 'Anchored centroid: relevance ' + (relevance * 100).toFixed(1) + '% (dominant membership ' + (maxMembership * 100).toFixed(1) + '%, no-evidence mass ' + (residual * 100).toFixed(1) + '%). Confidence: ' + (confidence * 100).toFixed(1) + '%.',
    };
  }

  /**
   * Batch defuzzification for multiple patterns
   */
  batchDefuzzify(patterns: Array<{
    patternId: string;
    fuzzyScore: { low: number; medium: number; high: number; very_high: number };
  }>): Array<{
    patternId: string;
    result: DefuzzificationResult;
  }> {
    return patterns.map(pattern => ({
      patternId: pattern.patternId,
      result: this.defuzzifyPatternRelevance(pattern.fuzzyScore)
    }));
  }

  /**
   * Get defuzzification statistics
   */
  getStatistics(results: DefuzzificationResult[]): {
    averageConfidence: number;
    confidenceDistribution: { low: number; medium: number; high: number };
    valueRanges: { min: number; max: number; average: number };
  } {
    const confidences = results.map(r => r.confidence);
    const values = results.flatMap(r => Object.values(r.crispValues));

    const confidenceDistribution = {
      low: confidences.filter(c => c < 0.4).length,
      medium: confidences.filter(c => c >= 0.4 && c < 0.8).length,
      high: confidences.filter(c => c >= 0.8).length
    };

    const valueRanges = {
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
      average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
    };

    return {
      averageConfidence: confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0,
      confidenceDistribution,
      valueRanges
    };
  }

  /**
   * Alternative defuzzification method for comparison
   */
  defuzzifyMaxMembership(fuzzyScore: {
    low: number;
    medium: number;
    high: number;
    very_high: number;
  }): number {
    const scores = [
      { term: 'low', membership: fuzzyScore.low, value: 0.2 },
      { term: 'medium', membership: fuzzyScore.medium, value: 0.5 },
      { term: 'high', membership: fuzzyScore.high, value: 0.75 },
      { term: 'very_high', membership: fuzzyScore.very_high, value: 0.85 }
    ];

    const maxTerm = scores.reduce((max, current) =>
      current.membership > max.membership ? current : max
    );

    return maxTerm.value;
  }
}