import { describe, expect, it, vi } from 'vitest';
import { SearchMediator } from '../../src/handlers/search-mediator.js';
import type { PatternRequest } from '../../src/types/search-types.js';

describe('SearchMediator.searchByType', () => {
  function createMediator(): SearchMediator {
    const db = {
      query: vi.fn().mockReturnValue([
        {
          id: 'builder',
          name: 'Builder',
          category: 'Creational',
          description: 'Builds complex objects step by step',
          complexity: 'Intermediate',
          tags: '["creational"]',
        },
      ]),
    };

    const vectorOps = {
      searchSimilar: vi.fn().mockResolvedValue([]),
    };

    return new SearchMediator(db as never, vectorOps as never, undefined, {
      useFuzzyRefinement: false,
      useHybridSearch: false,
    });
  }

  it('routes keyword strategy without invoking semantic handler path', async () => {
    const mediator = createMediator();
    const keywordSpy = vi.spyOn(
      (mediator as unknown as { keywordHandler: { search: (r: PatternRequest) => Promise<unknown[]> } })
        .keywordHandler,
      'search'
    );
    const semanticSpy = vi.spyOn(
      (mediator as unknown as { semanticHandler: { search: (r: PatternRequest) => Promise<unknown[]> } })
        .semanticHandler,
      'search'
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
    vi.spyOn(mediator, 'search')
      .mockRejectedValueOnce(new Error('semantic unavailable'))
      .mockResolvedValueOnce([]);

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
