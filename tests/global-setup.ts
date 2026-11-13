/**
 * Runs once per test run, in the main vitest process.
 *
 * Before the first test file: removes the scratch directories left behind by
 * runs that were killed before they could clean up (a file's own directory is
 * normally deleted by tests/setup.ts as soon as the file finishes).
 *
 * After the last test file: fails the run if the real pattern catalog was
 * written to while the tests were running. Test files work on private copies
 * (tests/helpers/test-db.ts); a test that opens data/design-patterns.db for
 * writing changes the developer's data and corrupts the copies other files
 * are taking of it at that moment.
 */
import { existsSync, statSync } from 'fs';
import { CATALOG_DATABASE_PATH, TEST_RUNS_ROOT } from './helpers/test-db';
import { sweepStaleTestRuns } from './helpers/test-run-context';

/** Cheap change detector: any rewrite of the file changes its mtime. */
function catalogFingerprint(): string | null {
  if (!existsSync(CATALOG_DATABASE_PATH)) {
    return null;
  }
  const { mtimeMs, size } = statSync(CATALOG_DATABASE_PATH);
  return `${mtimeMs}:${size}`;
}

export default function setup(): () => void {
  sweepStaleTestRuns(TEST_RUNS_ROOT);
  const fingerprintBefore = catalogFingerprint();

  return function teardown(): void {
    if (catalogFingerprint() !== fingerprintBefore) {
      throw new Error(
        `${CATALOG_DATABASE_PATH} was written to while the tests were running. ` +
          'Tests must open the catalog through getTestDatabasePath() or getTestDatabaseConfig() ' +
          'from tests/helpers/test-db.ts, which hand out a private copy.'
      );
    }
  };
}
