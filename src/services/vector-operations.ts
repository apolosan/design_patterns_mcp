/**
 * Vector Operations Service for Design Patterns MCP Server
 * Handles vector embeddings, similarity search, and vector database operations
 */
import { DatabaseManager } from './database-manager.js';
import { EmbeddingCompressor } from './embedding-compressor.js';
import { AdvancedEmbeddingCompressor } from './advanced-embedding-compressor.js';
import {
  EmbeddingModel,
  VectorSearchResult,
  VectorSearchFilters,
  VectorStats,
} from '../models/vector.js';
import { logger } from './logger.js';

export interface VectorConfig {
  model: EmbeddingModel;
  dimensions: number;
  similarityThreshold: number;
  maxResults: number;
  cacheEnabled: boolean;
  enableCompression?: boolean;
  compressionConfig?: {
    targetVariance?: number;
    maxDimensions?: number;
    quantizationBits?: 4 | 8 | 16;
    minAccuracyDrop?: number;
  };
}

export class VectorOperationsService {
  private db: DatabaseManager;
  private config: VectorConfig;
  private embeddingCache: Map<string, number[]> = new Map();
  private compressor: AdvancedEmbeddingCompressor | EmbeddingCompressor | null = null;

  constructor(db: DatabaseManager, config: VectorConfig, compressor?: AdvancedEmbeddingCompressor | EmbeddingCompressor) {
    this.db = db;
    this.config = config;
    
    if (compressor) {
      this.compressor = compressor;
    } else if (config.enableCompression) {
      // Create default advanced compressor if compression enabled
      this.compressor = new AdvancedEmbeddingCompressor({
        targetVariance: config.compressionConfig?.targetVariance ?? 0.95,
        maxDimensions: config.compressionConfig?.maxDimensions ?? 128,
        quantizationBits: config.compressionConfig?.quantizationBits ?? 8,
        minAccuracyDrop: config.compressionConfig?.minAccuracyDrop ?? 0.05,
      });
    }
  }

  /**
   * Compress embedding using available compressor
   */
  async compressEmbedding(embedding: number[]): Promise<{
    compressed: number[] | Int8Array | Uint8Array | Int16Array;
    metadata: Record<string, any>;
    stats: {
      originalSize: number;
      compressedSize: number;
      compressionRatio: number;
      memorySavings: number;
      accuracyDrop: number;
    };
  }> {
    if (!this.compressor) {
      throw new Error('Compression not enabled');
    }

    if (this.compressor instanceof AdvancedEmbeddingCompressor) {
      const result = await this.compressor.compress(embedding);
      return {
        compressed: result.compressed,
        metadata: result.metadata,
        stats: result.stats,
      };
    } else {
      // Use basic compressor
      const basis = this.compressor.buildPCABasis([embedding]);
      const { compressed, quantized, stats } = this.compressor.compressWithQualityControl(embedding, basis);
      return {
        compressed: quantized.quantized,
        metadata: {
          scale: quantized.scale,
          zeroPoint: quantized.zeroPoint,
          pcaBasis: basis,
        },
        stats: {
          originalSize: stats.originalSize,
          compressedSize: stats.compressedSize,
          compressionRatio: stats.compressionRatio,
          memorySavings: ((stats.originalSize - stats.compressedSize) / stats.originalSize) * 100,
          accuracyDrop: stats.errorRate,
        },
      };
    }
  }

  /**
   * Decompress embedding
   */
  decompressEmbedding(
    compressed: number[] | Int8Array | Uint8Array | Int16Array,
    metadata: Record<string, any>
  ): number[] {
    if (!this.compressor) {
      throw new Error('Compression not enabled');
    }

    if (this.compressor instanceof AdvancedEmbeddingCompressor) {
      // Advanced compressor doesn't have built-in decompression yet
      // For now, return as-is if it's an array
      if (Array.isArray(compressed)) {
        return compressed;
      } else if (compressed instanceof Int8Array || compressed instanceof Uint8Array) {
        // Simple dequantization
        const scale = metadata.quantizationScale || 1.0;
        const zeroPoint = metadata.quantizationZeroPoint || 0;
        const result: number[] = [];
        for (let i = 0; i < compressed.length; i++) {
          result.push((compressed[i] - zeroPoint) * scale);
        }
        return result;
      } else if (compressed instanceof Int16Array) {
        const scale = metadata.quantizationScale || 1.0;
        const zeroPoint = metadata.quantizationZeroPoint || 0;
        const result: number[] = [];
        for (let i = 0; i < compressed.length; i++) {
          result.push((compressed[i] - zeroPoint) * scale);
        }
        return result;
      }
      throw new Error('Unsupported compressed format');
    } else {
      // Basic compressor
      if (compressed instanceof Int8Array || compressed instanceof Uint8Array) {
        return this.compressor.dequantize8Bit(
          compressed,
          metadata.scale,
          metadata.zeroPoint
        );
      } else if (Array.isArray(compressed)) {
        return compressed;
      }
      throw new Error('Unsupported compressed format');
    }
  }

  /**
   * Store embedding with optional compression
   */
  async storeEmbeddingWithCompression(
    patternId: string,
    embedding: number[],
    compress: boolean = false
  ): Promise<{
    storedSize: number;
    compressed: boolean;
    compressionStats?: any;
  }> {
    let finalEmbedding = embedding;
    let compressed = false;
    let compressionStats: any = null;

    if (compress && this.compressor) {
      try {
        const result = await this.compressEmbedding(embedding);
        finalEmbedding = this.decompressEmbedding(result.compressed, result.metadata);
        compressionStats = result.stats;
        compressed = true;
        
        logger.info('vector-operations', 'Embedding compressed', {
          patternId,
          compressionRatio: compressionStats.compressionRatio.toFixed(2),
          memorySavings: compressionStats.memorySavings.toFixed(1) + '%',
          accuracyDrop: compressionStats.accuracyDrop.toFixed(3),
        });
      } catch (error) {
        logger.warn('vector-operations', 'Compression failed, storing uncompressed', {
          patternId,
          error: (error as Error).message,
        });
      }
    }

    this.storeEmbedding(patternId, finalEmbedding);
    
    return {
      storedSize: finalEmbedding.length * 4,
      compressed,
      compressionStats,
    };
  }

  /**
   * Create vector index for performance optimization
   */
  createVectorIndex(): void {
    try {
      // Create virtual table for vector search using sqlite-vec
      this.db.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_pattern_embeddings 
        USING vec0(
          pattern_id TEXT PRIMARY KEY,
          embedding FLOAT[${this.config.dimensions}]
        )
      `);

      // Populate the vector index from existing embeddings
      this.db.execute(`
        INSERT OR REPLACE INTO vec_pattern_embeddings(pattern_id, embedding)
        SELECT pattern_id, embedding FROM pattern_embeddings
      `);

      logger.info('vector-operations', 'Vector index created successfully');
    } catch (error) {
      console.error('Failed to create vector index:', error);
      throw error;
    }
  }

  /**
   * Check if vector index exists
   */
  hasVectorIndex(): boolean {
    try {
      const result = this.db.queryOne<{ count: number }>(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type = 'virtual table' AND name = 'vec_pattern_embeddings'
      `);
      return result ? result.count > 0 : false;
    } catch {
      return false;
    }
  }

  /**
   * Store pattern embedding
   */
  storeEmbedding(patternId: string, embedding: number[]): void {
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
  getEmbedding(patternId: string): number[] | null {
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

      const embedding = JSON.parse(row.embedding) as number[];

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
  deleteEmbedding(patternId: string): void {
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
  searchSimilar(
    queryEmbedding: number[],
    filters?: VectorSearchFilters,
    limit?: number
  ): VectorSearchResult[] {
    try {
      const maxResults = limit ?? this.config.maxResults;

      // Try indexed vector search first (optimized path)
      const indexedResults = this.tryIndexedVectorSearch(queryEmbedding, filters, maxResults);
      if (indexedResults) {
        return indexedResults;
      }

      // Fallback to linear search (backward compatibility)
      return this.linearVectorSearch(queryEmbedding, filters, maxResults);
    } catch (error) {
      console.error('Vector search failed:', error);
      throw error;
    }
  }

  /**
   * Attempt indexed vector search using sqlite-vec
   */
  private tryIndexedVectorSearch(
    queryEmbedding: number[],
    filters?: VectorSearchFilters,
    maxResults?: number
  ): VectorSearchResult[] | null {
    try {
      // Check if vector index exists
      const indexCheck = this.db.queryOne<{ count: number }>(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type = 'virtual table' AND name = 'vec_pattern_embeddings'
      `);

      if (!indexCheck || indexCheck.count === 0) {
        return null; // No vector index available
      }

      // Build WHERE clause for filters
      const whereConditions: string[] = [];
      const whereParams: (string | number)[] = [];

      if (filters) {
        if (filters.categories && filters.categories.length > 0) {
          const placeholders = filters.categories.map(() => '?').join(',');
          whereConditions.push(`p.category IN (${placeholders})`);
          whereParams.push(...filters.categories);
        }

        if (filters.complexity) {
          whereConditions.push('p.complexity = ?');
          whereParams.push(filters.complexity);
        }

        if (filters.tags && filters.tags.length > 0) {
          const tagConditions = filters.tags.map(() => 'JSON_EXTRACT(p.tags, ?)').join(' OR ');
          whereConditions.push(`(${tagConditions})`);
          whereParams.push(...filters.tags.map(tag => `$.${tag}`));
        }

        if (filters.excludePatterns && filters.excludePatterns.length > 0) {
          const placeholders = filters.excludePatterns.map(() => '?').join(',');
          whereConditions.push(`pe.pattern_id NOT IN (${placeholders})`);
          for (const pattern of filters.excludePatterns) {
            whereParams.push(pattern);
          }
        }
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Use sqlite-vec for indexed vector search
      const sql = `
        SELECT 
          pe.pattern_id,
          pe.embedding,
          vec_distance_l2(pe.embedding, ?) as distance,
          p.name,
          p.category,
          p.description,
          p.tags
        FROM pattern_embeddings pe
        JOIN patterns p ON pe.pattern_id = p.id
        ${whereClause}
        ORDER BY vec_distance_l2(pe.embedding, ?)
        LIMIT ?
      `;

      const params: (string | number)[] = [
        JSON.stringify(queryEmbedding),
        ...whereParams,
        JSON.stringify(queryEmbedding),
        maxResults ?? this.config.maxResults
      ];

      interface VectorSearchRow {
        pattern_id: string;
        embedding: string;
        distance: number;
        name: string;
        category: string;
        description: string;
        tags: string | null;
      }

      const rows = this.db.query<VectorSearchRow>(sql, params);

      const results: VectorSearchResult[] = rows.map((row, index) => ({
        patternId: row.pattern_id,
        score: 1 / (1 + row.distance), // Convert distance to similarity score
        distance: row.distance,
        rank: index + 1,
        pattern: {
          id: row.pattern_id,
          name: row.name,
          category: row.category,
          description: row.description,
          tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
        },
      }));

      // Apply minimum score threshold
      const minScore = filters?.minScore ?? 0.1;
      return results.filter(result => result.score >= minScore);
    } catch (error) {
      // Indexed search failed, fall back to linear search
      logger.debug('vector-operations', 'Indexed search failed, falling back to linear search', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Linear vector search (fallback method)
   */
  private linearVectorSearch(
    queryEmbedding: number[],
    filters?: VectorSearchFilters,
    maxResults?: number
  ): VectorSearchResult[] {
    const limit = maxResults ?? this.config.maxResults;

    // Get all embeddings
    const sql = 'SELECT pattern_id, embedding FROM pattern_embeddings';
    const rows = this.db.query<{ pattern_id: string; embedding: string }>(sql);

    const results: VectorSearchResult[] = [];

    for (const row of rows) {
      const embedding = JSON.parse(row.embedding) as number[];
      const similarity = this.calculateSimilarity(queryEmbedding, embedding);

      // Apply filters
      if (filters && !(this.matchesFilters(row.pattern_id, filters))) {
        continue;
      }

      results.push({
        patternId: row.pattern_id,
        score: similarity,
        distance: 1 - similarity, // Convert similarity to distance
        rank: 0, // Will be set after sorting
        pattern: this.getPatternInfo(row.pattern_id) ?? undefined,
      });
    }

    // Sort by similarity score (descending)
    results.sort((a, b) => b.score - a.score);

    // Apply threshold and limit
    const minScore = filters?.minScore ?? 0.1;
    const filteredResults = results
      .filter(result => result.score >= minScore)
      .slice(0, limit);

    // Set ranks
    filteredResults.forEach((result, index) => {
      result.rank = index + 1;
    });

    return filteredResults;
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
  private matchesFilters(patternId: string, filters: VectorSearchFilters): boolean {
    try {
      // Get pattern information
      const pattern = this.getPatternInfo(patternId);

      if (!pattern) {
        return false;
      }

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
  private getPatternInfo(
    patternId: string
  ): { id: string; name: string; category: string; description: string; tags: string[] } | null {
    try {
      const sql = 'SELECT id, name, category, description, tags FROM patterns WHERE id = ?';
      const pattern = this.db.queryOne<{
        id: string;
        name: string;
        category: string;
        description: string;
        tags: string;
      }>(sql, [patternId]);

      if (pattern) {
        return {
          ...pattern,
          tags: pattern.tags ? pattern.tags.split(',').filter(Boolean) : [],
        };
      }

      return {
        id: patternId,
        name: 'Unknown Pattern',
        category: 'Unknown',
        description: 'Pattern information not available',
        tags: [],
      };
    } catch (error) {
      logger.error('vector-operations', 'Failed to get pattern info', error as Error, { patternId });
      return {
        id: patternId,
        name: 'Unknown Pattern',
        category: 'Unknown',
        description: 'Pattern information not available',
        tags: [],
      };
    }
  }

  /**
   * Batch store embeddings
   */
  storeEmbeddingsBatch(
    embeddings: Array<{ patternId: string; embedding: number[] }>
  ): void {
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
  getStats(): VectorStats {
    try {
      const totalEmbeddings = this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM pattern_embeddings'
      );



      // Calculate average dimensions (simplified)
      const dimensions = this.config.dimensions;

      // Get storage size estimate
      const dbStats = this.db.getStats();

      return {
        totalVectors: totalEmbeddings?.count ?? 0,
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
  clearAll(): void {
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
      this.clearAll();

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
        this.storeEmbeddingsBatch(batch);
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
  findSimilarPatterns(patternId: string, limit?: number): VectorSearchResult[] {
    const embedding = this.getEmbedding(patternId);

    if (!embedding) {
      throw new Error(`No embedding found for pattern: ${patternId}`);
    }

    return this.searchSimilar(embedding, { excludePatterns: [patternId] }, limit);
  }

  /**
   * Calculate cluster centroids for pattern categorization
   */
  calculateClusters(
    clusterCount: number
  ): Array<{ centroid: number[]; patterns: string[] }> {
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
        vector: JSON.parse(e.embedding) as number[],
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
    const centroid: number[] = Array<number>(dimensions).fill(0);

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
