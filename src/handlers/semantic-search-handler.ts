/**
 * Semantic Search Handler
 * Handles semantic/vector-based pattern searches
 * Extracted from PatternMatcher following SRP
 */

import { VectorOperationsService } from '../services/vector-operations.js';
import { EmbeddingServiceAdapter } from '../adapters/embedding-service-adapter.js';
import { CacheService } from '../services/cache.js';
import { structuredLogger } from '../utils/logger.js';
import { Result, tryCatchAsync } from '../types/result.js';
import type {
  PatternRequest,
  MatchResult,
  SearchHandler,
  SemanticSearchHandlerConfig,
} from '../types/search-types.js';

/** Strategy whose vectors are not comparable with the stored model embeddings. */
const INCOMPATIBLE_STRATEGY = 'simple-hash';

const DEFAULT_CONFIG: SemanticSearchHandlerConfig = {
  maxResults: 10,
  minConfidence: 0.05,
  similarityThreshold: 0.3,
};

export class SemanticSearchHandler implements SearchHandler {
  private vectorOps: VectorOperationsService;
  private embeddingAdapter: EmbeddingServiceAdapter | null = null;
  private cache: CacheService;
  private config: SemanticSearchHandlerConfig;

  constructor(
    vectorOps: VectorOperationsService,
    cache: CacheService,
    config?: Partial<SemanticSearchHandlerConfig>
  ) {
    this.vectorOps = vectorOps;
    this.cache = cache;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Perform semantic search using vector similarity
   */
  async search(request: PatternRequest): Promise<MatchResult[]> {
    const result = await this.searchSafe(request);
    if (result.success) {
      return result.value;
    }
    structuredLogger.error(
      'semantic-search-handler',
      'Semantic search failed',
      result.error
    );
    return [];
  }

  /**
   * Safe version of search that returns a Result type
   */
  async searchSafe(request: PatternRequest): Promise<Result<MatchResult[]>> {
    return tryCatchAsync(async () => {
      const startTime = Date.now();

      // Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(request.query);

      // Candidate pool grows with the caller's limit so a request for N
      // results is not silently capped by the handler default.
      const candidateLimit = Math.max(this.config.maxResults, (request.maxResults ?? 0) * 2);
      const relevanceFloor = Math.max(this.config.minConfidence, this.config.similarityThreshold);

      // Search for similar patterns
      const searchResults = this.vectorOps.searchSimilar(
        queryEmbedding,
        {
          categories: request.categories,
          minUsageCount: 0,
          minScore: relevanceFloor,
        },
        candidateLimit
      );

      const matches: MatchResult[] = searchResults
        .filter((result) => result.score >= relevanceFloor)
        .slice(0, candidateLimit)
        .map((result) => ({
          pattern: {
            id: result.patternId,
            name: result.pattern?.name ?? 'Unknown Pattern',
            category: result.pattern?.category ?? 'Unknown',
            description: result.pattern?.description ?? 'No description available',
          },
          confidence: result.score,
          matchType: 'semantic' as const,
          reasons: [`Semantic similarity: ${(result.score * 100).toFixed(1)}%`],
          metadata: {
            semanticScore: result.score,
            finalScore: result.score,
          },
        }));

      const duration = Date.now() - startTime;
      structuredLogger.debug('semantic-search-handler', 'Semantic search completed', {
        query: request.query.substring(0, 50),
        resultsCount: matches.length,
        durationMs: duration,
      });

      return matches;
    });
  }

  /**
   * Generate the query embedding with the same model family used for the
   * stored pattern embeddings.
   *
   * Throws when no compatible model is available. A hash-based vector lives
   * in a different space than the stored MiniLM vectors, so similarity
   * scores computed from it are meaningless; failing lets the mediator
   * degrade to keyword search and report `degraded: true`.
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    const cachedEmbedding = this.cache.getEmbeddings(query);
    if (cachedEmbedding) {
      return cachedEmbedding;
    }

    if (!this.embeddingAdapter) {
      this.embeddingAdapter = new EmbeddingServiceAdapter({
        cacheEnabled: true,
        cacheTTL: 3600000,
        batchSize: 10,
        retryAttempts: 3,
        retryDelay: 1000,
        preferredStrategy: 'transformers',
        fallbackToSimple: false,
      });
    }

    if (!(await this.embeddingAdapter.isReady())) {
      await this.embeddingAdapter.initialize();
    }

    const strategy = this.embeddingAdapter.getStrategyInfo();
    if (strategy?.name === INCOMPATIBLE_STRATEGY) {
      throw new Error(
        `Embedding strategy "${strategy.name}" is incompatible with stored pattern embeddings`
      );
    }

    const embedding = await this.embeddingAdapter.generateEmbedding(query);
    if (embedding.length === 0) {
      throw new Error('Embedding model returned an empty query embedding');
    }

    this.cache.setEmbeddings(query, embedding, 3600000);
    return embedding;
  }
}
