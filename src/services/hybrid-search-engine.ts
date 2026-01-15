/**
 * Hybrid Search Engine
 * Implements Blended RAG with dense + sparse indexes + graph augmentation
 * Based on arXiv 2404.07220 (Blended RAG) and 2409.17383 (VectorSearch)
 */

import { VectorOperationsService } from './vector-operations.js';
import { DatabaseManager } from './database-manager.js';
import { logger } from './logger.js';
import { CacheService } from './cache.js';
import { TelemetryService } from './telemetry-service.js';
import {
  BlendedSearchConfig,
  BlendedResult,
  DenseResult,
  SparseResult,
  GraphResult,
  QueryAnalysis,
  SearchContext,
  SearchMetrics,
  SearchTrace,
  SparseEncoder,
  SemanticCompressionConfig,
  CompressedResult,
  MultiHopResult,
} from '../types/search-strategy.js';

/**
 * Sparse encoder implementation using simple TF-IDF
 * In production, this could use BM25 or external libraries
 */
class SimpleSparseEncoder implements SparseEncoder {
  private db: DatabaseManager;
  private documentStats: Map<string, { tf: Map<string, number>; length: number }> = new Map();
  private vocabulary: Map<string, number> = new Map(); // term -> document frequency
  private totalDocs = 0;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  async indexDocument(id: string, text: string): Promise<void> {
    const terms = this.tokenize(text);
    const tf = new Map<string, number>();
    
    for (const term of terms) {
      tf.set(term, (tf.get(term) || 0) + 1);
      
      // Update document frequency
      if (!this.vocabulary.has(term)) {
        this.vocabulary.set(term, 0);
      }
    }

    // Track which documents contain each term
    for (const term of tf.keys()) {
      // Store in database for persistent TF-IDF
      const termFreq = tf.get(term) ?? 0;
      this.db.execute(
        'INSERT OR REPLACE INTO sparse_terms (pattern_id, term, term_frequency) VALUES (?, ?, ?)',
        [id, term, termFreq]
      );
    }

    this.documentStats.set(id, { tf, length: terms.length });
    this.totalDocs++;
  }

  async search(query: string, limit: number = 10): Promise<SparseResult[]> {
    const queryTerms = this.tokenize(query);
    const results: SparseResult[] = [];

    // Get all patterns from database
    const patterns = this.db.query<{ id: string }>('SELECT id FROM patterns');

    for (const pattern of patterns) {
      let score = 0;
      const termMatches: SparseResult['termMatches'] = [];

      for (const term of queryTerms) {
        // Calculate TF for this pattern
        const termData = this.db.queryOne<{ term_frequency: number; doc_count: number }>(
          `SELECT st.term_frequency, COUNT(DISTINCT st.pattern_id) as doc_count
           FROM sparse_terms st
           WHERE st.term = ? AND st.pattern_id = ?`,
          [term, pattern.id]
        );

        if (termData) {
          const tf = termData.term_frequency;
          const df = termData.doc_count || 1;
          const idf = Math.log((this.totalDocs + 1) / (df + 1)) + 1;
          const termScore = tf * idf;

          score += termScore;
          termMatches.push({
            term,
            tf,
            idf,
            weight: termScore,
          });
        }
      }

      if (score > 0) {
        results.push({
          patternId: pattern.id,
          score,
          termMatches,
          rank: 0, // Will be set after sorting
        });
      }
    }

    // Normalize scores to 0-1 range
    const maxScore = Math.max(...results.map(r => r.score), 1);
    results.forEach(r => {
      r.score = r.score / maxScore;
      r.rank = 0;
    });

    // Sort and rank
    results.sort((a, b) => b.score - a.score);
    results.forEach((r, i) => r.rank = i + 1);

    return results.slice(0, limit);
  }

  getStats() {
    return {
      totalDocuments: this.totalDocs,
      vocabularySize: this.vocabulary.size,
      avgDocLength: 0, // Would need to calculate from stored data
    };
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'from'].includes(w));
  }
}

/**
 * Semantic compression engine using MMR (Maximal Marginal Relevance)
 * Based on arXiv 2507.19715
 */
class SemanticCompressionEngine {
  private config: SemanticCompressionConfig;

  constructor(config: SemanticCompressionConfig) {
    this.config = config;
  }

  /**
   * Compress results for diversity using MMR
   */
  compress(
    candidates: BlendedResult[],
    queryEmbedding: number[],
    similarityFn: (a: number[], b: number[]) => number
  ): CompressedResult[] {
    const selected: CompressedResult[] = [];
    const remaining = [...candidates];

    while (selected.length < this.config.targetSize && remaining.length > 0) {
      let bestCandidate: { index: number; score: number } | null = null;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const patternEmbedding = this.getEmbeddingForPattern(candidate.patternId); // Would need to fetch

        // Relevance score
        const relevanceScore = candidate.finalScore;

        // Diversity score (max similarity to already selected)
        let maxSimilarityToSelected = 0;
        for (const selectedResult of selected) {
          const selectedEmbedding = this.getEmbeddingForPattern(selectedResult.patternId);
          if (selectedEmbedding && patternEmbedding) {
            const sim = similarityFn(patternEmbedding, selectedEmbedding);
            maxSimilarityToSelected = Math.max(maxSimilarityToSelected, sim);
          }
        }

        // MMR score: balance relevance and diversity
        const diversityScore = 1 - maxSimilarityToSelected;
        const mmrScore = 
          this.config.coverageThreshold * relevanceScore +
          this.config.diversityWeight * diversityScore;

        if (!bestCandidate || mmrScore > bestCandidate.score) {
          bestCandidate = { index: i, score: mmrScore };
        }
      }

      if (bestCandidate) {
        const candidate = remaining.splice(bestCandidate.index, 1)[0];
        selected.push({
          patternId: candidate.patternId,
          score: candidate.finalScore,
          diversityContribution: bestCandidate.score - candidate.finalScore,
          coverageContribution: candidate.finalScore,
          selected: true,
          rationale: `MMR score: ${bestCandidate.score.toFixed(3)}`,
        });
      }
    }

    return selected;
  }

  private getEmbeddingForPattern(patternId: string): number[] | null {
    // This would fetch from vector operations service
    // For now, return null - integration happens at service level
    return null;
  }
}

/**
 * Main Hybrid Search Engine implementing Blended RAG
 */
export class HybridSearchEngine {
  private vectorOps: VectorOperationsService;
  private db: DatabaseManager;
  private cache: CacheService;
  private sparseEncoder: SimpleSparseEncoder;
  private compressionEngine: SemanticCompressionEngine;
  private config: BlendedSearchConfig;
  private telemetryService: TelemetryService | null;

  constructor(
    vectorOps: VectorOperationsService,
    db: DatabaseManager,
    cache: CacheService,
    config?: Partial<BlendedSearchConfig>,
    telemetryService?: TelemetryService
  ) {
    this.vectorOps = vectorOps;
    this.db = db;
    this.cache = cache;
    this.sparseEncoder = new SimpleSparseEncoder(db);
    this.compressionEngine = new SemanticCompressionEngine({
      targetSize: 10,
      coverageThreshold: 0.7,
      diversityWeight: 0.3,
      algorithm: 'mmr',
    });

    this.config = {
      denseWeight: config?.denseWeight ?? 0.6,
      sparseWeight: config?.sparseWeight ?? 0.4,
      boostExactMatches: config?.boostExactMatches ?? true,
      minDiversityScore: config?.minDiversityScore ?? 0.15,
      maxResults: config?.maxResults ?? 10,
      similarityThreshold: config?.similarityThreshold ?? 0.3,
    };
    this.telemetryService = telemetryService || null;
  }

  /**
   * Analyze query to determine optimal search strategy
   */
  analyzeQuery(query: string): QueryAnalysis {
    const words = query.split(/\s+/).filter(w => w.length > 0);
    const technicalTerms = ['pattern', 'factory', 'singleton', 'observer', 'strategy', 'adapter', 'bridge', 'proxy', 'facade', 'decorator', 'composite', 'iterator', 'mediator', 'memento', 'state', 'template', 'visitor', 'architecture', 'design'];
    
    const detectedTerms = words.filter(w => 
      technicalTerms.some(t => w.toLowerCase().includes(t))
    );

    const entropy = new Set(query.toLowerCase()).size / Math.max(query.length, 1);
    const hasCodeSnippet = /`[^`]+`|\{[^{]+\}/.test(query);
    
    let queryType: QueryAnalysis['queryType'] = 'balanced';
    let confidence = 0.5;
    let recommendedStrategy: QueryAnalysis['recommendedStrategy'] = 'hybrid';

    // Query type classification based on characteristics
    if (words.length <= 3 && detectedTerms.length > 0) {
      queryType = 'specific';
      confidence = 0.8;
      recommendedStrategy = 'sparse'; // Short specific queries work better with keyword
    } else if (words.length > 5 && entropy < 0.6) {
      queryType = 'exploratory';
      confidence = 0.75;
      recommendedStrategy = 'dense'; // Long exploratory queries benefit from semantic
    } else if (hasCodeSnippet) {
      queryType = 'specific';
      confidence = 0.7;
      recommendedStrategy = 'hybrid';
    } else if (entropy > 0.65 && words.length > 3) {
      queryType = 'exploratory';
      confidence = 0.6;
      recommendedStrategy = 'dense';
    }

    // Adjust strategy based on technical term density
    if (detectedTerms.length > 2) {
      if (recommendedStrategy !== 'dense') {
        recommendedStrategy = 'hybrid';
      }
      confidence += 0.1;
    }

    return {
      query,
      length: query.length,
      wordCount: words.length,
      technicalTerms: detectedTerms,
      entropy,
      hasCodeSnippet,
      queryType,
      recommendedStrategy,
      confidence: Math.min(1, confidence),
    };
  }

  /**
   * Perform dense vector search
   */
  private async denseSearch(
    queryEmbedding: number[],
    context: SearchContext
  ): Promise<DenseResult[]> {
    const startTime = Date.now();

    try {
      const results = this.vectorOps.searchSimilar(
        queryEmbedding,
        { minScore: this.config.similarityThreshold },
        this.config.maxResults * 2 // Get more for later fusion
      );

      const duration = Date.now() - startTime;

      // Log to trace
      this.logTraceStep(context, 'dense_search', duration, {
        embeddingsUsed: 1,
        resultCount: results.length,
      });

      return results.map((r, index) => ({
        patternId: r.patternId,
        similarity: r.score,
        distance: r.distance ?? (1 - r.score),
        embedding: [], // Would need to fetch
        rank: r.rank ?? index + 1,
      }));
    } catch (error) {
      logger.error('hybrid-search-engine', 'Dense search failed', error as Error);
      return [];
    }
  }

  /**
   * Perform sparse keyword search
   */
  private async sparseSearch(
    query: string,
    context: SearchContext
  ): Promise<SparseResult[]> {
    const startTime = Date.now();

    try {
      // Ensure sparse index is built
      await this.buildSparseIndex();

      const results = await this.sparseEncoder.search(query, this.config.maxResults * 2);

      const duration = Date.now() - startTime;

      this.logTraceStep(context, 'sparse_search', duration, {
        resultCount: results.length,
      });

      return results;
    } catch (error) {
      logger.error('hybrid-search-engine', 'Sparse search failed', error as Error);
      return [];
    }
  }

  /**
   * Build sparse index from database
   */
  private async buildSparseIndex(): Promise<void> {
    // Check if index is already built
    const indexCheck = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM sparse_terms'
    );

    if (indexCheck && indexCheck.count > 0) {
      return; // Index already exists
    }

    logger.info('hybrid-search-engine', 'Building sparse index');

    const patterns = this.db.query<{ id: string; name: string; description: string }>(
      'SELECT id, name, description FROM patterns'
    );

    for (const pattern of patterns) {
      const text = `${pattern.name} ${pattern.description}`;
      await this.sparseEncoder.indexDocument(pattern.id, text);
    }

    logger.info('hybrid-search-engine', `Sparse index built for ${patterns.length} patterns`);
  }

  /**
   * Reciprocal Rank Fusion (RRF)
   * Combines results from multiple search strategies
   */
  private reciprocalRankFusion(
    denseResults: DenseResult[],
    sparseResults: SparseResult[],
    graphResults: GraphResult[],
    weights: { dense: number; sparse: number; graph: number }
  ): BlendedResult[] {
    const combined = new Map<string, BlendedResult>();

    const addScore = (
      patternId: string,
      score: number,
      type: 'dense' | 'sparse' | 'graph',
      rank: number
    ) => {
      const rrfScore = 1 / (60 + rank); // RRF formula

      if (!combined.has(patternId)) {
        combined.set(patternId, {
          patternId,
          finalScore: 0,
          denseScore: 0,
          sparseScore: 0,
          graphScore: 0,
          matchTypes: [],
          reasons: [],
          metadata: {
            queryAnalysis: {} as QueryAnalysis, // Will be filled later
            weights: { ...weights },
          },
        });
      }

      const entry = combined.get(patternId)!;

      if (type === 'dense') {
        entry.denseScore = rrfScore * weights.dense;
        entry.reasons.push(`Dense match (rank ${rank}, score ${score.toFixed(3)})`);
      } else if (type === 'sparse') {
        entry.sparseScore = rrfScore * weights.sparse;
        entry.reasons.push(`Keyword match (rank ${rank}, score ${score.toFixed(3)})`);
      } else if (type === 'graph') {
        entry.graphScore = rrfScore * weights.graph;
        entry.reasons.push(`Graph traversal (hops ${graphResults.find(g => g.patternId === patternId)?.hops})`);
      }

      if (!entry.matchTypes.includes(type)) {
        entry.matchTypes.push(type);
      }
    };

    // Add all dense results
    denseResults.forEach(r => addScore(r.patternId, r.similarity, 'dense', r.rank));

    // Add all sparse results
    sparseResults.forEach(r => addScore(r.patternId, r.score, 'sparse', r.rank));

    // Add all graph results
    graphResults.forEach(r => addScore(r.patternId, r.cumulativeScore, 'graph', 1));

    // Calculate final scores and normalize
    const finalResults: BlendedResult[] = [];
    for (const entry of combined.values()) {
      const denseScore = entry.denseScore ?? 0;
      const sparseScore = entry.sparseScore ?? 0;
      const graphScore = entry.graphScore ?? 0;
      
      entry.finalScore = denseScore + sparseScore + graphScore;
      
      // Boost for hybrid matches
      if (entry.matchTypes.length > 1) {
        entry.finalScore *= 1.1;
        entry.reasons.push('Hybrid match boost applied');
      }

      entry.finalScore = Math.min(1, entry.finalScore);
      finalResults.push(entry);
    }

    return finalResults.sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Graph-augmented retrieval (simplified implementation)
   * Based on arXiv 2507.19715
   */
  private async graphAugmentedRetrieval(
    denseResults: DenseResult[],
    context: SearchContext,
    hops: number = 2
  ): Promise<GraphResult[]> {
    const startTime = Date.now();
    const results: GraphResult[] = [];

    // Build kNN graph from top dense results
    const topResults = denseResults.slice(0, 20);

    for (const result of topResults) {
      // For each pattern, find similar patterns using vector operations
      const neighbors = this.vectorOps.findSimilarPatterns(result.patternId, 5);
      
      const path = [result.patternId];
      const edgeWeights = [result.similarity];
      let cumulativeScore = result.similarity;

      // Simple 1-hop traversal for now (multi-hop would need recursive traversal)
      if (hops > 1) {
        for (const neighbor of neighbors) {
          path.push(neighbor.patternId);
          edgeWeights.push(neighbor.score);
          cumulativeScore += neighbor.score * 0.5; // Decay factor
        }
      }

      results.push({
        patternId: result.patternId,
        path,
        hops: path.length - 1,
        edgeWeights,
        cumulativeScore: cumulativeScore / path.length, // Average
      });
    }

    const duration = Date.now() - startTime;
    this.logTraceStep(context, 'graph_traversal', duration, {
      nodesVisited: results.length,
      hops,
    });

    return results;
  }

  /**
   * Main search method implementing Blended RAG
   */
  async search(
    query: string,
    queryEmbedding: number[],
    context?: Partial<SearchContext>
  ): Promise<BlendedResult[]> {
    const searchContext: SearchContext = {
      id: context?.id ?? crypto.randomUUID(),
      query,
      timestamp: context?.timestamp ?? new Date(),
      strategy: context?.strategy ?? 'hybrid',
      config: this.config,
      userId: context?.userId,
      sessionId: context?.sessionId,
      metadata: context?.metadata ?? {},
    };

    const startTime = Date.now();
    const trace: SearchTrace = {
      contextId: searchContext.id,
      steps: [],
    };

    // Record search start
    if (this.telemetryService) {
      this.telemetryService.recordEvent({
        type: 'search_start',
        timestamp: new Date(),
        context: {
          query: query.substring(0, 100),
          contextId: searchContext.id,
          strategy: searchContext.strategy,
          userId: searchContext.userId,
          sessionId: searchContext.sessionId,
        },
      });
    }

    try {
      // Step 1: Analyze query
      const queryAnalysis = this.analyzeQuery(query);
      searchContext.strategy = queryAnalysis.recommendedStrategy;

      // Step 2: Execute searches in parallel
      const [denseResults, sparseResults] = await Promise.all([
        this.denseSearch(queryEmbedding, searchContext),
        this.sparseSearch(query, searchContext),
      ]);

      // Step 3: Optional graph augmentation
      let graphResults: GraphResult[] = [];
      if (searchContext.strategy === 'hybrid' || searchContext.strategy === 'multi-hop') {
        graphResults = await this.graphAugmentedRetrieval(denseResults, searchContext, 2);
      }

      // Step 4: Reciprocal Rank Fusion
      let blendedResults = this.reciprocalRankFusion(
        denseResults,
        sparseResults,
        graphResults,
        {
          dense: this.config.denseWeight,
          sparse: this.config.sparseWeight,
          graph: 0.2, // Fixed small weight for graph
        }
      );

      // Step 5: Apply semantic compression for diversity
      if (blendedResults.length > 5) {
        const compressed = this.compressionEngine.compress(
          blendedResults,
          queryEmbedding,
          (a, b) => this.cosineSimilarity(a, b)
        );

        // Update results with diversity scores
        blendedResults = blendedResults.map(result => {
          const compressedEntry = compressed.find(c => c.patternId === result.patternId);
          if (compressedEntry) {
            return {
              ...result,
              diversityScore: compressedEntry.diversityContribution,
            };
          }
          return result;
        });
      }

      // Step 6: Apply minimum diversity threshold
      blendedResults = blendedResults.filter(r => 
        (r.diversityScore ?? 1) >= this.config.minDiversityScore
      );

      // Step 7: Limit results
      blendedResults = blendedResults.slice(0, this.config.maxResults);

      // Step 8: Update metadata
      blendedResults.forEach(r => {
        r.metadata.queryAnalysis = queryAnalysis;
      });

      // Step 9: Log metrics
      const duration = Date.now() - startTime;
      const metrics: SearchMetrics = {
        contextId: searchContext.id,
        query,
        strategy: searchContext.strategy,
        durationMs: duration,
        resultsCount: blendedResults.length,
        cacheHit: false,
        timestamp: new Date(),
        denseSearchTime: trace.steps.find(s => s.name === 'dense_search')?.duration,
        sparseSearchTime: trace.steps.find(s => s.name === 'sparse_search')?.duration,
        graphTraversalTime: trace.steps.find(s => s.name === 'graph_traversal')?.duration,
        diversityScore: blendedResults.reduce((sum, r) => sum + (r.diversityScore ?? 0), 0) / blendedResults.length,
        avgRelevance: blendedResults.reduce((sum, r) => sum + r.finalScore, 0) / blendedResults.length,
      };

       // Record telemetry
       if (this.telemetryService) {
         this.telemetryService.recordSearchMetrics(metrics);
         
         // Record trace if steps were collected
         if (trace.steps.length > 0) {
           this.telemetryService.recordTrace(trace);
         }
       }

       logger.info('hybrid-search-engine', 'Search completed', {
         contextId: searchContext.id,
         query: query.substring(0, 50),
         strategy: searchContext.strategy,
         durationMs: duration,
         results: blendedResults.length,
         queryType: queryAnalysis.queryType,
         confidence: queryAnalysis.confidence,
       });

       return blendedResults;
     } catch (error) {
       // Record error telemetry
       if (this.telemetryService) {
         this.telemetryService.recordEvent({
           type: 'search_error',
           timestamp: new Date(),
           context: {
             query: query.substring(0, 100),
             contextId: searchContext.id,
             strategy: searchContext.strategy,
             userId: searchContext.userId,
             sessionId: searchContext.sessionId,
           },
         });
       }

       logger.error('hybrid-search-engine', 'Search failed', error as Error, {
         query,
         contextId: searchContext.id,
       });
       throw error;
    }
  }

  /**
   * Multi-hop reasoning with LLM integration
   * Based on arXiv 2502.18458
   */
  async multiHopReasoning(
    query: string,
    initialResults: BlendedResult[],
    llmBridge: any // Would be LLM bridge service
  ): Promise<MultiHopResult[]> {
    const results: MultiHopResult[] = [];

    for (const result of initialResults.slice(0, 5)) {
      // Find related patterns
      const related = this.vectorOps.findSimilarPatterns(result.patternId, 3);
      
      // Build reasoning path
      const reasoningPath = related.map(r => ({
        intermediatePattern: r.patternId,
        relation: 'similar_to',
        confidence: r.score,
      }));

      results.push({
        patternId: result.patternId,
        reasoningPath,
        finalScore: result.finalScore * 0.9, // Weighted by reasoning depth
        depth: reasoningPath.length,
      });
    }

    return results;
  }

  /**
   * Update adaptive weights based on user feedback
   */
  async updateAdaptiveWeights(
    userId: string,
    query: string,
    selectedResults: string[],
    feedback: 'positive' | 'negative'
  ): Promise<void> {
    const analysis = this.analyzeQuery(query);

    // Update user preferences in database
    this.db.execute(
      `INSERT OR REPLACE INTO user_search_preferences 
       (user_id, query_pattern, dense_weight, sparse_weight, last_updated)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        query.toLowerCase().slice(0, 50),
        feedback === 'positive' ? this.config.denseWeight : this.config.denseWeight * 0.9,
        feedback === 'positive' ? this.config.sparseWeight : this.config.sparseWeight * 1.1,
        new Date().toISOString(),
      ]
    );

    logger.info('hybrid-search-engine', 'Updated adaptive weights', {
      userId,
      query: query.substring(0, 50),
      feedback,
      queryType: analysis.queryType,
    });
  }

  /**
   * Get search statistics
   */
  getStats() {
    return {
      config: this.config,
      sparseStats: this.sparseEncoder.getStats(),
    };
  }

  // Utility methods

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }

  private logTraceStep(
    context: SearchContext,
    name: string,
    duration: number,
    metadata: Record<string, unknown>
  ): void {
    logger.debug('hybrid-search-engine', `Trace: ${name}`, {
      contextId: context.id,
      duration,
      ...metadata,
    });
  }
}