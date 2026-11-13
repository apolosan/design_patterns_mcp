/**
 * Published score truth — RED tests.
 *
 * Why this exists: the mediator orders results by the composite score (search
 * confidence blended with fuzzy relevance), but the MCP payload published
 * `confidence` under the field name `score`, and the textual formatter printed
 * "Confidence". A consumer therefore reads a list ordered by one number while
 * being shown another: with the fuzzy weight at 0.8 a pattern can lead the list
 * at 35% relevance above one at 95% confidence. The list looks broken, and the
 * ranking work is invisible.
 *
 * These tests pin the invariant that makes the payload self-consistent: the
 * published score is the number that ordered the list, so it never increases
 * down the page.
 */
import { describe, it, expect } from 'vitest';
import {
  formatFindPatternsResult,
  formatSearchResultsFromRecommendations,
} from '../../src/mcp/tool-formatters.js';
import type { PatternRecommendation } from '../../src/models/recommendation.js';

function recommendation(
  id: string,
  confidence: number,
  score: number | undefined
): PatternRecommendation {
  return {
    pattern: {
      id,
      name: 'Pattern ' + id,
      category: 'Behavioral',
      description: 'd',
      complexity: 'Medium',
      tags: [],
    } as unknown as PatternRecommendation['pattern'],
    rank: 1,
    confidence,
    score,
    justification: {
      primaryReason: 'reason',
      supportingReasons: [],
      problemFit: 'fit',
      benefits: [],
      drawbacks: [],
      fuzzyRelevance: 0.9,
    },
    // Only the fields the formatters read are populated; the rest of
    // PatternRecommendation is irrelevant to this contract.
  } as unknown as PatternRecommendation;
}

/** Every "Score: NN.N%" / "Confidence: NN.N%" number in presentation order. */
function publishedScores(text: string): number[] {
  return [...text.matchAll(/Score: ([\d.]+)%/g)].map((match) => Number(match[1]));
}

describe('published score tells the truth about the order', () => {
  // Ordered by the composite the mediator used, with the confidence ascending —
  // exactly the case where publishing confidence would contradict the order.
  const ordered = [
    recommendation('promoted', 0.35, 0.83),
    recommendation('lexical-favourite', 0.95, 0.24),
  ];

  it('publishes the composite as `score` instead of the pre-fuzzy confidence', () => {
    const text = formatSearchResultsFromRecommendations('q', 'keyword', false, ordered);
    expect(publishedScores(text)).toEqual([83, 24]);
  });

  it('keeps the confidence reachable beside the composite', () => {
    const text = formatSearchResultsFromRecommendations('q', 'keyword', false, ordered);
    // The pre-fuzzy signal must not be lost just because the score changed meaning.
    expect(text).toContain('35.0%');
    expect(text).toContain('95.0%');
  });

  it('never lets the published score grow down the list', () => {
    for (const text of [
      formatSearchResultsFromRecommendations('q', 'keyword', false, ordered),
      formatFindPatternsResult(ordered),
    ]) {
      const scores = publishedScores(text);
      expect(scores).toHaveLength(2);
      expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
    }
  });

  it('falls back to confidence when no composite was computed', () => {
    const plain = [recommendation('a', 0.7, undefined), recommendation('b', 0.4, undefined)];
    expect(publishedScores(formatSearchResultsFromRecommendations('q', 'keyword', false, plain))).toEqual([
      70, 40,
    ]);
  });
});
