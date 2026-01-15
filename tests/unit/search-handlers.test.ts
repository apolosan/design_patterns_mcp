/**
 * Tests for Search Handlers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HybridSearchCombiner, DynamicAlphaTuner } from '../../src/handlers/hybrid-search-combiner.js';
import type { MatchResult, DynamicAlphaResult } from '../../src/types/search-types.js';

describe('DynamicAlphaTuner', () => {
  let tuner: DynamicAlphaTuner;

  beforeEach(() => {
    tuner = new DynamicAlphaTuner();
  });

  describe('calculateAlpha', () => {
    it('should return balanced weights for generic queries', () => {
      const result = tuner.calculateAlpha('find patterns');
      expect(result.semanticAlpha).toBeGreaterThan(0);
      expect(result.keywordAlpha).toBeGreaterThan(0);
      expect(result.semanticAlpha + result.keywordAlpha).toBeCloseTo(1, 1);
    });

    it('should favor keyword search for short specific queries', () => {
      const result = tuner.calculateAlpha('implement factory');
      expect(result.queryType).toBe('specific');
      expect(result.keywordAlpha).toBeGreaterThanOrEqual(result.semanticAlpha);
    });

    it('should favor semantic search for long exploratory queries', () => {
      const result = tuner.calculateAlpha(
        'how can I best understand the strategy pattern for my application'
      );
      expect(result.queryType).toBe('exploratory');
      expect(result.semanticAlpha).toBeGreaterThanOrEqual(result.keywordAlpha);
    });

    it('should detect technical terms', () => {
      const result = tuner.calculateAlpha('factory pattern singleton design');
      expect(result.analysis.technicalTermCount).toBeGreaterThan(0);
    });

    it('should detect code snippets', () => {
      const result = tuner.calculateAlpha('pattern with `interface{}` syntax');
      expect(result.analysis.hasCodeSnippet).toBe(true);
    });

    it('should adjust for very long queries', () => {
      const longQuery =
        'I need to understand how design patterns can help me structure my application ' +
        'in a way that promotes maintainability and testability while also being flexible ' +
        'enough to adapt to changing requirements over time';
      const result = tuner.calculateAlpha(longQuery);
      expect(result.semanticAlpha).toBeGreaterThan(0.5);
    });

    it('should adjust for very short queries', () => {
      const result = tuner.calculateAlpha('factory');
      expect(result.keywordAlpha).toBeGreaterThanOrEqual(0.5);
    });

    it('should return confidence level', () => {
      const result = tuner.calculateAlpha('strategy pattern');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should include analysis metadata', () => {
      const result = tuner.calculateAlpha('test query');
      expect(result.analysis).toBeDefined();
      expect(result.analysis.queryLength).toBe(10);
      expect(result.analysis.wordCount).toBe(2);
    });
  });
});

describe('HybridSearchCombiner', () => {
  let combiner: HybridSearchCombiner;

  beforeEach(() => {
    combiner = new HybridSearchCombiner();
  });

  describe('calculateAlpha', () => {
    it('should delegate to DynamicAlphaTuner', () => {
      const result = combiner.calculateAlpha('test query');
      expect(result).toHaveProperty('semanticAlpha');
      expect(result).toHaveProperty('keywordAlpha');
      expect(result).toHaveProperty('queryType');
    });
  });

  describe('applySemanticWeight', () => {
    it('should apply weight to semantic matches', () => {
      const matches: MatchResult[] = [
        {
          pattern: { id: '1', name: 'Test', category: 'Test', description: 'Desc' },
          confidence: 0.8,
          matchType: 'semantic',
          reasons: ['Test reason'],
          metadata: { semanticScore: 0.8, finalScore: 0.8 },
        },
      ];

      const weighted = combiner.applySemanticWeight(matches, 0.7);

      expect(weighted[0].confidence).toBeCloseTo(0.56, 2);
      expect(weighted[0].metadata.finalScore).toBeCloseTo(0.56, 2);
    });
  });

  describe('applyKeywordWeight', () => {
    it('should apply weight to keyword matches', () => {
      const matches: MatchResult[] = [
        {
          pattern: { id: '1', name: 'Test', category: 'Test', description: 'Desc' },
          confidence: 0.6,
          matchType: 'keyword',
          reasons: ['Test reason'],
          metadata: { keywordScore: 6, finalScore: 0.6 },
        },
      ];

      const weighted = combiner.applyKeywordWeight(matches, 0.3);

      expect(weighted[0].confidence).toBeCloseTo(0.18, 2);
    });
  });

  describe('combineMatches', () => {
    it('should combine semantic and keyword matches for the same pattern', () => {
      const matches: MatchResult[] = [
        {
          pattern: { id: '1', name: 'Factory', category: 'Creational', description: 'Desc' },
          confidence: 0.8,
          matchType: 'semantic',
          reasons: ['Semantic match'],
          metadata: { semanticScore: 0.8, finalScore: 0.8 },
        },
        {
          pattern: { id: '1', name: 'Factory', category: 'Creational', description: 'Desc' },
          confidence: 0.6,
          matchType: 'keyword',
          reasons: ['Keyword match'],
          metadata: { keywordScore: 6, finalScore: 0.6 },
        },
      ];

      const alphaResult: DynamicAlphaResult = {
        semanticAlpha: 0.7,
        keywordAlpha: 0.3,
        queryType: 'balanced',
        confidence: 0.6,
        analysis: {
          queryLength: 10,
          wordCount: 2,
          technicalTermCount: 0,
          exploratoryScore: 0,
          specificityScore: 0,
          hasCodeSnippet: false,
          entropy: 0.5,
        },
      };

      const combined = combiner.combineMatches(matches, alphaResult);

      expect(combined).toHaveLength(1);
      expect(combined[0].matchType).toBe('hybrid');
      expect(combined[0].pattern.id).toBe('1');
      expect(combined[0].reasons).toContain('Semantic match');
      expect(combined[0].reasons).toContain('Keyword match');
    });

    it('should keep separate patterns separate', () => {
      const matches: MatchResult[] = [
        {
          pattern: { id: '1', name: 'Factory', category: 'Creational', description: 'Desc' },
          confidence: 0.8,
          matchType: 'semantic',
          reasons: ['Match 1'],
          metadata: { semanticScore: 0.8, finalScore: 0.8 },
        },
        {
          pattern: { id: '2', name: 'Builder', category: 'Creational', description: 'Desc' },
          confidence: 0.6,
          matchType: 'semantic',
          reasons: ['Match 2'],
          metadata: { semanticScore: 0.6, finalScore: 0.6 },
        },
      ];

      const combined = combiner.combineMatches(matches);

      expect(combined).toHaveLength(2);
    });

    it('should handle empty matches', () => {
      const combined = combiner.combineMatches([]);
      expect(combined).toHaveLength(0);
    });

    it('should use default weights when no alpha result provided', () => {
      const matches: MatchResult[] = [
        {
          pattern: { id: '1', name: 'Test', category: 'Test', description: 'Desc' },
          confidence: 0.8,
          matchType: 'semantic',
          reasons: ['Match'],
          metadata: { semanticScore: 0.8, finalScore: 0.8 },
        },
      ];

      const combined = combiner.combineMatches(matches);

      expect(combined).toHaveLength(1);
      expect(combined[0].confidence).toBeGreaterThan(0);
    });

    it('should handle patterns with only semantic match', () => {
      const matches: MatchResult[] = [
        {
          pattern: { id: '1', name: 'Test', category: 'Test', description: 'Desc' },
          confidence: 0.8,
          matchType: 'semantic',
          reasons: ['Semantic only'],
          metadata: { semanticScore: 0.8, finalScore: 0.8 },
        },
      ];

      const combined = combiner.combineMatches(matches);

      expect(combined[0].metadata.semanticScore).toBe(0.8);
      expect(combined[0].metadata.keywordScore).toBe(0);
    });

    it('should handle patterns with only keyword match', () => {
      const matches: MatchResult[] = [
        {
          pattern: { id: '1', name: 'Test', category: 'Test', description: 'Desc' },
          confidence: 0.6,
          matchType: 'keyword',
          reasons: ['Keyword only'],
          metadata: { keywordScore: 6, finalScore: 0.6 },
        },
      ];

      const combined = combiner.combineMatches(matches);

      expect(combined[0].metadata.keywordScore).toBeCloseTo(0.6, 1);
      expect(combined[0].metadata.semanticScore).toBe(0);
    });

    it('should cap final score at 1', () => {
      const matches: MatchResult[] = [
        {
          pattern: { id: '1', name: 'Test', category: 'Test', description: 'Desc' },
          confidence: 1.5,
          matchType: 'semantic',
          reasons: ['High score'],
          metadata: { semanticScore: 1.5, finalScore: 1.5 },
        },
      ];

      const combined = combiner.combineMatches(matches);

      expect(combined[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should floor final score at 0', () => {
      const matches: MatchResult[] = [
        {
          pattern: { id: '1', name: 'Test', category: 'Test', description: 'Desc' },
          confidence: -0.5,
          matchType: 'semantic',
          reasons: ['Negative score'],
          metadata: { semanticScore: -0.5, finalScore: -0.5 },
        },
      ];

      const combined = combiner.combineMatches(matches);

      expect(combined[0].confidence).toBeGreaterThanOrEqual(0);
    });
  });
});
