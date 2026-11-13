/**
 * Keyword Search Handler
 * Handles keyword-based pattern searches
 * Extracted from PatternMatcher following SRP
 *
 * Uses BM25 Okapi scoring for relevance ranking.
 */

import { DatabaseManager } from '../services/database-manager.js';
import { parseArrayProperty } from '../utils/parse-tags.js';
import { BM25Scorer } from '../services/bm25-scorer.js';
import type { BM25Document } from '../services/bm25-scorer.js';
import { structuredLogger } from '../utils/logger.js';
import { parseTags } from '../utils/parse-tags.js';
import { Result, tryCatchAsync } from '../types/result.js';
import type {
  PatternRequest,
  MatchResult,
  PatternSummary,
  SearchHandler,
  KeywordSearchHandlerConfig,
} from '../types/search-types.js';

const DEFAULT_CONFIG: KeywordSearchHandlerConfig = {
  maxResults: 10,
  minConfidence: 0.05,
  broadSearchThreshold: 0.01,
};

export class KeywordSearchHandler implements SearchHandler {
  private db: DatabaseManager;
  private config: KeywordSearchHandlerConfig;
  private bm25Scorer: BM25Scorer | null = null;
  private patternMap: Map<string, PatternSummary> = new Map();
  /**
   * Second lexical index over the fields the primary index deliberately omits
   * (when_to_use, use_cases, benefits). It produces an INDEPENDENT ranking, which
   * is the only thing that lets the fuzzy layer fuse opinions instead of
   * re-weighting one signal with itself.
   */
  private applicabilityScorer: BM25Scorer | null = null;

  constructor(db: DatabaseManager, config?: Partial<KeywordSearchHandlerConfig>) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Lazily initialize BM25 scorer from database patterns.
   * Called on first search to ensure DB is ready.
   */
  /**
   * Normalised applicability score per pattern for one query, or an empty map
   * when the second index has nothing to offer. One pass per query; no per
   * candidate lookup.
   */
  applicabilityScores(query: string): Map<string, number> {
    this.ensureBM25();
    const scores = new Map<string, number>();
    if (!this.applicabilityScorer) return scores;
    for (const result of this.applicabilityScorer.normalizeScores(
      this.applicabilityScorer.scoreQuery(query)
    )) {
      scores.set(result.id, result.normalized);
    }
    return scores;
  }

  private ensureBM25(): BM25Scorer {
    if (this.bm25Scorer) return this.bm25Scorer;

    const patterns = this.db.query<{
      id: string;
      name: string;
      category: string;
      description: string;
      complexity: string;
      tags: string;
      when_to_use: string | null;
      use_cases: string | null;
      benefits: string | null;
    }>('SELECT id, name, category, description, complexity, tags, when_to_use, use_cases, benefits FROM patterns');

    const documents: BM25Document[] = [];

    for (const pattern of patterns) {
      const parsedTags = parseTags(pattern.tags);
      const patternSummary: PatternSummary = {
        id: pattern.id,
        name: pattern.name,
        category: pattern.category,
        description: pattern.description,
        complexity: pattern.complexity,
        tags: parsedTags,
      };

      this.patternMap.set(pattern.id, patternSummary);

      // Build document text: name + description + tags + category
      const text = [
        pattern.name,
        pattern.description,
        parsedTags.join(' '),
        pattern.category,
      ].join(' ');

      documents.push({ id: pattern.id, text });
    }

    this.bm25Scorer = new BM25Scorer(documents);

    // Built from the same rows, over the unindexed columns only. Lazy: one
    // tokenisation pass per handler instance, never per query.
    this.applicabilityScorer = new BM25Scorer(
      patterns.map((pattern) => ({
        id: pattern.id,
        text: [
          parseArrayProperty(pattern.when_to_use, 'when_to_use').join(' '),
          parseArrayProperty(pattern.use_cases, 'use_cases').join(' '),
          parseArrayProperty(pattern.benefits, 'benefits').join(' '),
        ].join(' '),
      }))
    );

    structuredLogger.debug('keyword-search-handler', 'BM25 scorer initialized', {
      corpusSize: documents.length,
      stats: this.bm25Scorer.getStats(),
    });

    return this.bm25Scorer;
  }

  /**
   * Perform keyword-based search
   */
  async search(request: PatternRequest): Promise<MatchResult[]> {
    const result = await this.searchSafe(request);
    if (result.success) {
      return result.value;
    }
    structuredLogger.error('keyword-search-handler', 'Keyword search failed', result.error);
    return [];
  }

  /**
   * Safe version of search that returns a Result type
   */
  searchSafe(request: PatternRequest): Promise<Result<MatchResult[]>> {
    return tryCatchAsync(async () => {
      await Promise.resolve(); // Ensure async execution for consistent behavior
      const startTime = Date.now();

      const scorer = this.ensureBM25();

      // BM25 scoring
      const bm25Results = scorer.scoreQuery(request.query);
      const normalized = scorer.normalizeScores(bm25Results);

      // Build matches with normalized scores
      const matches: MatchResult[] = [];
      const limit = this.resolveLimit(request);

      for (const result of normalized) {
        // Apply category filter if specified
        if (request.categories && request.categories.length > 0) {
          const pattern = this.patternMap.get(result.id);
          if (!pattern || !request.categories.includes(pattern.category)) {
            continue;
          }
        }

        const pattern = this.patternMap.get(result.id);
        if (!pattern) continue;

        const confidence = Math.min(Math.max(result.normalized, 0), 0.99);

        if (confidence >= this.config.minConfidence) {
          matches.push({
            pattern,
            confidence,
            matchType: 'keyword' as const,
            reasons: this.generateKeywordReasons(request.query, pattern),
            metadata: {
              keywordScore: result.normalized,
              finalScore: confidence,
            },
          });
        }

        // Stop after the per-request candidate limit
        if (matches.length >= limit) break;
      }

      const duration = Date.now() - startTime;
      structuredLogger.debug('keyword-search-handler', 'Keyword search completed', {
        query: request.query.substring(0, 50),
        resultsCount: matches.length,
        durationMs: duration,
      });

      return matches;
    });
  }

  /**
   * Perform broad keyword search with lower thresholds
   */
  async broadSearch(request: PatternRequest): Promise<MatchResult[]> {
    const result = await this.broadSearchSafe(request);
    if (result.success) {
      return result.value;
    }
    structuredLogger.error('keyword-search-handler', 'Broad search failed', result.error);
    return [];
  }

  /**
   * Safe version of broad search
   */
  broadSearchSafe(request: PatternRequest): Promise<Result<MatchResult[]>> {
    return tryCatchAsync(async () => {
      await Promise.resolve(); // Ensure async execution for consistent behavior
      const startTime = Date.now();

      const scorer = this.ensureBM25();

      // BM25 scoring (no category filter for broad search)
      const bm25Results = scorer.scoreQuery(request.query);
      const normalized = scorer.normalizeScores(bm25Results);

      const matches: MatchResult[] = [];
      const limit = this.resolveLimit(request);

      for (const result of normalized) {
        const pattern = this.patternMap.get(result.id);
        if (!pattern) continue;

        const confidence = Math.min(Math.max(result.normalized, 0), 0.99);

        // Use lower threshold for broad search
        if (confidence >= this.config.broadSearchThreshold) {
          matches.push({
            pattern,
            confidence,
            matchType: 'keyword' as const,
            reasons: this.generateKeywordReasons(request.query, pattern),
            metadata: {
              keywordScore: result.normalized,
              finalScore: confidence,
            },
          });
        }

        if (matches.length >= limit) break;
      }

      const duration = Date.now() - startTime;
      structuredLogger.debug('keyword-search-handler', 'Broad search completed', {
        query: request.query.substring(0, 50),
        resultsCount: matches.length,
        durationMs: duration,
      });

      return matches;
    });
  }

  /**
   * Candidate pool size: the handler default, widened so that a caller asking
   * for N results gets N (with headroom for hybrid fusion).
   */
  private resolveLimit(request: PatternRequest): number {
    return Math.max(this.config.maxResults, (request.maxResults ?? 0) * 2);
  }

  /**
   * Generate reasons for keyword matches
   */
  private generateKeywordReasons(query: string, pattern: PatternSummary): string[] {
    const queryWords = this.tokenizeQuery(query);
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
   * Tokenize query for keyword matching
   */
  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }
}
