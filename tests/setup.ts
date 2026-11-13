// Test setup file
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { disposeTestRunContext } from './helpers/test-db';

interface TestCache {
  clear(): void;
}

interface TestDatabaseManager {
  close(): Promise<void>;
}

declare global {
  // eslint-disable-next-line no-var
  var testCache: TestCache | undefined;
  // eslint-disable-next-line no-var
  var testDatabaseManager: TestDatabaseManager | undefined;
}

// Databases are not prepared here: each test file gets a private copy of the
// catalog on demand through tests/helpers/test-db.ts.
beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

// Reset test environment before each test
beforeEach(() => {
  // Clear any test-specific caches
  if (globalThis.testCache) {
    globalThis.testCache.clear();
  }
});

// Clean up after tests
afterAll(async () => {
  if (globalThis.testDatabaseManager) {
    try {
      await globalThis.testDatabaseManager.close();
    } catch {
      // Ignore close errors during teardown
    }
  }

  // Delete this file's catalog copy and temporary databases. Only this file's
  // directory is removed: other test files may still be running.
  disposeTestRunContext();
});