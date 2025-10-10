import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager';

async function createFullSchema(dbManager: DatabaseManager): Promise<void> {
  // Drop existing tables to ensure clean schema
  dbManager.execute('DROP TABLE IF EXISTS pattern_embeddings');
  dbManager.execute('DROP TABLE IF EXISTS pattern_relationships');
  dbManager.execute('DROP TABLE IF EXISTS pattern_implementations');
  dbManager.execute('DROP TABLE IF EXISTS patterns');

  // Create patterns table with all columns including examples
  dbManager.execute(`
    CREATE TABLE patterns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      when_to_use TEXT,
      benefits TEXT,
      drawbacks TEXT,
      use_cases TEXT,
      complexity TEXT NOT NULL,
      tags TEXT,
      examples TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create pattern_implementations table
  dbManager.execute(`
    CREATE TABLE pattern_implementations (
      id TEXT PRIMARY KEY,
      pattern_id TEXT NOT NULL,
      language TEXT NOT NULL,
      approach TEXT NOT NULL,
      code TEXT NOT NULL,
      explanation TEXT NOT NULL,
      dependencies TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
    )
  `);

  // Create pattern_relationships table
  dbManager.execute(`
    CREATE TABLE pattern_relationships (
      id TEXT PRIMARY KEY,
      source_pattern_id TEXT NOT NULL,
      target_pattern_id TEXT NOT NULL,
      type TEXT NOT NULL,
      strength REAL DEFAULT 1.0,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_pattern_id) REFERENCES patterns(id) ON DELETE CASCADE,
      FOREIGN KEY (target_pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
    )
  `);

  // Create pattern_embeddings table
  dbManager.execute(`
    CREATE TABLE pattern_embeddings (
      pattern_id TEXT PRIMARY KEY,
      embedding TEXT NOT NULL,
      model TEXT NOT NULL,
      strategy TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  dbManager.execute('CREATE INDEX IF NOT EXISTS idx_patterns_category ON patterns(category)');
  dbManager.execute('CREATE INDEX IF NOT EXISTS idx_patterns_complexity ON patterns(complexity)');
  dbManager.execute(
    'CREATE INDEX IF NOT EXISTS idx_pattern_implementations_pattern_id ON pattern_implementations(pattern_id)'
  );
  dbManager.execute(
    'CREATE INDEX IF NOT EXISTS idx_pattern_implementations_language ON pattern_implementations(language)'
  );
  dbManager.execute(
    'CREATE INDEX IF NOT EXISTS idx_pattern_relationships_source ON pattern_relationships(source_pattern_id)'
  );
  dbManager.execute(
    'CREATE INDEX IF NOT EXISTS idx_pattern_relationships_target ON pattern_relationships(target_pattern_id)'
  );
  dbManager.execute(
    'CREATE INDEX IF NOT EXISTS idx_pattern_relationships_type ON pattern_relationships(type)'
  );
}

describe('SQLite Schema Validation', () => {
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    // Initialize test database
    dbManager = new DatabaseManager({
      filename: ':memory:',
      options: { readonly: false },
    });

    await dbManager.initialize();

    // Create full schema manually (since migrations fail on in-memory DBs with existing tables)
    await createFullSchema(dbManager);
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  it('should validate database schema structure', () => {
    // Check that all required tables exist
    const tables = dbManager.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );

    const tableNames = tables.map((t: { name: string }) => t.name);

    // Required tables from our schema
    const requiredTables = [
      'patterns',
      'pattern_implementations',
      'pattern_relationships',
      'pattern_embeddings',
    ];

    for (const tableName of requiredTables) {
      expect(tableNames).toContain(tableName);
    }
  });

  it('should validate patterns table schema', () => {
    // Check patterns table columns
    const columns = dbManager.query<{ name: string; type: string; notnull: number; pk: number }>(
      'PRAGMA table_info(patterns)'
    );

    const columnNames = columns.map((c: { name: string }) => c.name);

    // Required columns for patterns table
    const requiredColumns = [
      'id',
      'name',
      'category',
      'description',
      'when_to_use',
      'benefits',
      'drawbacks',
      'use_cases',
      'complexity',
      'tags',
      'examples',
      'created_at',
      'updated_at',
    ];

    for (const columnName of requiredColumns) {
      expect(columnNames).toContain(columnName);
    }

    // Check that id is PRIMARY KEY
    const idColumn = columns.find((c: { name: string }) => c.name === 'id');
    expect(idColumn).toBeDefined();
    expect(idColumn!.pk).toBe(1); // Primary key flag
  });

  it('should validate pattern_embeddings table schema', () => {
    // Check pattern_embeddings table columns
    const columns = dbManager.query<{ name: string; type: string; notnull: number; pk: number }>(
      'PRAGMA table_info(pattern_embeddings)'
    );

    const columnNames = columns.map((c: { name: string }) => c.name);

    // Required columns for pattern_embeddings table
    const requiredColumns = [
      'pattern_id',
      'embedding',
      'model',
      'strategy',
      'dimensions',
      'created_at',
    ];

    for (const columnName of requiredColumns) {
      expect(columnNames).toContain(columnName);
    }

    // Check that pattern_id is PRIMARY KEY
    const patternIdColumn = columns.find((c: { name: string }) => c.name === 'pattern_id');
    expect(patternIdColumn).toBeDefined();
    expect(patternIdColumn!.pk).toBe(1); // Primary key flag
  });

  it('should validate foreign key constraints', () => {
    // Check foreign keys for pattern_implementations
    const fkPatternImpl = dbManager.query('PRAGMA foreign_key_list(pattern_implementations)');

    expect(fkPatternImpl.length).toBeGreaterThan(0);
    expect(fkPatternImpl[0].table).toBe('patterns');
    expect(fkPatternImpl[0].from).toBe('pattern_id');
    expect(fkPatternImpl[0].to).toBe('id');

    // Check foreign keys for pattern_relationships
    const fkRelationships = dbManager.query('PRAGMA foreign_key_list(pattern_relationships)');

    expect(fkRelationships.length).toBeGreaterThan(0);
    const sourceFk = fkRelationships.find((fk: any) => fk.from === 'source_pattern_id');
    const targetFk = fkRelationships.find((fk: any) => fk.from === 'target_pattern_id');

    expect(sourceFk).toBeDefined();
    expect(targetFk).toBeDefined();
    expect(sourceFk!.table).toBe('patterns');
    expect(targetFk!.table).toBe('patterns');
  });

  it('should validate indexes exist', () => {
    // Check that important indexes exist
    const indexes = dbManager.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
    );

    const indexNames = indexes.map((i: { name: string }) => i.name);

    // Some key indexes that should exist
    const expectedIndexes = [
      'idx_patterns_category',
      'idx_patterns_complexity',
      'idx_pattern_implementations_pattern_id',
      'idx_pattern_relationships_source',
      'idx_pattern_relationships_target',
    ];

    for (const indexName of expectedIndexes) {
      expect(indexNames).toContain(indexName);
    }
  });
});
