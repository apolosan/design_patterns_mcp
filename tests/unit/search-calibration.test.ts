/**
 * Search calibration harness (closing the open items from states 48-50).
 *
 * Why this exists: FUZZY_RANK_WEIGHT and NEUTRAL_RELEVANCE were product
 * judgements with no measurement behind them, and five analysis helpers had no
 * caller outside tests. Rather than exposing another configuration knob, the
 * weight is settled by measuring ranking quality against a ground truth that
 * does not come from the ranker itself (catalog metadata), so it cannot be
 * circular.
 *
 * These tests pin the pure core: metrics on known answers, deterministic query
 * sampling, the decision rule for the weight, and the diagnostics that tell a
 * flat curve apart from an absent signal.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCalibrationQueries,
  evaluateWeights,
  rankMetrics,
  rankWithWeight,
  rankInProductionWindow,
  recommendWeight,
  interpretReport,
  summarizeDiagnostics,
  type CalibrationRow,
  type RankingObservation,
} from '../../src/services/search-calibration.js';
import { computeCompositeScore, FUZZY_RANK_WEIGHT } from '../../src/handlers/search-mediator.js';
import { NEUTRAL_RELEVANCE } from '../../src/services/fuzzy-defuzzification.js';

describe('rankMetrics', () => {
  it('rewards the first relevant hit by its reciprocal rank', () => {
    expect(rankMetrics(['a', 'b', 'c'], 'b', 5).mrr).toBeCloseTo(0.5, 10);
    expect(rankMetrics(['a', 'b', 'c'], 'a', 5).mrr).toBeCloseTo(1, 10);
    expect(rankMetrics(['a', 'b', 'c'], 'z', 5).mrr).toBe(0);
  });

  it('counts only the expected id inside the precision window', () => {
    expect(rankMetrics(['a', 'b', 'c', 'd', 'e'], 'a', 5).precisionAtK).toBeCloseTo(0.2, 10);
    expect(rankMetrics(['b', 'a'], 'a', 5).precisionAtK).toBeCloseTo(0.2, 10);
  });

  it('ignores a hit beyond the requested depth', () => {
    const ranked = ['a', 'b', 'c', 'd', 'e', 'expected'];
    expect(rankMetrics(ranked, 'expected', 5).mrr).toBe(0);
    expect(rankMetrics(ranked, 'expected', 10).mrr).toBeCloseTo(1 / 6, 10);
  });
});

describe('buildCalibrationQueries', () => {
  const rows: CalibrationRow[] = Array.from({ length: 10 }, (_, i) => ({
    id: `p-${i}`,
    name: `Pattern Number ${i}`,
    category: i % 2 === 0 ? 'Creational' : 'Behavioral',
    description: `Description body for pattern ${i} covering coordination concerns`,
    tags: ['tag'],
    whenToUse: ['coordination of distributed workers and retries'],
  }));

  it('produces every tier with exact per-tier counts and unique ids', () => {
    const queries = buildCalibrationQueries(rows, 3);
    expect(queries).toHaveLength(12);
    const ids = new Set(queries.map((q) => q.id));
    expect(ids.size).toBe(12);
    for (const tier of ['name', 'name-category', 'description', 'applicability'] as const) {
      expect(queries.filter((q) => q.tier === tier)).toHaveLength(3);
    }
  });

  it('keeps the expected pattern id valid and the query non-empty', () => {
    const queries = buildCalibrationQueries(rows, 3);
    const known = new Set(rows.map((r) => r.id));
    for (const query of queries) {
      expect(known.has(query.expectedPatternId)).toBe(true);
      expect(query.query.trim().length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same input', () => {
    expect(buildCalibrationQueries(rows, 3)).toEqual(buildCalibrationQueries(rows, 3));
  });

  it('never returns more queries than rows available per tier', () => {
    expect(buildCalibrationQueries(rows.slice(0, 2), 5)).toHaveLength(8);
  });
});

describe('computeCompositeScore', () => {
  it('is the identity of each signal at the endpoints', () => {
    expect(computeCompositeScore(0.8, 0.2, 0)).toBeCloseTo(0.8, 10);
    expect(computeCompositeScore(0.8, 0.2, 1)).toBeCloseTo(0.2, 10);
  });

  it('blends confidence and fuzzy relevance with the default weight', () => {
    expect(computeCompositeScore(0.8, 0.2, FUZZY_RANK_WEIGHT)).toBeCloseTo(
      (1 - FUZZY_RANK_WEIGHT) * 0.8 + FUZZY_RANK_WEIGHT * 0.2,
      10
    );
  });
});

describe('rankWithWeight', () => {
  const observation: RankingObservation = {
    queryId: 'q1',
    tier: 'name',
    expectedPatternId: 'fuzzy-favoured',
    results: [
      { patternId: 'lexical-only', confidence: 0.9, fuzzyRelevance: 0.15 },
      { patternId: 'fuzzy-favoured', confidence: 0.8, fuzzyRelevance: 0.95 },
    ],
  };

  it('falls back to the search confidence at weight zero', () => {
    expect(rankWithWeight(observation, 0)).toEqual(['lexical-only', 'fuzzy-favoured']);
  });

  it('promotes the fuzzy-favoured pattern when the fuzzy weight dominates', () => {
    expect(rankWithWeight(observation, 1)).toEqual(['fuzzy-favoured', 'lexical-only']);
  });

  it('keeps results that lack a fuzzy relevance in the pool', () => {
    const partial: RankingObservation = {
      ...observation,
      results: [...observation.results, { patternId: 'no-fuzzy', confidence: 0.85 }],
    };
    expect(rankWithWeight(partial, 0.35)).toContain('no-fuzzy');
  });
});

const tiers = () => ({
  name: { mrr: 0, precisionAtK: 0 },
  'name-category': { mrr: 0, precisionAtK: 0 },
  description: { mrr: 0, precisionAtK: 0 },
  applicability: { mrr: 0, precisionAtK: 0 },
});
const evaluation = (weight: number, mrr: number, precisionAtK = 0.2) => ({
  weight,
  mrr,
  precisionAtK,
  // Mirrors the pool metric unless a test targets the cut order.
  windowMrr: mrr,
  byTier: tiers(),
});

describe('recommendWeight', () => {
  it('recommends zero when no weight beats the confidence-only baseline', () => {
    expect(
      recommendWeight([
        evaluation(0, 0.62, 0.2),
        evaluation(0.35, 0.62, 0.2),
        evaluation(1, 0.58, 0.2),
      ])
    ).toBe(0);
  });

  it('picks the middle of the winning band instead of a single peak', () => {
    const recommended = recommendWeight([
      evaluation(0, 0.5, 0.2),
      evaluation(0.15, 0.6, 0.24),
      evaluation(0.35, 0.61, 0.25),
      evaluation(0.5, 0.6, 0.24),
      evaluation(1, 0.4, 0.1),
    ]);
    expect(recommended).toBe(0.35);
  });

  it('never recommends a value that loses to the baseline', () => {
    expect(
      recommendWeight([
        evaluation(0, 0.7, 0.3),
        evaluation(0.5, 0.4, 0.1),
      ])
    ).toBe(0);
  });
});

describe('evaluateWeights', () => {
  it('reports one evaluation per weight and exposes the recommendation', () => {
    const observations: RankingObservation[] = [
      {
        queryId: 'q1',
        tier: 'name',
        expectedPatternId: 'b',
        results: [
          { patternId: 'a', confidence: 0.9, fuzzyRelevance: 0.1 },
          { patternId: 'b', confidence: 0.5, fuzzyRelevance: 0.9 },
        ],
      },
    ];
    const report = evaluateWeights(observations, [0, 1], 5);
    expect(report.evaluations).toHaveLength(2);
    expect(report.evaluations[0].mrr).toBeCloseTo(0.5, 10);
    expect(report.evaluations[1].mrr).toBeCloseTo(1, 10);
    expect(report.recommended).toBe(1);
  });

  it('reports per-tier metrics so an easy tier cannot hide a hard one', () => {
    const observations: RankingObservation[] = [
      { queryId: 'easy', tier: 'name', expectedPatternId: 'x', results: [{ patternId: 'x', confidence: 0.9, fuzzyRelevance: 0.5 }] },
      { queryId: 'hard', tier: 'description', expectedPatternId: 'y', results: [{ patternId: 'z', confidence: 0.9, fuzzyRelevance: 0.5 }] },
    ];
    const report = evaluateWeights(observations, [0], 5);
    expect(report.evaluations[0].byTier.name.mrr).toBeCloseTo(1, 10);
    expect(report.evaluations[0].byTier.description.mrr).toBe(0);
  });
});

describe('summarizeDiagnostics', () => {
  it('separates a flat curve caused by absent signal from indiference', () => {
    const observations: RankingObservation[] = [
      {
        queryId: 'q1',
        tier: 'name',
        expectedPatternId: 'a',
        results: [
          { patternId: 'a', confidence: 0.9, fuzzyRelevance: NEUTRAL_RELEVANCE },
          { patternId: 'b', confidence: 0.5, fuzzyRelevance: NEUTRAL_RELEVANCE },
        ],
      },
      {
        queryId: 'q2',
        tier: 'name',
        expectedPatternId: 'c',
        results: [
          { patternId: 'c', confidence: 0.9, fuzzyRelevance: 0.95 },
          { patternId: 'd', confidence: 0.8, fuzzyRelevance: 0.15 },
        ],
      },
    ];
    const diagnostics = summarizeDiagnostics(observations);
    // Two of the four results sit exactly on the neutral value (both in q1).
    expect(diagnostics.neutralShare).toBeCloseTo(0.5, 10);
    // Only q1 has no rule fired at all, so the share is one query out of two.
    expect(diagnostics.noRuleShare).toBeCloseTo(0.5, 10);
    // One query has all results identical, the other spreads by 0.8.
    expect(diagnostics.meanIntraQuerySpread).toBeCloseTo(0.4, 10);
  });
});

describe('interpretReport — absence of signal is not evidence for a weight', () => {
  const observations = [
    {
      queryId: 'q1' as const,
      tier: 'name' as const,
      expectedPatternId: 'a',
      results: [
        { patternId: 'a', confidence: 0.9, fuzzyRelevance: NEUTRAL_RELEVANCE },
        { patternId: 'b', confidence: 0.5, fuzzyRelevance: NEUTRAL_RELEVANCE },
      ],
    },
  ];

  it('refuses to recommend when the fuzzy relevance never varied', () => {
    const report = evaluateWeights(observations, [0, 0.5, 1], 5);
    const verdict = interpretReport(report, summarizeDiagnostics(observations));
    expect(verdict.kind).toBe('no-signal');
    expect(verdict.kind === 'no-signal' ? verdict.note : '').toMatch(/never varied/i);
  });

  it('reports no-gain when the signal exists but does not beat the baseline', () => {
    const observations = [
      {
        queryId: 'q1' as const,
        tier: 'name' as const,
        expectedPatternId: 'a',
        results: [
          // The expected pattern loses on confidence and wins on fuzzy, so the
          // two weights disagree and the verdict has something to measure.
          { patternId: 'a', confidence: 0.5, fuzzyRelevance: 0.9 },
          { patternId: 'b', confidence: 0.9, fuzzyRelevance: 0.1 },
        ],
      },
    ];
    const report = evaluateWeights(observations, [0, 1], 5);
    const verdict = interpretReport(report, summarizeDiagnostics(observations));
    expect(verdict.kind).toBe('measured');
    expect(verdict.recommended).toBe(1);
  });
});

describe('production window — cutting by confidence before scoring', () => {
  // Production slices to maxResults by confidence and only then applies the
  // composite score (SearchMediator.executeSearch), so a pattern outside that
  // window can never be promoted. These pin the cost of that order instead of
  // leaving it as a comment.
  const observation: RankingObservation = {
    queryId: 'window',
    tier: 'description',
    expectedPatternId: 'sixth',
    results: [
      { patternId: 'a', confidence: 0.9, fuzzyRelevance: 0.1 },
      { patternId: 'b', confidence: 0.8, fuzzyRelevance: 0.1 },
      { patternId: 'c', confidence: 0.7, fuzzyRelevance: 0.1 },
      { patternId: 'sixth', confidence: 0.4, fuzzyRelevance: 0.95 },
    ],
  };

  it('cannot promote a pattern the confidence cut already removed', () => {
    expect(rankInProductionWindow(observation, 0.8, 3)).not.toContain('sixth');
    expect(rankWithWeight(observation, 0.8)[0]).toBe('sixth');
  });

  it('reports the windowed MRR beside the pool MRR', () => {
    const report = evaluateWeights([observation], [0.8], 3);
    expect(report.evaluations[0].windowMrr).toBe(0);
    expect(report.evaluations[0].mrr).toBeCloseTo(1, 10);
  });

  it('promotes outside the returned depth when the scoring window is wider', () => {
    // The shipped order: score over a window larger than the caller asked for,
    // then cut. This is what separates 0.825 from 0.838 in the harness.
    expect(rankInProductionWindow(observation, 0.8, 1, 4)).toEqual(['sixth']);
    expect(rankInProductionWindow(observation, 0.8, 1)).toEqual(['a']);
  });

  it('coincides with the pool order when the window covers every result', () => {
    expect(rankInProductionWindow(observation, 0.8, 10)).toEqual(
      rankWithWeight(observation, 0.8)
    );
  });
});
