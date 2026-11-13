/**
 * Per-test-file database scratch space.
 *
 * Each test file gets a private directory holding its own copy of the pattern
 * catalog and every temporary database it creates. Nothing in it is shared
 * with other test files, so files can run in parallel and write freely, and
 * the whole directory is deleted when the file finishes.
 *
 * Directory names carry the PID of the process that owns them, which lets a
 * later run recognise and remove what a killed run left behind.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';

const RUN_DIRECTORY_PATTERN = /^run-(\d+)-/;
const CATALOG_COPY_NAME = 'catalog.db';

export interface TestRunContextOptions {
  /** Directory under which the private directory is created. */
  rootDir: string;
  /** Catalog database that is copied on first use. It is never written to. */
  sourceDatabasePath: string;
  /** Process owning the directory. Defaults to the current process. */
  ownerPid?: number;
}

export interface TestRunContext {
  /** Private directory of this context. It exists only once something was created in it. */
  readonly directory: string;
  /**
   * Path of this context's own copy of the catalog. The copy is made on the
   * first call and reused afterwards.
   *
   * @throws {Error} When the source catalog does not exist.
   */
  databasePath(): string;
  /** Path for a new, not yet existing, temporary database inside the private directory. */
  tempDatabasePath(prefix?: string): string;
  /** Deletes the private directory and everything in it. */
  dispose(): void;
}

/**
 * Creates the scratch space of one test file.
 *
 * @param options - Where to create it and which catalog to copy.
 * @returns The context; call `dispose()` when the file has finished.
 */
export function createTestRunContext(options: TestRunContextOptions): TestRunContext {
  const directory = join(
    options.rootDir,
    `run-${options.ownerPid ?? process.pid}-${randomUUID()}`
  );
  let catalogCopy: string | null = null;

  return {
    directory,

    databasePath(): string {
      if (catalogCopy !== null) {
        return catalogCopy;
      }
      if (!existsSync(options.sourceDatabasePath)) {
        throw new Error(
          `Pattern catalog not found at ${options.sourceDatabasePath}. ` +
            'Build it with "bun run db:setup" before running tests that read the catalog.'
        );
      }
      mkdirSync(directory, { recursive: true });
      const copy = join(directory, CATALOG_COPY_NAME);
      copyFileSync(options.sourceDatabasePath, copy);
      catalogCopy = copy;
      return copy;
    },

    tempDatabasePath(prefix: string = 'test'): string {
      mkdirSync(directory, { recursive: true });
      return join(directory, `${prefix}-${randomUUID()}.db`);
    },

    dispose(): void {
      catalogCopy = null;
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes the directories left behind by test runs that were killed before
 * they could clean up. Directories of processes that are still alive, and
 * anything not created by {@link createTestRunContext}, are left untouched.
 *
 * @param rootDir - The root passed to `createTestRunContext`.
 */
export function sweepStaleTestRuns(rootDir: string): void {
  if (!existsSync(rootDir)) {
    return;
  }
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const ownerPid = RUN_DIRECTORY_PATTERN.exec(entry.name)?.[1];
    if (!entry.isDirectory() || ownerPid === undefined || isProcessAlive(Number(ownerPid))) {
      continue;
    }
    rmSync(join(rootDir, entry.name), { recursive: true, force: true });
  }
}
