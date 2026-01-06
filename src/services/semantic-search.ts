/**
 * Semantic Search Service for Design Patterns MCP Server
 * Provides natural language search capabilities using embeddings
 */
import { DatabaseManager } from './database-manager';
import { VectorOperationsService } from './vector-operations';
import { EmbeddingServiceAdapter } from '../adapters/embedding-service-adapter.js';
import { VectorSearchResult } from '../models/vector.js';
import { logger } from './logger.js';

interface SemanticSearchConfig {
  modelName: string;
  maxResults: number;
  similarityThreshold: number;
  contextWindow: number;
  useQueryExpansion: boolean;
  useReRanking: boolean;
}

interface SearchQuery {
  text: string;
  filters?: {
    categories?: string[];
    complexity?: string;
    tags?: string[];
  };
  options?: {
    limit?: number;
    threshold?: number;
    includeMetadata?: boolean;
  };
}

interface SearchResult {
  patternId: string;
  pattern: {
    name: string;
    category: string;
    description: string;
    complexity: string;
    tags: string[];
  };
  score: number;
  rank: number;
  highlights?: string[];
  metadata: {
    searchQuery: string;
    searchTime: number;
    totalCandidates: number;
    similarityMethod: string;
  };
}

interface SearchStats {
  totalSearches: number;
  averageResults: number;
  averageSearchTime: number;
  popularQueries: string[];
  searchTrends: Record<string, number>;
}

interface UserPreferences {
  preferredCategories?: string[];
  preferredComplexity?: string;
  preferredTags?: string[];
}

export class SemanticSearchService {
  private db: DatabaseManager;
  private vectorOps: VectorOperationsService;
  private config: SemanticSearchConfig;
  private embeddingAdapter: EmbeddingServiceAdapter;

  constructor(
    db: DatabaseManager,
    vectorOps: VectorOperationsService,
    config: SemanticSearchConfig
  ) {
    this.db = db;
    this.vectorOps = vectorOps;
    this.config = config;

    // Initialize embedding adapter with transformers strategy for semantic search
    this.embeddingAdapter = new EmbeddingServiceAdapter({
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      batchSize: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      preferredStrategy: 'transformers',
      fallbackToSimple: false, // Don't fallback to simple hash for semantic search
    });
  }

  /**
   * Perform semantic search
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Expand query if enabled
      const queries = this.config.useQueryExpansion
        ? this.expandQuery(query.text)
        : [query.text];

      // Generate embeddings for all query variations
      const queryEmbeddings = await Promise.all(queries.map(q => this.generateEmbedding(q)));

      // Combine embeddings (simple average for now)
      const combinedEmbedding = this.combineEmbeddings(queryEmbeddings);

      // Perform vector search
      const vectorResults = this.vectorOps.searchSimilar(
        combinedEmbedding,
        {
          categories: query.filters?.categories,
          complexity: query.filters?.complexity,
          tags: query.filters?.tags,
        },
        query.options?.limit ?? this.config.maxResults
      );

      // Apply threshold filtering (TEMPORARILY DISABLED)
      const threshold = 0.0; // Allow all results
      const filteredResults = vectorResults.filter(r => r.score >= threshold);

      // Re-rank if enabled
      const finalResults = this.config.useReRanking
        ? this.reRankResults(filteredResults, query.text)
        : filteredResults;

      // Convert to SearchResult format
      const searchResults: SearchResult[] = finalResults.map((result, index) => ({
        patternId: result.patternId,
        pattern: {
          name: result.pattern?.name ?? 'Unknown Pattern',
          category: result.pattern?.category ?? 'Unknown',
          description: result.pattern?.description ?? 'No description available',
          complexity: 'Intermediate',
          tags: result.pattern?.tags ?? [],
        },
        score: result.score,
        rank: index + 1,
        metadata: {
          searchQuery: query.text,
          searchTime: Date.now() - startTime,
          totalCandidates: vectorResults.length,
          similarityMethod: 'cosine',
        },
      }));

      // Log search analytics
      this.logSearchAnalytics(query, searchResults);

      return searchResults;
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for text using the same strategy as pattern generation
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Initialize adapter if needed
      if (!(await this.embeddingAdapter.isReady())) {
        await this.embeddingAdapter.initialize();
      }

      // Use the embedding adapter to generate embeddings with the same strategy
      return await this.embeddingAdapter.generateEmbedding(text);
    } catch (error) {
      console.error('Failed to generate embedding in semantic search:', error);

      // Fallback to simple hash-based embedding if adapter fails
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Fallback embedding generation using simple hash (legacy behavior)
   */
  private generateFallbackEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = Array.from({ length: 384 }, () => 0); // Match all-MiniLM-L6-v2 dimensions

    // Create a simple hash-based embedding
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordHash = this.simpleHash(word);

      for (let j = 0; j < Math.min(word.length, 10); j++) {
        const charCode = word.charCodeAt(j);
        const position = (wordHash + j + i * 7) % embedding.length;
        embedding[position] = ((embedding[position] + charCode / 255) % 2) - 1; // Normalize to [-1, 1]
      }
    }

    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
    return embedding.map((val: number) => val / (norm || 1));
  }

  /**
   * Simple hash function for text
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
   * Combine multiple embeddings
   */
  private combineEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      throw new Error('No embeddings to combine');
    }

    if (embeddings.length === 1) {
      return embeddings[0];
    }

    const dimensions = embeddings[0].length;
    const combined = Array.from({ length: dimensions }, () => 0);

    // Average the embeddings
    for (const embedding of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        combined[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimensions; i++) {
      combined[i] /= embeddings.length;
    }

    return combined;
  }

  /**
   * Expand query with related terms
   */
  private expandQuery(query: string): string[] {
    const expansions: string[] = [query];

    // Add common synonyms and related terms
    const expansionMap: Record<string, string[]> = {
      object: ['instance', 'class', 'type'],
      create: ['instantiate', 'build', 'construct', 'make'],
      manage: ['handle', 'control', 'organize', 'coordinate'],
      data: ['information', 'state', 'content'],
      user: ['client', 'customer', 'person'],
      system: ['application', 'software', 'platform'],
      service: ['microservice', 'api', 'endpoint'],
      database: ['storage', 'persistence', 'data store'],
      web: ['http', 'browser', 'frontend'],
      api: ['interface', 'endpoint', 'service'],
      test: ['testing', 'validation', 'verification'],
      error: ['exception', 'failure', 'problem'],
      async: ['asynchronous', 'concurrent', 'parallel'],
      cache: ['caching', 'memory', 'storage'],
      security: ['authentication', 'authorization', 'encryption'],
    };

    const words = query.toLowerCase().split(/\s+/);
    const expandedWords: string[] = [];

    for (const word of words) {
      expandedWords.push(word);
      const synonyms = expansionMap[word];
      if (synonyms) {
        expandedWords.push(...synonyms.slice(0, 2)); // Limit to 2 synonyms per word
      }
    }

    // Create expanded query
    if (expandedWords.length > words.length) {
      expansions.push(expandedWords.join(' '));
    }

    // Add context-aware expansions
    if (query.toLowerCase().includes('design pattern')) {
      expansions.push(query.replace(/design pattern/g, 'software pattern'));
      expansions.push(query.replace(/design pattern/g, 'architectural pattern'));
    }

    return expansions.slice(0, 3); // Limit to 3 variations
  }

  /**
   * Re-rank search results using additional criteria
   */
  private reRankResults(results: VectorSearchResult[], originalQuery: string): VectorSearchResult[] {
    // Enhanced ranking based on multiple factors
    return results
      .map(result => {
        let adjustedScore = result.score;

        // Boost score for exact matches in pattern name
        if (result.pattern?.name?.toLowerCase().includes(originalQuery.toLowerCase())) {
          adjustedScore *= 1.2;
        }

        // Boost score for category matches
        const queryWords = originalQuery.toLowerCase().split(/\s+/);
        for (const word of queryWords) {
          if (result.pattern?.category?.toLowerCase().includes(word)) {
            adjustedScore *= 1.1;
          }
        }

        // Boost score for tag matches
        if (result.pattern?.tags) {
          for (const tag of result.pattern.tags) {
            for (const word of queryWords) {
              if (tag.toLowerCase().includes(word)) {
                adjustedScore *= 1.05;
              }
            }
          }
        }

        return {
          ...result,
          score: Math.min(adjustedScore, 1.0), // Cap at 1.0
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Log search analytics
   */
  private logSearchAnalytics(query: SearchQuery, results: SearchResult[]): void {
    try {
      const analytics = {
        query: query.text,
        timestamp: new Date().toISOString(),
        resultsCount: results.length,
        topScore: results.length > 0 ? results[0].score : 0,
        averageScore:
          results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0,
        searchTime: results.length > 0 ? results[0].metadata.searchTime : 0,
        filters: query.filters ?? {},
      };

      // Store in database (would be implemented)
      logger.debug('semantic-search', 'Search analytics', analytics);
    } catch (error) {
      console.error('Failed to log search analytics:', error);
    }
  }

  /**
   * Find similar patterns by pattern ID
   */
  findSimilarPatterns(patternId: string, limit?: number): Promise<SearchResult[]> {
    const embedding = this.vectorOps.getEmbedding(patternId);

    if (!embedding) {
      throw new Error(`No embedding found for pattern: ${patternId}`);
    }

    const vectorResults = this.vectorOps.searchSimilar(
      embedding,
      { excludePatterns: [patternId] },
      limit ?? this.config.maxResults
    );

    return Promise.resolve(
      vectorResults
        .filter(r => r.patternId !== patternId)
        .map((result, index) => ({
          patternId: result.patternId,
          pattern: {
            name: result.pattern?.name ?? 'Unknown Pattern',
            category: result.pattern?.category ?? 'Unknown',
            description: result.pattern?.description ?? 'No description available',
            complexity: 'Intermediate',
            tags: [],
          },
          score: result.score,
          rank: index + 1,
          metadata: {
            searchQuery: `similar to ${patternId}`,
            searchTime: Date.now(),
            totalCandidates: vectorResults.length,
            similarityMethod: 'cosine',
          },
        }))
    );
  }

  /**
   * Get search suggestions based on partial query
   */
  getSearchSuggestions(partialQuery: string, limit: number = 5): string[] {
    try {
      // Get patterns that match the partial query
      const patterns = this.db.query<{ name: string; description: string }>(
        `SELECT name, description FROM patterns
         WHERE name LIKE ? OR description LIKE ?
         LIMIT ?`,
        [`%${partialQuery}%`, `%${partialQuery}%`, limit * 2]
      );

      const suggestions: string[] = [];

      for (const pattern of patterns) {
        // Extract relevant phrases from name and description
        const descWords = pattern.description.split(/\s+/);

        // Add pattern name as suggestion
        if (pattern.name.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.push(pattern.name);
        }

        // Add relevant phrases from description
        const relevantPhrases = this.extractRelevantPhrases(descWords, partialQuery);
        suggestions.push(...relevantPhrases);
      }

      // Remove duplicates and limit results
      return [...new Set(suggestions)].slice(0, limit);
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * Extract relevant phrases from text
   */
  private extractRelevantPhrases(words: string[], query: string): string[] {
    const phrases: string[] = [];
    const queryWords = query.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words
        .slice(i, i + 3)
        .join(' ')
        .toLowerCase();
      const matches = queryWords.filter(qw => phrase.includes(qw));

      if (matches.length > 0) {
        phrases.push(words.slice(i, i + 3).join(' '));
      }
    }

    return phrases;
  }

  /**
   * Get search statistics
   */
  getSearchStats(): SearchStats {
    try {
      // This would query search analytics from database
      // For now, return mock stats
      return {
        totalSearches: 0,
        averageResults: 0,
        averageSearchTime: 0,
        popularQueries: [],
        searchTrends: {},
      };
    } catch (error) {
      console.error('Failed to get search stats:', error);
      throw error;
    }
  }

  /**
   * Batch search multiple queries
   */
  async batchSearch(queries: SearchQuery[]): Promise<SearchResult[][]> {
    const results: SearchResult[][] = [];

    for (const query of queries) {
      try {
        const queryResults = await this.search(query);
        results.push(queryResults);
      } catch (error) {
        console.error(`Batch search failed for query "${query.text}":`, error);
        results.push([]);
      }
    }

    return results;
  }

  /**
   * Advanced search with boolean operators
   */
  async advancedSearch(query: string, _operators: Record<string, unknown>): Promise<SearchResult[]> {
    // Parse boolean query (AND, OR, NOT)
    const parsedQuery = this.parseBooleanQuery(query);

    // This would implement complex boolean search logic
    // For now, fall back to regular search
    return this.search({
      text: parsedQuery,
      options: { limit: this.config.maxResults },
    });
  }

  /**
   * Parse boolean query
   */
  private parseBooleanQuery(query: string): string {
    // Simple boolean query parsing
    // This would be more sophisticated in production
    return query.replace(/\b(AND|OR|NOT)\b/g, '').trim();
  }

  /**
   * Search with context (previous searches, user preferences)
   */
  async contextualSearch(
    query: SearchQuery,
    context: {
      previousSearches?: string[];
      userPreferences?: UserPreferences;
      sessionHistory?: string[];
    }
  ): Promise<SearchResult[]> {
    let contextualQuery = query.text;

    // Incorporate context into search
    if (context.previousSearches && context.previousSearches.length > 0) {
      // Boost results similar to previous searches
      const recentQuery = context.previousSearches[context.previousSearches.length - 1];
      contextualQuery += ` ${recentQuery}`;
    }

    if (context.userPreferences) {
      // Adjust search based on user preferences
      if (context.userPreferences.preferredCategories) {
        query.filters = query.filters ?? {};
        query.filters.categories = context.userPreferences.preferredCategories;
      }
    }

    return this.search({
      ...query,
      text: contextualQuery,
    });
  }

  /**
   * Search for similar patterns using embedding
   */
  searchSimilar(
    queryEmbedding: number[],
    limit: number = 10,
    threshold: number = 0.3
  ): Promise<Array<{ id: string; score: number }>> {
    const vectorResults = this.vectorOps.searchSimilar(
      queryEmbedding,
      { minScore: threshold },
      limit
    );
    return Promise.resolve(
      vectorResults.map(result => ({
        id: result.patternId,
        score: result.score,
      }))
    );
  }

  /**
   * Compress context for large result sets
   * Reduces redundancy and highlights most relevant information
   */
  compressContext(results: SearchResult[], maxTokens: number = 1000): {
    compressedResults: SearchResult[];
    compressionRatio: number;
    preservedInfo: string[];
  } {
    if (results.length <= 3) {
      return {
        compressedResults: results,
        compressionRatio: 1.0,
        preservedInfo: ['No compression needed for small result set'],
      };
    }

    const compressedResults: SearchResult[] = [];
    const preservedInfo: string[] = [];
    let currentTokens = 0;
    const targetTokens = maxTokens * 0.8; // Leave room for metadata

    // Sort by score to prioritize most relevant results
    const sortedResults = [...results].sort((a, b) => b.score - a.score);

    // Always include top result
    if (sortedResults.length > 0) {
      const topResult = this.compressSingleResult(sortedResults[0], targetTokens / 4);
      compressedResults.push(topResult);
      currentTokens += this.estimateTokens(topResult);
      preservedInfo.push('Top result fully preserved');
    }

    // Compress remaining results with diversity preservation
    const remainingResults = sortedResults.slice(1);
    const diverseResults = this.selectDiverseResults(remainingResults, Math.min(5, remainingResults.length));

    for (let i = 0; i < diverseResults.length; i++) {
      const result = diverseResults[i];
      const availableTokens = targetTokens - currentTokens;
      
      if (availableTokens <= 50) break;

      const compressedResult = this.compressSingleResult(result, availableTokens / (diverseResults.length - i));
      compressedResults.push(compressedResult);
      currentTokens += this.estimateTokens(compressedResult);
      preservedInfo.push(`Result ${i + 2} compressed to key points`);
    }

    const compressionRatio = results.length > 0 ? compressedResults.length / results.length : 1.0;

    return {
      compressedResults: compressedResults.sort((a, b) => b.score - a.score),
      compressionRatio,
      preservedInfo,
    };
  }

  /**
   * Compress a single search result to reduce token usage
   */
  private compressSingleResult(result: SearchResult, maxTokens: number): SearchResult {
    const compressed: SearchResult = { ...result };
    
    // Compress description to key points
    if (result.pattern.description && result.pattern.description.length > 200) {
      compressed.pattern = {
        ...result.pattern,
        description: this.extractKeyPoints(result.pattern.description, Math.max(100, maxTokens / 4)),
      };
    }

    // Preserve essential metadata only
    compressed.metadata = {
      searchQuery: result.metadata.searchQuery,
      searchTime: result.metadata.searchTime,
      totalCandidates: result.metadata.totalCandidates,
      similarityMethod: result.metadata.similarityMethod,
    };

    return compressed;
  }

  /**
   * Select diverse results to avoid redundancy
   */
  private selectDiverseResults(results: SearchResult[], maxCount: number): SearchResult[] {
    if (results.length <= maxCount) {
      return results;
    }

    const diverseResults: SearchResult[] = [];
    const usedCategories = new Set<string>();
    const usedNames = new Set<string>();

    // Select results ensuring category diversity
    for (const result of results) {
      if (diverseResults.length >= maxCount) break;

      const category = result.pattern.category?.toLowerCase();
      const name = result.pattern.name?.toLowerCase();

      // Include if new category or high score
      if (!usedCategories.has(category) || result.score > 0.8) {
        diverseResults.push(result);
        usedCategories.add(category);
        usedNames.add(name);
      }
    }

    // Fill remaining slots with highest scoring results
    if (diverseResults.length < maxCount) {
      const remaining = results.filter(r => !usedNames.has(r.pattern.name?.toLowerCase()));
      const additional = remaining.slice(0, maxCount - diverseResults.length);
      diverseResults.push(...additional);
    }

    return diverseResults;
  }

  /**
   * Extract key points from a longer text
   */
  private extractKeyPoints(text: string, maxLength: number): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 2) {
      return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }

    // Score sentences based on importance indicators
    const scoredSentences = sentences.map((sentence, index) => {
      const score = this.scoreSentence(sentence, index, sentences.length);
      return { sentence: sentence.trim(), score };
    });

    // Select top sentences within length limit
    scoredSentences.sort((a, b) => b.score - a.score);
    
    let result = '';
    for (const { sentence } of scoredSentences) {
      if (result.length + sentence.length + 2 <= maxLength) {
        result += (result ? '. ' : '') + sentence;
      } else {
        break;
      }
    }

    return result || text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Score sentence importance based on heuristics
   */
  private scoreSentence(sentence: string, index: number, totalSentences: number): number {
    let score = 0;
    const words = sentence.toLowerCase().split(/\s+/);

    // Boost for sentences with important keywords
    const importantKeywords = [
      'pattern', 'design', 'structure', 'architecture', 'implement',
      'benefit', 'advantage', 'use', 'when', 'because', 'purpose'
    ];

    for (const keyword of importantKeywords) {
      if (words.includes(keyword)) {
        score += 0.2;
      }
    }

    // Position scoring (first and last sentences often important)
    if (index === 0 || index === totalSentences - 1) {
      score += 0.3;
    }

    // Length scoring (medium-length sentences often most informative)
    const wordCount = words.length;
    if (wordCount >= 8 && wordCount <= 20) {
      score += 0.2;
    } else if (wordCount > 25) {
      score -= 0.1; // Penalize very long sentences
    }

    return score;
  }

  /**
   * Estimate token count for a search result
   */
  private estimateTokens(result: SearchResult): number {
    const text = JSON.stringify(result);
    return Math.ceil(text.length / 4); // Rough estimate: 4 chars per token
  }

  /**
   * Search with automatic context compression
   */
  async searchWithCompression(
    query: SearchQuery,
    maxContextTokens?: number
  ): Promise<{
    results: SearchResult[];
    compression: {
      ratio: number;
      preservedInfo: string[];
    };
    metadata: {
      originalCount: number;
      compressedCount: number;
      searchTime: number;
    };
  }> {
    const startTime = Date.now();

    // Perform regular search
    const allResults = await this.search(query);

    // Apply context compression
    const { compressedResults, compressionRatio, preservedInfo } = this.compressContext(
      allResults,
      maxContextTokens ?? 2000
    );

    return {
      results: compressedResults,
      compression: {
        ratio: compressionRatio,
        preservedInfo,
      },
      metadata: {
        originalCount: allResults.length,
        compressedCount: compressedResults.length,
        searchTime: Date.now() - startTime,
      },
    };
  }
}



// Factory function

