/**
 * Single aggregation mechanism (audit item 12, closing correction).
 *
 * The inference engine carried two compensatory constructions that existed only
 * because there was no formal account of uncertainty:
 *   - per-rule binary thresholds ("lowered: allow dispatch for good matches");
 *   - a "smart default" that fabricated membership mass in high/medium/low
 *     whenever the strongest rule stayed under 0.5.
 * With the certainty-anchored defuzzifier the residual mass measures exactly
 * the remaining uncertainty, so both constructions now double count and, worse,
 * the fabricated mass shrinks the residual that the anchor relies on.
 *
 * These tests pin the properties that must hold once they are gone:
 *   1. no fabricated output mass — the output sets only carry what fired;
 *   2. monotone response — more evidence never lowers the relevance;
 *   3. no evidence means the neutral value, with a finite confidence.
 */
import { describe, it, expect } from 'vitest';
import { FuzzyInferenceEngine } from '../../src/services/fuzzy-inference.js';
import {
  FuzzyDefuzzificationEngine,
  NEUTRAL_RELEVANCE,
} from '../../src/services/fuzzy-defuzzification.js';

const inference = new FuzzyInferenceEngine();
const defuzz = new FuzzyDefuzzificationEngine();

function evaluate(overrides: {
  semanticSimilarity?: number;
  keywordMatchStrength?: number;
  contextualFit?: number;
  patternComplexity?: string;
}) {
  return inference.evaluatePattern({
    semanticSimilarity: 0.8,
    keywordMatchStrength: 0.3,
    patternComplexity: 'Medium',
    contextualFit: 0.5,
    patternId: 'p-1',
    originalScore: 0.5,
    ...overrides,
  });
}

function relevance(overrides: Parameters<typeof evaluate>[0]): number {
  return defuzz.defuzzifyPatternRelevanceAnchored(evaluate(overrides).fuzzyScore)
    .crispValues.relevance;
}

describe('no fabricated output mass', () => {
  it('never adds output mass that no rule produced', () => {
    const result = evaluate({});
    const total =
      result.fuzzyScore.low +
      result.fuzzyScore.medium +
      result.fuzzyScore.high +
      result.fuzzyScore.very_high;
    const strongestFiring = Math.max(0, ...result.ruleFirings.map((firing) => firing.strength));
    // Each output set holds at most the strength of the rule that fed it, so no
    // mass appears that no rule asked for.
    expect(total).toBeLessThanOrEqual(strongestFiring * 4 + 1e-9);
    if (total > 0) {
      expect(result.ruleFirings.length).toBeGreaterThan(0);
    }
  });

  it('reports moderate evidence as a middle-band result, not as confidence', () => {
    // Keyword 0.3 is a moderate hit: above ignorance and clearly below a
    // confident conclusion. The old assertion pinned the inert behaviour.
    const value = relevance({});
    expect(value).toBeLessThan(0.6);
    expect(value).toBeGreaterThan(NEUTRAL_RELEVANCE);
  });
});

describe('monotone response', () => {
  it('never lowers the relevance when the keyword evidence grows', () => {
    const sweep: number[] = [];
    for (let keyword = 0.5; keyword <= 0.85001; keyword += 0.01) {
      sweep.push(relevance({ semanticSimilarity: 0.95, keywordMatchStrength: keyword, contextualFit: 0.4 }));
    }
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i]).toBeGreaterThanOrEqual(sweep[i - 1] - 1e-9);
    }
  });

  it('never lowers the relevance when the contextual fit grows', () => {
    const sweep: number[] = [];
    for (let fit = 0.15; fit <= 0.95001; fit += 0.01) {
      sweep.push(relevance({ semanticSimilarity: 0.7, keywordMatchStrength: 0.6, contextualFit: fit }));
    }
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i]).toBeGreaterThanOrEqual(sweep[i - 1] - 1e-9);
    }
  });
});

describe('keyword-only composition', () => {
  it('fires keyword rules when the semantic membership is zero', () => {
    // The rule base is factorised so completeness does not depend on one channel.
    // This test used to assert the opposite, which is what made the inference
    // constant: seven of eight rules conjoined a semantic degree that is zero
    // whenever the semantic channel is off.
    const result = inference.infer({
      membershipValues: {
        semanticAvailable: false,
        semanticSimilarity: { low: 1, medium: 0, high: 0 },
        keywordMatchStrength: { weak: 0, moderate: 1, strong: 0 },
        patternComplexity: { simple: 0, moderate: 1, complex: 0 },
        contextualFit: { poor: 0, good: 1, excellent: 0 },
      },
      patternId: 'p-1',
      originalScore: 0.5,
    });

    expect(result.ruleFirings.length).toBeGreaterThan(0);
    expect(result.fuzzyScore.medium).toBeGreaterThan(0);
    expect(
      defuzz.defuzzifyPatternRelevanceAnchored(result.fuzzyScore).crispValues.relevance
    ).toBeGreaterThan(NEUTRAL_RELEVANCE);
  });
});

describe('absence of evidence', () => {
  it('returns exactly the neutral relevance with a finite confidence', () => {
    const result = inference.infer({
      membershipValues: {
        semanticSimilarity: { low: 0, medium: 0, high: 0 },
        keywordMatchStrength: { weak: 0, moderate: 0, strong: 0 },
        patternComplexity: { simple: 0, moderate: 0, complex: 0 },
        contextualFit: { poor: 0, good: 0, excellent: 0 },
      },
      patternId: 'p-1',
      originalScore: 0,
    });

    const crisp = defuzz.defuzzifyPatternRelevanceAnchored(result.fuzzyScore).crispValues.relevance;
    expect(crisp).toBeCloseTo(NEUTRAL_RELEVANCE, 6);
    expect(Number.isFinite(result.confidence)).toBe(true);
  });
});
