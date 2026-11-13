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
import type { PatternRequest, MatchResult } from '../types/search-types.js';

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
 * Weight of the fuzzy relevance in the composite ranking score. The search
 * confidence stays dominant because it is the only signal that discriminates
 * ranking positions inside one query; the fuzzy relevance refines it with
 * context, complexity and keyword/semantic agreement.
 *
 * Settled by measurement (`bun run calibrate-search`: 710 patterns, 48 queries
 * over the name / name+category / description / applicability tiers). MRR@5 per
 * weight with the pipeline as shipped (score every candidate, cut afterwards),
 * against the confidence-only baseline of 0.802:
 *
 *   0.00 -> 0.802   0.35 -> 0.809   0.80 -> 0.838   1.00 -> 0.817
 *
 * 0.80 is the measured best on both MRR and P@5 (0.179). Read it as the top of
 * the observed plateau, not a law: the curve is not smooth (0.65 sits at 0.827)
 * and the sample is 48 catalog-derived queries, so re-run the harness whenever
 * the rule base, the recovery pass or the retrieval depth changes.
 *
 * The weight only pays while the composite sees candidates the confidence cut
 * would drop: with the old cut-first order the same 0.80 scored 0.813, i.e. the
 * cut, not the weight, was capping the signal. Re-check the weight when query
 * embeddings make the semantic dimension available — that is the signal which
 * can reorder candidates for reasons the lexicon does not explain.
 */
export const FUZZY_RANK_WEIGHT = 0.8;


/**
 * Composite ranking score: the search confidence stays dominant because it is
 * the only signal that separates positions inside one query; the fuzzy
 * relevance refines it with context, complexity and signal agreement.
 *
 * Extracted so the calibration harness measures exactly the formula production
 * uses instead of a copy of it. The weight is a parameter here and a constant
 * at the call site; it is settled by measurement, not by configuration.
 */
export function computeCompositeScore(
  confidence: number,
  fuzzyRelevance: number,
  weight: number = FUZZY_RANK_WEIGHT
): number {
  const boundedWeight = Math.min(Math.max(weight, 0), 1);
  return (1 - boundedWeight) * confidence + boundedWeight * fuzzyRelevance;
}

/** Canonical spellings of the languages accepted in pattern tags. */
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  kt: 'kotlin',
  rs: 'rust',
  golang: 'go',
  cs: 'csharp',
  'c#': 'csharp',
  dotnet: 'csharp',
  'c++': 'cpp',
  gpp: 'cpp',
};

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
      const { recommendations, degraded } = await this.executeSearch(request, effectiveOverride);
      return {
        recommendations,
        searchTypeUsed: searchType,
        degraded,
      };
    } catch (error) {
      structuredLogger.warn('search-mediator', 'Typed search failed, falling back to keyword', {
        searchType,
        error: (error as Error).message,
      });

      const keywordOnlyOverride: SearchConfigOverride = {
        useSemanticSearch: false,
        useKeywordSearch: true,
        useHybridSearch: false,
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
    try {
      const { recommendations } = await this.executeSearch(request, override);
      return ok(recommendations);
    } catch (error) {
      return err(error as Error);
    }
  }

  /**
   * Run the full search pipeline and report whether any enabled channel
   * failed. Throws only when every enabled channel failed, so callers can
   * fall back. Degraded results are never cached, otherwise a transient
   * vector-store outage would be served from cache after recovery.
   */
  private async executeSearch(
    request: PatternRequest,
    override: SearchConfigOverride
  ): Promise<{ recommendations: PatternRecommendation[]; degraded: boolean }> {
    const startTime = Date.now();
    const effectiveConfig: SearchMediatorConfig = { ...this.config, ...override };

    try {
      const cacheKey = this.buildCacheKey(request, effectiveConfig);
      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult) {
        structuredLogger.debug('search-mediator', 'Cache hit', {
          query: request.query.substring(0, 50),
          resultsCount: (cachedResult as PatternRecommendation[]).length,
        });
        return { recommendations: cachedResult as PatternRecommendation[], degraded: false };
      }

      const { matches, degraded } = await this.performMatching(request, effectiveConfig);

      // The applicability index is not a second retriever any more. Its candidates
      // were admitted into the pool with a manufactured confidence, and
      // `bun run calibrate-search` measured the admission as inert: removing the
      // recovered candidates left MRR@5 identical at every weight and on every
      // tier, while three of them did occupy returned slots. The index still
      // earns its place through the fuzzy applicability dimension below, which
      // lifts the applicability tier from 0.292 to 0.392.
      const applicability = effectiveConfig.useKeywordSearch
        ? this.keywordHandler.applicabilityScores(request.query)
        : new Map<string, number>();

      if (matches.length === 0) {
        structuredLogger.warn('search-mediator', 'No matches found', {
          query: request.query,
          degraded,
        });
        return { recommendations: [], degraded };
      }

      // The handlers apply the floor they were constructed with, so a per-call
      // override would otherwise be silently ignored. Enforcing it here makes
      // the override mean what it says; the handler filter stays as a fast path.
      const recommendations = this.recommendationBuilder
        .buildRecommendations(matches, request)
        .filter((recommendation) => recommendation.confidence >= effectiveConfig.minConfidence);

      const requested = request.maxResults ?? effectiveConfig.maxResults;

      recommendations.sort((a, b) => b.confidence - a.confidence);
      // Score every candidate the retrievers and the recovery pass produced, and
      // cut only afterwards. Cutting first left the fuzzy pass permuting records
      // the confidence ranking had already chosen: measured MRR@5 0.825 against
      // 0.827 when the composite sees the whole candidate pool, and 0.838 only
      // when the caller asks for enough results to make the retrievers dig
      // deeper. The candidates are already in memory and already scored, so
      // scoring them costs arithmetic, not I/O.
      const finalResults = effectiveConfig.useFuzzyRefinement
        ? recommendations.slice()
        : recommendations.slice(0, requested);

      // The fuzzy pass refines the ranking through a composite score, and it
      // runs over a window wider than the caller asked for so evidence can
      // promote a record the confidence cut would otherwise have removed. The
      // pre-fuzzy confidence stays untouched for consumers that report it; only
      // the composite score reflects the refinement.
      if (effectiveConfig.useFuzzyRefinement) {
        this.applyFuzzyRefinement(finalResults, request, effectiveConfig, applicability);
        for (const rec of finalResults) {
          const fuzzyRelevance = rec.justification.fuzzyRelevance;
          if (typeof fuzzyRelevance !== 'number') continue;
          rec.score = computeCompositeScore(rec.confidence, fuzzyRelevance);
        }
        finalResults.sort((a, b) => (b.score ?? b.confidence) - (a.score ?? a.confidence));
        finalResults.splice(requested);
      }

      if (!degraded) {
        this.cache.set(cacheKey, finalResults, effectiveConfig.cacheResultsTTL);
      }

      structuredLogger.info('search-mediator', 'Search completed', {
        query: request.query.substring(0, 50),
        matchesFound: matches.length,
        recommendationsBuilt: recommendations.length,
        finalResultsCount: finalResults.length,
        degraded,
        durationMs: Date.now() - startTime,
      });

      return { recommendations: finalResults, degraded };
    } catch (error) {
      structuredLogger.error('search-mediator', 'Search failed', error as Error, {
        query: request.query,
        durationMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Perform pattern matching using configured strategies.
   * Uses the provided effective config (base + override) instead of instance state.
   *
   * Each channel reports failure through its Result instead of an empty list,
   * so an outage is distinguishable from "no hits". `degraded` is true when at
   * least one enabled channel failed; if all of them failed the error is thrown.
   */
  private async performMatching(
    request: PatternRequest,
    effectiveConfig: SearchMediatorConfig
  ): Promise<{ matches: MatchResult[]; degraded: boolean }> {
    const alphaResult = this.hybridCombiner.calculateAlpha(request.query);

    structuredLogger.debug('search-mediator', 'Dynamic alpha calculated', {
      queryType: alphaResult.queryType,
      semanticAlpha: alphaResult.semanticAlpha.toFixed(3),
      keywordAlpha: alphaResult.keywordAlpha.toFixed(3),
    });

    const channels: Array<Promise<{ name: string; result: Result<MatchResult[]> }>> = [];

    if (effectiveConfig.useSemanticSearch) {
      const semanticWeight = effectiveConfig.useHybridSearch ? alphaResult.semanticAlpha : 1.0;
      channels.push(
        this.semanticHandler.searchSafe(request).then((result) => ({
          name: 'semantic',
          result: isOk(result)
            ? ok(this.hybridCombiner.applySemanticWeight(result.value, semanticWeight))
            : result,
        }))
      );
    }

    if (effectiveConfig.useKeywordSearch) {
      const keywordWeight = effectiveConfig.useHybridSearch ? alphaResult.keywordAlpha : 1.0;
      channels.push(
        this.keywordHandler.searchSafe(request).then((result) => ({
          name: 'keyword',
          result: isOk(result)
            ? ok(this.hybridCombiner.applyKeywordWeight(result.value, keywordWeight))
            : result,
        }))
      );
    }

    const outcomes = await Promise.all(channels);
    const allMatches: MatchResult[] = [];
    const failures: Error[] = [];

    for (const { name, result } of outcomes) {
      if (isOk(result)) {
        allMatches.push(...result.value);
      } else {
        failures.push(result.error);
        structuredLogger.warn('search-mediator', 'Search channel failed', {
          channel: name,
          error: result.error.message,
        });
      }
    }

    if (outcomes.length > 0 && failures.length === outcomes.length) {
      throw new Error(
        `All search channels failed: ${failures.map((e) => e.message).join('; ')}`
      );
    }

    const degraded = failures.length > 0;

    if (allMatches.length === 0) {
      structuredLogger.warn('search-mediator', 'No matches, trying broad search');
      const broadMatches = await this.keywordHandler.broadSearch(request);
      allMatches.push(...broadMatches);
    }

    if (effectiveConfig.useHybridSearch && allMatches.length > 0) {
      return { matches: this.hybridCombiner.combineMatches(allMatches, alphaResult), degraded };
    }

    return { matches: allMatches, degraded };
  }

  /**
   * Apply fuzzy refinement to recommendations
   */
  private applyFuzzyRefinement(
    recommendations: PatternRecommendation[],
    request: PatternRequest,
    effectiveConfig: SearchMediatorConfig = this.config,
    applicability: ReadonlyMap<string, number> = new Map()
  ): void {
    const startTime = Date.now();
    let processedCount = 0;
    let ruleFiringsCount = 0;
    let totalConfidenceDelta = 0;
    const ruleCounts: Record<string, number> = {};

    for (const recommendation of recommendations) {
      try {
        const pattern = recommendation.pattern;
        // Calculate contextual fit
        const contextualFit = this.calculateContextualFit(pattern, request);

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
          applicabilityMatch: applicability.get(pattern.id),
          patternComplexity: pattern.complexity || 'Medium',
          contextualFit,
          programmingLanguage: request.programmingLanguage,
          patternId: pattern.id,
          originalScore: originalConfidence,
        };

        // Apply fuzzy inference
        const fuzzyResult = this.fuzzyInferenceEngine.evaluatePattern(fuzzyInput);

        // Apply defuzzification
        const defuzzResult = this.fuzzyDefuzzificationEngine.defuzzifyPatternRelevanceAnchored(
          fuzzyResult.fuzzyScore
        );

        // Publish the fuzzy outcome on its own fields; confidence keeps the
        // ranking score, so no downstream consumer has to undo anything.
        recommendation.justification.fuzzyRelevance = defuzzResult.crispValues.relevance;
        recommendation.justification.fuzzyReasoning = fuzzyResult.reasoning;
        recommendation.justification.fuzzyConfidence = defuzzResult.confidence;
        recommendation.justification.originalConfidence = originalConfidence;
        recommendation.justification.fuzzyInputFingerprint = {
          semanticSimilarity: semanticComponent,
          keywordMatchStrength: keywordComponent,
          contextualFit,
          patternComplexity: pattern.complexity || 'Medium',
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
  }

  /**
   * Language tokens are matched whole. The previous 3-character prefix test
   * matched "governance" for Go, "scalability" for Scala and 610 of the 710
   * catalog patterns for C.
   */
  private languageTokens(tags: readonly string[]): Set<string> {
    const tokens = new Set<string>();
    for (const tag of tags) {
      for (const raw of tag.toLowerCase().split(/[^a-z0-9#+]+/)) {
        if (!raw) continue;
        tokens.add(raw);
        const alias = LANGUAGE_ALIASES[raw];
        if (alias) tokens.add(alias);
      }
    }
    return tokens;
  }

  /**
   * Calculate contextual fit
   */
  private calculateContextualFit(
    pattern: PatternRecommendation['pattern'],
    request: PatternRequest
  ): number {
    // Baseline 0.4 leaves room to fall into the "poor" set (<= 0.15) when the
    // requested language is demonstrably absent; the old 0.5 baseline could
    // only ever produce values in [0.4, 1.0], so "poor" never fired.
    let fit = 0.4;
    const requestedLanguage = request.programmingLanguage?.trim().toLowerCase();
    if (requestedLanguage) {
      const canonical = LANGUAGE_ALIASES[requestedLanguage] ?? requestedLanguage;
      const hasLanguageExamples = this.languageTokens(pattern.tags ?? []).has(canonical);
      fit += hasLanguageExamples ? 0.35 : -0.4;
    }
    const lowerQuery = request.query.toLowerCase();
    if (
      (lowerQuery.includes('create') || lowerQuery.includes('factory')) &&
      pattern.category.toLowerCase() === 'creational'
    ) {
      fit += 0.2;
    }
    if (
      request.query.split(/\s+/).filter(Boolean).length <= 3 &&
      pattern.complexity.toLowerCase() === 'low'
    ) {
      fit += 0.1;
    }
    return Math.max(0, Math.min(1, fit));
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

    // Hybrid path: both signals present.
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

    // Keyword-only path: keywordScore is the normalized BM25 score [0,1].
    if (typeof keywordScore === 'number' && keywordScore > 0) {
      return {
        semanticComponent: 0,
        keywordComponent: Math.min(1, Math.max(0, keywordScore)),
      };
    }

    // Semantic-only path: semanticScore is the normalized vector similarity [0,1].
    if (typeof semanticScore === 'number' && semanticScore > 0) {
      return {
        semanticComponent: Math.min(1, Math.max(0, semanticScore)),
        keywordComponent: 0,
      };
    }

    // Fallback: neither score is meaningful. Use the blended confidence as
    // semantic and 0 for keyword so the fuzzy logic still gets a defensible input.
    const alpha = effectiveConfig.useHybridSearch ? 0.7 : 1.0;
    const semanticComponent = Math.min(1, Math.max(0, blended * alpha));
    const keywordComponent = Math.min(1, Math.max(0, blended * (1 - alpha)));

    return { semanticComponent, keywordComponent };
  }

  /**
   * Build cache key for request, including the effective config so that
   * different strategies don't share cache entries.
   */
  /**
   * Every input that changes the response belongs in the key. `searchSafe` takes
   * a per-call config override, so leaving any of these out lets the second
   * caller receive the first caller's answer — fuzzy-ranked records when it asked
   * for no refinement, or an unfiltered set when it raised the confidence floor,
   * with nothing in the payload revealing the swap.
   */
  private buildCacheKey(request: PatternRequest, effectiveConfig: SearchMediatorConfig): string {
    return `search:${request.query}:${JSON.stringify({
      categories: request.categories?.sort(),
      // The effective value, not the request field: an override can set the
      // limit while the request leaves it undefined.
      maxResults: request.maxResults ?? effectiveConfig.maxResults,
      programmingLanguage: request.programmingLanguage,
      minConfidence: effectiveConfig.minConfidence,
      useSemantic: effectiveConfig.useSemanticSearch,
      useKeyword: effectiveConfig.useKeywordSearch,
      useHybrid: effectiveConfig.useHybridSearch,
      useFuzzyRefinement: effectiveConfig.useFuzzyRefinement,
    })}`;
  }
}
