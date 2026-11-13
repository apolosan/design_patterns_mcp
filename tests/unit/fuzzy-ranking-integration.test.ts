/**
 * Fuzzy ranking integration (audit items 3, 6, 8 and 10).
 *
 *  - item 6: the fuzzy relevance now participates in ranking through the
 *    composite score published on PatternRecommendation.score;
 *  - item 3: the search_patterns surface exposes that relevance;
 *  - item 10: language compatibility is an exact token test, so a pattern
 *    tagged "governance" is not treated as a Go implementation;
 *  - item 8: the keyword bands are calibrated to the real, max-normalised
 *    keyword confidence (top hit near 1.0, mid-ranked hits in 0.3-0.7).
 */
import { describe, it, expect, vi } from 'vitest';
import { SearchMediator, FUZZY_RANK_WEIGHT } from '../../src/handlers/search-mediator.js';
import { PatternMembershipFunctions } from '../../src/services/fuzzy-membership.js';
import { formatSearchResultsFromRecommendations } from '../../src/mcp/tool-formatters.js';

function rowFor(id: string, tags: string) {
  return {
    id,
    name: 'Pattern ' + id,
    category: 'Behavioral',
    description: 'd',
    when_to_use: '[]',
    benefits: '[]',
    drawbacks: '[]',
    use_cases: '[]',
    complexity: 'Medium',
    tags,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function stubMatch(id: string, confidence: number, tags: string[]) {
  return {
    pattern: {
      id,
      name: 'Pattern ' + id,
      category: 'Behavioral',
      description: 'd',
      complexity: 'Medium',
      tags,
    },
    confidence,
    matchType: 'keyword',
    reasons: ['kw'],
    metadata: { finalScore: confidence, semanticScore: 0.8, keywordScore: 0.3 },
  };
}

/**
 * Replace both fuzzy engines so the test controls the relevance a pattern gets.
 * The ordering pipeline is what is under test here, not the rule base (covered
 * by the inference/defuzzification suites).
 */
function stubFuzzyRelevance(
  mediator: SearchMediator,
  relevanceFor: (patternId: string) => number
): void {
  const internal = mediator as unknown as {
    fuzzyInferenceEngine: { evaluatePattern: (input: { patternId: string }) => unknown };
    fuzzyDefuzzificationEngine: {
      defuzzifyPatternRelevanceAnchored: (score: unknown) => unknown;
    };
  };
  internal.fuzzyInferenceEngine = {
    evaluatePattern: (input) => ({
      fuzzyScore: { relevance: relevanceFor(input.patternId) },
      reasoning: [],
      ruleFirings: [],
    }),
  };
  internal.fuzzyDefuzzificationEngine = {
    defuzzifyPatternRelevanceAnchored: (score) => ({
      crispValues: { relevance: (score as { relevance: number }).relevance },
      confidence: 1,
    }),
  };
}

function build(matches: ReturnType<typeof stubMatch>[], language?: string) {
  const db = {
    query: vi.fn().mockReturnValue([]),
    queryOne: vi.fn((_sql: string, params: readonly string[] = []) => {
      const hit = matches.find((m) => m.pattern.id === String(params[0]));
      return rowFor(hit?.pattern.id ?? 'x', JSON.stringify(hit?.pattern.tags ?? []));
    }),
  };
  const mediator = new SearchMediator(
    db as never,
    { searchSimilar: vi.fn().mockReturnValue([]) } as never,
    undefined,
    {
      useFuzzyRefinement: true,
      useSemanticSearch: false,
      useKeywordSearch: false,
      useHybridSearch: false,
      maxResults: 5,
      minConfidence: 0,
    }
  );
  const internal = mediator as unknown as {
    semanticHandler: { search: () => Promise<unknown[]> };
    keywordHandler: { search: () => Promise<unknown[]>; broadSearch: () => Promise<unknown[]> };
  };
  internal.semanticHandler = { search: () => Promise.resolve([]) };
  internal.keywordHandler = {
    search: () => Promise.resolve([]),
    broadSearch: () => Promise.resolve(matches),
  };
  return { mediator, language };
}

describe('composite ranking score', () => {
  it('publishes score as the documented blend of confidence and fuzzy relevance', async () => {
    const { mediator } = build([stubMatch('p-1', 0.9, ['go']), stubMatch('p-2', 0.6, ['runtime'])]);
    const result = await mediator.search({ id: 'r1', query: 'concurrency', maxResults: 5 });

    expect(result.length).toBe(2);
    for (const rec of result) {
      const fuzzy = rec.justification.fuzzyRelevance;
      expect(typeof fuzzy).toBe('number');
      expect(typeof rec.score).toBe('number');
      // Documented blend: (1 - w) * search confidence + w * fuzzy relevance,
      // with w settled by `bun run calibrate-search`.
      expect(rec.score as number).toBeCloseTo(
        (1 - FUZZY_RANK_WEIGHT) * rec.confidence + FUZZY_RANK_WEIGHT * (fuzzy as number),
        6
      );
    }
  });

  it('promotes a pattern the confidence cut would have dropped', async () => {
    // Production used to cut to maxResults by confidence and only then score,
    // so the fuzzy evidence could permute the returned window but never
    // replace it: measured MRR@5 fell from 0.838 (score then cut) to 0.825
    // (cut then score), below the 0.827 baseline of having no fuzzy pass.
    const matches = [
      stubMatch('lexical-1', 0.95, ['governance']),
      stubMatch('lexical-2', 0.9, ['governance']),
      stubMatch('lexical-3', 0.85, ['governance']),
      stubMatch('lexical-4', 0.8, ['governance']),
      stubMatch('lexical-5', 0.75, ['governance']),
      stubMatch('fitting-6', 0.35, ['governance']),
    ];
    const { mediator } = build(matches);
    stubFuzzyRelevance(mediator, (patternId) =>
      patternId === 'fitting-6' ? 0.95 : 0.05
    );

    const result = await mediator.search({ id: 'r-cut', query: 'q', maxResults: 1 });

    expect(result.map((rec) => rec.pattern.id)).toEqual(['fitting-6']);
  });

  it('publishes numbers that follow the order it publishes', async () => {
    // The whole chain: mediator orders by the composite, the formatter prints
    // it. If the payload showed confidence, the list would read 35% above 95%.
    const matches = [
      stubMatch('lexical-1', 0.95, ['governance']),
      stubMatch('lexical-2', 0.9, ['governance']),
      stubMatch('lexical-3', 0.85, ['governance']),
      stubMatch('fitting-4', 0.35, ['governance']),
    ];
    const { mediator } = build(matches);
    stubFuzzyRelevance(mediator, (patternId) => (patternId === 'fitting-4' ? 0.95 : 0.05));

    const result = await mediator.search({ id: 'r-truth', query: 'q', maxResults: 4 });
    const text = formatSearchResultsFromRecommendations('q', 'keyword', false, result);
    const scores = [...text.matchAll(/Score: ([\d.]+)%/g)].map((match) => Number(match[1]));

    expect(result[0].pattern.id).toBe('fitting-4');
    expect(scores).toHaveLength(4);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(scores[0]).toBeCloseTo((result[0].score as number) * 100, 1);
  });

  it('orders results by the composite score', async () => {
    const { mediator } = build([stubMatch('p-1', 0.9, ['go']), stubMatch('p-2', 0.6, ['runtime'])]);
    const result = await mediator.search({ id: 'r2', query: 'concurrency', maxResults: 5 });

    const scores = result.map((r) => r.score as number);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe('search_patterns surface exposes the fuzzy relevance', () => {
  it('renders the fuzzy relevance line for recommendations that carry it', async () => {
    const { mediator } = build([stubMatch('p-1', 0.9, ['go'])]);
    const result = await mediator.search({ id: 'r3', query: 'concurrency', maxResults: 1 });

    const text = formatSearchResultsFromRecommendations('concurrency', 'keyword', false, result);
    expect(text).toMatch(/fuzzy relevance/i);
  });
});

describe('contextual fit — exact language tokens', () => {
  it('prefers a real Go tag over a tag that merely starts with "go"', async () => {
    const { mediator } = build(
      [stubMatch('p-go', 0.8, ['go']), stubMatch('p-gov', 0.8, ['governance'])]
    );
    const result = await mediator.search({
      id: 'r4',
      query: 'lightweight concurrency',
      maxResults: 5,
      programmingLanguage: 'Go',
    });

    const byId = new Map(result.map((r) => [r.pattern.id, r.justification.fuzzyRelevance as number]));
    expect(byId.get('p-go')).toBeGreaterThan(byId.get('p-gov') as number);
  });
});

describe('keyword membership bands follow the real keyword scale', () => {
  const mf = new PatternMembershipFunctions();
  const kw = (strength: number) =>
    mf.evaluate({
      semanticSimilarity: 0.5,
      keywordMatchStrength: strength,
      patternComplexity: 'Medium',
      contextualFit: 0.5,
    }).keywordMatchStrength;

  it('treats a mid-ranked hit (0.5) as moderate, not as a strong hit', () => {
    expect(kw(0.5).moderate).toBeCloseTo(1, 5);
    expect(kw(0.5).strong).toBe(0);
  });

  it('saturates strong only at the top of the normalised range', () => {
    expect(kw(0.85).strong).toBeCloseTo(1, 5);
    expect(kw(0.7).strong).toBeLessThan(0.75);
  });
});
