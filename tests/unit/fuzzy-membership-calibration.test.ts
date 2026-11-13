/**
 * Fuzzy membership calibration — RED tests.
 *
 * Contract under test (audit items 7 and 9):
 *  - keyword strength must be a trapezoidal partition: it cannot dip when the
 *    input grows (the previous breakpoints produced a 1.0 -> 0.05 cliff at
 *    0.45/0.46, so a 0.50 hit scored "weaker" than a 0.40 hit);
 *  - every complexity label present in the catalog ("Very High", "Low to
 *    Medium") must land on the right linguistic set, and any unknown label
 *    must still yield a valid partition instead of the 1.2-sum triple.
 */
import { describe, it, expect } from 'vitest';
import { PatternMembershipFunctions } from '../../src/services/fuzzy-membership.js';

const mf = new PatternMembershipFunctions();

function keyword(strength: number) {
  return mf.evaluate({
    semanticSimilarity: 0.5,
    keywordMatchStrength: strength,
    patternComplexity: 'Medium',
    contextualFit: 0.5,
  }).keywordMatchStrength;
}

function complexity(label: string) {
  return mf.evaluate({
    semanticSimilarity: 0.5,
    keywordMatchStrength: 0.5,
    patternComplexity: label,
    contextualFit: 0.5,
  }).patternComplexity;
}

describe('keyword match strength calibration', () => {
  it('holds the moderate plateau instead of collapsing to zero mid-band', () => {
    // 0.35 sits between the moderate peak (0.25) and the strong ramp (0.45).
    expect(keyword(0.35).moderate).toBeCloseTo(1, 5);
    expect(keyword(0.35).strong).toBe(0);
  });

  it('keeps "strong" at zero below the strong ramp start', () => {
    expect(keyword(0.3).strong).toBe(0);
    expect(keyword(0.44).strong).toBeLessThan(0.1);
  });

  it('is monotone non-decreasing in the input above the ramp start', () => {
    const samples = [0.3, 0.4, 0.44, 0.46, 0.5, 0.6, 0.7];
    const strongs = samples.map((s) => keyword(s).strong);
    for (let i = 1; i < strongs.length; i++) {
      expect(strongs[i]).toBeGreaterThanOrEqual(strongs[i - 1]);
    }
    // The strong set saturates at the top of the normalised keyword range:
    // BM25 is max-normalised per query and capped at 0.99 (audit item 8).
    expect(keyword(0.85).strong).toBeCloseTo(1, 5);
    expect(keyword(0.7).strong).toBeGreaterThan(keyword(0.44).strong);
  });
});

describe('pattern complexity labels', () => {
  it('maps the catalog label "Very High" to the complex set', () => {
    const c = complexity('Very High');
    expect(c.complex).toBe(1);
    expect(c.simple).toBe(0);
  });

  it('maps the catalog label "Low to Medium" to the moderate set', () => {
    const c = complexity('Low to Medium');
    expect(c.moderate).toBe(1);
  });

  it('returns a normalised partition for unknown labels', () => {
    const c = complexity('Unknown');
    expect(c.simple + c.moderate + c.complex).toBeCloseTo(1, 5);
    expect(c.moderate).toBe(1);
  });
});
