/**
 * Unit Tests for BM25 Scorer
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { BM25Scorer } from '../../src/services/bm25-scorer.js';
import type { BM25Document } from '../../src/services/bm25-scorer.js';

describe('BM25Scorer', () => {
  const documents: BM25Document[] = [
    { id: 'factory-method', text: 'Factory Method Creational Define an interface for creating an object pattern oo' },
    { id: 'abstract-factory', text: 'Abstract Factory Creational Create families of related objects pattern oo' },
    { id: 'observer', text: 'Observer Behavioral Define a one-to-many dependency between objects event notification' },
    { id: 'strategy', text: 'Strategy Behavioral Define a family of algorithms algorithm oo' },
    { id: 'decorator', text: 'Decorator Structural Attach additional responsibilities to an object wrapper pattern' },
    { id: 'singleton', text: 'Singleton Creational Ensure a class has only one instance pattern oo' },
    { id: 'mediator', text: 'Mediator Behavioral Define an object that encapsulates how objects interact pattern' },
    { id: 'state', text: 'State Behavioral Allow an object to alter its behavior when its internal state changes pattern' },
  ];

  let scorer: BM25Scorer;

  beforeEach(() => {
    scorer = new BM25Scorer(documents);
  });

  describe('constructor', () => {
    it('should initialize with correct corpus size', () => {
      const stats = scorer.getStats();
      expect(stats.corpusSize).toBe(8);
    });

    it('should compute average document length', () => {
      const stats = scorer.getStats();
      expect(stats.avgDocLength).toBeGreaterThan(0);
    });

    it('should compute IDF for unique terms', () => {
      const stats = scorer.getStats();
      expect(stats.uniqueTerms).toBeGreaterThan(0);
    });
  });

  describe('scoreQuery', () => {
    it('should return results sorted by score descending', () => {
      const results = scorer.scoreQuery('factory pattern');
      expect(results.length).toBe(8);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should rank documents with factory in name highly', () => {
      const results = scorer.scoreQuery('factory');
      const topIds = results.slice(0, 2).map(r => r.id);
      // Both factory-method and abstract-factory have 'factory' in name
      expect(topIds).toContain('factory-method');
      expect(topIds).toContain('abstract-factory');
    });

    it('should rank exact name matches for observer', () => {
      const results = scorer.scoreQuery('observer');
      expect(results[0].id).toBe('observer');
    });

    it('should give higher scores to documents with more query terms', () => {
      const results = scorer.scoreQuery('strategy algorithm');
      const strategyResult = results.find(r => r.id === 'strategy');
      const observerResult = results.find(r => r.id === 'observer');
      expect(strategyResult!.score).toBeGreaterThan(observerResult!.score);
    });

    it('should return zero or low scores for non-matching queries', () => {
      const results = scorer.scoreQuery('xyznonexistent');
      const maxScore = Math.max(...results.map(r => r.score));
      expect(maxScore).toBe(0);
    });

    it('should handle empty query gracefully', () => {
      const results = scorer.scoreQuery('');
      expect(results).toHaveLength(8);
    });

    it('should handle multi-word queries', () => {
      const results = scorer.scoreQuery('behavioral pattern');
      // Observer, Strategy, Mediator, State are behavioral
      const topIds = results.slice(0, 4).map(r => r.id);
      expect(topIds).toContain('observer');
      expect(topIds).toContain('strategy');
    });
  });

  describe('scoreDocumentByIndex', () => {
    it('should score a single document', () => {
      const score = scorer.scoreDocumentByIndex('factory', 0);
      expect(score).toBeGreaterThan(0);
    });

    it('should return 0 for non-matching terms', () => {
      const score = scorer.scoreDocumentByIndex('xyznonexistent', 0);
      expect(score).toBe(0);
    });
  });

  describe('normalizeScores', () => {
    it('should normalize scores to 0-1 range', () => {
      const results = scorer.scoreQuery('factory pattern');
      const normalized = scorer.normalizeScores(results);

      expect(normalized).toHaveLength(results.length);
      for (const n of normalized) {
        expect(n.normalized).toBeGreaterThanOrEqual(0);
        expect(n.normalized).toBeLessThanOrEqual(1);
      }
    });

    it('should give highest score 1.0', () => {
      const results = scorer.scoreQuery('factory pattern');
      const normalized = scorer.normalizeScores(results);
      expect(normalized[0].normalized).toBe(1.0);
    });

    it('should handle empty results', () => {
      const normalized = scorer.normalizeScores([]);
      expect(normalized).toHaveLength(0);
    });

    it('should handle single result', () => {
      const normalized = scorer.normalizeScores([{ id: 'only', score: 5.0 }]);
      expect(normalized).toHaveLength(1);
      // Single result: range is 0, fallback to 1.0 (it's the best by definition)
      expect(normalized[0].normalized).toBe(1.0);
    });
  });

  describe('IDF behavior', () => {
    it('should give higher IDF to rare terms', () => {
      // "flyweight" doesn't exist → IDF 0
      // "pattern" appears in most docs → low IDF
      // "mediator" appears in exactly 1 doc → higher IDF
      const results = scorer.scoreQuery('mediator');
      expect(results[0].id).toBe('mediator');
    });

    it('should filter short tokens like "oo" (< 3 chars)', () => {
      const results = scorer.scoreQuery('oo');
      // 'oo' is filtered by tokenizer (length < 3), so all scores are 0
      const maxScore = Math.max(...results.map(r => r.score));
      expect(maxScore).toBe(0);
    });
  });

  describe('document length normalization', () => {
    it('should not overly penalize longer documents', () => {
      // "state" appears in both 'state' and potentially other docs
      const results = scorer.scoreQuery('state');
      expect(results[0].id).toBe('state');
    });
  });
});

describe('BM25Scorer with realistic pattern data', () => {
  it('should produce discriminating scores for "factory pattern"', () => {
    const docs: BM25Document[] = [
      { id: 'factory-method', text: 'Factory Method Creational Design pattern for creating objects without specifying concrete classes' },
      { id: 'abstract-factory', text: 'Abstract Factory Creational Provides an interface for creating families of related objects' },
      { id: 'observer', text: 'Observer Behavioral Defines a one-to-many dependency so that when one object changes state all dependents are notified' },
      { id: 'strategy', text: 'Strategy Behavioral Defines a family of algorithms encapsulates each one and makes them interchangeable' },
      { id: 'decorator', text: 'Decorator Structural Attaches additional responsibilities to an object dynamically' },
      { id: 'singleton', text: 'Singleton Creational Ensures a class has only one instance and provides a global point of access' },
    ];

    const scorer = new BM25Scorer(docs);
    const results = scorer.scoreQuery('factory pattern');
    const normalized = scorer.normalizeScores(results);

    // Factory Method should be top
    expect(results[0].id).toBe('factory-method');

    // Spread should be significant (not uniform)
    const scores = normalized.map(n => n.normalized);
    const max = Math.max(...scores);
    const min = Math.min(...scores.filter(s => s > 0)); // exclude zeros
    expect(max - min).toBeGreaterThan(0.2); // meaningful spread
  });
});
