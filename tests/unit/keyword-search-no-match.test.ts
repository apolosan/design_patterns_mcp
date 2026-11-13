/**
 * Regression tests — keyword search must not fabricate relevance (review F1).
 *
 * Requirement: a query whose terms appear in no pattern is a miss, not a
 * perfect match. Before the fix, BM25 min-max normalization mapped an
 * all-zero score vector to 1.0 for every document, so the keyword handler
 * returned the first N patterns in DB order with confidence 0.99.
 */
import { describe, it, expect } from 'vitest';
import { BM25Scorer } from '../../src/services/bm25-scorer.js';
import { KeywordSearchHandler } from '../../src/handlers/keyword-search-handler.js';

interface PatternRowStub {
  id: string;
  name: string;
  category: string;
  description: string;
  complexity: string;
  tags: string;
}

const CATALOG: PatternRowStub[] = [
  { id: 'observer', name: 'Observer', category: 'Behavioral', description: 'Notify dependents when subject state changes', complexity: 'Low', tags: '["events"]' },
  { id: 'strategy', name: 'Strategy', category: 'Behavioral', description: 'Interchangeable family of algorithms', complexity: 'Low', tags: '["algorithms"]' },
  { id: 'singleton', name: 'Singleton', category: 'Creational', description: 'Single shared instance of a class', complexity: 'Low', tags: '["instance"]' },
  { id: 'adapter', name: 'Adapter', category: 'Structural', description: 'Convert one interface into another expected by clients', complexity: 'Low', tags: '["interface"]' },
];

function handlerOver(rows: PatternRowStub[]): KeywordSearchHandler {
  const db = { query: () => rows };
  return new KeywordSearchHandler(db as never, { maxResults: 10, minConfidence: 0.05, broadSearchThreshold: 0.01 });
}

describe('BM25 normalization of non-matching documents', () => {
  it('maps an all-zero score vector to zero relevance instead of 1.0', () => {
    const scorer = new BM25Scorer(CATALOG.map(p => ({ id: p.id, text: `${p.name} ${p.description}` })));
    const normalized = scorer.normalizeScores(scorer.scoreQuery('xyzzy qwerty'));

    expect(normalized.every(n => n.normalized === 0)).toBe(true);
  });

  it('keeps documents with zero raw score at zero even when another document matches', () => {
    const scorer = new BM25Scorer(CATALOG.map(p => ({ id: p.id, text: `${p.name} ${p.description}` })));
    const normalized = scorer.normalizeScores(scorer.scoreQuery('observer'));

    const observer = normalized.find(n => n.id === 'observer');
    const others = normalized.filter(n => n.id !== 'observer');
    expect(observer?.normalized).toBe(1);
    expect(others.every(n => n.normalized === 0)).toBe(true);
  });

  it('treats equally matching documents as equally best (ties keep 1.0)', () => {
    const scorer = new BM25Scorer([
      { id: 'a', text: 'cache invalidation' },
      { id: 'b', text: 'cache invalidation' },
    ]);
    const normalized = scorer.normalizeScores(scorer.scoreQuery('cache'));

    expect(normalized.map(n => n.normalized)).toEqual([1, 1]);
  });
});

describe('KeywordSearchHandler with queries that match nothing', () => {
  it('returns no patterns for a query whose terms are absent from the catalog', async () => {
    const results = await handlerOver(CATALOG).search({ id: 'q1', query: 'xyzzy qwerty' });

    expect(results).toEqual([]);
  });

  it('returns no patterns for a query made only of tokens shorter than three characters', async () => {
    const results = await handlerOver(CATALOG).search({ id: 'q2', query: 'is a of to' });

    expect(results).toEqual([]);
  });

  it('broad search also refuses to invent matches for an unknown vocabulary', async () => {
    const results = await handlerOver(CATALOG).broadSearch({ id: 'q3', query: 'xyzzy qwerty' });

    expect(results).toEqual([]);
  });

  it('returns only the patterns that actually contain the query term', async () => {
    const results = await handlerOver(CATALOG).search({ id: 'q4', query: 'interface conversion' });

    expect(results.map(r => r.pattern.id)).toEqual(['adapter']);
  });
});
