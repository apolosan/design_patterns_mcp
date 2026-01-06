import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager';
import { createPatternSeeder } from '../../src/services/pattern-seeder';
import path from 'path';

function createFullSchema(dbManager: DatabaseManager): void {
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

describe('Pattern Category Filtering', () => {
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    // Initialize test database
    dbManager = new DatabaseManager({
      filename: ':memory:',
      options: { readonly: false },
    });

    await dbManager.initialize();

    // Create full schema manually (since migrations fail on in-memory DBs with existing tables)
    createFullSchema(dbManager);

    // Seed patterns for testing
    const seeder = createPatternSeeder(dbManager, {
      patternsPath: path.resolve(__dirname, '../../data/patterns'),
      batchSize: 10,
      skipExisting: false,
    });

    const result = await seeder.seedAll();
    if (!result.success) {
      throw new Error(`Failed to seed patterns: ${result.message}`);
    }
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  it('should filter patterns by GoF category', () => {
    const gofPatterns = dbManager.query('SELECT * FROM patterns WHERE category = ?', [
      'Creational',
    ]);

    // GoF patterns should include Singleton, Factory, Observer, etc.
    expect(gofPatterns.length).toBeGreaterThanOrEqual(5);
  });

  it('should filter patterns by Architectural category', () => {
    const architecturalPatterns = dbManager.query('SELECT * FROM patterns WHERE category = ?', [
      'Architectural',
    ]);

    // Should include Clean Architecture, Hexagonal, Onion, etc.
    expect(architecturalPatterns.length).toBeGreaterThan(3);
  });

  it('should filter patterns by Cloud-Native category', () => {
    const cloudPatterns = dbManager.query('SELECT * FROM patterns WHERE category = ?', [
      'Cloud-Native',
    ]);

    // Should include Circuit Breaker, Service Mesh, etc.
    expect(cloudPatterns.length).toBeGreaterThan(3);
  });

  it('should filter patterns by AI/ML category', () => {
    const aiPatterns = dbManager.query('SELECT * FROM patterns WHERE category = ?', ['AI/ML']);

    // Should include RAG, Agentic patterns, etc.
    expect(aiPatterns.length).toBeGreaterThan(2);
  });

  it('should return all categories', () => {
    const categories = dbManager.query<{ category: string }>(
      'SELECT DISTINCT category FROM patterns ORDER BY category'
    );

    const allCategories = categories.map(c => c.category);

    expect(allCategories).toContain('Creational');
    expect(allCategories).toContain('Architectural');
    expect(allCategories).toContain('Cloud-Native');
    expect(allCategories).toContain('AI/ML');
    expect(allCategories.length).toBeGreaterThan(5);
  });
});
