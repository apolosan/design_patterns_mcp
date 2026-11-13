/**
 * Complete rule base with explicit evidence availability (fuzzy refactor).
 *
 * Root cause of the inert inference: seven of the eight old rules conjoined with
 * semanticSimilarity.high or .medium, which are zero whenever the semantic
 * channel is off. No choice of t-norm fixes that, because the defect is treating
 * "channel absent" as "degree zero". The literature is explicit: a rule base is
 * complete when at least one rule fires for every input, and an incomplete base
 * needs an explicitly declared default.
 *
 * The refactor: availability is a first-class part of the fuzzified result,
 * rules are factorised per dimension so completeness follows from each input
 * partition being total, conjunctions only range over available antecedents, and
 * the contextual dimension stopped depending on language tags (96% of the
 * catalog declares none) in favour of query term coverage, which is information
 * a BM25 score does not carry.
 */
import { describe, it, expect } from 'vitest';
import { PatternMembershipFunctions } from '../../src/services/fuzzy-membership.js';
import { FuzzyInferenceEngine } from '../../src/services/fuzzy-inference.js';
import {
  FuzzyDefuzzificationEngine,
  NEUTRAL_RELEVANCE,
} from '../../src/services/fuzzy-defuzzification.js';

const mf = new PatternMembershipFunctions();
const inference = new FuzzyInferenceEngine();
const defuzz = new FuzzyDefuzzificationEngine();

const relevanceOf = (input: Parameters<typeof inference.evaluatePattern>[0]) =>
  defuzz.defuzzifyPatternRelevanceAnchored(
    inference.evaluatePattern(input).fuzzyScore
  ).crispValues.relevance;

describe('evidence availability', () => {
  it('marks the semantic dimension unavailable when no similarity is supplied', () => {
    const result = mf.evaluate({
      keywordMatchStrength: 0.7,
      patternComplexity: 'Medium',
      contextualFit: 0.6,
    });
    expect(result.semanticAvailable).toBe(false);
    expect(result.semanticSimilarity).toEqual({ low: 0, medium: 0, high: 0 });
  });

  it('marks it available when a similarity is supplied', () => {
    const result = mf.evaluate({
      semanticSimilarity: 0.8,
      keywordMatchStrength: 0.7,
      patternComplexity: 'Medium',
      contextualFit: 0.6,
    });
    expect(result.semanticAvailable).toBe(true);
    expect(result.semanticSimilarity.high).toBeGreaterThan(0.5);
  });
});

describe('keyword-only inference is no longer inert', () => {
  it('fires keyword rules without any semantic evidence', () => {
    const strong = inference.evaluatePattern({
      keywordMatchStrength: 0.9,
      patternComplexity: 'Medium',
      contextualFit: 0.4,
      patternId: 'p-1',
      originalScore: 0.9,
    });
    const weak = inference.evaluatePattern({
      keywordMatchStrength: 0.05,
      patternComplexity: 'Medium',
      contextualFit: 0.4,
      patternId: 'p-2',
      originalScore: 0.1,
    });

    expect(strong.ruleFirings.length).toBeGreaterThan(0);
    expect(weak.ruleFirings.length).toBeGreaterThan(0);
    // Different evidence must produce different relevance: no longer constant.
    const strongRelevance = defuzz.defuzzifyPatternRelevanceAnchored(strong.fuzzyScore).crispValues.relevance;
    const weakRelevance = defuzz.defuzzifyPatternRelevanceAnchored(weak.fuzzyScore).crispValues.relevance;
    expect(strongRelevance).toBeGreaterThan(weakRelevance + 0.2);
  });

  it('never returns the neutral value when keyword evidence exists', () => {
    for (const keyword of [0.05, 0.2, 0.45, 0.7, 0.95]) {
      const relevance = relevanceOf({
        keywordMatchStrength: keyword,
        patternComplexity: 'Medium',
        contextualFit: 0.4,
        patternId: 'p',
        originalScore: keyword,
      });
      expect(Math.abs(relevance - NEUTRAL_RELEVANCE)).toBeGreaterThan(1e-6);
    }
  });
});

describe('semantic evidence strengthens but never vetoes', () => {
  it('reaches very high when high similarity agrees with a strong keyword hit', () => {
    const result = inference.evaluatePattern({
      semanticSimilarity: 0.9,
      keywordMatchStrength: 0.9,
      patternComplexity: 'Medium',
      contextualFit: 0.4,
      patternId: 'p-1',
      originalScore: 0.9,
    });
    expect(result.fuzzyScore.very_high).toBeGreaterThan(0.5);
    expect(
      defuzz.defuzzifyPatternRelevanceAnchored(result.fuzzyScore).crispValues.relevance
    ).toBeGreaterThan(0.9);
  });

  it('does not lower the relevance of the same keyword evidence', () => {
    const withoutSemantic = relevanceOf({
      keywordMatchStrength: 0.7,
      patternComplexity: 'Medium',
      contextualFit: 0.4,
      patternId: 'p',
      originalScore: 0.7,
    });
    const withSemantic = relevanceOf({
      semanticSimilarity: 0.9,
      keywordMatchStrength: 0.7,
      patternComplexity: 'Medium',
      contextualFit: 0.4,
      patternId: 'p',
      originalScore: 0.7,
    });
    expect(withSemantic).toBeGreaterThanOrEqual(withoutSemantic - 1e-9);
  });
});

describe('contextual dimension fires on its own', () => {
  it('raises and lowers relevance from fit alone', () => {
    const excellent = relevanceOf({
      keywordMatchStrength: 0.45,
      patternComplexity: 'Medium',
      contextualFit: 0.95,
      patternId: 'p',
      originalScore: 0.45,
    });
    const poor = relevanceOf({
      keywordMatchStrength: 0.45,
      patternComplexity: 'Medium',
      contextualFit: 0.0,
      patternId: 'p',
      originalScore: 0.45,
    });
    expect(excellent).toBeGreaterThan(poor + 0.2);
  });
});

describe('completeness by construction', () => {
  it('fires at least one rule for every point of the keyword domain', () => {
    const fired: number[] = [];
    for (let keyword = 0; keyword <= 1.0001; keyword += 0.05) {
      const result = inference.evaluatePattern({
        keywordMatchStrength: Math.min(keyword, 1),
        patternComplexity: 'Medium',
        contextualFit: 0.4,
        patternId: 'p',
        originalScore: keyword,
      });
      fired.push(result.ruleFirings.length);
    }
    expect(fired.every((count) => count > 0)).toBe(true);
  });

  it('is monotone in keyword evidence', () => {
    const sweep: number[] = [];
    for (let keyword = 0; keyword <= 1.0001; keyword += 0.02) {
      sweep.push(
        relevanceOf({
          keywordMatchStrength: Math.min(keyword, 1),
          patternComplexity: 'Medium',
          contextualFit: 0.4,
          patternId: 'p',
          originalScore: keyword,
        })
      );
    }
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i]).toBeGreaterThanOrEqual(sweep[i - 1] - 1e-9);
    }
  });
});
