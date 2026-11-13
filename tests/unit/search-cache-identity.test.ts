/**
 * Cache identity — RED tests.
 *
 * Why this exists: `buildCacheKey` serialised the query, categories,
 * maxResults, programmingLanguage and the three strategy flags, but not
 * `useFuzzyRefinement` or `minConfidence` — two settings that change the
 * response. Because `searchSafe(request, override)` lets a caller vary the
 * config per call, the second caller could receive the first caller's answer:
 * fuzzy-ranked records when it asked for no refinement, or an unfiltered set
 * when it raised the confidence floor. The payload carried no sign of it.
 *
 * The contract pinned here: the cache key must cover every input that changes
 * the response, so a cached answer always belongs to the request that gets it.
 */
import { describe, it, expect, vi } from 'vitest';
import { SearchMediator } from '../../src/handlers/search-mediator.js';
import { CacheService } from '../../src/services/cache.js';
import { ok, isOk } from '../../src/types/result.js';
import type { PatternRequest } from '../../src/types/search-types.js';

function pattern(id: string) {
  return { id, name: 'Pattern ' + id, category: 'Behavioral', description: 'd', complexity: 'Medium', tags: [] };
}

function match(id: string, confidence: number) {
  return {
    pattern: pattern(id),
    confidence,
    matchType: 'keyword' as const,
    reasons: ['kw'],
    metadata: { finalScore: confidence },
  };
}

function build() {
  const db = {
    query: vi.fn().mockReturnValue([]),
    queryOne: vi.fn((_sql: string, params: readonly unknown[] = []) => ({
      id: String(params[0] ?? 'x'),
      name: 'Pattern ' + String(params[0] ?? 'x'),
      category: 'Behavioral',
      description: 'd',
      complexity: 'Medium',
      tags: '[]',
      benefits: '[]',
      drawbacks: '[]',
    })),
  };
  const mediator = new SearchMediator(db as never, { searchSimilar: vi.fn().mockReturnValue([]) } as never, new CacheService(), {
    useFuzzyRefinement: true,
    useSemanticSearch: false,
    useKeywordSearch: true,
    useHybridSearch: false,
    maxResults: 5,
    minConfidence: 0,
  });
  const internal = mediator as unknown as {
    semanticHandler: { searchSafe: () => Promise<unknown> };
    keywordHandler: {
      searchSafe: () => Promise<unknown>;
      applicabilityScores: () => Map<string, number>;
    };
  };
  internal.semanticHandler = { searchSafe: () => Promise.resolve(ok([])) };
  // Two candidates with distinct confidences so the floor has something to cut.
  internal.keywordHandler = {
    searchSafe: () => Promise.resolve(ok([match('strong', 0.9), match('weak', 0.3)])),
    applicabilityScores: () => new Map<string, number>(),
  };
  return mediator;
}

const request: PatternRequest = { id: 'r-cache', query: 'observer', maxResults: 5 };

describe('cache identity covers the inputs that change the response', () => {
  it('does not serve a fuzzy-disabled answer to a fuzzy-enabled request', async () => {
    const mediator = build();

    // Same query, same maxResults: only the refinement flag differs.
    const plainResult = await mediator.searchSafe(request, { useFuzzyRefinement: false });
    const refinedResult = await mediator.searchSafe(request, { useFuzzyRefinement: true });
    if (!isOk(plainResult) || !isOk(refinedResult)) throw new Error('search failed');
    const plain = plainResult.value;
    const refined = refinedResult.value;

    expect(plain).toHaveLength(2);
    // A cached copy of `plain` would carry no fuzzy evidence at all.
    expect(typeof refined[0].justification.fuzzyRelevance).toBe('number');
  });

  it('does not serve an answer filtered by another confidence floor', async () => {
    const mediator = build();

    const permissiveResult = await mediator.searchSafe(request, { minConfidence: 0 });
    const strictResult = await mediator.searchSafe(request, { minConfidence: 0.5 });
    if (!isOk(permissiveResult) || !isOk(strictResult)) throw new Error('search failed');
    const permissive = permissiveResult.value;
    const strict = strictResult.value;

    // The floor changes the set, not just the order: a cached permissive answer
    // would keep the weak candidate the caller asked to be excluded.
    expect(permissive.map((rec) => rec.pattern.id)).toContain('weak');
    expect(strict.map((rec) => rec.pattern.id)).toEqual(['strong']);
  });
});
