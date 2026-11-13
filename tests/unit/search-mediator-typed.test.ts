import { describe, expect, it, vi } from 'vitest';
import { SearchMediator } from '../../src/handlers/search-mediator.js';
import type { PatternRequest } from '../../src/types/search-types.js';

describe('SearchMediator.searchByType', () => {
  function createMediator(): SearchMediator {
    const builderRow = {
      id: 'builder',
      name: 'Builder',
      category: 'Creational',
      description: 'Builds complex objects step by step',
      complexity: 'Intermediate',
      tags: '["creational"]',
    };
    const db = {
      query: vi.fn().mockReturnValue([builderRow]),
      queryOne: vi.fn((_sql: string, params: readonly string[] = []) =>
        params[0] === builderRow.id ? builderRow : null
      ),
    };

    const vectorOps = {
      searchSimilar: vi.fn().mockReturnValue([]),
    };

    return new SearchMediator(db as never, vectorOps as never, undefined, {
      useFuzzyRefinement: false,
      useHybridSearch: false,
    });
  }

  it('routes keyword strategy without invoking semantic handler path', async () => {
    const mediator = createMediator();
    const keywordSpy = vi.spyOn(
      (mediator as unknown as { keywordHandler: { searchSafe: (r: PatternRequest) => Promise<unknown> } })
        .keywordHandler,
      'searchSafe'
    );
    const semanticSpy = vi.spyOn(
      (mediator as unknown as { semanticHandler: { searchSafe: (r: PatternRequest) => Promise<unknown> } })
        .semanticHandler,
      'searchSafe'
    );

    const request: PatternRequest = {
      id: 'req-1',
      query: 'builder',
      maxResults: 3,
    };

    const result = await mediator.searchByType(request, 'keyword');

    expect(result.searchTypeUsed).toBe('keyword');
    expect(result.degraded).toBe(false);
    expect(keywordSpy).toHaveBeenCalled();
    expect(semanticSpy).not.toHaveBeenCalled();
  });

  it('reports degraded fallback when typed search throws', async () => {
    const mediator = createMediator();
    vi.spyOn(
      (mediator as unknown as { semanticHandler: { searchSafe: (r: PatternRequest) => Promise<unknown> } })
        .semanticHandler,
      'searchSafe'
    ).mockResolvedValue({ success: false, error: new Error('semantic unavailable') });

    const request: PatternRequest = {
      id: 'req-2',
      query: 'factory',
      maxResults: 3,
    };

    const result = await mediator.searchByType(request, 'semantic');

    expect(result.searchTypeUsed).toBe('keyword');
    expect(result.degraded).toBe(true);
    expect(result.recommendations).toEqual([]);
  });
});
