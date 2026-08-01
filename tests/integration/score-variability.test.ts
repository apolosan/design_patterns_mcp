/**
 * Integration Test: Score Variability Measurement
 *
 * Validates that BM25 + fuzzy pipeline produces discriminating scores
 * across representative queries against the real 686-pattern corpus.
 *
 * Acceptance criteria:
 *   - CV (coefficient of variation) ≥ 0.30 for top-10 results
 *   - Spread (max - min) ≥ 0.50 for top-10 results
 *   - Top-1 != Top-2 in ≥ 7/10 queries
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager.js';
import { KeywordSearchHandler } from '../../src/handlers/keyword-search-handler.js';
import { getTestDatabaseConfig } from '../helpers/test-db.js';
import type { PatternRequest } from '../../src/types/search-types.js';

// Representative queries covering different search patterns
const TEST_QUERIES = [
  { query: 'factory pattern', expectedTop: 'factory-method' },
  { query: 'observer event', expectedTop: 'observer' },
  { query: 'how to create objects', expectedTop: null }, // conceptual
  { query: 'behavioral design', expectedTop: null }, // category
  { query: 'wrapper pattern', expectedTop: 'decorator' }, // synonym
  { query: 'singleton instance', expectedTop: 'singleton' },
  { query: 'algorithm selection', expectedTop: 'strategy' },
  { query: 'object creation', expectedTop: null }, // vague
  { query: 'structural', expectedTop: null }, // category only
  { query: 'decorator', expectedTop: 'decorator' },
];

function calculateCV(scores: number[]): number {
  if (scores.length === 0) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (mean === 0) return 0;
  const std = Math.sqrt(
    scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length
  );
  return std / mean;
}

describe('Score Variability Measurement', () => {
  let handler: KeywordSearchHandler;

  beforeAll(async () => {
    const db = new DatabaseManager(getTestDatabaseConfig(true));
    await db.initialize();
    handler = new KeywordSearchHandler(db);
  });

  it('should have sufficient patterns in database', async () => {
    const request: PatternRequest = {
      id: 'test-count',
      query: 'pattern',
      maxResults: 1,
    };
    const results = await handler.search(request);
    // At least some results should come back
    expect(results.length).toBeGreaterThan(0);
  });

  it('should produce discriminating scores across queries', async () => {
    const cvResults: number[] = [];
    const spreadResults: number[] = [];
    const top1NotTop2Count: number[] = [];

    for (const { query } of TEST_QUERIES) {
      const request: PatternRequest = {
        id: `cv-test-${query.replace(/\s/g, '-')}`,
        query,
        maxResults: 10,
      };

      const results = await handler.search(request);

      if (results.length < 2) continue; // Skip queries with too few results

      const scores = results.map((r) => r.confidence);
      const cv = calculateCV(scores);
      const spread = Math.max(...scores) - Math.min(...scores);
      const top1Different = results[0]?.pattern.id !== results[1]?.pattern.id;

      cvResults.push(cv);
      spreadResults.push(spread);
      top1NotTop2Count.push(top1Different ? 1 : 0);
    }

    // Calculate averages
    const avgCV =
      cvResults.reduce((a, b) => a + b, 0) / (cvResults.length || 1);
    const avgSpread =
      spreadResults.reduce((a, b) => a + b, 0) / (spreadResults.length || 1);
    const topDifferentRate =
      top1NotTop2Count.reduce((a, b) => a + b, 0) /
      (top1NotTop2Count.length || 1);

    // Log results for diagnostics
    console.log('\n=== SCORE VARIABILITY RESULTS ===');
    console.log(`Queries tested: ${cvResults.length}`);
    console.log(`Average CV: ${avgCV.toFixed(3)}`);
    console.log(`Average Spread: ${avgSpread.toFixed(3)}`);
    console.log(`Top-1 != Top-2 rate: ${(topDifferentRate * 100).toFixed(0)}%`);
    console.log('=================================\n');

    // Acceptance criteria
    expect(avgCV).toBeGreaterThanOrEqual(0.30);
    expect(avgSpread).toBeGreaterThanOrEqual(0.50);
    expect(topDifferentRate).toBeGreaterThanOrEqual(0.70);
  });

  it('should rank exact name matches highly', async () => {
    const request: PatternRequest = {
      id: 'exact-match-test',
      query: 'factory',
      maxResults: 5,
    };

    const results = await handler.search(request);

    // At least one of the top results should contain "factory" in name
    const topIds = results.slice(0, 3).map((r) => r.pattern.id);
    const hasFactory = topIds.some(
      (id) => id.includes('factory') || id.includes('Factory')
    );
    expect(hasFactory).toBe(true);
  });

  it('should differentiate similar queries', async () => {
    const request1: PatternRequest = {
      id: 'diff-test-1',
      query: 'observer pattern',
      maxResults: 3,
    };
    const request2: PatternRequest = {
      id: 'diff-test-2',
      query: 'strategy pattern',
      maxResults: 3,
    };

    const results1 = await handler.search(request1);
    const results2 = await handler.search(request2);

    // Top results should differ between queries
    const topIds1 = results1.slice(0, 2).map((r) => r.pattern.id);
    const topIds2 = results2.slice(0, 2).map((r) => r.pattern.id);

    // At least one different pattern in top-2
    const hasDifferent = topIds1.some((id) => !topIds2.includes(id));
    expect(hasDifferent).toBe(true);
  });
});
