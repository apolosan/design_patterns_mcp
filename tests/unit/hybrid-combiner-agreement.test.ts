/**
 * Regression tests — hybrid fusion must reward agreement between signals (review F3).
 *
 * Requirement: in hybrid mode a pattern found by BOTH semantic and keyword
 * search is stronger evidence than one found by a single signal with the
 * same per-signal score. Before the fix, single-signal matches kept their
 * raw score while dual-signal matches were averaged down, so agreement was
 * penalized and keyword-only hits dominated hybrid rankings.
 */
import { describe, it, expect } from 'vitest';
import { HybridSearchCombiner } from '../../src/handlers/hybrid-search-combiner.js';
import type { MatchResult, DynamicAlphaResult } from '../../src/types/search-types.js';

const ALPHA_60_40: DynamicAlphaResult = {
  semanticAlpha: 0.6,
  keywordAlpha: 0.4,
  queryType: 'balanced',
  confidence: 0.5,
  analysis: {
    queryLength: 20,
    wordCount: 3,
    technicalTermCount: 0,
    exploratoryScore: 0,
    specificityScore: 0,
    hasCodeSnippet: false,
    entropy: 0.5,
  },
};

function semantic(id: string, score: number): MatchResult {
  return {
    pattern: { id, name: id, category: 'Test', description: 'd' },
    confidence: score,
    matchType: 'semantic',
    reasons: [],
    metadata: { semanticScore: score, finalScore: score },
  };
}

function keyword(id: string, score: number): MatchResult {
  return {
    pattern: { id, name: id, category: 'Test', description: 'd' },
    confidence: score,
    matchType: 'keyword',
    reasons: [],
    metadata: { keywordScore: score, finalScore: score },
  };
}

function scoreOf(results: MatchResult[], id: string): number {
  const found = results.find(r => r.pattern.id === id);
  if (!found) throw new Error(`pattern ${id} missing from combined results`);
  return found.confidence;
}

describe('HybridSearchCombiner fusion', () => {
  const combiner = new HybridSearchCombiner();

  it('ranks a pattern confirmed by both signals above one with the same semantic score alone', () => {
    const combined = combiner.combineMatches(
      [semantic('semantic-only', 0.8), semantic('both', 0.8), keyword('both', 0.5)],
      ALPHA_60_40
    );

    expect(scoreOf(combined, 'both')).toBeGreaterThan(scoreOf(combined, 'semantic-only'));
  });

  it('does not let a keyword-only hit outrank a pattern strongly matched by both signals', () => {
    const combined = combiner.combineMatches(
      [keyword('keyword-only', 0.99), semantic('both', 0.9), keyword('both', 0.9)],
      ALPHA_60_40
    );

    expect(scoreOf(combined, 'both')).toBeGreaterThan(scoreOf(combined, 'keyword-only'));
  });

  it('weights a missing signal as zero evidence (convex blend of both channels)', () => {
    const combined = combiner.combineMatches([semantic('s', 0.8), keyword('k', 0.5)], ALPHA_60_40);

    expect(scoreOf(combined, 's')).toBeCloseTo(0.6 * 0.8, 6);
    expect(scoreOf(combined, 'k')).toBeCloseTo(0.4 * 0.5, 6);
  });

  it('preserves the order of single-signal matches within the same channel', () => {
    const combined = combiner.combineMatches(
      [semantic('high', 0.9), semantic('mid', 0.6), semantic('low', 0.3)],
      ALPHA_60_40
    );

    expect(scoreOf(combined, 'high')).toBeGreaterThan(scoreOf(combined, 'mid'));
    expect(scoreOf(combined, 'mid')).toBeGreaterThan(scoreOf(combined, 'low'));
  });
});
