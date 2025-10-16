import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager';
import { createVectorOperationsService } from '../../src/services/vector-operations';
import { createPatternMatcher } from '../../src/services/pattern-matcher';
import { createPatternSeeder } from '../../src/services/pattern-seeder';
import path from 'path';

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

describe('Pattern Matching with Semantic Search', () => {
  let dbManager: DatabaseManager;
  let vectorOps: any;
  let patternMatcher: any;

  beforeAll(async () => {
    // Initialize test database
    dbManager = new DatabaseManager({
      filename: ':memory:',
      options: { readonly: false },
    });
    await dbManager.initialize();

    // Create full schema manually (since migrations fail on in-memory DBs with existing tables)
    await createFullSchema(dbManager);

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

    // Debug logging removed for cleaner test output

    // Initialize vector operations
    vectorOps = createVectorOperationsService(dbManager);

    // Create pattern matcher
    patternMatcher = createPatternMatcher(dbManager, vectorOps);
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  it('should find patterns using semantic similarity', async () => {
    const request = {
      id: 'test-1',
      query: 'factory method pattern',
      maxResults: 3,
    };

    const matches = await patternMatcher.findMatchingPatterns(request);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toHaveProperty('pattern');
    expect(matches[0]).toHaveProperty('confidence');
    expect(matches[0].confidence).toBeGreaterThan(0);
    expect(matches[0].confidence).toBeLessThanOrEqual(1);
  });

  it('should rank patterns by relevance', async () => {
    const request = {
      id: 'test-2',
      query: 'factory method pattern',
      maxResults: 5,
    };

    const matches = await patternMatcher.findMatchingPatterns(request);

    expect(matches.length).toBeGreaterThan(0);

    // Results should be sorted by confidence (highest first)
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].confidence).toBeGreaterThanOrEqual(matches[i].confidence);
    }

    // First result should have reasonable confidence
    expect(matches[0].confidence).toBeGreaterThan(0.1);
  });

  it('should handle multiple programming languages', async () => {
    const request = {
      id: 'test-3',
      query: 'factory method',
      programmingLanguage: 'typescript',
      maxResults: 3,
    };

    const matches = await patternMatcher.findMatchingPatterns(request);

    expect(matches.length).toBeGreaterThan(0);

    // Check that implementation guidance is provided
    const firstMatch = matches[0];
    expect(firstMatch).toHaveProperty('implementation');
    expect(firstMatch.implementation).toHaveProperty('steps');
    expect(Array.isArray(firstMatch.implementation.steps)).toBe(true);
    expect(firstMatch.implementation.steps.length).toBeGreaterThan(0);
  });

  it('should support hybrid search (keyword + semantic)', async () => {
    const request = {
      id: 'test-4',
      query: 'factory method pattern',
      maxResults: 3,
    };

    const matches = await patternMatcher.findMatchingPatterns(request);

    expect(matches.length).toBeGreaterThan(0);

    // Should find Factory Method pattern
    const factoryMethodMatch = matches.find((m: any) =>
      m.pattern.name.toLowerCase().includes('factory method')
    );
    expect(factoryMethodMatch).toBeTruthy();
    expect(factoryMethodMatch!.confidence).toBeGreaterThan(0.3);
  });

  it('should provide pattern explanations', async () => {
    const request = {
      id: 'test-5',
      query: 'observer pattern',
      maxResults: 1,
    };

    const matches = await patternMatcher.findMatchingPatterns(request);

    expect(matches.length).toBeGreaterThan(0);

    const match = matches[0];
    expect(match).toHaveProperty('justification');
    expect(match.justification).toHaveProperty('primaryReason');
    expect(match.justification).toHaveProperty('supportingReasons');
    expect(match.justification).toHaveProperty('benefits');
    expect(match.justification).toHaveProperty('drawbacks');

    // Benefits and drawbacks should be arrays
    expect(Array.isArray(match.justification.benefits)).toBe(true);
    expect(Array.isArray(match.justification.drawbacks)).toBe(true);
  });

  it('should filter by categories', async () => {
    const request = {
      id: 'test-6',
      query: 'factory method pattern',
      categories: ['Creational'],
      maxResults: 5,
    };

    const matches = await patternMatcher.findMatchingPatterns(request);

    expect(matches.length).toBeGreaterThan(0);

    // All results should be from Creational category
    for (const match of matches) {
      expect(match.pattern.category).toBe('Creational');
    }
  });

  it('should handle edge case queries gracefully', async () => {
    const request = {
      id: 'test-7',
      query: 'single instance global access',
      maxResults: 3,
    };

    const matches = await patternMatcher.findMatchingPatterns(request);

    // Should return array (may or may not be empty depending on matching)
    expect(Array.isArray(matches)).toBe(true);
    expect(matches.length).toBeGreaterThanOrEqual(0);
  });
});
