import { describe, expect, it, vi } from 'vitest';
import { SearchMediator } from '../../src/handlers/search-mediator.js';

/**
 * Documents the contract for unit tests: when constructing a SearchMediator
 * for unit testing, callers should pass `useFuzzyRefinement: false` so the
 * fuzzy refinement pipeline (which requires full DB access) does not run.
 */
describe('SearchMediator — fuzzy disabled in unit tests', () => {
  function createMediator(): SearchMediator {
    const db = {
      query: vi.fn().mockReturnValue([]),
      queryOne: vi.fn().mockReturnValue(null),
    };
    const vectorOps = { searchSimilar: vi.fn().mockResolvedValue([]) };
    return new SearchMediator(db as never, vectorOps as never, undefined, {
      useFuzzyRefinement: false,
      useHybridSearch: false,
    });
  }

  it('respects useFuzzyRefinement=false in constructor config', () => {
    const mediator = createMediator();
    const config = (mediator as unknown as { config: { useFuzzyRefinement: boolean } }).config;
    expect(config.useFuzzyRefinement).toBe(false);
  });

  it('does not throw when fuzzy pipeline is skipped (empty results)', async () => {
    const mediator = createMediator();
    const result = await mediator.search({
      id: 'r1',
      query: 'factory',
      maxResults: 1,
    });
    expect(Array.isArray(result)).toBe(true);
  });
});
