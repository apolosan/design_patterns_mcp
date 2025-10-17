/**
 * Vector Operations Service for Design Patterns MCP Server
 * Handles vector embeddings, similarity search, and vector database operations
 */
import { DatabaseManager } from './database-manager.js';
import {
  PatternVector,
  EmbeddingModel,
  VectorSearchResult,
  VectorSearchFilters,
  VectorSearchStrategy,
  VectorStats,
} from '../models/vector.js';
import { logger } from './logger.js';

interface VectorConfig {
  model: EmbeddingModel;
  dimensions: number;
  similarityThreshold: number;
  maxResults: number;
  cacheEnabled: boolean;
}

export class VectorOperationsService {
  private db: DatabaseManager;
  private config: VectorConfig;
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(db: DatabaseManager, config: VectorConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * Store pattern embedding
   */
  async storeEmbedding(patternId: string, embedding: number[]): Promise<void> {
    try {
      // Validate embedding dimensions
      if (embedding.length !== this.config.dimensions) {
        throw new Error(
          `Embedding dimensions mismatch: expected ${this.config.dimensions}, got ${embedding.length}`
        );
      }

      const sql = `
        INSERT OR REPLACE INTO pattern_embeddings (
          pattern_id, embedding, model, strategy, dimensions, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      const params = [
        patternId,
        JSON.stringify(embedding),
        this.config.model,
        'semantic', // Default strategy
        embedding.length, // Dimensions
        new Date().toISOString(),
      ];

      this.db.execute(sql, params);

      // Update cache if enabled
      if (this.config.cacheEnabled) {
        this.embeddingCache.set(patternId, embedding);
      }

      logger.info('vector-operations', `Stored embedding for pattern: ${patternId}`);
    } catch (error) {
      console.error(`Failed to store embedding for pattern ${patternId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve pattern embedding
   */
  async getEmbedding(patternId: string): Promise<number[] | null> {
    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = this.embeddingCache.get(patternId);
        if (cached) {
          return cached;
        }
      }

      const sql = 'SELECT embedding FROM pattern_embeddings WHERE pattern_id = ?';
      const row = this.db.queryOne<{ embedding: string }>(sql, [patternId]);

      if (!row) {
        return null;
      }

      const embedding = JSON.parse(row.embedding);

      // Update cache
      if (this.config.cacheEnabled) {
        this.embeddingCache.set(patternId, embedding);
      }

      return embedding;
    } catch (error) {
      console.error(`Failed to retrieve embedding for pattern ${patternId}:`, error);
      return null;
    }
  }

  /**
   * Delete pattern embedding
   */
  async deleteEmbedding(patternId: string): Promise<void> {
    try {
      const sql = 'DELETE FROM pattern_embeddings WHERE pattern_id = ?';
      this.db.execute(sql, [patternId]);

      // Remove from cache
      if (this.config.cacheEnabled) {
        this.embeddingCache.delete(patternId);
      }

      logger.info('vector-operations', `Deleted embedding for pattern: ${patternId}`);
    } catch (error) {
      console.error(`Failed to delete embedding for pattern ${patternId}:`, error);
      throw error;
    }
  }

  /**
   * Perform vector similarity search
   */
  async searchSimilar(
    queryEmbedding: number[],
    filters?: VectorSearchFilters,
    limit?: number
  ): Promise<VectorSearchResult[]> {
    try {
      const maxResults = limit || this.config.maxResults;

      // Get all embeddings (in production, use vector database with indexing)
      const sql = 'SELECT pattern_id, embedding FROM pattern_embeddings';
      const rows = this.db.query<{ pattern_id: string; embedding: string }>(sql);

      const results: VectorSearchResult[] = [];

      for (const row of rows) {
        const embedding = JSON.parse(row.embedding);
        const similarity = this.calculateSimilarity(queryEmbedding, embedding);

        // Apply filters
        if (filters && !(await this.matchesFilters(row.pattern_id, filters))) {
          continue;
        }

        results.push({
          patternId: row.pattern_id,
          score: similarity,
          distance: 1 - similarity, // Convert similarity to distance
          rank: 0, // Will be set after sorting
          pattern: await this.getPatternInfo(row.pattern_id),
        });
      }

      // Sort by similarity score (descending)
      results.sort((a, b) => b.score - a.score);

      // Apply threshold and limit
      const filteredResults = results
        .filter(result => result.score >= 0.1) // Lower threshold for better results
        .slice(0, maxResults);

      // Set ranks
      filteredResults.forEach((result, index) => {
        result.rank = index + 1;
      });

      return filteredResults;
    } catch (error) {
      console.error('Vector search failed:', error);
      throw error;
    }
  }

  /**
   * Calculate similarity between two vectors
   */
  private calculateSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vector dimensions do not match');
    }

    switch (this.config.model) {
      case 'all-MiniLM-L6-v2':
      case 'all-MiniLM-L12-v2':
      case 'all-mpnet-base-v2':
        return this.cosineSimilarity(vec1, vec2);
      default:
        return this.cosineSimilarity(vec1, vec2);
    }
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Check if pattern matches search filters
   */
  private async matchesFilters(patternId: string, filters: VectorSearchFilters): Promise<boolean> {
    try {
      // Get pattern information
      const pattern = await this.getPatternInfo(patternId);

      // Category filter
      if (filters.categories && filters.categories.length > 0) {
        if (!filters.categories.includes(pattern.category)) {
          return false;
        }
      }

      // Complexity filter
      if (filters.complexity && filters.complexity.length > 0) {
        // This would need pattern data - simplified for now
        // In production, join with patterns table
      }

      // Usage count filter
      if (filters.minUsageCount) {
        // This would need usage analytics - simplified for now
      }

      return true;
    } catch (error) {
      console.error(`Filter check failed for pattern ${patternId}:`, error);
      return false;
    }
  }

  /**
   * Get pattern information for search results
   */
  private async getPatternInfo(
    patternId: string
  ): Promise<{ id: string; name: string; category: string; description: string }> {
    try {
      const sql = 'SELECT id, name, category, description FROM patterns WHERE id = ?';
      const pattern = this.db.queryOne<{
        id: string;
        name: string;
        category: string;
        description: string;
      }>(sql, [patternId]);

      return (
        pattern || {
          id: patternId,
          name: 'Unknown Pattern',
          category: 'Unknown',
          description: 'Pattern information not available',
        }
      );
    } catch (error) {
      console.error(`Failed to get pattern info for ${patternId}:`, error);
      return {
        id: patternId,
        name: 'Unknown Pattern',
        category: 'Unknown',
        description: 'Pattern information not available',
      };
    }
  }

  /**
   * Batch store embeddings
   */
  async storeEmbeddingsBatch(
    embeddings: Array<{ patternId: string; embedding: number[] }>
  ): Promise<void> {
    this.db.transaction(() => {
      for (const { patternId, embedding } of embeddings) {
        this.storeEmbedding(patternId, embedding);
      }
    });

    logger.info('vector-operations', `Stored ${embeddings.length} embeddings in batch`);
  }

  /**
   * Get vector statistics
   */
  async getStats(): Promise<VectorStats> {
    try {
      const totalEmbeddings = this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM pattern_embeddings'
      );

      const modelStats = this.db.query<{ model: string; count: number }>(
        'SELECT model, COUNT(*) as count FROM pattern_embeddings GROUP BY model'
      );

      // Calculate average dimensions (simplified)
      const dimensions = this.config.dimensions;

      // Get storage size estimate
      const dbStats = this.db.getStats();

      return {
        totalVectors: totalEmbeddings?.count || 0,
        embeddingModel: this.config.model,
        dimensions: this.config.dimensions,
        averageDimensions: dimensions,
        storageSize: dbStats.databaseSize,
        indexBuildTime: undefined, // Would need to track this
        lastUpdated: new Date(),
        averageSimilarity: 0.5, // Default value
      };
    } catch (error) {
      console.error('Failed to get vector stats:', error);
      throw error;
    }
  }

  /**
   * Clear all embeddings
   */
  async clearAll(): Promise<void> {
    try {
      const sql = 'DELETE FROM pattern_embeddings';
      this.db.execute(sql);

      // Clear cache
      this.embeddingCache.clear();

      logger.info('vector-operations', 'All embeddings cleared');
    } catch (error) {
      console.error('Failed to clear embeddings:', error);
      throw error;
    }
  }

  /**
   * Rebuild embeddings from patterns
   */
  async rebuildEmbeddings(generateEmbeddingFn: (text: string) => Promise<number[]>): Promise<void> {
    try {
      // Clear existing embeddings
      await this.clearAll();

      // Get all patterns
      const patterns = this.db.query<{ id: string; name: string; description: string }>(
        'SELECT id, name, description FROM patterns'
      );

      logger.info('vector-operations', `Rebuilding embeddings for ${patterns.length} patterns`);

      const embeddings: Array<{ patternId: string; embedding: number[] }> = [];

      for (const pattern of patterns) {
        const text = `${pattern.name} ${pattern.description}`;
        const embedding = await generateEmbeddingFn(text);
        embeddings.push({ patternId: pattern.id, embedding });
      }

      // Store in batches
      const batchSize = 10;
      for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = embeddings.slice(i, i + batchSize);
        await this.storeEmbeddingsBatch(batch);
      }

      logger.info('vector-operations', `Rebuilt embeddings for ${embeddings.length} patterns`);
    } catch (error) {
      console.error('Failed to rebuild embeddings:', error);
      throw error;
    }
  }

  /**
   * Find similar patterns by pattern ID
   */
  async findSimilarPatterns(patternId: string, limit?: number): Promise<VectorSearchResult[]> {
    const embedding = await this.getEmbedding(patternId);

    if (!embedding) {
      throw new Error(`No embedding found for pattern: ${patternId}`);
    }

    return this.searchSimilar(embedding, { excludePatterns: [patternId] }, limit);
  }

  /**
   * Calculate cluster centroids for pattern categorization
   */
  async calculateClusters(
    clusterCount: number
  ): Promise<Array<{ centroid: number[]; patterns: string[] }>> {
    try {
      // Get all embeddings
      const embeddings = this.db.query<{ pattern_id: string; embedding: string }>(
        'SELECT pattern_id, embedding FROM pattern_embeddings'
      );

      if (embeddings.length < clusterCount) {
        throw new Error('Not enough embeddings for requested cluster count');
      }

      // Simple K-means clustering (simplified implementation)
      const vectors = embeddings.map(e => ({
        id: e.pattern_id,
        vector: JSON.parse(e.embedding),
      }));

      const clusters = this.simpleKMeans(vectors, clusterCount);

      return clusters.map(cluster => ({
        centroid: cluster.centroid,
        patterns: cluster.patterns.map(p => p.id),
      }));
    } catch (error) {
      console.error('Failed to calculate clusters:', error);
      throw error;
    }
  }

  /**
   * Simple K-means clustering implementation
   */
  private simpleKMeans(
    vectors: Array<{ id: string; vector: number[] }>,
    k: number,
    maxIterations: number = 100
  ) {
    // Initialize centroids randomly
    const centroids = vectors.slice(0, k).map(v => [...v.vector]);

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign vectors to nearest centroid
      const clusters: Array<{
        centroid: number[];
        patterns: Array<{ id: string; vector: number[] }>;
      }> = centroids.map(centroid => ({ centroid, patterns: [] }));

      for (const vector of vectors) {
        let minDistance = Infinity;
        let closestCluster = 0;

        for (let i = 0; i < centroids.length; i++) {
          const distance = this.euclideanDistance(vector.vector, centroids[i]);
          if (distance < minDistance) {
            minDistance = distance;
            closestCluster = i;
          }
        }

        clusters[closestCluster].patterns.push(vector);
      }

      // Update centroids
      let converged = true;
      for (let i = 0; i < k; i++) {
        const cluster = clusters[i];
        if (cluster.patterns.length > 0) {
          const newCentroid = this.calculateCentroid(cluster.patterns.map(p => p.vector));
          if (!this.vectorsEqual(centroids[i], newCentroid)) {
            centroids[i] = newCentroid;
            converged = false;
          }
        }
      }

      if (converged) {
        break;
      }
    }

    return centroids.map((centroid, index) => ({
      centroid,
      patterns: vectors.filter(vector => {
        let minDistance = Infinity;
        let closestCentroid = 0;

        for (let i = 0; i < centroids.length; i++) {
          const distance = this.euclideanDistance(vector.vector, centroids[i]);
          if (distance < minDistance) {
            minDistance = distance;
            closestCentroid = i;
          }
        }

        return closestCentroid === index;
      }),
    }));
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  private euclideanDistance(vec1: number[], vec2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += Math.pow(vec1[i] - vec2[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * Calculate centroid of multiple vectors
   */
  private calculateCentroid(vectors: number[][]): number[] {
    const dimensions = vectors[0].length;
    const centroid = new Array(dimensions).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += vector[i];
      }
    }

    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= vectors.length;
    }

    return centroid;
  }

  /**
   * Check if two vectors are equal
   */
  private vectorsEqual(vec1: number[], vec2: number[], tolerance: number = 0.0001): boolean {
    if (vec1.length !== vec2.length) {
      return false;
    }

    for (let i = 0; i < vec1.length; i++) {
      if (Math.abs(vec1[i] - vec2[i]) > tolerance) {
        return false;
      }
    }

    return true;
  }
}

// Default configuration
const DEFAULT_VECTOR_CONFIG: VectorConfig = {
  model: 'all-MiniLM-L6-v2',
  dimensions: 384,
  similarityThreshold: 0.3,
  maxResults: 10,
  cacheEnabled: true,
};

// Factory function
export function createVectorOperationsService(
  db: DatabaseManager,
  config?: Partial<VectorConfig>
): VectorOperationsService {
  const finalConfig = { ...DEFAULT_VECTOR_CONFIG, ...config };
  return new VectorOperationsService(db, finalConfig);
}
