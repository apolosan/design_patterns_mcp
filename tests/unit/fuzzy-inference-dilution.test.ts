/**
 * Fuzzy inference: no dilution from the complexity rules (audit item 11).
 *
 * A perfect semantic + keyword match must score the same regardless of the
 * pattern's complexity. Previously rule 7 (complex -> high) and rule 8
 * (simple -> medium) fired *in addition to* the very_high rules and, because
 * defuzzification is a weighted average, dragged the score down: the same
 * perfect match scored 0.95 for Medium complexity but 0.70 for Low and 0.875
 * for High. Evidence in favour must never lower the score.
 */
import { describe, it, expect } from 'vitest';
import { FuzzyInferenceEngine } from '../../src/services/fuzzy-inference.js';
import { FuzzyDefuzzificationEngine } from '../../src/services/fuzzy-defuzzification.js';

const inference = new FuzzyInferenceEngine();
const defuzz = new FuzzyDefuzzificationEngine();

function relevance(complexity: string): number {
  const result = inference.evaluatePattern({
    semanticSimilarity: 0.95,
    keywordMatchStrength: 0.9,
    patternComplexity: complexity,
    contextualFit: 0.9,
    patternId: 'p-1',
    originalScore: 0.9,
  });
  return defuzz.defuzzifyPatternRelevance(result.fuzzyScore).crispValues.relevance;
}

describe('complexity rules do not dilute a very-high match', () => {
  it('scores a perfect match independently of the complexity label', () => {
    const medium = relevance('Medium');
    for (const label of ['Low', 'High', 'Very High', 'Low to Medium']) {
      expect(Math.abs(relevance(label) - medium)).toBeLessThan(0.05);
    }
  });

  it('keeps the perfect match near the very-high representative value', () => {
    expect(relevance('Low')).toBeGreaterThan(0.9);
  });
});
