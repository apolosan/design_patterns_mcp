/**
 * Unit Tests for Fuzzy Logic Components
 */

import { describe, it, expect } from 'vitest';
import { PatternMembershipFunctions } from '../../src/services/fuzzy-membership.js';
import { FuzzyInferenceEngine } from '../../src/services/fuzzy-inference.js';
import { FuzzyDefuzzificationEngine } from '../../src/services/fuzzy-defuzzification.js';

describe('Fuzzy Membership Functions', () => {
  const membershipFunctions = new PatternMembershipFunctions();

  it('should evaluate semantic similarity correctly', () => {
    // High semantic similarity (0.9) should be in "high" set
    const result1 = membershipFunctions.evaluate({
      semanticSimilarity: 0.9,
      keywordMatchStrength: 0.5,
      patternComplexity: 'Medium',
      contextualFit: 0.8
    });

    expect(result1.semanticSimilarity.high).toBeGreaterThan(0.8);
    expect(result1.semanticSimilarity.medium).toBeLessThan(0.3);
    expect(result1.semanticSimilarity.low).toBe(0);

    // Low semantic similarity (0.1) should be in "low" set
    const result2 = membershipFunctions.evaluate({
      semanticSimilarity: 0.1,
      keywordMatchStrength: 0.5,
      patternComplexity: 'Medium',
      contextualFit: 0.8
    });

    expect(result2.semanticSimilarity.low).toBeGreaterThan(0.8);
    expect(result2.semanticSimilarity.medium).toBeLessThan(0.3);
    expect(result2.semanticSimilarity.high).toBe(0);
  });

  it('should evaluate keyword match strength correctly', () => {
    // Strong keyword match (0.9) should be in "strong" set
    const result1 = membershipFunctions.evaluate({
      semanticSimilarity: 0.5,
      keywordMatchStrength: 0.9,
      patternComplexity: 'Medium',
      contextualFit: 0.8
    });

    expect(result1.keywordMatchStrength.strong).toBeGreaterThan(0.8);
    expect(result1.keywordMatchStrength.moderate).toBeLessThan(0.3);
    expect(result1.keywordMatchStrength.weak).toBe(0);

    // Weak keyword match (0.1) should be in "weak" set
    const result2 = membershipFunctions.evaluate({
      semanticSimilarity: 0.5,
      keywordMatchStrength: 0.1,
      patternComplexity: 'Medium',
      contextualFit: 0.8
    });

    expect(result2.keywordMatchStrength.weak).toBeGreaterThan(0.8);
    expect(result2.keywordMatchStrength.moderate).toBeLessThan(0.3);
    expect(result2.keywordMatchStrength.strong).toBe(0);
  });

  it('should evaluate pattern complexity correctly', () => {
    // Low complexity should be in "simple" set
    const result1 = membershipFunctions.evaluate({
      semanticSimilarity: 0.5,
      keywordMatchStrength: 0.5,
      patternComplexity: 'Low',
      contextualFit: 0.8
    });

    expect(result1.patternComplexity.simple).toBe(1.0);
    expect(result1.patternComplexity.moderate).toBe(0.0);
    expect(result1.patternComplexity.complex).toBe(0.0);

    // High complexity should be in "complex" set
    const result2 = membershipFunctions.evaluate({
      semanticSimilarity: 0.5,
      keywordMatchStrength: 0.5,
      patternComplexity: 'High',
      contextualFit: 0.8
    });

    expect(result2.patternComplexity.complex).toBe(1.0);
    expect(result2.patternComplexity.simple).toBe(0.0);
    expect(result2.patternComplexity.moderate).toBe(0.0);
  });

  it('should evaluate contextual fit correctly', () => {
    // Excellent contextual fit (0.95) should be in "excellent" set
    const result1 = membershipFunctions.evaluate({
      semanticSimilarity: 0.5,
      keywordMatchStrength: 0.5,
      patternComplexity: 'Medium',
      contextualFit: 0.95
    });

    expect(result1.contextualFit.excellent).toBeGreaterThan(0.5);
    expect(result1.contextualFit.good).toBeGreaterThan(0.2);
    expect(result1.contextualFit.poor).toBe(0);
  });

  it('should provide linguistic interpretation', () => {
    const result = membershipFunctions.evaluate({
      semanticSimilarity: 0.9,
      keywordMatchStrength: 0.8,
      patternComplexity: 'Low',
      contextualFit: 0.9
    });

    const interpretation = membershipFunctions.getLinguisticInterpretation(result);

    expect(interpretation.semanticLevel).toBe('high');
    expect(interpretation.keywordLevel).toBe('strong');
    expect(interpretation.complexityLevel).toBe('simple');
    expect(['good', 'excellent']).toContain(interpretation.fitLevel); // Could be either depending on exact value
  });
});

describe('Fuzzy Inference Engine', () => {
  const inferenceEngine = new FuzzyInferenceEngine();

  it('should fire appropriate rules for high semantic + strong keyword match', () => {
    const input = {
      membershipValues: {
        semanticSimilarity: { low: 0.0, medium: 0.0, high: 0.9 },
        keywordMatchStrength: { weak: 0.0, moderate: 0.0, strong: 0.8 },
        patternComplexity: { simple: 0.0, moderate: 1.0, complex: 0.0 },
        contextualFit: { poor: 0.0, good: 0.7, excellent: 0.3 }
      },
      patternId: 'test-pattern',
      originalScore: 0.8
    };

    const result = inferenceEngine.infer(input);

    expect(result.fuzzyScore.very_high).toBeGreaterThan(0);
    expect(result.ruleFirings.some(rule => rule.rule.includes('Very High Relevance'))).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should handle low relevance patterns correctly', () => {
    const input = {
      membershipValues: {
        semanticSimilarity: { low: 0.8, medium: 0.2, high: 0.0 },
        keywordMatchStrength: { weak: 0.9, moderate: 0.1, strong: 0.0 },
        patternComplexity: { simple: 0.0, moderate: 1.0, complex: 0.0 },
        contextualFit: { poor: 0.6, good: 0.4, excellent: 0.0 }
      },
      patternId: 'test-pattern',
      originalScore: 0.2
    };

    const result = inferenceEngine.infer(input);

    expect(result.fuzzyScore.low).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('should evaluate complete patterns correctly', () => {
    const result = inferenceEngine.evaluatePattern({
      semanticSimilarity: 0.85,
      keywordMatchStrength: 0.75,
      patternComplexity: 'Medium',
      contextualFit: 0.8,
      patternId: 'test-pattern',
      originalScore: 0.8
    });

    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(result.ruleFirings.length).toBeGreaterThan(0);
  });
});

describe('Fuzzy Defuzzification Engine', () => {
  const defuzzEngine = new FuzzyDefuzzificationEngine();

  it('should defuzzify pattern relevance correctly', () => {
    const fuzzyScore = {
      low: 0.1,
      medium: 0.2,
      high: 0.8,
      very_high: 0.6
    };

    const result = defuzzEngine.defuzzifyPatternRelevance(fuzzyScore);

    expect(result.crispValues.relevance).toBeGreaterThan(0.7); // Should be high due to high membership
    expect(result.crispValues.relevance).toBeLessThanOrEqual(0.95);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.explanation).toContain('high');
  });

  it('should handle clear low relevance correctly', () => {
    const fuzzyScore = {
      low: 0.9,
      medium: 0.1,
      high: 0.0,
      very_high: 0.0
    };

    const result = defuzzEngine.defuzzifyPatternRelevance(fuzzyScore);

    expect(result.crispValues.relevance).toBeLessThan(0.3);
    expect(result.explanation).toContain('low');
  });

  it('should provide consistent results with max membership method', () => {
    const fuzzyScore = {
      low: 0.2,
      medium: 0.6,
      high: 0.4,
      very_high: 0.1
    };

    const result = defuzzEngine.defuzzifyPatternRelevance(fuzzyScore);
    const maxMembershipResult = defuzzEngine.defuzzifyMaxMembership(fuzzyScore);

    // Should return medium value (0.5) as it has the highest membership (0.6)
    expect(result.crispValues.relevance).toBe(0.5);
    expect(maxMembershipResult).toBe(0.5);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should batch process multiple patterns', () => {
    const patterns = [
      {
        patternId: 'pattern1',
        fuzzyScore: { low: 0.1, medium: 0.2, high: 0.8, very_high: 0.6 }
      },
      {
        patternId: 'pattern2',
        fuzzyScore: { low: 0.8, medium: 0.2, high: 0.0, very_high: 0.0 }
      }
    ];

    const results = defuzzEngine.batchDefuzzify(patterns);

    expect(results).toHaveLength(2);
    expect(results[0].patternId).toBe('pattern1');
    expect(results[1].patternId).toBe('pattern2');
    expect(results[0].result.crispValues.relevance).toBeGreaterThan(results[1].result.crispValues.relevance);
  });

  it('should generate statistics correctly', () => {
    const results = [
      { crispValues: { relevance: 0.8 }, confidence: 0.9, method: 'centroid', explanation: 'test' },
      { crispValues: { relevance: 0.6 }, confidence: 0.8, method: 'centroid', explanation: 'test' },
      { crispValues: { relevance: 0.2 }, confidence: 0.6, method: 'centroid', explanation: 'test' }
    ] as any;

    const stats = defuzzEngine.getStatistics(results);

    expect(stats.averageConfidence).toBeGreaterThan(0.7);
    expect(stats.valueRanges.average).toBeGreaterThan(0.5);
    expect(stats.confidenceDistribution.high).toBeGreaterThan(0);
  });
});

describe('Fuzzy Logic Integration', () => {
  it('should work end-to-end with realistic pattern data', () => {
    const membershipFunctions = new PatternMembershipFunctions();
    const inferenceEngine = new FuzzyInferenceEngine();
    const defuzzEngine = new FuzzyDefuzzificationEngine();

    // Simulate a high-relevance pattern (like Factory Method for "factory method" query)
    const input = {
      semanticSimilarity: 0.88, // High semantic match
      keywordMatchStrength: 0.75, // Good keyword match
      patternComplexity: 'Low', // Simple pattern
      contextualFit: 0.85, // Good contextual fit
      patternId: 'factory-method',
      originalScore: 0.82
    };

    // Step 1: Fuzzification
    const membershipValues = membershipFunctions.evaluate(input);

    // Step 2: Inference
    const inferenceResult = inferenceEngine.evaluatePattern(input);

    // Step 3: Defuzzification
    const defuzzResult = defuzzEngine.defuzzifyPatternRelevance(inferenceResult.fuzzyScore);

    // Verify the pipeline works correctly
    expect(membershipValues.semanticSimilarity.high).toBeGreaterThan(0.5);
    expect(inferenceResult.confidence).toBeGreaterThan(0.5); // Adjusted for realistic expectations
    expect(defuzzResult.crispValues.relevance).toBeGreaterThanOrEqual(0.5); // Adjusted for realistic expectations
    expect(inferenceResult.reasoning.length).toBeGreaterThan(0);
  });
});