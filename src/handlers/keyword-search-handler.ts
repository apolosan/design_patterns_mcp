/**
 * Keyword Search Handler
 * Handles keyword-based pattern searches
 * Extracted from PatternMatcher following SRP
 */

import { DatabaseManager } from '../services/database-manager.js';
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

  constructor(db: DatabaseManager, config?: Partial<KeywordSearchHandlerConfig>) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
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
      const queryWords = this.tokenizeQuery(request.query);
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
        const patternSummary: PatternSummary = {
          id: pattern.id,
          name: pattern.name,
          category: pattern.category,
          description: pattern.description,
          complexity: pattern.complexity,
          tags: parsedTags,
        };

        const score = this.calculateKeywordScore(queryWords, patternSummary);
        const confidence = Math.min(score / 10, 0.99);

        if (confidence >= this.config.minConfidence) {
          matches.push({
            pattern: patternSummary,
            confidence,
            matchType: 'keyword' as const,
            reasons: this.generateKeywordReasons(queryWords, patternSummary),
            metadata: {
              keywordScore: score,
              finalScore: confidence,
            },
          });
        }
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
      const queryWords = this.tokenizeQuery(request.query);
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
        const patternSummary: PatternSummary = {
          id: pattern.id,
          name: pattern.name,
          category: pattern.category,
          description: pattern.description,
          complexity: pattern.complexity,
          tags: parsedTags,
        };

        const score = this.calculateKeywordScore(queryWords, patternSummary);
        const confidence = Math.min(score / 10, 0.99);

        // Use lower threshold for broad search
        if (confidence >= this.config.broadSearchThreshold) {
          matches.push({
            pattern: patternSummary,
            confidence,
            matchType: 'keyword' as const,
            reasons: this.generateKeywordReasons(queryWords, patternSummary),
            metadata: {
              keywordScore: score,
              finalScore: confidence,
            },
          });
        }
      }

      // Sort and limit
      const sortedMatches = matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.config.maxResults);

      const duration = Date.now() - startTime;
      structuredLogger.debug('keyword-search-handler', 'Broad search completed', {
        query: request.query.substring(0, 50),
        resultsCount: sortedMatches.length,
        durationMs: duration,
      });

      return sortedMatches;
    });
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

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordScore(queryWords: string[], pattern: PatternSummary): number {
    let score = 0;
    const patternText =
      `${pattern.name} ${pattern.description} ${pattern.tags?.join(' ') ?? ''}`.toLowerCase();

    for (const word of queryWords) {
      if (patternText.includes(word)) {
        score += 0.5;
      }

      // Bonus for exact matches in name
      if (pattern.name.toLowerCase().includes(word)) {
        score += 1;
      }

      // Bonus for category matches
      if (pattern.category.toLowerCase().includes(word)) {
        score += 0.5;
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
}
