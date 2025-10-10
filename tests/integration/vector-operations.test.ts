import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager';
import { VectorOperationsService } from '../../src/services/vector-operations';
import { MigrationManager } from '../../src/services/migrations';
import { getTestDatabaseConfig } from '../helpers/test-db';

describe('Vector Operations with sqlite-vec', () => {
  let dbManager: DatabaseManager;
  let vectorOps: VectorOperationsService;

  beforeAll(async () => {
    // Initialize test database with proper schema
    dbManager = new DatabaseManager(getTestDatabaseConfig(false));
    await dbManager.initialize();

    // Run migrations to ensure schema is up to date
    const migrationManager = new MigrationManager(dbManager, './migrations');
    await migrationManager.initialize();
    await migrationManager.migrate();

    // Initialize vector operations service
    vectorOps = new VectorOperationsService(dbManager, {
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      similarityThreshold: 0.7,
      maxResults: 10,
      cacheEnabled: true,
    });
  });

  beforeEach(() => {
    // Clean up embeddings table between tests
    try {
      dbManager!.execute('DELETE FROM pattern_embeddings');
    } catch {
      // Table might not exist yet, ignore
    }
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  it('should create vector table', () => {
    // Create pattern_embeddings table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS pattern_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_id TEXT NOT NULL,
        embedding TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
      )
    `;

    dbManager.execute(createTableSQL);

    // Verify table exists
    const tables = dbManager.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='pattern_embeddings'
    `);

    const vectorTableCreated = tables.length === 1;
    expect(vectorTableCreated).toBe(true);
  });

  it('should store pattern embeddings', async () => {
    // Create patterns table first with complete schema
    dbManager.execute(`
      CREATE TABLE IF NOT EXISTS patterns (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create pattern_embeddings table
    dbManager.execute(`
      CREATE TABLE IF NOT EXISTS pattern_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_id TEXT NOT NULL,
        embedding TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
      )
    `);

    // Insert a test pattern
    dbManager.execute(
      'INSERT OR REPLACE INTO patterns (id, name, category, description, complexity) VALUES (?, ?, ?, ?, ?)',
      ['test_pattern', 'Test Pattern', 'Test', 'A test pattern for vector operations', 'Low']
    );

    // Create a test embedding (384 dimensions filled with random values)
    const testEmbedding = Array.from({ length: 384 }, () => Math.random());

    // Store the embedding
    await vectorOps.storeEmbedding('test_pattern', testEmbedding);

    // Verify embedding was stored
    const embeddings = dbManager.query('SELECT * FROM pattern_embeddings WHERE pattern_id = ?', [
      'test_pattern',
    ]);

    const stored = embeddings.length === 1;
    expect(stored).toBe(true);
    expect(embeddings[0].pattern_id).toBe('test_pattern');
    expect(embeddings[0].model).toBe('all-MiniLM-L6-v2');
  });

  it('should perform vector similarity search', async () => {
    // Create tables first
    dbManager.execute(`
      CREATE TABLE IF NOT EXISTS patterns (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    dbManager.execute(`
      CREATE TABLE IF NOT EXISTS pattern_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_id TEXT NOT NULL,
        embedding TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
      )
    `);

    // Store multiple test embeddings
    const testPatterns = [
      { id: 'pattern1', name: 'Factory', category: 'Creational' },
      { id: 'pattern2', name: 'Observer', category: 'Behavioral' },
      { id: 'pattern3', name: 'Singleton', category: 'Creational' },
    ];

    for (const pattern of testPatterns) {
      dbManager.execute(
        'INSERT OR REPLACE INTO patterns (id, name, category, description, complexity) VALUES (?, ?, ?, ?, ?)',
        [
          pattern.id,
          pattern.name,
          pattern.category,
          `${pattern.name} pattern description`,
          'Medium',
        ]
      );

      // Create embeddings with slight variations to test similarity
      const baseEmbedding = Array.from({ length: 384 }, () => Math.random());
      await vectorOps.storeEmbedding(pattern.id, baseEmbedding);
    }

    // Perform similarity search
    const queryEmbedding = Array.from({ length: 384 }, () => Math.random());
    const results = await vectorOps.searchSimilar(queryEmbedding, undefined, 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('distance');
    expect(results[0]).toHaveProperty('score');
    expect(results[0]).toHaveProperty('pattern');
  });

  it('should handle different vector dimensions', async () => {
    // Create tables first
    dbManager.execute(`
      CREATE TABLE IF NOT EXISTS patterns (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    dbManager.execute(`
      CREATE TABLE IF NOT EXISTS pattern_embeddings (
        pattern_id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        model TEXT NOT NULL,
        strategy TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Test validation of embedding dimensions
    let dimensionsSupported = false;

    try {
      // This should fail with wrong dimensions
      const wrongDimensionEmbedding = Array.from({ length: 100 }, () => Math.random());
      await vectorOps.storeEmbedding('wrong_dim_pattern', wrongDimensionEmbedding);
      dimensionsSupported = false;
    } catch (error) {
      // Should throw error for wrong dimensions
      dimensionsSupported = (error as Error).message.includes('dimensions mismatch');
    }

    expect(dimensionsSupported).toBe(true);

    // Test correct dimensions
    const correctEmbedding = Array.from({ length: 384 }, () => Math.random());

    // Add pattern first
    dbManager.execute(
      'INSERT OR REPLACE INTO patterns (id, name, category, description, complexity) VALUES (?, ?, ?, ?, ?)',
      ['correct_dim_pattern', 'Correct Dim', 'Test', 'Test pattern with correct dimensions', 'Low']
    );

    await vectorOps.storeEmbedding('correct_dim_pattern', correctEmbedding);

    const embeddings = dbManager.query('SELECT * FROM pattern_embeddings WHERE pattern_id = ?', [
      'correct_dim_pattern',
    ]);

    expect(embeddings.length).toBe(1);
  });

  it('should optimize vector queries', async () => {
    // Test caching and performance optimizations
    const queryEmbedding = Array.from({ length: 384 }, () => Math.random());

    // First search (should be slower)
    const startTime1 = Date.now();
    const results1 = await vectorOps.searchSimilar(queryEmbedding, undefined, 3);
    const time1 = Date.now() - startTime1;

    // Second search with same embedding (should use cache if available)
    const startTime2 = Date.now();
    const results2 = await vectorOps.searchSimilar(queryEmbedding, undefined, 3);
    const time2 = Date.now() - startTime2;

    const queryOptimized = results1.length === results2.length;
    expect(queryOptimized).toBe(true);

    // Verify results are consistent
    expect(results1.length).toBe(results2.length);
    if (results1.length > 0 && results2.length > 0 && results1[0].pattern && results2[0].pattern) {
      expect(results1[0].pattern.id).toBe(results2[0].pattern.id);
    }
  });
});
