/**
 * Regression tests — semantic relevance guarantees (review F8).
 *
 * Requirements:
 *  - The configured `similarityThreshold` is the relevance floor for
 *    semantic hits; matches below it are not presented as recommendations.
 *  - Query embeddings must come from the same model family as the stored
 *    embeddings. If the embedding model is unavailable, the semantic channel
 *    must FAIL (so the mediator can degrade to keyword search) instead of
 *    silently comparing hash vectors with MiniLM vectors and reporting
 *    random "Semantic similarity: X%" scores.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SemanticSearchHandler } from '../../src/handlers/semantic-search-handler.js';
import { EmbeddingServiceAdapter } from '../../src/adapters/embedding-service-adapter.js';
import { CacheService } from '../../src/services/cache.js';
import type { VectorSearchResult } from '../../src/models/vector.js';

function hit(id: string, score: number): VectorSearchResult {
  return {
    patternId: id,
    score,
    distance: 1 - score,
    rank: 0,
    pattern: { id, name: id, category: 'Test', description: 'd', tags: [] },
  };
}

const EMBEDDING = Array.from({ length: 384 }, (_, i) => Math.sin(i));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SemanticSearchHandler relevance floor', () => {
  it('drops vector hits whose similarity is below the configured threshold', async () => {
    const cache = new CacheService();
    cache.setEmbeddings('event driven', EMBEDDING);
    const vectorOps = {
      searchSimilar: () => [hit('strong', 0.9), hit('fair', 0.5), hit('weak', 0.29), hit('noise', 0.1)],
    };
    const handler = new SemanticSearchHandler(vectorOps as never, cache, {
      maxResults: 10,
      minConfidence: 0.05,
      similarityThreshold: 0.3,
    });

    const results = await handler.search({ id: 'q', query: 'event driven' });

    expect(results.map(r => r.pattern.id)).toEqual(['strong', 'fair']);
  });
});

describe('SemanticSearchHandler when the embedding model is unavailable', () => {
  it('fails the semantic channel instead of searching with a hash-based embedding', async () => {
    vi.spyOn(EmbeddingServiceAdapter.prototype, 'isReady').mockResolvedValue(true);
    vi.spyOn(EmbeddingServiceAdapter.prototype, 'generateEmbedding').mockResolvedValue([]);
    const searchSimilar = vi.fn(() => [hit('random', 0.4)]);
    const handler = new SemanticSearchHandler({ searchSimilar } as never, new CacheService());

    const result = await handler.searchSafe({ id: 'q', query: 'event driven' });

    expect(result.success).toBe(false);
    expect(searchSimilar).not.toHaveBeenCalled();
  });

  it('refuses query embeddings produced by the simple-hash fallback strategy', async () => {
    vi.spyOn(EmbeddingServiceAdapter.prototype, 'isReady').mockResolvedValue(true);
    vi.spyOn(EmbeddingServiceAdapter.prototype, 'getStrategyInfo').mockReturnValue({
      name: 'simple-hash',
      model: 'simplified-hash',
      dimensions: 384,
    });
    vi.spyOn(EmbeddingServiceAdapter.prototype, 'generateEmbedding').mockResolvedValue(EMBEDDING);
    const searchSimilar = vi.fn(() => [hit('random', 0.4)]);
    const handler = new SemanticSearchHandler({ searchSimilar } as never, new CacheService());

    const result = await handler.searchSafe({ id: 'q', query: 'event driven' });

    expect(result.success).toBe(false);
    expect(searchSimilar).not.toHaveBeenCalled();
  });
});
