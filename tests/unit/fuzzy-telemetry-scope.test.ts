/**
 * Fuzzy telemetry scope — RED tests.
 *
 * Contract under test (audit items 1, 2 and 4, revised by measurement): the
 * fuzzy pass must (a) not re-query the catalog for every candidate — the
 * recommendation already carries complexity/tags/category, (b) score the whole
 * candidate pool and be cut afterwards, and (c) publish its score on its own
 * field instead of overwriting (and later restoring) the ranking confidence.
 *
 * (b) is the revision. The pass is no longer telemetry-only: `bun run
 * calibrate-search` measured MRR@5 0.838 when the composite sees the pool
 * against 0.813 when the records are cut by confidence first, so the pass now
 * decides which candidates survive instead of only reordering them.
 */
import { describe, it, expect, vi } from 'vitest';
import { SearchMediator } from '../../src/handlers/search-mediator.js';

function rowFor(id: string) {
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
    tags: '["observer"]',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function stubMatch(id: string, confidence: number) {
  return {
    pattern: {
      id,
      name: 'Pattern ' + id,
      category: 'Behavioral',
      description: 'd',
      complexity: 'Medium',
      tags: ['observer'],
    },
    confidence,
    matchType: 'keyword',
    reasons: ['contains keyword observer'],
    metadata: { finalScore: confidence, semanticScore: 0.8, keywordScore: 0.3 },
  };
}

function build(maxResults: number) {
  const queryOne = vi.fn((_sql: string, params: readonly string[] = []) =>
    rowFor(String(params[0]))
  );
  const db = { query: vi.fn().mockReturnValue([]), queryOne };
  const vectorOps = { searchSimilar: vi.fn().mockReturnValue([]) };
  const mediator = new SearchMediator(db as never, vectorOps as never, undefined, {
    useFuzzyRefinement: true,
    useSemanticSearch: false,
    useKeywordSearch: false,
    useHybridSearch: false,
    maxResults,
    minConfidence: 0,
  });

  const matches = [stubMatch('p-1', 0.9), stubMatch('p-2', 0.7), stubMatch('p-3', 0.5)];
  const internal = mediator as unknown as {
    semanticHandler: { search: () => Promise<unknown[]> };
    keywordHandler: { search: () => Promise<unknown[]>; broadSearch: () => Promise<unknown[]> };
  };
  internal.semanticHandler = { search: () => Promise.resolve([]) };
  internal.keywordHandler = {
    search: () => Promise.resolve([]),
    broadSearch: () => Promise.resolve(matches),
  };

  return { mediator, queryOne };
}

describe('fuzzy telemetry scope', () => {
  it('does not re-query the catalog per candidate', async () => {
    const { mediator, queryOne } = build(1);
    await mediator.search({ id: 'req-1', query: 'observer', maxResults: 1 });
    // One lookup per match when the recommendations are built; the fuzzy pass
    // itself must add none.
    expect(queryOne).toHaveBeenCalledTimes(3);
  });

  it('scores the candidate pool rather than only the returned slice', async () => {
    const loggerModule = await import('../../src/utils/logger.js');
    const infoSpy = vi.spyOn(loggerModule.structuredLogger, 'info');

    const { mediator } = build(1);
    const result = await mediator.search({ id: 'req-2', query: 'observer', maxResults: 1 });

    expect(result.length).toBe(1);
    const payload = infoSpy.mock.calls
      .map((call) => call[2] as Record<string, unknown>)
      .find((arg) => arg !== null && typeof arg === 'object' && 'patternsProcessed' in arg);
    expect(payload).toBeDefined();
    // Three candidates in the pool, one returned: scoring all of them is the
    // point — a record cut by confidence can no longer be promoted.
    expect(payload?.patternsProcessed).toBe(3);

    infoSpy.mockRestore();
  });

  it('publishes the fuzzy relevance without overwriting the ranking confidence', async () => {
    const { mediator } = build(1);
    const result = await mediator.search({ id: 'req-3', query: 'observer', maxResults: 1 });

    expect(result.length).toBe(1);
    expect(result[0].confidence).toBe(0.9);
    const just = result[0].justification as Record<string, unknown>;
    expect(typeof just.fuzzyRelevance).toBe('number');
    // The stored score is the defuzzified crisp value and stays in [0, 1].
    const relevance = just.fuzzyRelevance as number;
    expect(relevance).toBeGreaterThan(0);
    expect(relevance).toBeLessThanOrEqual(1);
  });
});
