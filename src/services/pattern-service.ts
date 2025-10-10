/**
 * Service Layer Pattern Implementation
 * Orchestrates business logic between repositories and controllers
 * Provides high-level operations for pattern management
 */

import type { Pattern } from '../models/pattern.js';
import type { PatternRepository } from '../repositories/interfaces.js';
import type { CacheService } from './cache.js';
import type { SemanticSearchService } from './semantic-search.js';
import type { VectorOperationsService } from './vector-operations.js';

/**
 * Fast hash function for cache keys (replaces slow JSON.stringify)
 * Uses FNV-1a hash algorithm - O(n) instead of O(n log n)
 */
function fastHash(obj: any): string {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  let hash = 2166136261; // FNV offset basis
  
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  
  return (hash >>> 0).toString(36); // Convert to base36 for shorter keys
}

export interface PatternSearchQuery {
  text: string;
  filters?: {
    category?: string;
    tags?: string[];
    complexity?: string;
  };
  options?: {
    limit?: number;
    includeMetadata?: boolean;
    searchType?: 'keyword' | 'semantic' | 'hybrid';
  };
}

export interface PatternSearchResult {
  pattern: Pattern;
  score: number;
  highlights?: string[];
}

export interface PatternDetails extends Pattern {
  similarPatterns?: Pattern[];
}

export class PatternService {
  constructor(
    private repository: PatternRepository,
    private cache: CacheService,
    private semanticSearch: SemanticSearchService,
    private vectorOps: VectorOperationsService
  ) {}

  /**
   * Find pattern by ID with caching
   */
  async findPatternById(id: string): Promise<Pattern | null> {
    // Check cache first
    const cached = this.cache.getPattern(id);
    if (cached) {
      return cached;
    }

    // Query repository
    const pattern = await this.repository.findById(id);
    
    if (pattern) {
      // Cache the result
      this.cache.setPattern(id, pattern);
    }

    return pattern;
  }

  /**
   * Get pattern details with implementations and similar patterns
   */
  async getPatternDetails(id: string): Promise<PatternDetails | null> {
    const pattern = await this.findPatternById(id);
    
    if (!pattern) {
      return null;
    }

    // Find similar patterns using vector search
    const similarPatterns = await this.findSimilarPatterns(pattern, 3);

    return {
      ...pattern,
      similarPatterns,
    };
  }

  /**
   * Search patterns with caching
   */
  async searchPatterns(query: PatternSearchQuery): Promise<PatternSearchResult[]> {
    // Generate cache key (optimized with hash instead of JSON.stringify)
    const cacheKey = `search:${query.text}:${fastHash(query)}`;
    
    // Check cache
    const cached = this.cache.get<PatternSearchResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Convert filters to match SemanticSearchService expected format
    const searchFilters = query.filters ? {
      categories: query.filters.category ? [query.filters.category] : undefined,
      complexity: query.filters.complexity ? [query.filters.complexity] : undefined,
      tags: query.filters.tags,
    } : undefined;

    // Perform search
    const results = await this.semanticSearch.search({
      text: query.text,
      filters: searchFilters,
      options: query.options,
    });

    // OPTIMIZATION: Use single query to fetch all patterns instead of N+1 queries
    const patternIds = results.map(r => r.patternId);
    const fullPatterns = await this.repository.findByIds(patternIds);
    
    // Create a map for O(1) lookup
    const patternsMap = new Map(fullPatterns.map(p => [p.id, p]));

    // Map results to full Pattern objects
    const searchResults: PatternSearchResult[] = results.map(r => {
      const fullPattern = patternsMap.get(r.patternId);
      
      if (!fullPattern) {
        // Fallback: construct minimal pattern from search result
        return {
          pattern: {
            id: r.patternId,
            name: r.pattern.name,
            category: r.pattern.category,
            description: r.pattern.description,
            problem: '',
            solution: '',
            when_to_use: [],
            benefits: [],
            drawbacks: [],
            use_cases: [],
            implementations: [],
            complexity: r.pattern.complexity,
            tags: r.pattern.tags,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          score: r.score,
          highlights: r.highlights,
        };
      }
      
      return {
        pattern: fullPattern,
        score: r.score,
        highlights: r.highlights,
      };
    });

    // Cache results for 5 minutes
    this.cache.set(cacheKey, searchResults, 300000);

    return searchResults;
  }

  /**
   * Find similar patterns using vector similarity
   */
  async findSimilarPatterns(pattern: Pattern, limit: number = 5): Promise<Pattern[]> {
    try {
      // Create search text from pattern
      const searchText = `${pattern.name} ${pattern.description} ${pattern.problem}`;
      
      // Use semantic search to find similar patterns
      const results = await this.semanticSearch.search({
        text: searchText,
        options: {
          limit: limit + 1, // +1 to exclude the pattern itself
          includeMetadata: false,
        },
      });

      // Map to full Pattern objects from repository
      const patterns: Pattern[] = [];
      for (const result of results) {
        if (result.patternId !== pattern.id) {
          const fullPattern = await this.repository.findById(result.patternId);
          if (fullPattern) {
            patterns.push(fullPattern);
          }
        }
      }

      return patterns.slice(0, limit);
    } catch (error) {
      console.error('Error finding similar patterns:', error);
      return [];
    }
  }

  /**
   * Get patterns by category with caching
   */
  async getPatternsByCategory(category: string, limit?: number): Promise<Pattern[]> {
    const cacheKey = `category:${category}:${limit || 'all'}`;
    
    const cached = this.cache.get<Pattern[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const patterns = await this.repository.findByCategory(category, limit);
    
    this.cache.set(cacheKey, patterns, 600000); // Cache for 10 minutes
    
    return patterns;
  }

  /**
   * Get patterns by tags with caching
   */
  async getPatternsByTags(tags: string[], matchAll: boolean = false): Promise<Pattern[]> {
    const cacheKey = `tags:${tags.join(',')}:${matchAll}`;
    
    const cached = this.cache.get<Pattern[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const patterns = await this.repository.findByTags(tags, matchAll);
    
    this.cache.set(cacheKey, patterns, 600000); // Cache for 10 minutes
    
    return patterns;
  }

  /**
   * Get all patterns with optional filters
   */
  async getAllPatterns(filters?: any): Promise<Pattern[]> {
    const cacheKey = `all:${fastHash(filters || {})}`;
    
    const cached = this.cache.get<Pattern[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const patterns = await this.repository.findAll(filters);
    
    this.cache.set(cacheKey, patterns, 600000); // Cache for 10 minutes
    
    return patterns;
  }

  /**
   * Save a pattern
   */
  async savePattern(pattern: Pattern): Promise<Pattern> {
    const saved = await this.repository.save(pattern);
    
    // Invalidate cache
    this.cache.delete(`pattern:${pattern.id}`);
    
    return saved;
  }

  /**
   * Update a pattern
   */
  async updatePattern(id: string, updates: Partial<Pattern>): Promise<Pattern | null> {
    const updated = await this.repository.update(id, updates);
    
    if (updated) {
      // Invalidate cache
      this.cache.delete(`pattern:${id}`);
    }
    
    return updated;
  }

  /**
   * Delete a pattern
   */
  async deletePattern(id: string): Promise<boolean> {
    const deleted = await this.repository.delete(id);
    
    if (deleted) {
      // Invalidate cache
      this.cache.delete(`pattern:${id}`);
    }
    
    return deleted;
  }

  /**
   * Count patterns with optional filters
   */
  async countPatterns(filters?: any): Promise<number> {
    return await this.repository.count(filters);
  }

  /**
   * Check if pattern exists
   */
  async patternExists(id: string): Promise<boolean> {
    // Check cache first
    const cached = this.cache.getPattern(id);
    if (cached) {
      return true;
    }

    return await this.repository.exists(id);
  }

  /**
   * Clear all pattern caches
   */
  clearCache(): void {
    this.cache.clear();
  }
}
