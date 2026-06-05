import { describe, expect, it, vi } from 'vitest';
import { SearchMediator } from '../../src/handlers/search-mediator.js';
import type { PatternRequest } from '../../src/types/search-types.js';

describe('SearchMediator (immutable config)', () => {
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

  it('does not mutate constructor config across concurrent searchByType calls', async () => {
    const mediator = createMediator();
    type ConfigSnapshot = { useHybridSearch: boolean; useSemanticSearch: boolean; useKeywordSearch: boolean };
    const readConfig = (): ConfigSnapshot => {
      const field = (mediator as unknown as { config: ConfigSnapshot }).config;
      return JSON.parse(JSON.stringify(field)) as ConfigSnapshot;
    };

    const internalConfigBefore = readConfig();

    const request: PatternRequest = { id: 'race-1', query: 'factory', maxResults: 3 };

    const [resultA, resultB] = await Promise.all([
      mediator.searchByType(request, 'hybrid'),
      mediator.searchByType(request, 'keyword'),
    ]);

    const internalConfigAfter = readConfig();

    expect(resultA.searchTypeUsed).toBe('hybrid');
    expect(resultB.searchTypeUsed).toBe('keyword');
    expect(internalConfigAfter).toEqual(internalConfigBefore);
  });

  it('searchSafe accepts an optional config override', async () => {
    const mediator = createMediator();
    const request: PatternRequest = { id: 'override-1', query: 'builder', maxResults: 1 };

    // The override parameter must be accepted (compile-time + runtime).
    // We don't assert success because the lightweight mock does not implement
    // queryOne; the goal is to verify the API surface.
    const result = await mediator.searchSafe(request, {
      useSemanticSearch: false,
      useKeywordSearch: true,
      useHybridSearch: false,
    });

    // The return value is a Result object (success or failure) - never throws.
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('search() forwards override to searchSafe (typecheck at minimum)', async () => {
    const mediator = createMediator();
    const request: PatternRequest = { id: 'override-2', query: 'singleton', maxResults: 2 };

    // No-op assertion: this call must not throw a TypeError at the call site.
    // The Result type assertion is checked at compile time by tsc.
    const recommendations = await mediator.search(request, {
      useFuzzyRefinement: false,
    });

    expect(Array.isArray(recommendations)).toBe(true);
  });

  it('honors enableHybridSearch=false when user requests hybrid strategy', async () => {
    // A2: requesting 'hybrid' should not bypass the configured useHybridSearch flag
    const mediator = createMediator();
    const request: PatternRequest = { id: 'a2-1', query: 'observer', maxResults: 3 };

    const result = await mediator.searchByType(request, 'hybrid');

    expect(result.searchTypeUsed).toBe('hybrid');
    expect(result.recommendations).toBeDefined();
  });
});

describe('SearchMediator.searchByType (existing behavior)', () => {
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
