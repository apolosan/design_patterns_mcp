/**
 * Contract tests — per-test-file database isolation.
 *
 * Background: catalog-backed test files (pattern-searchability, performance,
 * abstract-server-pattern, ...) passed alone and failed intermittently in
 * full runs with "no such table: patterns" or "database disk image is
 * malformed". Every test file copied the catalog to the same
 * `tests/temp/test-patterns.db` and, in afterAll, deleted the whole shared
 * directory — so a file finishing early pulled the database out from under
 * files still running, and writable fixtures exported over the copy other
 * files were reading. Temp databases from createTempDatabasePath were never
 * deleted and piled up in temp/test-databases.
 *
 * Requirements:
 *  - each test file works on its own copy of the catalog;
 *  - writes through a writable DatabaseManager never reach the source catalog
 *    nor another file's copy;
 *  - disposing a file's context deletes its copy and every temp database it
 *    created, and nothing belonging to other files;
 *  - a missing catalog fails loudly instead of silently pointing at another
 *    path;
 *  - a run that was killed (afterAll never ran) leaves databases behind; the
 *    next run removes them, without touching runs that are still alive nor
 *    anything else stored under the temp root.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { DatabaseManager } from '../../src/services/database-manager.js';
import { createTestRunContext, sweepStaleTestRuns } from '../helpers/test-run-context.js';

async function writeCatalog(file: string, patternIds: string[]): Promise<void> {
  const db = new DatabaseManager({ filename: file, options: { readonly: false } });
  await db.initialize();
  db.execute('CREATE TABLE IF NOT EXISTS patterns (id TEXT PRIMARY KEY)');
  for (const id of patternIds) db.execute('INSERT INTO patterns (id) VALUES (?)', [id]);
  await db.close();
}

async function patternIds(file: string): Promise<string[]> {
  const db = new DatabaseManager({ filename: file, options: { readonly: true } });
  await db.initialize();
  const ids = db.query<{ id: string }>('SELECT id FROM patterns ORDER BY id').map(r => r.id);
  await db.close();
  return ids;
}

describe('TestRunContext database isolation', () => {
  let root: string;
  let source: string;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-run-context-'));
    source = path.join(root, 'catalog.db');
    await writeCatalog(source, ['builder', 'observer']);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('gives each test file a private copy of the catalog with the same content', async () => {
    const a = createTestRunContext({ rootDir: path.join(root, 'runs'), sourceDatabasePath: source });
    const b = createTestRunContext({ rootDir: path.join(root, 'runs'), sourceDatabasePath: source });

    expect(a.databasePath()).not.toBe(b.databasePath());
    expect(a.databasePath()).not.toBe(source);
    expect(await patternIds(a.databasePath())).toEqual(['builder', 'observer']);
  });

  it('keeps writes from one file away from the catalog and from other files', async () => {
    const a = createTestRunContext({ rootDir: path.join(root, 'runs'), sourceDatabasePath: source });
    const b = createTestRunContext({ rootDir: path.join(root, 'runs'), sourceDatabasePath: source });
    const bPath = b.databasePath();

    const writer = new DatabaseManager({ filename: a.databasePath(), options: { readonly: false } });
    await writer.initialize();
    writer.execute('DELETE FROM patterns');
    await writer.close();

    expect(await patternIds(a.databasePath())).toEqual([]);
    expect(await patternIds(bPath)).toEqual(['builder', 'observer']);
    expect(await patternIds(source)).toEqual(['builder', 'observer']);
  });

  it('copies once per file, so later calls see that file’s own earlier writes', async () => {
    const ctx = createTestRunContext({ rootDir: path.join(root, 'runs'), sourceDatabasePath: source });
    const writer = new DatabaseManager({ filename: ctx.databasePath(), options: { readonly: false } });
    await writer.initialize();
    writer.execute("INSERT INTO patterns (id) VALUES ('saga')");
    await writer.close();

    expect(await patternIds(ctx.databasePath())).toEqual(['builder', 'observer', 'saga']);
  });

  it('deletes its catalog copy and every temp database it created when disposed', async () => {
    const ctx = createTestRunContext({ rootDir: path.join(root, 'runs'), sourceDatabasePath: source });
    const copy = ctx.databasePath();
    const scratch = ctx.tempDatabasePath('seeder');
    await writeCatalog(scratch, ['tmp']);

    ctx.dispose();

    expect(fs.existsSync(copy)).toBe(false);
    expect(fs.existsSync(scratch)).toBe(false);
    expect(fs.existsSync(source)).toBe(true);
  });

  it('leaves databases of files still running intact when another file is disposed', async () => {
    const finished = createTestRunContext({ rootDir: path.join(root, 'runs'), sourceDatabasePath: source });
    const running = createTestRunContext({ rootDir: path.join(root, 'runs'), sourceDatabasePath: source });
    finished.databasePath();
    const runningCopy = running.databasePath();
    const runningScratch = running.tempDatabasePath('vector-ops');
    await writeCatalog(runningScratch, ['x']);

    finished.dispose();

    expect(await patternIds(runningCopy)).toEqual(['builder', 'observer']);
    expect(fs.existsSync(runningScratch)).toBe(true);
  });

  it('hands out a fresh, populated copy when asked again after being disposed', async () => {
    const ctx = createTestRunContext({ rootDir: path.join(root, 'runs'), sourceDatabasePath: source });
    ctx.databasePath();
    ctx.dispose();

    // A stale path here would open as an empty database ("no such table: patterns").
    expect(await patternIds(ctx.databasePath())).toEqual(['builder', 'observer']);
  });

  it('fails with an actionable error when the catalog has not been built', () => {
    const ctx = createTestRunContext({
      rootDir: path.join(root, 'runs'),
      sourceDatabasePath: path.join(root, 'missing.db'),
    });

    expect(() => ctx.databasePath()).toThrow(/bun run db:setup/);
  });
});

describe('sweepStaleTestRuns after an aborted run', () => {
  let root: string;
  let source: string;
  let runs: string;

  /** PID of a process that has already exited: stands in for a killed test run. */
  function exitedProcessId(): number {
    const child = spawnSync(process.execPath, ['-e', '0']);
    if (child.pid === undefined || child.status !== 0) {
      throw new Error('could not spawn the helper process used to obtain a dead PID');
    }
    return child.pid;
  }

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-run-sweep-'));
    source = path.join(root, 'catalog.db');
    runs = path.join(root, 'runs');
    await writeCatalog(source, ['builder']);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('removes the catalog copy and temp databases of a run whose process is gone', async () => {
    const killed = createTestRunContext({
      rootDir: runs,
      sourceDatabasePath: source,
      ownerPid: exitedProcessId(),
    });
    const orphanCopy = killed.databasePath();
    const orphanScratch = killed.tempDatabasePath('vector-ops');
    await writeCatalog(orphanScratch, ['x']);

    sweepStaleTestRuns(runs);

    expect(fs.existsSync(orphanCopy)).toBe(false);
    expect(fs.existsSync(orphanScratch)).toBe(false);
    expect(fs.readdirSync(runs)).toEqual([]);
  });

  it('keeps the databases of a run that is still executing', async () => {
    const killed = createTestRunContext({
      rootDir: runs,
      sourceDatabasePath: source,
      ownerPid: exitedProcessId(),
    });
    killed.databasePath();
    const alive = createTestRunContext({ rootDir: runs, sourceDatabasePath: source });
    const liveCopy = alive.databasePath();

    sweepStaleTestRuns(runs);

    expect(await patternIds(liveCopy)).toEqual(['builder']);
    expect(fs.readdirSync(runs)).toEqual([path.basename(alive.directory)]);
  });

  it('leaves files it did not create under the temp root untouched', () => {
    fs.mkdirSync(path.join(runs, 'fixtures'), { recursive: true });
    fs.writeFileSync(path.join(runs, 'fixtures', 'sample.json'), '{}');
    fs.writeFileSync(path.join(runs, 'notes.txt'), 'keep me');

    sweepStaleTestRuns(runs);

    expect(fs.readdirSync(runs).sort()).toEqual(['fixtures', 'notes.txt']);
    expect(fs.readFileSync(path.join(runs, 'fixtures', 'sample.json'), 'utf-8')).toBe('{}');
  });

  it('is a no-op on a clean checkout where the temp root does not exist yet', () => {
    expect(() => sweepStaleTestRuns(runs)).not.toThrow();
    expect(fs.existsSync(runs)).toBe(false);
  });
});
