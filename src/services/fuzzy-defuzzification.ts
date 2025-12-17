/**
 * Fuzzy Defuzzification Engine
 * Converts fuzzy outputs back to crisp values using max membership method
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

export class FuzzyDefuzzificationEngine {
  /**
   * Defuzzify using max membership method (simpler and more predictable)
   */
  defuzzify(input: DefuzzificationInput): DefuzzificationResult {
    const crispValues: { [outputVariable: string]: number } = {};

    for (const [outputVar, fuzzyOutput] of Object.entries(input.fuzzyOutputs)) {
      const range = input.outputRanges[outputVar];
      if (!range) {
        throw new Error(`No range defined for output variable: ${outputVar}`);
      }

      crispValues[outputVar] = this.maxMembershipDefuzzification(fuzzyOutput, range);
    }

    // Calculate overall confidence
    const confidence = this.calculateConfidence(input.fuzzyOutputs);

    return {
      crispValues,
      method: 'max-membership',
      confidence,
      explanation: this.generateExplanation(crispValues, confidence)
    };
  }

  /**
   * Max membership defuzzification method
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
    let strongMemberships = 0;
    let maxMembership = 0;

    for (const fuzzyOutput of Object.values(fuzzyOutputs)) {
      for (const membership of Object.values(fuzzyOutput)) {
        totalMembership += membership;
        maxMembership = Math.max(maxMembership, membership);
        if (membership > 0.7) {
          strongMemberships += membership;
        }
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
      outputRanges: {
        relevance: {
          low: { min: 0.0, max: 0.3, representativeValue: 0.2 },
          medium: { min: 0.3, max: 0.7, representativeValue: 0.5 },
          high: { min: 0.7, max: 0.9, representativeValue: 0.75 },
          very_high: { min: 0.9, max: 1.0, representativeValue: 0.85 }
        }
      }
    };

    return this.defuzzify(input);
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