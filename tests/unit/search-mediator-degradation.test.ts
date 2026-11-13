/**
 * Regression tests — SearchMediator failure handling and result limits
 * (review F2 and F5).
 *
 * Requirements:
 *  - F2: when the semantic channel fails (model unavailable, vector store
 *    error) the user still gets keyword results and the response is flagged
 *    `degraded: true`. A degraded response must never be cached as if it
 *    were healthy.
 *  - F5: a caller asking for N results (the validator allows up to 100) gets
 *    up to N results; the handlers' internal candidate pools must not cap it
 *    at 10.
 */
import { describe, it, expect } from 'vitest';
import { SearchMediator } from '../../src/handlers/search-mediator.js';
import { CacheService } from '../../src/services/cache.js';
import type { VectorSearchResult, VectorSearchFilters } from '../../src/models/vector.js';

interface PatternRowStub {
  id: string;
  name: string;
  category: string;
  description: string;
  complexity: string;
  tags: string;
  when_to_use: string | null;
  benefits: string | null;
  drawbacks: string | null;
  use_cases: string | null;
  created_at: string;
  updated_at: string;
}

function row(id: string, description: string): PatternRowStub {
  return {
    id,
    name: id,
    category: 'Performance',
    description,
    complexity: 'Medium',
    tags: '["perf"]',
    when_to_use: null,
    benefits: null,
    drawbacks: null,
    use_cases: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

const CACHE_PATTERNS = Array.from({ length: 40 }, (_, i) =>
  row(`cache-${i}`, `Cache strategy variant ${i} for read-heavy workloads`.repeat(1 + (i % 3)))
);
const SEMANTIC_ONLY = row('write-behind', 'Defers persistence of updates to a background flusher');
const CATALOG = [...CACHE_PATTERNS, SEMANTIC_ONLY];

function stubDb(rows: PatternRowStub[]) {
  return {
    query: () => rows,
    queryOne: (_sql: string, params: readonly string[] = []) =>
      rows.find(r => r.id === params[0]) ?? null,
  };
}

type SearchSimilarFn = (
  embedding: number[],
  filters?: VectorSearchFilters,
  limit?: number
) => VectorSearchResult[];

/** Vector store stub that honours the requested limit, like the real service. */
function vectorStore(ids: string[]): SearchSimilarFn {
  return (_embedding, _filters, limit = 10) =>
    ids.slice(0, limit).map((id, index) => ({
      patternId: id,
      score: 0.9 - index * 0.01,
      distance: 0.1 + index * 0.01,
      rank: index + 1,
      pattern: { id, name: id, category: 'Performance', description: 'd', tags: [] },
    }));
}

const QUERY_EMBEDDING = Array.from({ length: 384 }, (_, i) => (i % 7) / 7);

function buildMediator(searchSimilar: SearchSimilarFn, query: string): SearchMediator {
  const cache = new CacheService();
  cache.setEmbeddings(query, QUERY_EMBEDDING);
  return new SearchMediator(stubDb(CATALOG) as never, { searchSimilar } as never, cache, {
    useFuzzyRefinement: false,
  });
}

const failingStore: SearchSimilarFn = () => {
  throw new Error('vector store unavailable');
};

describe('SearchMediator degradation when the semantic channel fails', () => {
  it('serves keyword results flagged as degraded when a semantic-only search fails', async () => {
    const mediator = buildMediator(failingStore, 'cache strategy');

    const result = await mediator.searchByType({ id: 'r1', query: 'cache strategy' }, 'semantic');

    expect(result.degraded).toBe(true);
    expect(result.searchTypeUsed).toBe('keyword');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.every(r => r.pattern.id.startsWith('cache-'))).toBe(true);
  });

  it('keeps keyword results and flags degradation when the semantic half of a hybrid search fails', async () => {
    const mediator = buildMediator(failingStore, 'cache strategy');

    const result = await mediator.searchByType({ id: 'r2', query: 'cache strategy' }, 'hybrid');

    expect(result.degraded).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('does not flag degradation when semantic search succeeds with no hits', async () => {
    const mediator = buildMediator(() => [], 'cache strategy');

    const result = await mediator.searchByType({ id: 'r3', query: 'cache strategy' }, 'semantic');

    expect(result.degraded).toBe(false);
    expect(result.searchTypeUsed).toBe('semantic');
  });

  it('does not cache a degraded response: a recovered store serves semantic hits on the next call', async () => {
    let storeUp = false;
    const healthyStore = vectorStore(['write-behind']);
    const flakyStore: SearchSimilarFn = (e, f, l) => {
      if (!storeUp) throw new Error('vector store unavailable');
      return healthyStore(e, f, l);
    };
    const mediator = buildMediator(flakyStore, 'cache strategy');
    const request = { id: 'r4', query: 'cache strategy', maxResults: 50 };

    const first = await mediator.searchByType(request, 'hybrid');
    storeUp = true;
    const second = await mediator.searchByType(request, 'hybrid');

    expect(first.degraded).toBe(true);
    expect(second.degraded).toBe(false);
    expect(second.recommendations.map(r => r.pattern.id)).toContain('write-behind');
  });
});

describe('SearchMediator per-request result limits', () => {
  it('returns up to the requested number of keyword results beyond the default pool of 10', async () => {
    const mediator = buildMediator(() => [], 'cache strategy');

    const result = await mediator.searchByType(
      { id: 'r5', query: 'cache strategy', maxResults: 30 },
      'keyword'
    );

    expect(result.recommendations).toHaveLength(30);
  });

  it('returns up to the requested number of semantic results beyond the vector default of 10', async () => {
    const mediator = buildMediator(vectorStore(CACHE_PATTERNS.map(p => p.id)), 'cache strategy');

    const result = await mediator.searchByType(
      { id: 'r6', query: 'cache strategy', maxResults: 25 },
      'semantic'
    );

    expect(result.recommendations).toHaveLength(25);
  });
});
