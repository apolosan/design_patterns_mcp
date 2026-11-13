import { join } from 'path';
import { existsSync, rmSync, writeFileSync } from 'fs';
import { createTestRunContext, type TestRunContext } from './test-run-context';

/** Root of the per-test-file scratch directories (see test-run-context.ts). */
export const TEST_RUNS_ROOT = join(__dirname, '..', 'temp');

/** The real pattern catalog. Tests only ever read it, to copy it. */
export const CATALOG_DATABASE_PATH = join(__dirname, '..', '..', 'data', 'design-patterns.db');

export interface PatternRow {
  id: string;
  name: string;
  category: string;
  description: string;
  when_to_use: string | null;
  benefits: string | null;
  use_cases: string | null;
  complexity: string | null;
  tags: string | null;
  examples: string | null;
}

export interface PatternColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface CountResult {
  count: number;
}

export interface ExamplesField {
  typescript: {
    description: string;
    code: string;
  };
  clojure: {
    description: string;
    code: string;
  };
  python: {
    description: string;
    code: string;
  };
  java: {
    description: string;
    code: string;
  };
}

/**
 * Scratch space of the test file that imported this module. Vitest evaluates
 * modules once per test file, so every file gets its own.
 */
let activeContext: TestRunContext | null = null;

function testRunContext(): TestRunContext {
  activeContext ??= createTestRunContext({
    rootDir: TEST_RUNS_ROOT,
    sourceDatabasePath: CATALOG_DATABASE_PATH,
  });
  return activeContext;
}

/**
 * Deletes the catalog copy and every temporary database of the current test
 * file. Called by tests/setup.ts once the file has finished.
 */
export function disposeTestRunContext(): void {
  activeContext?.dispose();
  activeContext = null;
}

/**
 * Returns the path for a new temporary database. The file lives in the
 * current test file's scratch directory and is deleted with it, so calling
 * {@link cleanupTempDatabase} is optional.
 */
export function createTempDatabasePath(prefix: string = 'test'): string {
  return testRunContext().tempDatabasePath(prefix);
}

export function cleanupTempDatabase(path: string): void {
  try {
    if (existsSync(path)) {
      rmSync(path);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Returns the path of the current test file's private copy of the pattern
 * catalog. The copy is made on first use; it can be opened for writing
 * without affecting other test files or the real catalog.
 *
 * @throws {Error} When the real catalog has not been built yet.
 */
export function getTestDatabasePath(): string {
  return testRunContext().databasePath();
}

export function getTestDatabaseConfig(readonly: boolean = true, customPath?: string) {
  return {
    filename: customPath ?? getTestDatabasePath(),
    options: {
      readonly,
      fileMustExist: !readonly
    }
  };
}

export function createInMemoryDatabase(): { path: string; close: () => void } {
  const path = createTempDatabasePath('inmemory');
  writeFileSync(path, '');
  return {
    path,
    close: () => cleanupTempDatabase(path)
  };
}
