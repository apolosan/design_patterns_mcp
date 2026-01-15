/**
 * Graph Vector Service
 * Implements graph augmentation with kNN overlay for multi-hop retrieval
 * Based on arXiv 2507.19715 (Beyond Nearest Neighbors) and 2502.12908 (Graph Neural Networks)
 */

import { VectorOperationsService } from './vector-operations.js';
import { DatabaseManager } from './database-manager.js';
import { logger } from './logger.js';
import { TelemetryService } from './telemetry-service.js';
import type { GraphNode, GraphResult, MultiHopResult } from '../types/search-strategy.js';

/**
 * Graph construction configuration
 */
export interface GraphConstructionConfig {
  k: number;                    // k for kNN graph
  maxHops: number;              // Maximum traversal depth
  edgeWeightThreshold: number;  // Minimum edge weight to include
  useMetadataEdges: boolean;    // Include category/tag edges
  rebuildInterval: number;      // Rebuild interval in ms
}

/**
 * Graph traversal configuration
 */
export interface TraversalConfig {
  startNode: string;
  maxHops: number;
  beamWidth: number;            // Number of paths to keep
  similarityThreshold: number;
  includeReverseEdges: boolean;
}

/**
 * Edge weights for graph
 */
export interface EdgeWeight {
  source: string;
  target: string;
  weight: number;
  type: 'vector' | 'metadata' | 'temporal';
}

/**
 * Graph Vector Service
 * Builds and queries graph-augmented vector space
 */
export class GraphVectorService {
  private vectorOps: VectorOperationsService;
  private db: DatabaseManager;
  private config: GraphConstructionConfig;
  private graphCache: Map<string, GraphNode> = new Map();
  private lastBuildTime: number = 0;
  private telemetryService: TelemetryService | null;

  constructor(
    vectorOps: VectorOperationsService,
    db: DatabaseManager,
    config?: Partial<GraphConstructionConfig>,
    telemetryService?: TelemetryService
  ) {
    this.vectorOps = vectorOps;
    this.db = db;
    this.config = {
      k: config?.k ?? 10,
      maxHops: config?.maxHops ?? 3,
      edgeWeightThreshold: config?.edgeWeightThreshold ?? 0.1,
      useMetadataEdges: config?.useMetadataEdges ?? true,
      rebuildInterval: config?.rebuildInterval ?? 3600000, // 1 hour
    };
    this.telemetryService = telemetryService || null;
  }

  /**
   * Build kNN graph from embeddings
   */
   async buildKNNGraph(): Promise<Map<string, GraphNode>> {
    const now = Date.now();
    
    // Check if cache is still valid
    if (this.graphCache.size > 0 && (now - this.lastBuildTime) < this.config.rebuildInterval) {
      logger.debug('graph-vector-service', 'Using cached graph');
      return this.graphCache;
    }

    logger.info('graph-vector-service', 'Building kNN graph', {
      k: this.config.k,
    });

    // Record graph build start
    if (this.telemetryService) {
      this.telemetryService.recordEvent({
        type: 'graph_traversal',
        timestamp: new Date(),
        context: {
          action: 'graph_build_start',
          k: this.config.k,
          rebuildInterval: this.config.rebuildInterval,
        },
      });
    }

    const startTime = Date.now();
    const graph = new Map<string, GraphNode>();

    // Get all pattern embeddings
    const embeddings = this.db.query<{ pattern_id: string; embedding: string }>(
      'SELECT pattern_id, embedding FROM pattern_embeddings'
    );

    if (embeddings.length === 0) {
      logger.warn('graph-vector-service', 'No embeddings found for graph construction');
      return graph;
    }

    // For each pattern, find k nearest neighbors
    for (const { pattern_id, embedding } of embeddings) {
      const embeddingVector = JSON.parse(embedding) as number[];
      
      // Find neighbors using vector operations
      const neighbors = this.vectorOps.searchSimilar(
        embeddingVector,
        { excludePatterns: [pattern_id] },
        this.config.k
      );

      const graphNode: GraphNode = {
        id: pattern_id,
        embedding: embeddingVector,
        neighbors: neighbors
          .filter(n => n.score >= this.config.edgeWeightThreshold)
          .map(n => ({
            id: n.patternId,
            distance: n.distance ?? (1 - n.score),
            weight: n.score,
          })),
        metadata: this.getPatternMetadata(pattern_id),
      };

      graph.set(pattern_id, graphNode);
    }

    // Add metadata edges if enabled
    if (this.config.useMetadataEdges) {
      this.addMetadataEdges(graph);
    }

    this.graphCache = graph;
    this.lastBuildTime = now;

     const duration = Date.now() - startTime;
     logger.info('graph-vector-service', 'Graph built successfully', {
       nodes: graph.size,
       avgNeighbors: Array.from(graph.values()).reduce((sum, n) => sum + n.neighbors.length, 0) / graph.size,
       durationMs: duration,
     });

     // Record graph build completion
     if (this.telemetryService) {
       this.telemetryService.recordEvent({
         type: 'graph_traversal',
         timestamp: new Date(),
         context: {
           action: 'graph_build_complete',
           nodes: graph.size,
           avgNeighbors: Array.from(graph.values()).reduce((sum, n) => sum + n.neighbors.length, 0) / graph.size,
           durationMs: duration,
           edgesAdded: Array.from(graph.values()).reduce((sum, n) => sum + n.neighbors.length, 0),
         },
       });
     }

     return graph;
  }

  /**
   * Add metadata-based edges (category, tags)
   */
  private addMetadataEdges(graph: Map<string, GraphNode>): void {
    const patterns = this.db.query<{ id: string; category: string; tags: string }>(
      'SELECT id, category, tags FROM patterns'
    );

    const categoryGroups = new Map<string, string[]>();
    const tagGroups = new Map<string, string[]>();

    // Group by category and tags
    for (const pattern of patterns) {
      if (!categoryGroups.has(pattern.category)) {
        categoryGroups.set(pattern.category, []);
      }
      categoryGroups.get(pattern.category)!.push(pattern.id);

      const tags = pattern.tags ? JSON.parse(pattern.tags) : [];
      for (const tag of tags) {
        if (!tagGroups.has(tag)) {
          tagGroups.set(tag, []);
        }
        tagGroups.get(tag)!.push(pattern.id);
      }
    }

    // Add category edges
    for (const [category, patternIds] of categoryGroups.entries()) {
      const weight = 0.15; // Fixed weight for category edges
      for (let i = 0; i < patternIds.length; i++) {
        for (let j = i + 1; j < patternIds.length; j++) {
          const id1 = patternIds[i];
          const id2 = patternIds[j];

          if (graph.has(id1)) {
            const existing = graph.get(id1)!.neighbors.find(n => n.id === id2);
            if (existing) {
              existing.weight += weight; // Boost existing edges
            } else {
              graph.get(id1)!.neighbors.push({
                id: id2,
                distance: 1 - weight,
                weight,
              });
            }
          }
        }
      }
    }

    // Add tag edges
    for (const [tag, patternIds] of tagGroups.entries()) {
      const weight = 0.1; // Fixed weight for tag edges
      for (let i = 0; i < patternIds.length; i++) {
        for (let j = i + 1; j < patternIds.length; j++) {
          const id1 = patternIds[i];
          const id2 = patternIds[j];

          if (graph.has(id1)) {
            const existing = graph.get(id1)!.neighbors.find(n => n.id === id2);
            if (existing) {
              existing.weight += weight;
            } else {
              graph.get(id1)!.neighbors.push({
                id: id2,
                distance: 1 - weight,
                weight,
              });
            }
          }
        }
      }
    }

    logger.debug('graph-vector-service', `Added metadata edges for ${categoryGroups.size} categories and ${tagGroups.size} tags`);
  }

  /**
   * Traverse graph from starting node
   */
  async traverseGraph(config: TraversalConfig): Promise<GraphResult[]> {
    const graph = await this.buildKNNGraph();
    
    if (!graph.has(config.startNode)) {
      return [];
    }

    const results: GraphResult[] = [];
    const visited = new Set<string>();
    const queue: Array<{
      nodeId: string;
      path: string[];
      weights: number[];
      hops: number;
    }> = [{
      nodeId: config.startNode,
      path: [config.startNode],
      weights: [],
      hops: 0,
    }];

    while (queue.length > 0 && results.length < config.beamWidth) {
      const current = queue.shift()!;
      
      if (current.hops >= config.maxHops) {
        // Reached max depth, add to results
        const cumulativeScore = current.weights.reduce((sum, w) => sum + w, 0) / (current.weights.length || 1);
        results.push({
          patternId: current.nodeId,
          path: current.path,
          hops: current.hops,
          edgeWeights: current.weights,
          cumulativeScore,
        });
        continue;
      }

      const node = graph.get(current.nodeId);
      if (!node) continue;

      // Add to visited
      visited.add(current.nodeId);

      // Explore neighbors
      const neighbors = node.neighbors
        .filter(n => n.weight >= this.config.edgeWeightThreshold)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3); // Top 3 neighbors

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id) && !current.path.includes(neighbor.id)) {
          queue.push({
            nodeId: neighbor.id,
            path: [...current.path, neighbor.id],
            weights: [...current.weights, neighbor.weight],
            hops: current.hops + 1,
          });
        }
      }
    }

    logger.debug('graph-vector-service', `Graph traversal completed`, {
      startNode: config.startNode,
      totalPaths: results.length,
      maxHops: config.maxHops,
    });

    return results;
  }

  /**
   * Multi-hop reasoning with graph
   */
  async multiHopReasoning(
    startPatternId: string,
    queryEmbedding: number[],
    maxHops: number = 2
  ): Promise<MultiHopResult[]> {
    const graph = await this.buildKNNGraph();
    const results: MultiHopResult[] = [];

    // Get top 3 paths from traversal
    const paths = await this.traverseGraph({
      startNode: startPatternId,
      maxHops,
      beamWidth: 10,
      similarityThreshold: 0.3,
      includeReverseEdges: false,
    });

    for (const path of paths) {
      if (path.path.length <= 1) continue;

      // Calculate reasoning path
      const reasoningPath: MultiHopResult['reasoningPath'] = [];
      let pathScore = 0;

      for (let i = 1; i < path.path.length; i++) {
        const intermediate = path.path[i];
        const weight = path.edgeWeights[i - 1];
        
        // Get pattern info for intermediate
        const patternInfo = this.db.queryOne<{ name: string; description: string }>(
          'SELECT name, description FROM patterns WHERE id = ?',
          [intermediate]
        );

        reasoningPath.push({
          intermediatePattern: patternInfo?.name ?? intermediate,
          relation: 'similar_to',
          confidence: weight,
        });

        pathScore += weight;
      }

      // Boost score for longer paths with high weights
      const finalScore = (pathScore / path.path.length) * Math.exp(-path.hops * 0.2);

      results.push({
        patternId: path.patternId,
        reasoningPath,
        finalScore,
        depth: path.hops,
      });
    }

    // Sort by final score
    results.sort((a, b) => b.finalScore - a.finalScore);

    logger.debug('graph-vector-service', `Multi-hop reasoning completed`, {
      startPatternId,
      paths: results.length,
      maxHops,
    });

    return results;
  }

  /**
   * Find similar patterns using graph traversal
   */
  async findSimilarWithGraph(
    patternId: string,
    limit: number = 10,
    hops: number = 2
  ): Promise<{
    direct: Array<{ id: string; score: number }>;
    indirect: Array<{ id: string; score: number; path: string[] }>;
  }> {
    const graph = await this.buildKNNGraph();

    // Direct neighbors
    const node = graph.get(patternId);
    const direct = node ? node.neighbors.map(n => ({ id: n.id, score: n.weight })) : [];

    // Indirect neighbors (multi-hop)
    const indirect: Array<{ id: string; score: number; path: string[] }> = [];
    const visited = new Set<string>([patternId]);

    if (node) {
      const queue: Array<{ nodeId: string; path: string[]; score: number }> = 
        node.neighbors.map(n => ({ nodeId: n.id, path: [patternId, n.id], score: n.weight }));

      while (queue.length > 0 && indirect.length < limit) {
        const current = queue.shift()!;
        
        if (current.path.length - 1 >= hops) {
          // Add to indirect results if not already in direct
          if (!direct.some(d => d.id === current.nodeId)) {
            indirect.push({
              id: current.nodeId,
              score: current.score / current.path.length, // Decay by path length
              path: current.path,
            });
          }
          continue;
        }

        const currentNode = graph.get(current.nodeId);
        if (!currentNode) continue;

        for (const neighbor of currentNode.neighbors) {
          if (!visited.has(neighbor.id) && neighbor.weight > 0.2) {
            visited.add(neighbor.id);
            queue.push({
              nodeId: neighbor.id,
              path: [...current.path, neighbor.id],
              score: current.score + neighbor.weight,
            });
          }
        }
      }
    }

    // Sort and limit
    direct.sort((a, b) => b.score - a.score);
    indirect.sort((a, b) => b.score - a.score);

    return {
      direct: direct.slice(0, limit),
      indirect: indirect.slice(0, limit),
    };
  }

  /**
   * Get pattern metadata for graph nodes
   */
  private getPatternMetadata(patternId: string): { category?: string; tags?: string[] } | undefined {
    const pattern = this.db.queryOne<{ category: string; tags: string }>(
      'SELECT category, tags FROM patterns WHERE id = ?',
      [patternId]
    );

    if (!pattern) return undefined;

    return {
      category: pattern.category,
      tags: pattern.tags ? JSON.parse(pattern.tags) : [],
    };
  }

  /**
   * Export graph to JSON for visualization
   */
  async exportGraph(): Promise<{
    nodes: Array<{ id: string; category?: string; tags?: string[] }>;
    edges: Array<{ source: string; target: string; weight: number }>;
  }> {
    const graph = await this.buildKNNGraph();
    const nodes: Array<{ id: string; category?: string; tags?: string[] }> = [];
    const edges: Array<{ source: string; target: string; weight: number }> = [];

    for (const [id, node] of graph.entries()) {
      nodes.push({
        id,
        category: node.metadata?.category,
        tags: node.metadata?.tags,
      });

      for (const neighbor of node.neighbors) {
        edges.push({
          source: id,
          target: neighbor.id,
          weight: neighbor.weight,
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Get graph statistics
   */
  async getGraphStats(): Promise<{
    nodeCount: number;
    edgeCount: number;
    avgDegree: number;
    density: number;
    connectedComponents: number;
  }> {
    const graph = await this.buildKNNGraph();
    
    const nodeCount = graph.size;
    let edgeCount = 0;
    let totalDegree = 0;

    for (const node of graph.values()) {
      edgeCount += node.neighbors.length;
      totalDegree += node.neighbors.length;
    }

    const avgDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
    const maxEdges = nodeCount * (nodeCount - 1);
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;

    // Estimate connected components (simplified)
    const visited = new Set<string>();
    let components = 0;

    for (const id of graph.keys()) {
      if (!visited.has(id)) {
        components++;
        this.dfs(id, graph, visited);
      }
    }

    return {
      nodeCount,
      edgeCount,
      avgDegree,
      density,
      connectedComponents: components,
    };
  }

  /**
   * Depth-first search for connected components
   */
  private dfs(nodeId: string, graph: Map<string, GraphNode>, visited: Set<string>): void {
    visited.add(nodeId);
    const node = graph.get(nodeId);
    if (!node) return;

    for (const neighbor of node.neighbors) {
      if (!visited.has(neighbor.id)) {
        this.dfs(neighbor.id, graph, visited);
      }
    }
  }

  /**
   * Clear graph cache
   */
  clearCache(): void {
    this.graphCache.clear();
    this.lastBuildTime = 0;
    logger.info('graph-vector-service', 'Graph cache cleared');
  }

  /**
   * Update graph configuration
   */
  updateConfig(config: Partial<GraphConstructionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('graph-vector-service', 'Configuration updated', {
      k: this.config.k,
      maxHops: this.config.maxHops,
      edgeWeightThreshold: this.config.edgeWeightThreshold,
    });
  }
}

/**
 * Factory function
 */
export function createGraphVectorService(
  vectorOps: VectorOperationsService,
  db: DatabaseManager,
  config?: Partial<GraphConstructionConfig>
): GraphVectorService {
  return new GraphVectorService(vectorOps, db, config);
}