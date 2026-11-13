/**
 * Certainty-anchored defuzzification (audit item 12).
 *
 * With plain centre-of-sets the firing strength cancels out for a single
 * active output term: very_high fired at 0.2 and at 1.0 both return 0.95,
 * because Σμv/Σμ = v when only one term has mass. Clipping a symmetric
 * triangle does not help either — the clipped shape stays symmetric around the
 * apex, so its centroid is still the apex. The anchor adds the completeness
 * rule "IF nothing fires THEN relevance IS neutral" with the residual mass
 * (1 - max μ), so weak evidence is pulled towards neutral instead of being
 * reported as certain.
 */
import { describe, it, expect } from 'vitest';
import { FuzzyDefuzzificationEngine } from '../../src/services/fuzzy-defuzzification.js';

const engine = new FuzzyDefuzzificationEngine();
const relevance = (scores: { low?: number; medium?: number; high?: number; very_high?: number }) =>
  engine.defuzzifyPatternRelevanceAnchored({
    low: 0,
    medium: 0,
    high: 0,
    very_high: 0,
    ...scores,
  }).crispValues.relevance;

describe('certainty-anchored defuzzification', () => {
  it('lets the firing strength change the score of a single active term', () => {
    const weak = relevance({ very_high: 0.2 });
    const strong = relevance({ very_high: 1 });
    expect(strong).toBeCloseTo(0.95, 2);
    expect(weak).toBeLessThan(strong - 0.2);
    expect(weak).toBeGreaterThan(0.4);
  });

  it('is monotone non-decreasing in the firing strength', () => {
    const sweep = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 1];
    const values = sweep.map((m) => relevance({ very_high: m }));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it('agrees with plain centre-of-sets when a term saturates', () => {
    const saturated = { low: 0, medium: 0, high: 0, very_high: 1 };
    expect(engine.defuzzifyPatternRelevanceAnchored(saturated).crispValues.relevance).toBeCloseTo(
      engine.defuzzifyPatternRelevance(saturated).crispValues.relevance,
      6
    );
  });

  it('keeps the result inside the declared output span', () => {
    const inflated = relevance({ low: 3, medium: 3, high: 3, very_high: 3 });
    expect(inflated).toBeGreaterThanOrEqual(0);
    expect(inflated).toBeLessThanOrEqual(1);
  });
});
