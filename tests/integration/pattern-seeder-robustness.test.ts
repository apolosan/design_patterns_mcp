/**
 * Regression tests — PatternSeeder idempotency and fault isolation
 * (review F4 and F9).
 *
 * Requirements:
 *  - F4: `bun run seed` is safe to repeat. Re-seeding must not duplicate
 *    implementations (get_pattern_details shows LIMIT 3 snippets, so
 *    duplicates surface directly to users), in skip mode or replace mode.
 *  - F9: one malformed JSON file must not abort the whole catalog; it is
 *    skipped and reported. The seeder's own default relationship type
 *    ('related') must pass validate().
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseManager } from '../../src/services/database-manager.js';
import { MigrationManager } from '../../src/services/migrations.js';
import { createPatternSeeder } from '../../src/services/pattern-seeder.js';
import { createTempDatabasePath } from '../helpers/test-db.js';

function patternJson(id: string, related: string[] = []): string {
  return JSON.stringify([
    {
      id,
      name: id,
      category: 'Creational',
      description: `${id} description`,
      complexity: 'Low',
      tags: ['creational'],
      relatedPatterns: related,
      implementations: [
        { language: 'typescript', approach: 'class', code: `class ${id} {}`, explanation: 'ts' },
        { language: 'python', approach: 'class', code: `class ${id}: pass`, explanation: 'py' },
      ],
    },
  ]);
}

describe('PatternSeeder robustness', () => {
  let db: DatabaseManager;
  let patternsDir: string;

  beforeEach(async () => {
    db = new DatabaseManager({ filename: createTempDatabasePath('seeder'), options: { readonly: false } });
    await db.initialize();
    const migrations = new MigrationManager(db, './migrations');
    migrations.initialize();
    await migrations.migrate();
    db.execute('DELETE FROM pattern_relationships');
    db.execute('DELETE FROM pattern_implementations');
    db.execute('DELETE FROM patterns');

    patternsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seeder-patterns-'));
    fs.writeFileSync(path.join(patternsDir, 'builder.json'), patternJson('builder'));
    fs.writeFileSync(path.join(patternsDir, 'prototype.json'), patternJson('prototype', ['builder']));
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(patternsDir, { recursive: true, force: true });
  });

  function implementationCount(patternId: string): number {
    return (
      db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM pattern_implementations WHERE pattern_id = ?',
        [patternId]
      )?.count ?? -1
    );
  }

  it('does not duplicate implementations when seeding twice with skipExisting', async () => {
    const seeder = createPatternSeeder(db, { patternsPath: patternsDir, skipExisting: true });

    await seeder.seedAll();
    await seeder.seedAll();

    expect(implementationCount('builder')).toBe(2);
    expect(implementationCount('prototype')).toBe(2);
  });

  it('replaces rather than appends implementations when re-seeding with skipExisting disabled', async () => {
    const seeder = createPatternSeeder(db, { patternsPath: patternsDir, skipExisting: false });

    await seeder.seedAll();
    await seeder.seedAll();
    await seeder.seedAll();

    expect(implementationCount('builder')).toBe(2);
  });

  it('reports zero new implementations on a no-op re-seed', async () => {
    const seeder = createPatternSeeder(db, { patternsPath: patternsDir, skipExisting: true });

    await seeder.seedAll();
    const second = await seeder.seedAll();

    expect(second.totalImplementations).toBe(0);
  });

  it('seeds the valid files and reports a malformed one instead of aborting', async () => {
    fs.writeFileSync(path.join(patternsDir, 'broken.json'), '[{"id": "broken", "name": "x",}]');
    const seeder = createPatternSeeder(db, { patternsPath: patternsDir });

    const result = await seeder.seedAll();

    expect(result.success).toBe(true);
    expect(result.totalPatterns).toBe(2);
    expect(result.failedFiles).toEqual(['broken.json']);
  });

  it('accepts its own default relationship type during validation', async () => {
    const seeder = createPatternSeeder(db, { patternsPath: patternsDir });
    await seeder.seedAll();

    const validation = seeder.validate();

    expect(validation.errors.filter(e => e.includes('invalid types'))).toEqual([]);
  });
});
