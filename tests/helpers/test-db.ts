import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const TEMP_DB_DIR = join(__dirname, '..', '..', 'temp', 'test-databases');

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

function ensureTempDir(): void {
  if (!existsSync(TEMP_DB_DIR)) {
    mkdirSync(TEMP_DB_DIR, { recursive: true });
  }
}

export function createTempDatabasePath(prefix: string = 'test'): string {
  ensureTempDir();
  const uniqueId = randomUUID();
  return join(TEMP_DB_DIR, `${prefix}-${uniqueId}.db`);
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

export function getTestDatabasePath(): string {
  if (process.env.TEST_DB_PATH && existsSync(process.env.TEST_DB_PATH)) {
    return process.env.TEST_DB_PATH;
  }
  
  const mainDbPath = join(__dirname, '..', '..', 'data', 'design-patterns.db');
  if (existsSync(mainDbPath)) {
    return mainDbPath;
  }
  
  throw new Error('Test database not found. Run setup first or ensure main database exists.');
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
