/**
 * T5: Fuzzy input fingerprint — RED test.
 * Asserts that when fuzzy refinement is enabled, the SearchMediator exposes
 * the input passed to FuzzyInferenceEngine.evaluatePattern on the
 * recommendation's justification as `fuzzyInputFingerprint`. The fingerprint
 * captures the semantic and keyword components that drove the inference,
 * so future T6 can decompose them from the blended hybrid score and stop
 * double-counting the same value in the smart-default rule.
 */
import { describe, it, expect, vi } from 'vitest';
import { SearchMediator } from '../../src/handlers/search-mediator.js';

const patternRow = {
  id: 'p-1',
  name: 'Observer',
  category: 'Behavioral',
  description: 'Notify dependents of state changes.',
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
  const vectorOps = { searchSimilar: vi.fn().mockResolvedValue([]) };
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
      name: 'Observer',
      category: 'Behavioral',
      description: 'desc',
      complexity: 'Medium',
      tags: ['observer'],
    },
    confidence: 0.62,
    matchType: 'keyword',
    reasons: ['contains keyword observer'],
    metadata: { finalScore: 0.62, semanticScore: 0.85, keywordScore: 0.3 },
  };
  internal.semanticHandler = { search: () => Promise.resolve([stubMatch]) };
  internal.keywordHandler = {
    search: () => Promise.resolve([stubMatch]),
    broadSearch: () => Promise.resolve([stubMatch]),
  };

  return mediator;
}

describe('Fuzzy input fingerprint', () => {
  it('exposes fuzzyInputFingerprint on the recommendation justification', async () => {
    const mediator = buildMediator();
    const result = await mediator.search({
      id: 'req-1',
      query: 'observer',
      maxResults: 1,
    });

    expect(result.length).toBe(1);
    const just = result[0].justification as Record<string, unknown>;
    const fingerprint = just.fuzzyInputFingerprint as Record<string, unknown> | undefined;

    expect(fingerprint).toBeDefined();
    if (!fingerprint) return;
    expect(typeof fingerprint.semanticSimilarity).toBe('number');
    expect(typeof fingerprint.keywordMatchStrength).toBe('number');
    expect(typeof fingerprint.contextualFit).toBe('number');
    expect(typeof fingerprint.patternComplexity).toBe('string');
  });

  it('uses the underlying semantic score, not the blended confidence, as semanticSimilarity', async () => {
    const mediator = buildMediator();
    const result = await mediator.search({
      id: 'req-2',
      query: 'observer',
      maxResults: 1,
    });

    expect(result.length).toBe(1);
    const just = result[0].justification as Record<string, unknown>;
    const fingerprint = just.fuzzyInputFingerprint as { semanticSimilarity: number } | undefined;

    // The fingerprint's semanticSimilarity should be the alpha-deconvolved
    // semantic component (high) — NOT the blended hybrid confidence (0.62).
    // The mock metadata says semanticScore=0.85; the blended is 0.62.
    expect(fingerprint).toBeDefined();
    if (!fingerprint) return;
    expect(fingerprint.semanticSimilarity).toBeGreaterThan(0.7);
    expect(fingerprint.semanticSimilarity).not.toBe(0.62);
  });
});
