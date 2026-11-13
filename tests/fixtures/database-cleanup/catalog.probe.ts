/**
 * Probe executed by a nested vitest run (see
 * tests/integration/test-database-cleanup.test.ts).
 *
 * It behaves like the heaviest fixtures of the suite: it opens its catalog
 * for writing, inserts a row, closes the database (sql.js exports the file on
 * close) and creates a scratch database. It then reports the paths it used so
 * the parent test can inspect the disk once this file has finished.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, writeFileSync } from 'fs';
import { DatabaseManager } from '../../../src/services/database-manager.js';
import { createTempDatabasePath, getTestDatabaseConfig } from '../../helpers/test-db.js';

describe('database cleanup probe', () => {
  it('writes to its catalog and to a scratch database, then reports their paths', async () => {
    const reportPath = process.env.DATABASE_CLEANUP_PROBE_REPORT;
    if (reportPath === undefined) {
      throw new Error('DATABASE_CLEANUP_PROBE_REPORT is not set: run this probe through its parent test');
    }

    const catalogConfig = getTestDatabaseConfig(false);
    const catalog = new DatabaseManager(catalogConfig);
    await catalog.initialize();
    const patterns =
      catalog.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM patterns')?.count ?? 0;
    catalog.execute(
      'INSERT INTO patterns (id, name, category, description, complexity, tags) VALUES (?, ?, ?, ?, ?, ?)',
      ['cleanup-probe', 'Cleanup Probe', 'Testing', 'Row written by the cleanup probe', 'Low', '[]']
    );
    await catalog.close();

    const scratchPath = createTempDatabasePath('cleanup-probe');
    const scratch = new DatabaseManager({ filename: scratchPath, options: { readonly: false } });
    await scratch.initialize();
    scratch.execute('CREATE TABLE probe (id INTEGER PRIMARY KEY)');
    await scratch.close();

    expect(patterns).toBeGreaterThan(0);
    expect(existsSync(catalogConfig.filename)).toBe(true);
    expect(existsSync(scratchPath)).toBe(true);

    writeFileSync(
      reportPath,
      JSON.stringify({ catalogPath: catalogConfig.filename, scratchPath, patterns })
    );
  });
});
