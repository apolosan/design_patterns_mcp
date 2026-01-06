/**
 * Pattern Matcher Service for Design Patterns MCP Server
 * Matches user queries to appropriate design patterns using multiple strategies
 */
import { DatabaseManager } from './database-manager.js';
import { VectorOperationsService } from './vector-operations.js';
import { PatternRecommendation, ImplementationGuidance, AlternativePattern } from '../models/recommendation.js';
import { PatternAnalyzer } from './pattern-analyzer.js';
import { CacheService } from './cache.js';
import { structuredLogger } from '../utils/logger.js';
import { parseTags, parseArrayProperty } from '../utils/parse-tags.js';
import { EmbeddingServiceAdapter } from '../adapters/embedding-service-adapter.js';
import { FuzzyInferenceEngine } from './fuzzy-inference.js';
import { FuzzyDefuzzificationEngine } from './fuzzy-defuzzification.js';
import { PatternMembershipFunctions } from './fuzzy-membership.js';

// Define CodeAnalysisResult interface locally since it's not exported in compiled JS
interface CodeAnalysisResult {
  identifiedPatterns: {
    pattern: string;
    category: string;
    confidence: number;
    location?: {
      line?: number;
      column?: number;
      snippet?: string;
    };
    indicators: string[];
  }[];
  suggestedPatterns: {
    pattern: string;
    reason: string;
    confidence: number;
  }[];
  improvements: string[];
  antiPatterns?: {
    pattern: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }[];
}

interface PatternMatcherConfig {
  maxResults: number;
  minConfidence: number;
  useSemanticSearch: boolean;
  useKeywordSearch: boolean;
  useHybridSearch: boolean;
  semanticWeight: number;
  keywordWeight: number;
  useFuzzyRefinement?: boolean;
}

// Local interfaces for pattern matching
interface PatternSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  complexity?: string;
  tags?: string[];
}

interface PatternRequest {
  id: string;
  query: string;
  categories?: string[];
  maxResults?: number;
  programmingLanguage?: string;
}

interface MatchResult {
  pattern: PatternSummary;
  confidence: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
  reasons: string[];
  metadata: {
    semanticScore?: number;
    keywordScore?: number;
    finalScore: number;
  };
}

interface DetailedPattern {
  id: string;
  name: string;
  category: string;
  description: string;
  when_to_use: string[];
  benefits: string[];
  drawbacks: string[];
  use_cases: string[];
  complexity: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface PatternImplementation {
  id: string;
  language: string;
  code: string;
  explanation: string;
}

interface QueryAnalysis {
  queryLength: number;
  wordCount: number;
  technicalTermCount: number;
  exploratoryScore: number;
  specificityScore: number;
  hasCodeSnippet: boolean;
  entropy: number;
}

interface DynamicAlphaResult {
  semanticAlpha: number;
  keywordAlpha: number;
  queryType: 'exploratory' | 'specific' | 'balanced';
  confidence: number;
  analysis: QueryAnalysis;
}

// Technical keywords that suggest more specific/semantic search
const TECHNICAL_KEYWORDS = [
  'pattern', 'architecture', 'design', 'algorithm', 'data', 'structure',
  'interface', 'abstract', 'factory', 'singleton', 'observer', 'strategy',
  'decorator', 'adapter', 'bridge', 'proxy', 'facade', 'flyweight', 'chain',
  'command', 'mediator', 'memento', 'state', 'template', 'visitor', 'iterator'
];

// Query type indicators
const EXPLORATORY_WORDS = ['best', 'good', 'how', 'what', 'why', 'explain', 'learn', 'understand'];
const SPECIFIC_WORDS = ['implement', 'code', 'example', 'use', 'apply', 'create', 'write'];

/**
 * Dynamic Alpha Tuner - Implements Dynamic Alpha Tuning for Hybrid Retrieval (2025)
 * Adjusts the weight between semantic and keyword search based on query characteristics
 * Based on research: "DAT: Dynamic Alpha Tuning for Hybrid Retrieval in RAG" (2025)
 */
class DynamicAlphaTuner {
  calculateAlpha(query: string): DynamicAlphaResult {
    const analysis = this.analyzeQuery(query);
    const { semanticAlpha, keywordAlpha, queryType, confidence } = this.computeAlphaFromAnalysis(analysis);

    return {
      semanticAlpha,
      keywordAlpha,
      queryType,
      confidence,
      analysis,
    };
  }

  private analyzeQuery(query: string): QueryAnalysis {
    const normalizedQuery = query.toLowerCase();
    const words = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
    const queryLength = query.length;
    const wordCount = words.length;

    const technicalTermCount = words.filter(word =>
      TECHNICAL_KEYWORDS.some(keyword => word.includes(keyword))
    ).length;

    const exploratoryScore = EXPLORATORY_WORDS.reduce((score, word) => {
      return score + (normalizedQuery.includes(word) ? 0.15 : 0);
    }, 0);

    const specificityScore = SPECIFIC_WORDS.reduce((score, word) => {
      return score + (normalizedQuery.includes(word) ? 0.12 : 0);
    }, 0);

    const hasCodeSnippet = /`[^`]+`|\{[^{]+\}|\([^(]+\)/.test(query);

    const uniqueChars = new Set(query).size;
    const entropy = uniqueChars / Math.max(queryLength, 1);

    return {
      queryLength,
      wordCount,
      technicalTermCount,
      exploratoryScore: Math.min(exploratoryScore, 0.5),
      specificityScore: Math.min(specificityScore, 0.5),
      hasCodeSnippet,
      entropy,
    };
  }

  private computeAlphaFromAnalysis(analysis: QueryAnalysis): Omit<DynamicAlphaResult, 'analysis'> {
    let semanticAlpha = 0.5;
    let keywordAlpha = 0.5;
    let queryType: 'exploratory' | 'specific' | 'balanced' = 'balanced';
    let confidence = 0.5;

    if (analysis.wordCount <= 2 && analysis.specificityScore > 0.2) {
      semanticAlpha = 0.3;
      keywordAlpha = 0.7;
      queryType = 'specific';
      confidence = 0.7;
    } else if (analysis.wordCount > 5 && analysis.exploratoryScore > 0.2) {
      semanticAlpha = 0.7;
      keywordAlpha = 0.3;
      queryType = 'exploratory';
      confidence = 0.75;
    } else if (analysis.technicalTermCount > 0 && analysis.wordCount > 3) {
      semanticAlpha = 0.6;
      keywordAlpha = 0.4;
      queryType = 'exploratory';
      confidence = 0.65;
    } else if (analysis.hasCodeSnippet) {
      semanticAlpha = 0.4;
      keywordAlpha = 0.6;
      queryType = 'specific';
      confidence = 0.6;
    } else if (analysis.entropy > 0.6 && analysis.wordCount > 3) {
      semanticAlpha = 0.65;
      keywordAlpha = 0.35;
      queryType = 'exploratory';
      confidence = 0.55;
    } else {
      semanticAlpha = 0.5;
      keywordAlpha = 0.5;
      queryType = 'balanced';
      confidence = 0.5;
    }

    if (analysis.queryLength > 100) {
      semanticAlpha += 0.1;
      keywordAlpha -= 0.1;
    } else if (analysis.queryLength < 30) {
      semanticAlpha -= 0.15;
      keywordAlpha += 0.15;
    }

    const total = semanticAlpha + keywordAlpha;
    semanticAlpha = semanticAlpha / total;
    keywordAlpha = keywordAlpha / total;

    return {
      semanticAlpha: Math.max(0.1, Math.min(0.9, semanticAlpha)),
      keywordAlpha: Math.max(0.1, Math.min(0.9, keywordAlpha)),
      queryType,
      confidence: Math.min(0.9, confidence + (analysis.technicalTermCount * 0.05)),
    };
  }
}


export class PatternMatcher {
  private db: DatabaseManager;
  private vectorOps: VectorOperationsService;
  private config: PatternMatcherConfig;
  private patternAnalyzer: PatternAnalyzer;
  private embeddingAdapter: EmbeddingServiceAdapter | null = null;
  private cache: CacheService;
  private fuzzyInferenceEngine: FuzzyInferenceEngine;
  private fuzzyDefuzzificationEngine: FuzzyDefuzzificationEngine;
  private fuzzyMembershipFunctions: PatternMembershipFunctions;
  private dynamicAlphaTuner: DynamicAlphaTuner;

  constructor(
    db: DatabaseManager,
    vectorOps: VectorOperationsService,
    config: PatternMatcherConfig,
    cache?: CacheService
  ) {
    this.db = db;
    this.vectorOps = vectorOps;
    this.config = config;
    this.patternAnalyzer = new PatternAnalyzer();
    this.cache = cache ?? new CacheService();
    this.dynamicAlphaTuner = new DynamicAlphaTuner();

    // Initialize fuzzy logic components
    this.fuzzyMembershipFunctions = new PatternMembershipFunctions();
    this.fuzzyInferenceEngine = new FuzzyInferenceEngine();
    this.fuzzyDefuzzificationEngine = new FuzzyDefuzzificationEngine();

    // Embedding adapter will be initialized lazily in generateQueryEmbedding
  }

  /**
   * Find patterns matching a user request
   */
  async findMatchingPatterns(request: PatternRequest): Promise<PatternRecommendation[]> {
    const startTime = Date.now();

    try {
      structuredLogger.debug('pattern-matcher', 'Starting pattern matching', {
        query: request.query,
        useFuzzyRefinement: this.config.useFuzzyRefinement,
        config: this.config
      });
      // Check cache first
      const cacheKey = `pattern_match:${request.query}:${JSON.stringify({
        categories: request.categories?.sort(),
        maxResults: request.maxResults,
        programmingLanguage: request.programmingLanguage,
      })}`;
      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult) {
        structuredLogger.debug('pattern-matcher', 'Cache hit for pattern matching', {
          query: request.query,
          cacheKey,
          resultsCount: (cachedResult as PatternRecommendation[]).length
        });
        return cachedResult as PatternRecommendation[];
      }

      const matchingStartTime = Date.now();
      const matches = await this.performMatching(request);
      const matchingTime = Date.now() - matchingStartTime;

      const buildingStartTime = Date.now();
      let recommendations = this.buildRecommendations(matches, request);
      const buildingTime = Date.now() - buildingStartTime;

      // Apply fuzzy refinement if enabled
      const fuzzyStartTime = Date.now();
      if (this.config.useFuzzyRefinement) {
        structuredLogger.debug('pattern-matcher', 'Applying fuzzy refinement', {
          patternCount: recommendations.length,
          query: request.query
        });
        recommendations = this.applyFuzzyRefinement(recommendations, request);
      }
      const fuzzyTime = this.config.useFuzzyRefinement ? Date.now() - fuzzyStartTime : 0;

      // Sort by confidence and limit results
      const sortingStartTime = Date.now();
      recommendations.sort((a, b) => b.confidence - a.confidence);
      const finalResults = recommendations.slice(0, request.maxResults ?? this.config.maxResults);
      const sortingTime = Date.now() - sortingStartTime;

      // Cache the results for 30 minutes
      this.cache.set(cacheKey, finalResults, 1800000);

      const totalTime = Date.now() - startTime;

      structuredLogger.info('pattern-matcher', 'Pattern matching performance metrics', {
        query: request.query,
        totalTimeMs: totalTime,
        matchingTimeMs: matchingTime,
        buildingTimeMs: buildingTime,
        fuzzyTimeMs: fuzzyTime,
        sortingTimeMs: sortingTime,
        matchesFound: matches.length,
        recommendationsBuilt: recommendations.length,
        finalResultsCount: finalResults.length,
        semanticSearchEnabled: this.config.useSemanticSearch,
        keywordSearchEnabled: this.config.useKeywordSearch,
        hybridSearchEnabled: this.config.useHybridSearch,
        fuzzyRefinementEnabled: this.config.useFuzzyRefinement,
        avgConfidence: finalResults.length > 0
          ? (finalResults.reduce((sum, r) => sum + r.confidence, 0) / finalResults.length).toFixed(3)
          : '0.000'
      });

      return finalResults;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      structuredLogger.error('pattern-matcher', 'Pattern matching failed', error as Error, {
        query: request.query,
        processingTimeMs: totalTime
      });
      throw error;
    }
  }

  /**
   * Perform pattern matching using configured strategies
   */
  private async performMatching(request: PatternRequest): Promise<MatchResult[]> {
    const alphaResult = this.dynamicAlphaTuner.calculateAlpha(request.query);

    structuredLogger.debug('pattern-matcher', 'Dynamic Alpha Tuning applied', {
      query: request.query.substring(0, 50),
      queryType: alphaResult.queryType,
      semanticAlpha: alphaResult.semanticAlpha.toFixed(3),
      keywordAlpha: alphaResult.keywordAlpha.toFixed(3),
      confidence: alphaResult.confidence.toFixed(3),
    });

    const allMatches: MatchResult[] = [];
    let semanticWeight = this.config.semanticWeight;
    let keywordWeight = this.config.keywordWeight;

    if (this.config.useHybridSearch) {
      semanticWeight = alphaResult.semanticAlpha;
      keywordWeight = alphaResult.keywordAlpha;
    }

    // Semantic search
    if (this.config.useSemanticSearch) {
      const semanticMatches = await this.semanticSearch(request);
      semanticMatches.forEach(match => {
        match.confidence *= semanticWeight;
        match.metadata.finalScore = match.confidence;
      });
      allMatches.push(...semanticMatches);
    }

    // Keyword search
    if (this.config.useKeywordSearch) {
      const keywordMatches = await this.keywordSearch(request);
      keywordMatches.forEach(match => {
        match.confidence *= keywordWeight;
        match.metadata.finalScore = match.confidence;
      });
      allMatches.push(...keywordMatches);
    }

    // If no matches found, try a broader keyword search
    if (allMatches.length === 0) {
      structuredLogger.warn('pattern-matcher', 'No matches found, trying broader search');
      const broadMatches = await this.broadKeywordSearch(request);
      allMatches.push(...broadMatches);
    }

    // Hybrid search (combine results)
    if (this.config.useHybridSearch && allMatches.length > 0) {
      return this.combineMatches(allMatches, alphaResult);
    }

    return allMatches;
  }

  /**
   * Perform semantic search using vector similarity
   */
  private async semanticSearch(request: PatternRequest): Promise<MatchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(request.query);

      // Search for similar patterns
      const searchResults = this.vectorOps.searchSimilar(queryEmbedding, {
        categories: request.categories,
        minUsageCount: 0,
      });

      const matches = searchResults.map(result => ({
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

      return matches;
    } catch (error) {
      structuredLogger.error(
        'pattern-matcher',
        'Semantic search failed, falling back to keyword search',
        error as Error
      );
      // Fallback to keyword search if semantic fails
      return this.keywordSearch(request);
    }
  }

  /**
   * Perform keyword-based search
   */
  private async keywordSearch(request: PatternRequest): Promise<MatchResult[]> {
    try {
      const queryWords = await Promise.resolve(this.tokenizeQuery(request.query));
      const matches: MatchResult[] = [];

      // Build SQL query
      let sql = `
        SELECT id, name, category, description, complexity, tags
        FROM patterns
      `;
      const params: string[] = [];

      if (request.categories && request.categories.length > 0) {
        sql += ` WHERE category IN (${request.categories.map(() => '?').join(',')})`;
        params.push(...request.categories);
      }

      const patterns = this.db.query<{
        id: string;
        name: string;
        category: string;
        description: string;
        complexity: string;
        tags: string;
       }>(sql, params);

       for (const pattern of patterns) {
         const parsedTags = parseTags(pattern.tags);
         const score = this.calculateKeywordScore(queryWords, {
           id: pattern.id,
           name: pattern.name,
           category: pattern.category,
           description: pattern.description,
           complexity: pattern.complexity,
           tags: parsedTags,
         });
         const confidence = Math.min(score / 10, 0.99); // Normalize score, cap at 0.99

         if (confidence >= this.config.minConfidence) {
           const parsedPattern = {
             id: pattern.id,
             name: pattern.name,
             category: pattern.category,
             description: pattern.description,
             complexity: pattern.complexity,
             tags: parsedTags,
           };
           matches.push({
             pattern: parsedPattern,
             confidence,
             matchType: 'keyword' as const,
             reasons: this.generateKeywordReasons(queryWords, parsedPattern),
            metadata: {
              keywordScore: score,
              finalScore: confidence,
            },
          });
        }
      }

      return matches;
    } catch (error) {
      structuredLogger.error('pattern-matcher', 'Keyword search failed', error as Error);
      return [];
    }
  }

  /**
   * Perform broad keyword search (lower threshold, no category filter)
   */
  private async broadKeywordSearch(request: PatternRequest): Promise<MatchResult[]> {
    try {
      const queryWords = await Promise.resolve(this.tokenizeQuery(request.query));
      const matches: MatchResult[] = [];

      // Get all patterns (no category filter)
      const patterns = this.db.query<{
        id: string;
        name: string;
        category: string;
        description: string;
        complexity: string;
        tags: string;
      }>(`SELECT id, name, category, description, complexity, tags FROM patterns`);

      for (const pattern of patterns) {
        const parsedTags = parseTags(pattern.tags);
        const score = this.calculateKeywordScore(queryWords, {
          id: pattern.id,
          name: pattern.name,
          category: pattern.category,
          description: pattern.description,
          complexity: pattern.complexity,
          tags: parsedTags,
        });
        const confidence = Math.min(score / 10, 0.99);

        // Lower threshold for broad search
        if (confidence >= 0.01) {
          const parsedPattern = {
            id: pattern.id,
            name: pattern.name,
            category: pattern.category,
            description: pattern.description,
            complexity: pattern.complexity,
            tags: parsedTags,
          };
          matches.push({
            pattern: parsedPattern,
            confidence,
            matchType: 'keyword' as const,
            reasons: this.generateKeywordReasons(queryWords, parsedPattern),
            metadata: {
              keywordScore: score,
              finalScore: confidence,
            },
          });
        }
      }

      // Return top matches
      return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
    } catch (error) {
      structuredLogger.error('pattern-matcher', 'Broad keyword search failed', error as Error);
      return [];
    }
  }

  /**
    * Combine semantic and keyword matches using hybrid scoring
    */
    private combineMatches(matches: MatchResult[], alphaResult: DynamicAlphaResult): MatchResult[] {
      const patternMap = new Map<string, MatchResult[]>();

      for (const match of matches) {
        const existing = patternMap.get(match.pattern.id) ?? [];
        existing.push(match);
        patternMap.set(match.pattern.id, existing);
      }

      const combinedMatches: MatchResult[] = [];

      const semanticWeight = alphaResult?.semanticAlpha ?? this.config.semanticWeight;
      const keywordWeight = alphaResult?.keywordAlpha ?? this.config.keywordWeight;

      for (const [, patternMatches] of patternMap) {
        const semanticMatch = patternMatches.find(m => m.matchType === 'semantic');
        const keywordMatch = patternMatches.find(m => m.matchType === 'keyword');

        const semanticScore = semanticMatch?.metadata.semanticScore ?? 0;
        const keywordScoreRaw = keywordMatch?.metadata.keywordScore ?? 0;
        const keywordScore = Math.min(keywordScoreRaw / 10, 0.99);

        let finalScore = 0;
        if (semanticScore > 0 && keywordScore > 0) {
          finalScore = (semanticWeight * semanticScore + keywordWeight * keywordScore) /
                       (semanticWeight + keywordWeight);
        } else if (semanticScore > 0) {
          finalScore = semanticScore;
        } else if (keywordScore > 0) {
          finalScore = keywordScore;
        }

        finalScore = Math.min(Math.max(finalScore, 0), 1);

        const reasons = [...(semanticMatch?.reasons ?? []), ...(keywordMatch?.reasons ?? [])];

        combinedMatches.push({
          pattern: patternMatches[0].pattern,
          confidence: finalScore,
          matchType: 'hybrid' as const,
          reasons,
          metadata: {
            semanticScore,
            keywordScore,
            finalScore,
          },
        });
      }

      return combinedMatches;
    }

  /**
   * Apply fuzzy refinement to pattern recommendations
   */
  private applyFuzzyRefinement(
    recommendations: PatternRecommendation[],
    request: PatternRequest
  ): PatternRecommendation[] {
    const startTime = Date.now();
    let processedCount = 0;
    let failedCount = 0;
    const originalScores: number[] = [];
    const refinedScores: number[] = [];

    for (const recommendation of recommendations) {
      try {
        originalScores.push(recommendation.confidence);

        // Extract features for fuzzy evaluation
        const pattern = recommendation.pattern;
        const detailedPattern = this.getDetailedPattern(pattern.id);

        if (!detailedPattern) continue;

        // Calculate contextual fit based on programming language and other factors
        const contextualFit = this.calculateContextualFit(detailedPattern, request);

        // Prepare fuzzy input
        const fuzzyInput = {
          semanticSimilarity: recommendation.confidence, // Use current confidence as semantic score
          keywordMatchStrength: this.calculateKeywordStrength(recommendation.justification.supportingReasons),
          patternComplexity: detailedPattern.complexity || 'Medium',
          contextualFit,
          programmingLanguage: request.programmingLanguage,
          patternId: pattern.id,
          originalScore: recommendation.confidence
        };

        // Apply fuzzy inference
        const fuzzyResult = this.fuzzyInferenceEngine.evaluatePattern(fuzzyInput);

        // Apply defuzzification
        const defuzzResult = this.fuzzyDefuzzificationEngine.defuzzifyPatternRelevance(fuzzyResult.fuzzyScore);

        // Update recommendation with fuzzy-refined score
        const originalConfidence = recommendation.confidence;
        recommendation.confidence = defuzzResult.crispValues.relevance;
        recommendation.justification.fuzzyReasoning = fuzzyResult.reasoning;
        recommendation.justification.fuzzyConfidence = defuzzResult.confidence;

        refinedScores.push(recommendation.confidence);
        processedCount++;
        processedCount++;

        console.log(`🎯 Pattern ${pattern.id}: original=${originalConfidence.toFixed(3)}, fuzzy=${defuzzResult.crispValues.relevance.toFixed(3)}, rules=${fuzzyResult.ruleFirings.length}`);

        // Log significant changes
        const scoreChange = recommendation.confidence - originalConfidence;
        if (Math.abs(scoreChange) > 0.1) {
          structuredLogger.debug('pattern-matcher', 'Significant fuzzy refinement', {
            patternId: pattern.id,
            originalScore: originalConfidence.toFixed(3),
            refinedScore: recommendation.confidence.toFixed(3),
            change: scoreChange.toFixed(3),
            dominantRule: fuzzyResult.ruleFirings[0]?.rule.split(' → ')[0]
          });
        }

      } catch (error) {
        failedCount++;
        structuredLogger.warn('pattern-matcher', 'Fuzzy refinement failed for pattern', {
          patternId: recommendation.pattern.id,
          error: (error as Error).message
        });
        // Keep original recommendation if fuzzy refinement fails
      }
    }

    const processingTime = Date.now() - startTime;
    const avgProcessingTime = processedCount > 0 ? processingTime / processedCount : 0;
    const avgScoreChange = refinedScores.length > 0 && originalScores.length > 0
      ? refinedScores.reduce((a, b, i) => a + (b - originalScores[i]), 0) / refinedScores.length
      : 0;

    structuredLogger.info('pattern-matcher', 'Fuzzy refinement performance metrics', {
      patternsProcessed: processedCount,
      patternsFailed: failedCount,
      totalProcessingTimeMs: processingTime,
      avgProcessingTimePerPatternMs: avgProcessingTime.toFixed(2),
      avgScoreChange: avgScoreChange.toFixed(4),
      successRate: ((processedCount / recommendations.length) * 100).toFixed(1) + '%'
    });

    return recommendations;
  }

  /**
   * Calculate contextual fit based on programming language and other factors
   */
  private calculateContextualFit(pattern: DetailedPattern, request: PatternRequest): number {
    let fit = 0.5; // Base fit

    // Language compatibility
    if (request.programmingLanguage) {
      const lang = request.programmingLanguage;
      const hasLanguageExamples = pattern.tags.some(tag =>
        tag.toLowerCase().includes(lang.toLowerCase().slice(0, 3))
      );
      fit += hasLanguageExamples ? 0.3 : -0.1;
    }

    // Category relevance (creational patterns might be more relevant for object creation queries)
    if (request.query.toLowerCase().includes('create') || request.query.toLowerCase().includes('factory')) {
      if (pattern.category.toLowerCase() === 'creational') {
        fit += 0.2;
      }
    }

    // Complexity appropriateness (prefer simpler patterns for basic queries)
    if (request.query.split(' ').length <= 3 && pattern.complexity.toLowerCase() === 'low') {
      fit += 0.1;
    }

    return Math.max(0, Math.min(1, fit));
  }

  /**
   * Calculate keyword match strength from justification reasons
   */
  private calculateKeywordStrength(supportingReasons: string[]): number {
    if (!supportingReasons || supportingReasons.length === 0) return 0.3;

    // Count keyword-related reasons
    const keywordReasons = supportingReasons.filter(reason =>
      reason.toLowerCase().includes('contains') ||
      reason.toLowerCase().includes('matches') ||
      reason.toLowerCase().includes('keyword')
    );

    return Math.min(1, keywordReasons.length * 0.2 + 0.3);
  }

  /**
   * Build pattern recommendations from matches
   */
  private buildRecommendations(
    matches: MatchResult[],
    request: PatternRequest
  ): PatternRecommendation[] {
    const recommendations: PatternRecommendation[] = [];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const pattern = this.getDetailedPattern(match.pattern.id);

      if (pattern) {
        const recommendation: PatternRecommendation = {
          id: crypto.randomUUID(),
          requestId: request.id,
          pattern: {
            id: pattern.id,
            name: pattern.name,
            category: pattern.category,
            description: pattern.description,
            complexity: pattern.complexity,
            tags: pattern.tags,
          },
          confidence: match.confidence,
          rank: i + 1,
          justification: {
            primaryReason: match.reasons[0] || 'Pattern matches query requirements',
            supportingReasons: match.reasons.slice(1),
            problemFit: this.generateProblemFit(match, request),
            benefits: pattern.benefits || [],
            drawbacks: pattern.drawbacks || [],
          },
          implementation: this.generateImplementationGuidance(pattern, request),
          alternatives: this.findAlternatives(pattern.id, matches),
          context: {
            projectContext: this.extractProjectContext(request),
            teamContext: this.extractTeamContext(request),
            technologyFit: {
              fitScore: 0.8, // Simplified
              reasons: ['Good fit for the specified programming language'],
              compatibleTech: [request.programmingLanguage ?? 'typescript'],
              incompatibleTech: [],
              integrationRequirements: [],
            },
          },
        };

        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  /**
   * Generate query embedding using the same strategy as pattern embeddings
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      // Ensure adapter is initialized
      if (!this.embeddingAdapter) {
        this.embeddingAdapter = new EmbeddingServiceAdapter({
          cacheEnabled: true,
          cacheTTL: 3600000, // 1 hour
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

      // Use the embedding adapter to generate query embedding with the same strategy
      const embedding = await this.embeddingAdapter.generateEmbedding(query);

      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding generated');
      }

      return embedding;
    } catch (error) {
      structuredLogger.error(
        'pattern-matcher',
        'Failed to generate query embedding, using fallback',
        error as Error
      );

      // Fallback to simple hash-based embedding if the adapter fails
      return this.generateFallbackEmbedding(query);
    }
  }

  /**
   * Fallback embedding generation using simple hash (legacy behavior)
   */
  private generateFallbackEmbedding(query: string): number[] {
    const words = query.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0) as number[]; // Match all-MiniLM-L6-v2 dimensions

    // Create a simple hash-based embedding
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordHash = this.simpleHash(word);

      for (let j = 0; j < Math.min(word.length, 10); j++) {
        const charCode = word.charCodeAt(j);
        const position = (wordHash + j + i * 7) % embedding.length;
        // Improved algorithm to avoid zeros
        embedding[position] += (charCode / 255) * 0.5 + Math.sin(wordHash * j) * 0.3;
      }
    }

    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
    const normalizedEmbedding: number[] = embedding.map((val: number) => val / (norm || 1));

    // Cache the embedding for 1 hour
    this.cache.setEmbeddings(query, normalizedEmbedding, 3600000);

    return normalizedEmbedding;
  }

  /**
   * Simple hash function (same as generate-embeddings.ts)
   */
  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Tokenize query for keyword search
   */
  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordScore(queryWords: string[], pattern: PatternSummary): number {
    let score = 0;
    const patternText = `${pattern.name} ${pattern.description} ${pattern.tags?.join(' ') ?? ''}`.toLowerCase();

    for (const word of queryWords) {
      if (patternText.includes(word)) {
        score += 0.5; // Reduced from 1
      }

      // Bonus for exact matches in name
      if (pattern.name.toLowerCase().includes(word)) {
        score += 1; // Reduced from 2
      }

      // Bonus for category matches
      if (pattern.category.toLowerCase().includes(word)) {
        score += 0.5; // Reduced from 1.5
      }
    }

    return score;
  }

  /**
   * Generate reasons for keyword matches
   */
  private generateKeywordReasons(queryWords: string[], pattern: PatternSummary): string[] {
    const reasons: string[] = [];

    for (const word of queryWords) {
      if (pattern.name.toLowerCase().includes(word)) {
        reasons.push(`Pattern name contains "${word}"`);
      }
      if (pattern.description.toLowerCase().includes(word)) {
        reasons.push(`Pattern description mentions "${word}"`);
      }
      if (pattern.category.toLowerCase().includes(word)) {
        reasons.push(`Pattern category matches "${word}"`);
      }
    }

    return reasons.length > 0 ? reasons : ['Keyword-based pattern match'];
  }

  /**
   * Generate problem-solution fit explanation
   */
  private generateProblemFit(match: MatchResult, request: PatternRequest): string {
    return `This pattern addresses your requirement for "${request.query}" by providing a proven solution for ${match.pattern.category.toLowerCase()} scenarios.`;
  }

  /**
   * Generate implementation guidance
   */
  private generateImplementationGuidance(
    pattern: DetailedPattern,
    request: PatternRequest
  ): ImplementationGuidance {
    const implementations = this.getPatternImplementations(
      pattern.id,
      request.programmingLanguage
    );

    return {
      steps: [
        'Analyze your current code structure',
        'Identify where the pattern applies',
        'Implement the pattern following the examples',
        'Test the implementation',
        'Refactor as needed',
      ],
      examples: implementations.map((impl: PatternImplementation) => ({
        language: impl.language,
        title: `${pattern.name} in ${impl.language}`,
        code: impl.code,
        explanation: impl.explanation,
      })),
      dependencies: [],
      configuration: [],
      testing: {
        unitTests: ['Test pattern implementation', 'Test edge cases'],
        integrationTests: ['Test pattern interaction with existing code'],
        testScenarios: ['Normal operation', 'Error conditions', 'Boundary cases'],
      },
      performance: {
        impact: 'medium',
        memoryUsage: 'Minimal additional memory',
        cpuUsage: 'Negligible CPU overhead',
        optimizations: ['Consider lazy initialization', 'Use appropriate caching'],
        monitoring: ['Monitor pattern usage', 'Track performance metrics'],
      },
    };
  }

  /**
   * Find alternative patterns
   */
  private findAlternatives(patternId: string, allMatches: MatchResult[]): AlternativePattern[] {
    // Get related patterns from database
    const relatedPatterns = this.db.query<{
      target_pattern_id: string;
      type: string;
      description: string;
    }>(
      `
      SELECT target_pattern_id, type, description
      FROM pattern_relationships
      WHERE source_pattern_id = ? AND type IN ('alternative', 'similar')
    `,
      [patternId]
    );

    return relatedPatterns.slice(0, 3).map(rel => {
      const foundPattern = allMatches.find(m => m.pattern.id === rel.target_pattern_id)?.pattern;
      return {
        id: rel.target_pattern_id,
        name: foundPattern?.name ?? 'Unknown Pattern',
        category: foundPattern?.category ?? 'Unknown',
        reason: rel.description,
        score: 0.7, // Default score for alternatives
      };
    });
  }

  /**
   * Get detailed pattern information
   */
  private getDetailedPattern(patternId: string): DetailedPattern | null {
    const pattern = this.db.queryOne<{
      id: string;
      name: string;
      category: string;
      description: string;
      when_to_use: string | null;
      benefits: string | null;
      drawbacks: string | null;
      use_cases: string | null;
      complexity: string | null;
      tags: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT id, name, category, description, when_to_use, benefits, drawbacks,
             use_cases, complexity, tags, created_at, updated_at
      FROM patterns WHERE id = ?
    `,
      [patternId]
    );

    if (!pattern) return null;

    return {
      id: pattern.id,
      name: pattern.name,
      category: pattern.category,
      description: pattern.description,
      when_to_use: parseArrayProperty(pattern.when_to_use, 'when_to_use'),
      benefits: parseArrayProperty(pattern.benefits, 'benefits'),
      drawbacks: parseArrayProperty(pattern.drawbacks, 'drawbacks'),
      use_cases: parseArrayProperty(pattern.use_cases, 'use_cases'),
      complexity: pattern.complexity ?? 'Medium',
      tags: parseArrayProperty(pattern.tags, 'tags'),
      created_at: pattern.created_at,
      updated_at: pattern.updated_at,
    };
  }

  /**
   * Get pattern implementations
   */
  private getPatternImplementations(patternId: string, language?: string): PatternImplementation[] {
    let sql =
      'SELECT id, language, code, explanation FROM pattern_implementations WHERE pattern_id = ?';
    const params: string[] = [patternId];

    if (language) {
      sql += ' AND language = ?';
      params.push(language);
    }

    sql += ' ORDER BY language, created_at DESC';

    const implementations = this.db.query<PatternImplementation>(sql, params);
    return implementations.slice(0, 3); // Return top 3 implementations
  }

  /**
   * Extract project context from request
   */
  private extractProjectContext(_request: PatternRequest): string {
    // Simplified context extraction
    return 'Medium-sized established project with standard architecture patterns';
  }

  /**
   * Extract team context from request
   */
  private extractTeamContext(_request: PatternRequest): string {
    // Simplified context extraction
    return 'Medium-sized team with intermediate experience, prefers examples and documentation';
  }

  /**
   * Analyze code to detect patterns and suggest improvements
   */
  analyzeCode(code: string, language: string): CodeAnalysisResult {
    return this.patternAnalyzer.analyzeCode(code, language);
  }
}

// Default configuration
const DEFAULT_PATTERN_MATCHER_CONFIG: PatternMatcherConfig = {
  maxResults: 5,
  minConfidence: 0.3,
  useSemanticSearch: true,
  useKeywordSearch: true,
  useHybridSearch: true,
  semanticWeight: 0.7,
  keywordWeight: 0.3,
};

// Factory function
export function createPatternMatcher(
  db: DatabaseManager,
  vectorOps: VectorOperationsService,
  config?: Partial<PatternMatcherConfig>
): PatternMatcher {
  const finalConfig = { ...DEFAULT_PATTERN_MATCHER_CONFIG, ...config };
  return new PatternMatcher(db, vectorOps, finalConfig);
}
