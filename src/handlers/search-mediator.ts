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

export type SearchStrategy = 'keyword' | 'semantic' | 'hybrid';

/**
 * Partial config override applied per-call. Each non-undefined field
 * replaces the base config value. Used by `searchByType` to route between
 * strategies without mutating the mediator's base config.
 */
export type SearchConfigOverride = Partial<SearchMediatorConfig>;

export interface TypedSearchResult {
  recommendations: PatternRecommendation[];
  searchTypeUsed: SearchStrategy;
  degraded: boolean;
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
  private readonly config: SearchMediatorConfig;

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
   * Search with an explicit strategy (keyword, semantic, or hybrid).
   * Used by MCP search_patterns to honor searchType.
   *
   * The strategy is applied via a per-call config override, so the mediator's
   * base config is never mutated and concurrent calls are race-free.
   */
  async searchByType(
    request: PatternRequest,
    searchType: SearchStrategy
  ): Promise<TypedSearchResult> {
    const strategyOverride = this.resolveStrategyConfig(searchType);
    // Resolve against base config: base flags always win over strategy default
    // when they would weaken the base configuration (e.g. useHybridSearch=false).
    // This preserves the user's global flag choice while still routing handlers.
    const effectiveOverride = this.applyBaseConfigConstraints(strategyOverride);

    try {
      const recommendations = await this.search(request, effectiveOverride);
      return {
        recommendations,
        searchTypeUsed: searchType,
        degraded: false,
      };
    } catch (error) {
      structuredLogger.warn('search-mediator', 'Typed search failed, falling back to keyword', {
        searchType,
        error: (error as Error).message,
      });

      const keywordOnlyOverride: SearchConfigOverride = {
        useSemanticSearch: false,
        useKeywordSearch: true,
        useHybridSearch: this.config.useHybridSearch,
      };

      const fallback = await this.search(request, keywordOnlyOverride);
      return {
        recommendations: fallback,
        searchTypeUsed: 'keyword',
        degraded: true,
      };
    }
  }

  private resolveStrategyConfig(searchType: SearchStrategy): SearchConfigOverride {
    switch (searchType) {
      case 'keyword':
        return {
          useSemanticSearch: false,
          useKeywordSearch: true,
          useHybridSearch: false,
        };
      case 'semantic':
        return {
          useSemanticSearch: true,
          useKeywordSearch: false,
          useHybridSearch: false,
        };
      case 'hybrid':
      default:
        return {
          useSemanticSearch: true,
          useKeywordSearch: true,
          useHybridSearch: true,
        };
    }
  }

  /**
   * Apply base-config constraints to a strategy override. If the base config
   * disables a feature, the strategy cannot re-enable it for this call.
   * Other fields (TTL, maxResults) are taken as-is from the strategy.
   */
  private applyBaseConfigConstraints(
    strategyOverride: SearchConfigOverride
  ): SearchConfigOverride {
    const baseHybrid = this.config.useHybridSearch;
    const overrideHybrid = strategyOverride.useHybridSearch;
    const resolvedHybrid = overrideHybrid === undefined ? baseHybrid : overrideHybrid && baseHybrid;

    return {
      ...strategyOverride,
      useHybridSearch: resolvedHybrid,
      useSemanticSearch: strategyOverride.useSemanticSearch ?? this.config.useSemanticSearch,
      useKeywordSearch: strategyOverride.useKeywordSearch ?? this.config.useKeywordSearch,
    };
  }

  /**
   * Execute a pattern search request
   * Coordinates all search handlers and returns recommendations
   */
  async search(
    request: PatternRequest,
    override: SearchConfigOverride = {}
  ): Promise<PatternRecommendation[]> {
    const result = await this.searchSafe(request, override);
    if (isOk(result)) {
      return result.value;
    }
    structuredLogger.error('search-mediator', 'Search failed', result.error);
    return [];
  }

  /**
   * Safe version of search that returns a Result type.
   * Accepts an optional config override applied on top of the base config.
   */
  async searchSafe(
    request: PatternRequest,
    override: SearchConfigOverride = {}
  ): Promise<Result<PatternRecommendation[]>> {
    const startTime = Date.now();
    const effectiveConfig: SearchMediatorConfig = { ...this.config, ...override };

    try {
      // Check cache first
      const cacheKey = this.buildCacheKey(request, effectiveConfig);
      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult) {
        structuredLogger.debug('search-mediator', 'Cache hit', {
          query: request.query.substring(0, 50),
          resultsCount: (cachedResult as PatternRecommendation[]).length,
        });
        return ok(cachedResult as PatternRecommendation[]);
      }

      // Perform matching
      const matches = await this.performMatching(request, effectiveConfig);

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
      if (effectiveConfig.useFuzzyRefinement) {
        recommendations = this.applyFuzzyRefinement(recommendations, request, effectiveConfig);
      }

      // Sort and limit results
      recommendations.sort((a, b) => b.confidence - a.confidence);
      const finalResults = recommendations.slice(
        0,
        request.maxResults ?? effectiveConfig.maxResults
      );

      // Cache results
      this.cache.set(cacheKey, finalResults, effectiveConfig.cacheResultsTTL);

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
   * Perform pattern matching using configured strategies.
   * Uses the provided effective config (base + override) instead of instance state.
   */
  private async performMatching(
    request: PatternRequest,
    effectiveConfig: SearchMediatorConfig
  ): Promise<MatchResult[]> {
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

    if (effectiveConfig.useSemanticSearch) {
      searchPromises.push(
        this.semanticHandler.search(request).then((matches) =>
          this.hybridCombiner.applySemanticWeight(matches, alphaResult.semanticAlpha)
        )
      );
    }

    if (effectiveConfig.useKeywordSearch) {
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
    if (effectiveConfig.useHybridSearch && allMatches.length > 0) {
      return this.hybridCombiner.combineMatches(allMatches, alphaResult);
    }

    return allMatches;
  }

  /**
   * Apply fuzzy refinement to recommendations
   */
  private applyFuzzyRefinement(
    recommendations: PatternRecommendation[],
    request: PatternRequest,
    effectiveConfig: SearchMediatorConfig = this.config,
  ): PatternRecommendation[] {
    const startTime = Date.now();
    let processedCount = 0;
    let ruleFiringsCount = 0;
    let totalConfidenceDelta = 0;
    const ruleCounts: Record<string, number> = {};

    for (const recommendation of recommendations) {
      try {
        const pattern = recommendation.pattern;
        const detailedPattern = this.recommendationBuilder.getDetailedPattern(
          pattern.id
        );

        if (!detailedPattern) continue;

        // Calculate contextual fit
        const contextualFit = this.calculateContextualFit(detailedPattern, request);

        // Capture pre-fuzzy confidence so downstream consumers can compare
        // raw hybrid score vs the fuzzy-refined score on the same record.
        const originalConfidence = recommendation.confidence;

        // Decompose the blended hybrid confidence into its semantic and keyword
        // components so the fuzzy engine does not double-count the same value
        // inside the smart-default rule. When the underlying MatchResult is
        // reachable, use its raw scores. Otherwise fall back to alpha-deconvolved
        // values from the blended confidence.
        const { semanticComponent, keywordComponent } = this.decomposeHybridScore(
          recommendation,
          effectiveConfig,
        );

        // Prepare fuzzy input
        const fuzzyInput = {
          semanticSimilarity: semanticComponent,
          keywordMatchStrength: keywordComponent,
          patternComplexity: detailedPattern.complexity || 'Medium',
          contextualFit,
          programmingLanguage: request.programmingLanguage,
          patternId: pattern.id,
          originalScore: originalConfidence,
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
        recommendation.justification.originalConfidence = originalConfidence;
        recommendation.justification.fuzzyInputFingerprint = {
          semanticSimilarity: semanticComponent,
          keywordMatchStrength: keywordComponent,
          contextualFit,
          patternComplexity: detailedPattern.complexity || 'Medium',
        };

        // Accumulate telemetry
        ruleFiringsCount += fuzzyResult.ruleFirings.length;
        totalConfidenceDelta += defuzzResult.crispValues.relevance - originalConfidence;
        for (const firing of fuzzyResult.ruleFirings) {
          ruleCounts[firing.rule] = (ruleCounts[firing.rule] ?? 0) + 1;
        }
        processedCount++;
      } catch (error) {
        structuredLogger.warn('search-mediator', 'Fuzzy refinement failed for pattern', {
          patternId: recommendation.pattern.id,
          error: (error as Error).message,
        });
      }
    }

    const duration = Date.now() - startTime;
    const avgConfidenceDelta = processedCount > 0
      ? totalConfidenceDelta / processedCount
      : 0;

    structuredLogger.info('search-mediator', 'Fuzzy refinement telemetry', {
      patternsProcessed: processedCount,
      ruleFiringsCount,
      avgConfidenceDelta: Number(avgConfidenceDelta.toFixed(4)),
      rulesFiredDistribution: ruleCounts,
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
   * Decompose the blended hybrid confidence into its semantic and keyword
   * components for the fuzzy engine. When the underlying MatchResult exposes
   * raw semanticScore/keywordScore, use those directly. Otherwise fall back
   * to an alpha-deconvolution that respects the configured hybrid weights.
   * This prevents the smart-default rule from double-counting the blended
   * confidence as if it were an independent semantic signal.
   */
  private decomposeHybridScore(
    recommendation: PatternRecommendation,
    effectiveConfig: SearchMediatorConfig,
  ): { semanticComponent: number; keywordComponent: number } {
    const blended = recommendation.confidence;
    const semanticScore = recommendation.semanticScore;
    const keywordScore = recommendation.keywordScore;

    if (
      typeof semanticScore === 'number' &&
      typeof keywordScore === 'number' &&
      semanticScore + keywordScore > 0
    ) {
      return {
        semanticComponent: Math.min(1, Math.max(0, semanticScore)),
        keywordComponent: Math.min(1, Math.max(0, keywordScore)),
      };
    }

    const alpha = effectiveConfig.useHybridSearch ? 0.7 : 1.0;
    const semanticComponent = Math.min(1, Math.max(0, blended * alpha));
    const keywordComponent = Math.min(1, Math.max(0, blended * (1 - alpha)));

    return { semanticComponent, keywordComponent };
  }

  /**
   * Build cache key for request, including the effective config so that
   * different strategies don't share cache entries.
   */
  private buildCacheKey(request: PatternRequest, effectiveConfig: SearchMediatorConfig): string {
    return `search:${request.query}:${JSON.stringify({
      categories: request.categories?.sort(),
      maxResults: request.maxResults,
      programmingLanguage: request.programmingLanguage,
      useSemantic: effectiveConfig.useSemanticSearch,
      useKeyword: effectiveConfig.useKeywordSearch,
      useHybrid: effectiveConfig.useHybridSearch,
    })}`;
  }
}
