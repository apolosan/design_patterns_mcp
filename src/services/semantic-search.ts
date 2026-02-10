/**
 * Semantic Search Service for Design Patterns MCP Server
 * Provides natural language search capabilities using embeddings
 */
import { PatternRepository } from '../repositories/interfaces.js';
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
    id: string;
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
  private patternRepo: PatternRepository;
  private vectorOps: VectorOperationsService;
  private config: SemanticSearchConfig;
  private embeddingAdapter: EmbeddingServiceAdapter;

  constructor(
    patternRepo: PatternRepository,
    vectorOps: VectorOperationsService,
    config: SemanticSearchConfig
  ) {
    this.patternRepo = patternRepo;
    this.vectorOps = vectorOps;
    this.config = config;

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

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      const queries = this.config.useQueryExpansion
        ? this.expandQuery(query.text)
        : [query.text];

      const queryEmbeddings = await Promise.all(queries.map(q => this.generateEmbedding(q)));
      const combinedEmbedding = this.combineEmbeddings(queryEmbeddings);

      const vectorResults = this.vectorOps.searchSimilar(
        combinedEmbedding,
        {
          categories: query.filters?.categories,
          complexity: query.filters?.complexity,
          tags: query.filters?.tags,
        },
        query.options?.limit ?? this.config.maxResults
      );

      const threshold = 0.0;
      const filteredResults = vectorResults.filter(r => r.score >= threshold);

      const finalResults = this.config.useReRanking
        ? this.reRankResults(filteredResults, query.text)
        : filteredResults;

      const searchResults: SearchResult[] = finalResults.map((result, index) => ({
        patternId: result.patternId,
        pattern: {
          id: result.patternId,
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

      this.logSearchAnalytics(query, searchResults);

      return searchResults;
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!(await this.embeddingAdapter.isReady())) {
        await this.embeddingAdapter.initialize();
      }

      return await this.embeddingAdapter.generateEmbedding(text);
    } catch (error) {
      console.error('Failed to generate embedding in semantic search:', error);

      return this.generateFallbackEmbedding(text);
    }
  }

  private generateFallbackEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = Array.from({ length: 384 }, () => 0);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordHash = this.simpleHash(word);

      for (let j = 0; j < Math.min(word.length, 10); j++) {
        const charCode = word.charCodeAt(j);
        const position = (wordHash + j + i * 7) % embedding.length;
        embedding[position] = ((embedding[position] + charCode / 255) % 2) - 1;
      }
    }

    const norm = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
    return embedding.map((val: number) => val / (norm || 1));
  }

  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private combineEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      throw new Error('No embeddings to combine');
    }

    if (embeddings.length === 1) {
      return embeddings[0];
    }

    const dimensions = embeddings[0].length;
    const combined = Array.from({ length: dimensions }, () => 0);

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

  private expandQuery(query: string): string[] {
    const expansions: string[] = [query];

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
        expandedWords.push(...synonyms.slice(0, 2));
      }
    }

    if (expandedWords.length > words.length) {
      expansions.push(expandedWords.join(' '));
    }

    if (query.toLowerCase().includes('design pattern')) {
      expansions.push(query.replace(/design pattern/g, 'software pattern'));
      expansions.push(query.replace(/design pattern/g, 'architectural pattern'));
    }

    return expansions.slice(0, 3);
  }

  private reRankResults(results: VectorSearchResult[], originalQuery: string): VectorSearchResult[] {
    return results
      .map(result => {
        let adjustedScore = result.score;

        if (result.pattern?.name?.toLowerCase().includes(originalQuery.toLowerCase())) {
          adjustedScore *= 1.2;
        }

        const queryWords = originalQuery.toLowerCase().split(/\s+/);
        for (const word of queryWords) {
          if (result.pattern?.category?.toLowerCase().includes(word)) {
            adjustedScore *= 1.1;
          }
        }

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
          score: Math.min(adjustedScore, 1.0),
        };
      })
      .sort((a, b) => b.score - a.score);
  }

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

      logger.debug('semantic-search', 'Search analytics', analytics);
    } catch (error) {
      console.error('Failed to log search analytics:', error);
    }
  }

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
            id: result.patternId,
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

  async getSearchSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    try {
      const patterns = await this.patternRepo.findAllSummaries();
      const partialLower = partialQuery.toLowerCase();

      const suggestions: string[] = [];
      const maxCandidates = limit * 2;
      let candidatesCount = 0;

      for (const pattern of patterns) {
        if (candidatesCount >= maxCandidates) break;

        const nameMatch = pattern.name.toLowerCase().includes(partialLower);
        const descMatch = pattern.description.toLowerCase().includes(partialLower);

        if (!nameMatch && !descMatch) continue;

        candidatesCount++;

        const descWords = pattern.description.split(/\s+/);

        if (nameMatch) {
          suggestions.push(pattern.name);
        }

        const relevantPhrases = this.extractRelevantPhrases(descWords, partialQuery);
        suggestions.push(...relevantPhrases);
      }

      return [...new Set(suggestions)].slice(0, limit);
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }

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

  getSearchStats(): SearchStats {
    try {
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

  async advancedSearch(query: string, _operators: Record<string, unknown>): Promise<SearchResult[]> {
    const parsedQuery = this.parseBooleanQuery(query);

    return this.search({
      text: parsedQuery,
      options: { limit: this.config.maxResults },
    });
  }

  private parseBooleanQuery(query: string): string {
    return query.replace(/\b(AND|OR|NOT)\b/g, '').trim();
  }

  async contextualSearch(
    query: SearchQuery,
    context: {
      previousSearches?: string[];
      userPreferences?: UserPreferences;
      sessionHistory?: string[];
    }
  ): Promise<SearchResult[]> {
    let contextualQuery = query.text;

    if (context.previousSearches && context.previousSearches.length > 0) {
      const recentQuery = context.previousSearches[context.previousSearches.length - 1];
      contextualQuery += ` ${recentQuery}`;
    }

    if (context.userPreferences) {
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
    const targetTokens = maxTokens * 0.8;

    const sortedResults = [...results].sort((a, b) => b.score - a.score);

    if (sortedResults.length > 0) {
      const topResult = this.compressSingleResult(sortedResults[0], targetTokens / 4);
      compressedResults.push(topResult);
      currentTokens += this.estimateTokens(topResult);
      preservedInfo.push('Top result fully preserved');
    }

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

  private compressSingleResult(result: SearchResult, maxTokens: number): SearchResult {
    const compressed: SearchResult = { ...result };

    if (result.pattern.description && result.pattern.description.length > 200) {
      compressed.pattern = {
        ...result.pattern,
        description: this.extractKeyPoints(result.pattern.description, Math.max(100, maxTokens / 4)),
      };
    }

    compressed.metadata = {
      searchQuery: result.metadata.searchQuery,
      searchTime: result.metadata.searchTime,
      totalCandidates: result.metadata.totalCandidates,
      similarityMethod: result.metadata.similarityMethod,
    };

    return compressed;
  }

  private selectDiverseResults(results: SearchResult[], maxCount: number): SearchResult[] {
    if (results.length <= maxCount) {
      return results;
    }

    const diverseResults: SearchResult[] = [];
    const usedCategories = new Set<string>();
    const usedNames = new Set<string>();

    for (const result of results) {
      if (diverseResults.length >= maxCount) break;

      const category = result.pattern.category?.toLowerCase();
      const name = result.pattern.name?.toLowerCase();

      if (!usedCategories.has(category) || result.score > 0.8) {
        diverseResults.push(result);
        usedCategories.add(category);
        usedNames.add(name);
      }
    }

    if (diverseResults.length < maxCount) {
      const remaining = results.filter(r => !usedNames.has(r.pattern.name?.toLowerCase()));
      const additional = remaining.slice(0, maxCount - diverseResults.length);
      diverseResults.push(...additional);
    }

    return diverseResults;
  }

  private extractKeyPoints(text: string, maxLength: number): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length <= 2) {
      return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }

    const scoredSentences = sentences.map((sentence, index) => {
      const score = this.scoreSentence(sentence, index, sentences.length);
      return { sentence: sentence.trim(), score };
    });

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

  private scoreSentence(sentence: string, index: number, totalSentences: number): number {
    let score = 0;
    const words = sentence.toLowerCase().split(/\s+/);

    const importantKeywords = [
      'pattern', 'design', 'structure', 'architecture', 'implement',
      'benefit', 'advantage', 'use', 'when', 'because', 'purpose'
    ];

    for (const keyword of importantKeywords) {
      if (words.includes(keyword)) {
        score += 0.2;
      }
    }

    if (index === 0 || index === totalSentences - 1) {
      score += 0.3;
    }

    const wordCount = words.length;
    if (wordCount >= 8 && wordCount <= 20) {
      score += 0.2;
    } else if (wordCount > 25) {
      score -= 0.1;
    }

    return score;
  }

  private estimateTokens(result: SearchResult): number {
    const text = JSON.stringify(result);
    return Math.ceil(text.length / 4);
  }

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

    const allResults = await this.search(query);

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

export function createSemanticSearchService(
  patternRepo: PatternRepository,
  vectorOps: VectorOperationsService,
  config?: Partial<SemanticSearchConfig>
): SemanticSearchService {
  const finalConfig: SemanticSearchConfig = {
    modelName: 'all-MiniLM-L6-v2',
    maxResults: 10,
    similarityThreshold: 0.3,
    contextWindow: 512,
    useQueryExpansion: true,
    useReRanking: true,
    ...config,
  };
  return new SemanticSearchService(patternRepo, vectorOps, finalConfig);
}
