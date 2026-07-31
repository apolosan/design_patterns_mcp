/**
 * T1: Fuzzy divergence — RED test.
 * Asserts that when fuzzy refinement is enabled, the SearchMediator preserves
 * the pre-fuzzy (hybrid-blended) confidence on the recommendation justification
 * as `originalConfidence`, and that fuzzyReasoning + fuzzyConfidence are
 * populated. Mocks the SearchMediator's internal handlers so we can drive
 * a deterministic match set without booting DB / vector / embeddings.
 */
import { describe, it, expect, vi } from 'vitest';
import { SearchMediator } from '../../src/handlers/search-mediator.js';

const RAW_CONFIDENCE = 0.62;

function buildMediator() {
  const db = {
    query: vi.fn().mockReturnValue([]),
    queryOne: vi.fn().mockReturnValue({
      id: 'p-1',
      name: 'Factory Method',
      category: 'Creational',
      description: 'desc',
      when_to_use: '[]',
      benefits: '[]',
      drawbacks: '[]',
      use_cases: '[]',
      complexity: 'Medium',
      tags: '[]',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }),
  };
  const vectorOps = { searchSimilar: vi.fn().mockResolvedValue([]) };
  const mediator = new SearchMediator(db as never, vectorOps as never, undefined, {
    useFuzzyRefinement: true,
    useSemanticSearch: false,
    useKeywordSearch: false,
    useHybridSearch: false,
    maxResults: 5,
    minConfidence: 0.0,
  });

  // Inject deterministic match results, bypassing real handlers/embeddings.
  const internal = mediator as unknown as {
    semanticHandler: { search: () => Promise<unknown[]> };
    keywordHandler: { search: () => Promise<unknown[]>; broadSearch: () => Promise<unknown[]> };
  };
  const stubMatch = {
    pattern: {
      id: 'p-1',
      name: 'Factory Method',
      category: 'Creational',
      description: 'desc',
      complexity: 'Medium',
      tags: ['factory'],
    },
    confidence: RAW_CONFIDENCE,
    matchType: 'keyword',
    reasons: ['contains keyword factory'],
    metadata: { finalScore: RAW_CONFIDENCE },
  };
  internal.semanticHandler = { search: () => Promise.resolve([stubMatch]) };
  internal.keywordHandler = {
    search: () => Promise.resolve([stubMatch]),
    broadSearch: () => Promise.resolve([stubMatch]),
  };

  return mediator;
}

describe('Fuzzy divergence — originalConfidence preserved', () => {
  it('writes originalConfidence onto justification when fuzzy is enabled', async () => {
    const mediator = buildMediator();
    const result = await mediator.search({
      id: 'req-1',
      query: 'factory',
      maxResults: 1,
    });

    expect(result.length).toBe(1);
    const just = result[0].justification as Record<string, unknown>;
    expect(just.originalConfidence).toBe(RAW_CONFIDENCE);
  });

  it('populates fuzzyReasoning and fuzzyConfidence on the recommendation', async () => {
    const mediator = buildMediator();
    const result = await mediator.search({
      id: 'req-2',
      query: 'factory',
      maxResults: 1,
    });

    expect(result.length).toBe(1);
    const just = result[0].justification as Record<string, unknown>;
    expect(Array.isArray(just.fuzzyReasoning)).toBe(true);
    expect((just.fuzzyReasoning as unknown[]).length).toBeGreaterThan(0);
    expect(typeof just.fuzzyConfidence).toBe('number');
  });
});
