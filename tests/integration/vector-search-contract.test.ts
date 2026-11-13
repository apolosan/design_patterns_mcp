/**
 * Contract tests — VectorOperationsService.searchSimilar (review F6, F7, F10).
 *
 * Requirements:
 *  - F6: tag filters select patterns by membership in their JSON-array
 *    `tags` column, and result tags are the parsed array elements
 *    (not fragments of the JSON string).
 *  - F7: scores are cosine similarity on every execution path, so the same
 *    `minScore` means the same thing whether sqlite-vec is present or not.
 *  - F10: a search reads candidates in a single query instead of issuing
 *    one or two extra SELECTs per stored embedding (N+1).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager.js';
import { MigrationManager } from '../../src/services/migrations.js';
import { VectorOperationsService } from '../../src/services/vector-operations.js';
import { createTempDatabasePath } from '../helpers/test-db.js';

const DIMENSIONS = 384;

/** Unit vector pointing along axis `i` mixed with axis `j` by angle `theta`. */
function direction(theta: number): number[] {
  const v = new Array<number>(DIMENSIONS).fill(0);
  v[0] = Math.cos(theta);
  v[1] = Math.sin(theta);
  return v;
}

const PATTERNS = [
  { id: 'factory-method', category: 'Creational', tags: ['creational', 'gof'], theta: 0 },
  { id: 'builder', category: 'Creational', tags: ['creational', 'fluent'], theta: Math.PI / 6 },
  { id: 'observer', category: 'Behavioral', tags: ['behavioral', 'events'], theta: Math.PI / 3 },
  { id: 'saga', category: 'Microservices', tags: ['distributed'], theta: Math.PI / 2 },
];

describe('VectorOperationsService.searchSimilar contract', () => {
  let db: DatabaseManager;
  let vectorOps: VectorOperationsService;

  beforeAll(async () => {
    db = new DatabaseManager({ filename: createTempDatabasePath('vector-contract'), options: { readonly: false } });
    await db.initialize();
    const migrations = new MigrationManager(db, './migrations');
    migrations.initialize();
    await migrations.migrate();

    vectorOps = new VectorOperationsService(db, {
      model: 'all-MiniLM-L6-v2',
      dimensions: DIMENSIONS,
      similarityThreshold: 0.3,
      maxResults: 10,
      cacheEnabled: false,
    });

    for (const p of PATTERNS) {
      db.execute(
        'INSERT INTO patterns (id, name, category, description, complexity, tags) VALUES (?, ?, ?, ?, ?, ?)',
        [p.id, p.id, p.category, `${p.id} description`, 'Medium', JSON.stringify(p.tags)]
      );
      vectorOps.storeEmbedding(p.id, direction(p.theta));
    }
  });

  afterAll(async () => {
    await db.close();
  });

  it('filters by tag membership in the JSON tags array', () => {
    const results = vectorOps.searchSimilar(direction(0), { tags: ['creational'], minScore: -1 });

    expect(results.map(r => r.patternId).sort()).toEqual(['builder', 'factory-method']);
  });

  it('matches any of several requested tags', () => {
    const results = vectorOps.searchSimilar(direction(0), { tags: ['events', 'distributed'], minScore: -1 });

    expect(results.map(r => r.patternId).sort()).toEqual(['observer', 'saga']);
  });

  it('returns pattern tags as parsed array elements', () => {
    const [top] = vectorOps.searchSimilar(direction(0), { minScore: -1 }, 1);

    expect(top.pattern?.tags).toEqual(['creational', 'gof']);
  });

  it('scores results by cosine similarity to the query', () => {
    const results = vectorOps.searchSimilar(direction(0), { minScore: -1 });
    const score = (id: string) => results.find(r => r.patternId === id)?.score;

    expect(score('factory-method')).toBeCloseTo(1, 6);
    expect(score('builder')).toBeCloseTo(Math.cos(Math.PI / 6), 6);
    expect(score('observer')).toBeCloseTo(0.5, 6);
    expect(score('saga')).toBeCloseTo(0, 6);
  });

  it('applies minScore on the cosine scale (orthogonal patterns are excluded at 0.3)', () => {
    const results = vectorOps.searchSimilar(direction(0), { minScore: 0.3 });

    expect(results.map(r => r.patternId)).toEqual(['factory-method', 'builder', 'observer']);
  });

  it('reads candidates without one lookup per stored embedding', () => {
    const querySpy = vi.spyOn(db, 'query');
    const queryOneSpy = vi.spyOn(db, 'queryOne');

    vectorOps.searchSimilar(direction(0), { categories: ['Creational'], minScore: -1 });

    const totalStatements = querySpy.mock.calls.length + queryOneSpy.mock.calls.length;
    querySpy.mockRestore();
    queryOneSpy.mockRestore();
    expect(totalStatements).toBeLessThanOrEqual(2);
  });
});

describe('VectorOperationsService indexed (sqlite-vec) path', () => {
  it('converts sqlite-vec cosine distance to the same cosine-similarity scale as the linear path', () => {
    const rows = [
      { pattern_id: 'near', embedding: '[]', distance: 0.1, name: 'near', category: 'C', description: 'd', tags: '["x"]' },
      { pattern_id: 'far', embedding: '[]', distance: 0.95, name: 'far', category: 'C', description: 'd', tags: '[]' },
    ];
    const fakeDb = {
      queryOne: () => ({ count: 1 }),
      query: (sql: string) => (sql.includes('vec_distance_cosine') ? rows : []),
    };
    const ops = new VectorOperationsService(fakeDb as never, {
      model: 'all-MiniLM-L6-v2',
      dimensions: DIMENSIONS,
      similarityThreshold: 0.3,
      maxResults: 10,
      cacheEnabled: false,
    });

    const results = ops.searchSimilar(direction(0), { minScore: 0.3 });

    expect(results.map(r => r.patternId)).toEqual(['near']);
    expect(results[0].score).toBeCloseTo(0.9, 6);
    expect(results[0].pattern?.tags).toEqual(['x']);
  });
});
