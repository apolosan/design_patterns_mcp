/**
 * PatternVector Model Interface
 * Semantic embeddings for pattern search and similarity
 */

export type EmbeddingModel = 'all-MiniLM-L6-v2' | 'all-MiniLM-L12-v2' | 'all-mpnet-base-v2' | 'text-embedding-ada-002' | 'custom';

export type VectorSearchStrategy = 'cosine' | 'euclidean' | 'dot_product';

export interface VectorSearchFilters {
  patternId?: string;
  category?: string;
  categories?: string[];
  complexity?: string;
  tags?: string[];
  minScore?: number;
  maxResults?: number;
  minUsageCount?: number;
  excludePatterns?: string[];
}

export interface PatternVector {
  /** References pattern */
  patternId: string;

  /** all-MiniLM-L6-v2 embedding vector */
  embedding: number[];

  /** Model used for generation */
  embeddingModel: string;

  /** Hash of source text for invalidation */
  textHash: string;

  /** Embedding generation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt?: Date;
}

/**
 * Vector creation input
 */
interface CreatePatternVectorInput {
  patternId: string;
  embedding: number[];
  embeddingModel: string;
  textHash: string;
}

/**
 * Vector update input
 */
interface UpdatePatternVectorInput extends Partial<CreatePatternVectorInput> {
  patternId: string;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  patternId: string;
  score: number;
  distance?: number;
  rank?: number;
  pattern?: {
    id: string;
    name: string;
    category: string;
    description: string;
  };
  embedding?: number[];
}

/**
 * Batch vector operation result
 */
interface BatchVectorResult {
  processed: number;
  failed: number;
  errors: string[];
  processingTime: number;
}

/**
 * Vector similarity search options
 */
interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  includeEmbeddings?: boolean;
  normalize?: boolean;
}

/**
 * Embedding generation configuration
 */
interface EmbeddingConfig {
  model: string;
  dimensions: number;
  normalize: boolean;
  batchSize: number;
  textFields: string[];
}

/**
 * Vector database statistics
 */
export interface VectorStats {
  totalVectors: number;
  embeddingModel: string;
  dimensions: number;
  averageDimensions?: number;
  storageSize?: number;
  indexBuildTime?: number;
  lastUpdated: Date;
  averageSimilarity: number;
}

/**
 * Vector validation result
 */
interface VectorValidation {
  isValid: boolean;
  dimension: number;
  normalized: boolean;
  issues: string[];
}

/**
 * Similarity computation result
 */
interface SimilarityResult {
  patternId: string;
  similarity: number;
  distance: number;
  method: 'cosine' | 'euclidean' | 'dot_product';
}