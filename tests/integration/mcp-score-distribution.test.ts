/**
 * Integration Test: MCP Score Distribution (post-fuzzy path)
 *
 * Validates that the full MCP search pipeline (BM25 → normalize → fuzzy → defuzzify)
 * preserves score discrimination, not the 15%/45%/80% quantized collapse.
 *
 * This test mirrors the MCP `search_patterns` tool path via SearchMediator,
 * unlike score-variability.test.ts which uses KeywordSearchHandler directly.
 *
 * Acceptance criteria (collapse detection — pre-fix was 2-3 distinct, ~0.35 spread):
 *   - Per-query: distinct values ≥ 4 (proves no collapse to 2-3)
 *   - Per-query: spread ≥ 0.30 (proves no flat ~0.35 collapse)
 *   - Aggregate across eligible queries: mean distinct ≥ 5, mean spread ≥ 0.40
 *
 * Queries with fewer than 4 matching patterns are skipped — discrimination
 * is undefined when there are not enough results to distribute.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager.js';
import { VectorOperationsService } from '../../src/services/vector-operations.js';
import { SearchMediator } from '../../src/handlers/search-mediator.js';
import { getTestDatabaseConfig } from '../helpers/test-db.js';
import type { PatternRequest } from '../../src/types/search-types.js';

const TEST_QUERIES = [
  'factory pattern',
  'observer event',
  'how to create objects',
  'behavioral design',
  'wrapper pattern',
  'singleton instance',
  'algorithm selection',
  'object creation',
  'structural',
  'decorator',
];

const MIN_REQUIRED_RESULTS = 4;

describe('MCP Score Distribution (post-fuzzy path)', () => {
  let mediator: SearchMediator;

  beforeAll(async () => {
    const db = new DatabaseManager(getTestDatabaseConfig(true));
    await db.initialize();
    const vectorOps = new VectorOperationsService(db, {
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      similarityThreshold: 0.3,
      maxResults: 50,
      cacheEnabled: false,
    });
    mediator = new SearchMediator(db, vectorOps, undefined, {
      maxResults: 10,
      minConfidence: 0.05,
      useSemanticSearch: false,
      useKeywordSearch: true,
      useHybridSearch: false,
      useFuzzyRefinement: true,
      cacheResultsTTL: 0,
    });
  });

  async function runQuery(query: string): Promise<{ scores: number[]; unique: number; spread: number; atFloor: number }> {
    const request: PatternRequest = {
      id: `mcp-dist-${query.replace(/\s/g, '-')}-${Math.random().toString(36).slice(2, 8)}`,
      query,
      maxResults: 10,
    };
    const result = await mediator.searchByType(request, 'keyword');
    const scores = result.recommendations.map((r) => r.confidence);
    const unique = new Set(scores.map((s) => s.toFixed(4))).size;
    const spread = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0;
    const atFloor = scores.filter((s) => s < 0.2).length;
    return { scores, unique, spread, atFloor };
  }

  it('should have ≥ 4 distinct score values per query (proves no collapse to 2-3)', async () => {
    const samples: number[] = [];
    for (const query of TEST_QUERIES) {
      const { scores, unique } = await runQuery(query);
      if (scores.length < MIN_REQUIRED_RESULTS) continue;
      samples.push(unique);
      expect(unique, `query="${query}" n=${scores.length} unique=${unique}`).toBeGreaterThanOrEqual(4);
    }
    const mean = samples.reduce((a, b) => a + b, 0) / (samples.length || 1);
    expect(mean, `mean distinct across ${samples.length} eligible queries`).toBeGreaterThanOrEqual(5);
  });

  it('should not collapse > 80% of results to the 20% floor (excludes bimodal queries with one strong match)', async () => {
    for (const query of TEST_QUERIES) {
      const { scores, atFloor } = await runQuery(query);
      if (scores.length < MIN_REQUIRED_RESULTS) continue;
      expect(atFloor / scores.length, `query="${query}" atFloor=${atFloor}/${scores.length}`).toBeLessThanOrEqual(0.8);
    }
  });

  it('should produce score spread ≥ 0.30 per query (proves no flat ~0.35 collapse)', async () => {
    const samples: number[] = [];
    for (const query of TEST_QUERIES) {
      const { scores, spread } = await runQuery(query);
      if (scores.length < MIN_REQUIRED_RESULTS) continue;
      samples.push(spread);
      expect(spread, `query="${query}" spread=${spread.toFixed(3)}`).toBeGreaterThanOrEqual(0.30);
    }
    const mean = samples.reduce((a, b) => a + b, 0) / (samples.length || 1);
    expect(mean, `mean spread across ${samples.length} eligible queries`).toBeGreaterThanOrEqual(0.40);
  });
});
