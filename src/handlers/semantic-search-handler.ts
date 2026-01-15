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

      // Search for similar patterns
      const searchResults = this.vectorOps.searchSimilar(queryEmbedding, {
        categories: request.categories,
        minUsageCount: 0,
      });

      const matches: MatchResult[] = searchResults
        .filter((result) => result.score >= this.config.minConfidence)
        .slice(0, this.config.maxResults)
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
   * Generate query embedding using the embedding adapter
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    // Check cache first
    const cachedEmbedding = this.cache.getEmbeddings(query);
    if (cachedEmbedding) {
      return cachedEmbedding;
    }

    // Ensure adapter is initialized
    if (!this.embeddingAdapter) {
      this.embeddingAdapter = new EmbeddingServiceAdapter({
        cacheEnabled: true,
        cacheTTL: 3600000,
        batchSize: 10,
        retryAttempts: 3,
        retryDelay: 1000,
        preferredStrategy: 'transformers',
        fallbackToSimple: true,
      });
    }

    // Initialize if needed
    if (!(await this.embeddingAdapter.isReady())) {
      await this.embeddingAdapter.initialize();
    }

    // Generate embedding
    const embedding = await this.embeddingAdapter.generateEmbedding(query);

    if (!embedding || embedding.length === 0) {
      // Fallback to simple hash-based embedding
      return this.generateFallbackEmbedding(query);
    }

    // Cache the embedding
    this.cache.setEmbeddings(query, embedding, 3600000);

    return embedding;
  }

  /**
   * Fallback embedding generation using simple hash
   */
  private generateFallbackEmbedding(query: string): number[] {
    const words = query.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0) as number[];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordHash = this.simpleHash(word);

      for (let j = 0; j < Math.min(word.length, 10); j++) {
        const charCode = word.charCodeAt(j);
        const position = (wordHash + j + i * 7) % embedding.length;
        embedding[position] += (charCode / 255) * 0.5 + Math.sin(wordHash * j) * 0.3;
      }
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / (norm || 1));
  }

  /**
   * Simple hash function
   */
  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
