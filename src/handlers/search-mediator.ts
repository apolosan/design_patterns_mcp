/**
 * Search Mediator
 * Implements the Mediator pattern to coordinate search operations
 * Reduces coupling between search handlers and provides a unified interface
 */

import { DatabaseManager } from '../services/database-manager.js';
import { VectorOperationsService } from '../services/vector-operations.js';
import { CacheService } from '../services/cache.js';
import { SemanticSearchHandler } from './semantic-search-handler.js';
import { KeywordSearchHandler } from './keyword-search-handler.js';
import { HybridSearchCombiner } from './hybrid-search-combiner.js';
import { RecommendationBuilder } from './recommendation-builder.js';
import { FuzzyInferenceEngine } from '../services/fuzzy-inference.js';
import { FuzzyDefuzzificationEngine } from '../services/fuzzy-defuzzification.js';
import { PatternRecommendation } from '../models/recommendation.js';
import { structuredLogger } from '../utils/logger.js';
import { Result, ok, err, isOk } from '../types/result.js';
import type { PatternRequest, MatchResult, DetailedPattern } from '../types/search-types.js';

/**
 * Search mediator configuration
 */
export interface SearchMediatorConfig {
  maxResults: number;
  minConfidence: number;
  useSemanticSearch: boolean;
  useKeywordSearch: boolean;
  useHybridSearch: boolean;
  useFuzzyRefinement: boolean;
  cacheResultsTTL: number;
}

const DEFAULT_CONFIG: SearchMediatorConfig = {
  maxResults: 5,
  minConfidence: 0.05,
  useSemanticSearch: true,
  useKeywordSearch: true,
  useHybridSearch: true,
  useFuzzyRefinement: true,
  cacheResultsTTL: 1800000, // 30 minutes
};

/**
 * Search Mediator - Coordinates pattern search operations
 * Following the Mediator pattern to reduce dependencies between components
 */
export class SearchMediator {
  private semanticHandler: SemanticSearchHandler;
  private keywordHandler: KeywordSearchHandler;
  private hybridCombiner: HybridSearchCombiner;
  private recommendationBuilder: RecommendationBuilder;
  private fuzzyInferenceEngine: FuzzyInferenceEngine;
  private fuzzyDefuzzificationEngine: FuzzyDefuzzificationEngine;
  private cache: CacheService;
  private config: SearchMediatorConfig;

  constructor(
    db: DatabaseManager,
    vectorOps: VectorOperationsService,
    cache?: CacheService,
    config?: Partial<SearchMediatorConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = cache ?? new CacheService();

    // Initialize handlers
    this.semanticHandler = new SemanticSearchHandler(vectorOps, this.cache, {
      maxResults: this.config.maxResults * 2,
      minConfidence: this.config.minConfidence,
      similarityThreshold: 0.3,
    });

    this.keywordHandler = new KeywordSearchHandler(db, {
      maxResults: this.config.maxResults * 2,
      minConfidence: this.config.minConfidence,
      broadSearchThreshold: 0.01,
    });

    this.hybridCombiner = new HybridSearchCombiner();
    this.recommendationBuilder = new RecommendationBuilder(db);

    // Initialize fuzzy logic components
    this.fuzzyInferenceEngine = new FuzzyInferenceEngine();
    this.fuzzyDefuzzificationEngine = new FuzzyDefuzzificationEngine();
  }

  /**
   * Execute a pattern search request
   * Coordinates all search handlers and returns recommendations
   */
  async search(request: PatternRequest): Promise<PatternRecommendation[]> {
    const result = await this.searchSafe(request);
    if (isOk(result)) {
      return result.value;
    }
    structuredLogger.error('search-mediator', 'Search failed', result.error);
    return [];
  }

  /**
   * Safe version of search that returns a Result type
   */
  async searchSafe(
    request: PatternRequest
  ): Promise<Result<PatternRecommendation[]>> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.buildCacheKey(request);
      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult) {
        structuredLogger.debug('search-mediator', 'Cache hit', {
          query: request.query.substring(0, 50),
          resultsCount: (cachedResult as PatternRecommendation[]).length,
        });
        return ok(cachedResult as PatternRecommendation[]);
      }

      // Perform matching
      const matches = await this.performMatching(request);

      if (matches.length === 0) {
        structuredLogger.warn('search-mediator', 'No matches found', {
          query: request.query,
        });
        return ok([]);
      }

      // Build recommendations
      let recommendations = this.recommendationBuilder.buildRecommendations(
        matches,
        request
      );

      // Apply fuzzy refinement if enabled
      if (this.config.useFuzzyRefinement) {
        recommendations = this.applyFuzzyRefinement(recommendations, request);
      }

      // Sort and limit results
      recommendations.sort((a, b) => b.confidence - a.confidence);
      const finalResults = recommendations.slice(
        0,
        request.maxResults ?? this.config.maxResults
      );

      // Cache results
      this.cache.set(cacheKey, finalResults, this.config.cacheResultsTTL);

      const duration = Date.now() - startTime;
      structuredLogger.info('search-mediator', 'Search completed', {
        query: request.query.substring(0, 50),
        matchesFound: matches.length,
        recommendationsBuilt: recommendations.length,
        finalResultsCount: finalResults.length,
        durationMs: duration,
      });

      return ok(finalResults);
    } catch (error) {
      const duration = Date.now() - startTime;
      structuredLogger.error(
        'search-mediator',
        'Search failed',
        error as Error,
        {
          query: request.query,
          durationMs: duration,
        }
      );
      return err(error as Error);
    }
  }

  /**
   * Perform pattern matching using configured strategies
   */
  private async performMatching(request: PatternRequest): Promise<MatchResult[]> {
    const allMatches: MatchResult[] = [];

    // Calculate dynamic alpha for hybrid search
    const alphaResult = this.hybridCombiner.calculateAlpha(request.query);

    structuredLogger.debug('search-mediator', 'Dynamic alpha calculated', {
      queryType: alphaResult.queryType,
      semanticAlpha: alphaResult.semanticAlpha.toFixed(3),
      keywordAlpha: alphaResult.keywordAlpha.toFixed(3),
    });

    // Execute searches in parallel
    const searchPromises: Promise<MatchResult[]>[] = [];

    if (this.config.useSemanticSearch) {
      searchPromises.push(
        this.semanticHandler.search(request).then((matches) =>
          this.hybridCombiner.applySemanticWeight(matches, alphaResult.semanticAlpha)
        )
      );
    }

    if (this.config.useKeywordSearch) {
      searchPromises.push(
        this.keywordHandler.search(request).then((matches) =>
          this.hybridCombiner.applyKeywordWeight(matches, alphaResult.keywordAlpha)
        )
      );
    }

    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);
    for (const results of searchResults) {
      allMatches.push(...results);
    }

    // If no matches found, try broad search
    if (allMatches.length === 0) {
      structuredLogger.warn('search-mediator', 'No matches, trying broad search');
      const broadMatches = await this.keywordHandler.broadSearch(request);
      allMatches.push(...broadMatches);
    }

    // Combine matches if hybrid search is enabled
    if (this.config.useHybridSearch && allMatches.length > 0) {
      return this.hybridCombiner.combineMatches(allMatches, alphaResult);
    }

    return allMatches;
  }

  /**
   * Apply fuzzy refinement to recommendations
   */
  private applyFuzzyRefinement(
    recommendations: PatternRecommendation[],
    request: PatternRequest
  ): PatternRecommendation[] {
    const startTime = Date.now();
    let processedCount = 0;

    for (const recommendation of recommendations) {
      try {
        const pattern = recommendation.pattern;
        const detailedPattern = this.recommendationBuilder.getDetailedPattern(
          pattern.id
        );

        if (!detailedPattern) continue;

        // Calculate contextual fit
        const contextualFit = this.calculateContextualFit(detailedPattern, request);

        // Prepare fuzzy input
        const fuzzyInput = {
          semanticSimilarity: recommendation.confidence,
          keywordMatchStrength: this.calculateKeywordStrength(
            recommendation.justification.supportingReasons
          ),
          patternComplexity: detailedPattern.complexity || 'Medium',
          contextualFit,
          programmingLanguage: request.programmingLanguage,
          patternId: pattern.id,
          originalScore: recommendation.confidence,
        };

        // Apply fuzzy inference
        const fuzzyResult = this.fuzzyInferenceEngine.evaluatePattern(fuzzyInput);

        // Apply defuzzification
        const defuzzResult = this.fuzzyDefuzzificationEngine.defuzzifyPatternRelevance(
          fuzzyResult.fuzzyScore
        );

        // Update recommendation
        recommendation.confidence = defuzzResult.crispValues.relevance;
        recommendation.justification.fuzzyReasoning = fuzzyResult.reasoning;
        recommendation.justification.fuzzyConfidence = defuzzResult.confidence;

        processedCount++;
      } catch (error) {
        structuredLogger.warn('search-mediator', 'Fuzzy refinement failed for pattern', {
          patternId: recommendation.pattern.id,
          error: (error as Error).message,
        });
      }
    }

    const duration = Date.now() - startTime;
    structuredLogger.debug('search-mediator', 'Fuzzy refinement completed', {
      patternsProcessed: processedCount,
      durationMs: duration,
    });

    return recommendations;
  }

  /**
   * Calculate contextual fit
   */
  private calculateContextualFit(
    pattern: DetailedPattern,
    request: PatternRequest
  ): number {
    let fit = 0.5;

    if (request.programmingLanguage) {
      const lang = request.programmingLanguage;
      const hasLanguageExamples = pattern.tags.some((tag) =>
        tag.toLowerCase().includes(lang.toLowerCase().slice(0, 3))
      );
      fit += hasLanguageExamples ? 0.3 : -0.1;
    }

    if (
      request.query.toLowerCase().includes('create') ||
      request.query.toLowerCase().includes('factory')
    ) {
      if (pattern.category.toLowerCase() === 'creational') {
        fit += 0.2;
      }
    }

    if (
      request.query.split(' ').length <= 3 &&
      pattern.complexity.toLowerCase() === 'low'
    ) {
      fit += 0.1;
    }

    return Math.max(0, Math.min(1, fit));
  }

  /**
   * Calculate keyword match strength
   */
  private calculateKeywordStrength(supportingReasons: string[]): number {
    if (!supportingReasons || supportingReasons.length === 0) return 0.3;

    const keywordReasons = supportingReasons.filter(
      (reason) =>
        reason.toLowerCase().includes('contains') ||
        reason.toLowerCase().includes('matches') ||
        reason.toLowerCase().includes('keyword')
    );

    return Math.min(1, keywordReasons.length * 0.2 + 0.3);
  }

  /**
   * Build cache key for request
   */
  private buildCacheKey(request: PatternRequest): string {
    return `search:${request.query}:${JSON.stringify({
      categories: request.categories?.sort(),
      maxResults: request.maxResults,
      programmingLanguage: request.programmingLanguage,
    })}`;
  }
}
