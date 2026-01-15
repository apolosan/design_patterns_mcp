/**
 * Tests for HybridSearchEngine
 * Testing Blended RAG implementation (arXiv 2404.07220)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HybridSearchEngine } from '../../src/services/hybrid-search-engine.js';
import type { VectorOperationsService } from '../../src/services/vector-operations.js';
import type { DatabaseManager } from '../../src/services/database-manager.js';
import type { CacheService } from '../../src/services/cache.js';
import type { BlendedSearchConfig, QueryAnalysis } from '../../src/types/search-strategy.js';

describe('HybridSearchEngine', () => {
  let engine: HybridSearchEngine;
  let mockVectorOps: VectorOperationsService;
  let mockDb: DatabaseManager;
  let mockCache: CacheService;

  beforeEach(() => {
    mockVectorOps = {
      searchSimilar: vi.fn(),
      findSimilarPatterns: vi.fn(),
    } as unknown as VectorOperationsService;

    mockDb = {
      execute: vi.fn(),
      query: vi.fn(),
      queryOne: vi.fn(),
    } as unknown as DatabaseManager;

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
    } as unknown as CacheService;

    const config: Partial<BlendedSearchConfig> = {
      denseWeight: 0.6,
      sparseWeight: 0.4,
      maxResults: 10,
      similarityThreshold: 0.3,
    };

    engine = new HybridSearchEngine(mockVectorOps, mockDb, mockCache, config);
  });

  describe('analyzeQuery', () => {
    it('should classify short technical queries as specific', () => {
      const analysis = engine.analyzeQuery('factory pattern');
      
      expect(analysis.queryType).toBe('specific');
      expect(analysis.recommendedStrategy).toBe('sparse');
      expect(analysis.confidence).toBeGreaterThan(0.5);
      expect(analysis.technicalTerms).toContain('factory');
    });

    it('should classify long exploratory queries as exploratory', () => {
      const query = 'how to implement design patterns for better software architecture';
      const analysis = engine.analyzeQuery(query);
      
      expect(analysis.queryType).toBe('exploratory');
      expect(analysis.recommendedStrategy).toBe('dense');
      expect(analysis.wordCount).toBeGreaterThan(5);
    });

    it('should detect code snippets', () => {
      const analysis = engine.analyzeQuery('pattern with `interface{}` syntax');
      
      expect(analysis.hasCodeSnippet).toBe(true);
      expect(analysis.recommendedStrategy).toBe('hybrid');
    });

    it('should calculate entropy correctly', () => {
      const analysis1 = engine.analyzeQuery('factory factory factory');
      const analysis2 = engine.analyzeQuery('factory builder singleton');
      
      expect(analysis1.entropy).toBeLessThan(analysis2.entropy);
    });

    it('should handle queries with multiple technical terms', () => {
      const analysis = engine.analyzeQuery('factory singleton observer strategy');
      
      expect(analysis.technicalTerms.length).toBeGreaterThan(2);
      expect(analysis.recommendedStrategy).toBe('hybrid');
      expect(analysis.confidence).toBeGreaterThan(0.5);
    });

    it('should return balanced classification for medium queries', () => {
      const analysis = engine.analyzeQuery('design patterns for web applications');
      
      expect(analysis.queryType).toBe('balanced');
      expect(analysis.recommendedStrategy).toBe('hybrid');
    });
  });

  describe('search', () => {
    it('should perform blended search with dense and sparse components', async () => {
      // Mock dense search results
      vi.mocked(mockVectorOps.searchSimilar).mockReturnValue([
        { patternId: 'factory', score: 0.85, distance: 0.15, rank: 1 },
        { patternId: 'builder', score: 0.75, distance: 0.25, rank: 2 },
      ]);

      // Mock sparse search results (simplified)
      vi.mocked(mockDb.query).mockReturnValue([
        { id: 'factory' },
        { id: 'builder' },
        { id: 'singleton' },
      ]);

      vi.mocked(mockDb.queryOne).mockReturnValue({
        term_frequency: 2,
        doc_count: 1,
      });

      const queryEmbedding = new Array(384).fill(0.1);
      const results = await engine.search('factory pattern', queryEmbedding);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(mockVectorOps.searchSimilar).toHaveBeenCalled();
    });

    it('should handle empty search results gracefully', async () => {
      vi.mocked(mockVectorOps.searchSimilar).mockReturnValue([]);
      vi.mocked(mockDb.query).mockReturnValue([]);

      const queryEmbedding = new Array(384).fill(0.1);
      const results = await engine.search('nonexistent pattern', queryEmbedding);

      expect(results).toEqual([]);
    });

    it('should apply semantic compression for diversity', async () => {
      vi.mocked(mockVectorOps.searchSimilar).mockReturnValue([
        { patternId: 'factory', score: 0.9, distance: 0.1, rank: 1 },
        { patternId: 'abstract-factory', score: 0.88, distance: 0.12, rank: 2 },
        { patternId: 'builder', score: 0.85, distance: 0.15, rank: 3 },
        { patternId: 'singleton', score: 0.8, distance: 0.2, rank: 4 },
        { patternId: 'prototype', score: 0.78, distance: 0.22, rank: 5 },
        { patternId: 'object-pool', score: 0.75, distance: 0.25, rank: 6 },
      ]);

      vi.mocked(mockDb.query).mockReturnValue([
        { id: 'factory' },
        { id: 'abstract-factory' },
        { id: 'builder' },
        { id: 'singleton' },
        { id: 'prototype' },
        { id: 'object-pool' },
      ]);

      vi.mocked(mockDb.queryOne).mockReturnValue({
        term_frequency: 1,
        doc_count: 1,
      });

      const queryEmbedding = new Array(384).fill(0.1);
      const results = await engine.search('creational patterns', queryEmbedding);

      expect(results.length).toBeLessThanOrEqual(10);
      // Should have diversity scores
      results.forEach(result => {
        expect(result).toHaveProperty('diversityScore');
      });
    });
  });

  describe('graphAugmentedRetrieval', () => {
    it('should perform graph traversal for related patterns', async () => {
      vi.mocked(mockVectorOps.findSimilarPatterns).mockReturnValue([
        { patternId: 'abstract-factory', score: 0.8 },
        { patternId: 'factory-method', score: 0.75 },
      ]);

      const denseResults = [
        { patternId: 'factory', similarity: 0.9, distance: 0.1, rank: 1, embedding: [] },
      ];

      const context = {
        id: 'test-context',
        query: 'factory',
        timestamp: new Date(),
        strategy: 'hybrid' as const,
        config: engine.getStats().config,
      };

      // @ts-expect-error - private method access for testing
      const graphResults = await engine.graphAugmentedRetrieval(denseResults, context, 2);

      expect(graphResults).toBeDefined();
      expect(Array.isArray(graphResults)).toBe(true);
      expect(mockVectorOps.findSimilarPatterns).toHaveBeenCalled();
    });
  });

  describe('updateAdaptiveWeights', () => {
    it('should update weights based on positive feedback', async () => {
      const executeSpy = vi.spyOn(mockDb, 'execute');

      await engine.updateAdaptiveWeights('user123', 'factory pattern', ['factory'], 'positive');

      expect(executeSpy).toHaveBeenCalled();
      const call = executeSpy.mock.calls[0];
      expect(call[0]).toContain('INSERT OR REPLACE');
      expect(call[1]).toContain('user123');
    });

    it('should update weights based on negative feedback', async () => {
      const executeSpy = vi.spyOn(mockDb, 'execute');

      await engine.updateAdaptiveWeights('user123', 'factory pattern', [], 'negative');

      expect(executeSpy).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return engine statistics', () => {
      const stats = engine.getStats();

      expect(stats).toHaveProperty('config');
      expect(stats.config.denseWeight).toBe(0.6);
      expect(stats.config.sparseWeight).toBe(0.4);
      expect(stats).toHaveProperty('sparseStats');
    });
  });

  describe('multiHopReasoning', () => {
    it('should perform multi-hop reasoning with LLM integration', async () => {
      const mockLLMBridge = {
        generate: vi.fn(),
      };

      const initialResults = [
        {
          patternId: 'factory',
          finalScore: 0.9,
          denseScore: 0.6,
          sparseScore: 0.3,
          matchTypes: ['dense', 'sparse'] as ('dense' | 'sparse' | 'graph')[],
          reasons: ['Test reason'],
          metadata: {
            queryAnalysis: {} as QueryAnalysis,
            weights: { dense: 0.6, sparse: 0.4, graph: 0.2 },
          },
        },
      ];

      vi.mocked(mockVectorOps.findSimilarPatterns).mockReturnValue([
        { patternId: 'abstract-factory', score: 0.8 },
        { patternId: 'factory-method', score: 0.75 },
      ]);

      const results = await engine.multiHopReasoning(
        'factory pattern',
        initialResults,
        mockLLMBridge
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results[0]).toHaveProperty('reasoningPath');
      expect(results[0].reasoningPath.length).toBeGreaterThan(0);
    });
  });
});