/**
 * Search Strategy Types
 * Defines interfaces for blended search architecture with dense + sparse indexes
 * Based on arXiv 2404.07220 (Blended RAG) and 2409.17383 (VectorSearch)
 */

/**
 * Search strategy types for blended retrieval
 */
export type SearchStrategyType = 
  | 'dense'           // Vector embeddings (semantic)
  | 'sparse'          // BM25/TF-IDF (keyword)
  | 'hybrid'          // Combined dense + sparse
  | 'graph'           // Graph-augmented
  | 'multi-hop';      // Multi-hop reasoning

/**
 * Configuration for blended search strategy
 */
export interface BlendedSearchConfig {
  denseWeight: number;      // Weight for dense vector search (0.0-1.0)
  sparseWeight: number;     // Weight for sparse keyword search (0.0-1.0)
  boostExactMatches: boolean; // Boost exact keyword matches
  minDiversityScore: number;  // Minimum diversity score for results
  maxResults: number;       // Maximum number of results to return
  similarityThreshold: number; // Minimum similarity threshold
}

/**
 * Sparse index configuration (BM25/TF-IDF)
 */
export interface SparseIndexConfig {
  k1: number;        // BM25 parameter (term frequency saturation)
  b: number;         // BM25 parameter (document length normalization)
  epsilon: number;   // BM25 parameter (lower bound for IDF)
  minTermFrequency: number; // Minimum term frequency for inclusion
}

/**
 * Graph augmentation configuration
 */
export interface GraphAugmentationConfig {
  k: number;         // k for kNN graph construction
  maxHops: number;   // Maximum traversal hops
  edgeWeightThreshold: number; // Minimum edge weight
  useMetadataEdges: boolean;   // Include category/tag edges
}

/**
 * Semantic compression configuration
 */
export interface SemanticCompressionConfig {
  targetSize: number;       // Target number of results
  coverageThreshold: number; // Minimum coverage (0.0-1.0)
  diversityWeight: number;   // Weight for diversity vs relevance
  algorithm: 'mmr' | 'dpp' | 'submodular'; // Compression algorithm
}

/**
 * Query analysis results for dynamic tuning
 */
export interface QueryAnalysis {
  query: string;
  length: number;
  wordCount: number;
  technicalTerms: string[];
  entropy: number;
  hasCodeSnippet: boolean;
  queryType: 'exploratory' | 'specific' | 'balanced';
  recommendedStrategy: SearchStrategyType;
  confidence: number;
}

/**
 * Search context for tracking execution
 */
export interface SearchContext {
  id: string;
  query: string;
  timestamp: Date;
  strategy: SearchStrategyType;
  config: BlendedSearchConfig;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Dense vector result
 */
export interface DenseResult {
  patternId: string;
  similarity: number;  // Cosine similarity (0.0-1.0)
  distance: number;    // L2 distance
  embedding: number[];
  rank: number;
}

/**
 * Sparse keyword result
 */
export interface SparseResult {
  patternId: string;
  score: number;       // BM25/TF-IDF score
  termMatches: Array<{
    term: string;
    tf: number;
    idf: number;
    weight: number;
  }>;
  rank: number;
}

/**
 * Graph traversal result
 */
export interface GraphResult {
  patternId: string;
  path: string[];      // Traversal path
  hops: number;
  edgeWeights: number[];
  cumulativeScore: number;
}

/**
 * Combined blended result
 */
export interface BlendedResult {
  patternId: string;
  finalScore: number;
  denseScore?: number;
  sparseScore?: number;
  graphScore?: number;
  diversityScore?: number;
  matchTypes: Array<'dense' | 'sparse' | 'graph'>;
  reasons: string[];
  metadata: {
    queryAnalysis: QueryAnalysis;
    weights: {
      dense: number;
      sparse: number;
      graph: number;
    };
  };
}

/**
 * Search metrics for telemetry
 */
export interface SearchMetrics {
  contextId: string;
  query: string;
  strategy: SearchStrategyType;
  durationMs: number;
  resultsCount: number;
  cacheHit: boolean;
  timestamp: Date;
  denseSearchTime?: number;
  sparseSearchTime?: number;
  graphTraversalTime?: number;
  compressionTime?: number;
  diversityScore?: number;
  avgRelevance: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
}

/**
 * Search execution trace
 */
export interface SearchTrace {
  contextId: string;
  steps: Array<{
    name: string;
    startTime: number;
    duration: number;
    inputSize?: number;
    outputSize?: number;
    embeddingsUsed?: number;
    cacheHit?: boolean;
    error?: string;
  }>;
}

/**
 * Result diversity metrics
 */
export interface DiversityMetrics {
  uniqueCategories: number;
  uniqueTags: number;
  semanticCoverage: number; // 0.0-1.0
  redundancyScore: number;  // Lower is better
  informationGain: number;  // Shannon entropy gain
}

/**
 * Sparse encoder interface for BM25/TF-IDF
 */
export interface SparseEncoder {
  /**
   * Index a document for sparse search
   */
  indexDocument(id: string, text: string): Promise<void>;
  
  /**
   * Search using sparse encoding
   */
  search(query: string, limit?: number): Promise<SparseResult[]>;
  
  /**
   * Get vocabulary statistics
   */
  getStats(): {
    totalDocuments: number;
    vocabularySize: number;
    avgDocLength: number;
  };
}

/**
 * Graph node for kNN overlay
 */
export interface GraphNode {
  id: string;
  embedding: number[];
  neighbors: Array<{
    id: string;
    distance: number;
    weight: number;
  }>;
  metadata?: {
    category?: string;
    tags?: string[];
  };
}

/**
 * Multi-hop reasoning result
 */
export interface MultiHopResult {
  patternId: string;
  reasoningPath: Array<{
    intermediatePattern: string;
    relation: string;
    confidence: number;
  }>;
  finalScore: number;
  depth: number;
}

/**
 * Semantic compression result
 */
export interface CompressedResult {
  patternId: string;
  score: number;
  diversityContribution: number;
  coverageContribution: number;
  selected: boolean;
  rationale: string;
}

/**
 * Search evaluation metrics
 */
export interface EvaluationMetrics {
  precisionAtK: number;
  recallAtK: number;
  ndcgAtK: number;  // Normalized Discounted Cumulative Gain
  mapAtK: number;   // Mean Average Precision
  diversityScore: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
}

/**
 * Adaptive weight configuration based on usage patterns
 */
export interface AdaptiveWeightConfig {
  userId?: string;
  queryPatterns: Record<string, number>; // Query pattern -> weight
  categoryPreferences: Record<string, number>;
  complexityPreference: 'low' | 'medium' | 'high';
  languagePreference?: string;
  lastUpdated: Date;
}