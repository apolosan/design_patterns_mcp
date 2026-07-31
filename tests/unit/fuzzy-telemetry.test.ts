/**
 * T7: Fuzzy telemetry — RED test.
 * Asserts that applyFuzzyRefinement emits a structured log line carrying
 * ruleFiringsCount and avgConfidenceDelta aggregates at INFO level.
 */
import { describe, it, expect, vi } from 'vitest';
import { SearchMediator } from '../../src/handlers/search-mediator.js';

const patternRow = {
  id: 'p-1',
  name: 'Strategy',
  category: 'Behavioral',
  description: 'Family of interchangeable algorithms.',
  when_to_use: '[]',
  benefits: '[]',
  drawbacks: '[]',
  use_cases: '[]',
  complexity: 'Medium',
  tags: '[]',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function buildMediator() {
  const db = {
    query: vi.fn().mockReturnValue([]),
    queryOne: vi.fn().mockReturnValue(patternRow),
  };
  const vectorOps = {
    searchSimilar: vi.fn().mockResolvedValue([]),
  };
  const mediator = new SearchMediator(db as never, vectorOps as never, undefined, {
    useFuzzyRefinement: true,
    useSemanticSearch: false,
    useKeywordSearch: false,
    useHybridSearch: false,
    maxResults: 5,
    minConfidence: 0.0,
  });

  const internal = mediator as unknown as {
    semanticHandler: { search: () => Promise<unknown[]> };
    keywordHandler: { search: () => Promise<unknown[]>; broadSearch: () => Promise<unknown[]> };
  };
  const stubMatch = {
    pattern: {
      id: 'p-1',
      name: 'Strategy',
      category: 'Behavioral',
      description: 'Family of algorithms.',
      complexity: 'Medium',
      tags: ['strategy'],
    },
    confidence: 0.7,
    matchType: 'keyword',
    reasons: ['contains keyword strategy'],
    metadata: { finalScore: 0.7 },
  };
  internal.semanticHandler = { search: () => Promise.resolve([stubMatch]) };
  internal.keywordHandler = {
    search: () => Promise.resolve([stubMatch]),
    broadSearch: () => Promise.resolve([stubMatch]),
  };

  return mediator;
}

describe('Fuzzy telemetry invariant', () => {
  it('emits structured info log with ruleFiringsCount and avgConfidenceDelta', async () => {
    const structuredLoggerModule = await import('../../src/utils/logger.js');
    const infoSpy = vi.spyOn(structuredLoggerModule.structuredLogger, 'info');

    const mediator = buildMediator();
    await mediator.search({ id: 'req-1', query: 'strategy', maxResults: 1 });

    const targets = infoSpy.mock.calls.filter((call) => {
      const arg2 = call[2] as Record<string, unknown>;
      return arg2 !== null && typeof arg2 === 'object' && 'ruleFiringsCount' in arg2;
    });

    expect(targets.length).toBeGreaterThan(0);
    const payload = targets[0][2] as Record<string, unknown>;
    expect(typeof payload.ruleFiringsCount).toBe('number');
    expect(typeof payload.avgConfidenceDelta).toBe('number');
    expect(typeof payload.patternsProcessed).toBe('number');
    expect(typeof payload.durationMs).toBe('number');

    infoSpy.mockRestore();
  });
});
