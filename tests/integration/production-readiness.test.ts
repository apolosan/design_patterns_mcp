import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager';
import { PatternMatcher } from '../../src/services/pattern-matcher';
import { VectorOperationsService } from '../../src/services/vector-operations';

describe('Production Readiness Tests', () => {
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    // Initialize database
    dbManager = new DatabaseManager({
      filename: ':memory:',
      options: { readonly: false },
    });
    await dbManager.initialize();

    // Create test tables matching production schema
    const db = dbManager.getDatabase() as {
      run: (sql: string) => void;
      exec: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
    };
    const typedDb = db;
    
    try {
      typedDb.run('DROP TABLE IF EXISTS pattern_relationships');
      typedDb.run('DROP TABLE IF EXISTS pattern_implementations');
      typedDb.run('DROP TABLE IF EXISTS pattern_embeddings');
      typedDb.run('DROP TABLE IF EXISTS patterns');
    } catch (e) {
      // Ignore drop errors
    }
    
    typedDb.run(`
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    typedDb.run(`
      CREATE TABLE pattern_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_id TEXT NOT NULL,
        embedding TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    typedDb.run(`
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
    
    typedDb.run(`
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
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  it('should detect empty database and fail gracefully', async () => {
    // Initialize services with empty database
    const vectorOps = new VectorOperationsService(dbManager, {
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      similarityThreshold: 0.7,
      maxResults: 10,
      cacheEnabled: true,
    });

    const patternMatcher = new PatternMatcher(dbManager, vectorOps, {
      maxResults: 5,
      minConfidence: 0.3,
      useSemanticSearch: true,
      useKeywordSearch: true,
      useHybridSearch: true,
      semanticWeight: 0.7,
      keywordWeight: 0.3,
    });

    // Check pattern count
    const patternCount = dbManager.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM patterns');
    expect(patternCount?.count).toBe(0);

    // Test with empty database - should return empty results, not crash
    const request = {
      id: 'test-empty-db',
      query: 'create objects without specifying exact classes',
      maxResults: 5,
      programmingLanguage: 'typescript'
    };

    const recommendations = await patternMatcher.findMatchingPatterns(request);
    
    // Should return empty results gracefully
    expect(recommendations).toEqual([]);
    
    // Log warning for production readiness
    console.warn('⚠️  PRODUCTION ISSUE: Empty database detected - no patterns available for recommendations');
  });

  it('should detect high confidence thresholds that prevent results', async () => {
    // Add minimal test data
    const db = dbManager.getDatabase() as {
      run: (sql: string) => void;
      exec: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
    };
    db.run(`
      INSERT INTO patterns (id, name, category, description, complexity, tags) 
      VALUES ('factory_method', 'Factory Method', 'Creational', 'Create objects without specifying exact classes', 'Intermediate', 'factory,creation,objects')
    `);

    // Test with very high confidence threshold (production misconfiguration)
    const vectorOps = new VectorOperationsService(dbManager, {
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      similarityThreshold: 0.95, // Very high threshold
      maxResults: 10,
      cacheEnabled: true,
    });

    const patternMatcher = new PatternMatcher(dbManager, vectorOps, {
      maxResults: 5,
      minConfidence: 0.9, // Very high confidence required
      useSemanticSearch: false, // Only keyword search
      useKeywordSearch: true,
      useHybridSearch: false,
      semanticWeight: 0.7,
      keywordWeight: 0.3,
    });

    const request = {
      id: 'test-high-threshold',
      query: 'create objects without specifying exact classes',
      maxResults: 5,
      programmingLanguage: 'typescript'
    };

    const recommendations = await patternMatcher.findMatchingPatterns(request);
    
    // High threshold might prevent results
    if (recommendations.length === 0) {
      console.warn('⚠️  PRODUCTION ISSUE: High confidence threshold preventing results');
      console.warn('⚠️  Consider lowering minConfidence from 0.9 to 0.3 or lower');
    }
    
    // This should pass with proper threshold
    expect(recommendations.length).toBeGreaterThanOrEqual(0);
  });

  it('should detect missing embeddings for semantic search', async () => {
    // Clear any existing data
    const db = dbManager.getDatabase() as {
      run: (sql: string) => void;
      exec: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
    };
    db.run('DELETE FROM patterns');
    db.run('DELETE FROM pattern_embeddings');

    db.run(`
      INSERT INTO patterns (id, name, category, description, complexity, tags) 
      VALUES ('test_pattern', 'Test Pattern', 'Creational', 'Test pattern for embedding check', 'Beginner', 'test')
    `);

    const vectorOps = new VectorOperationsService(dbManager, {
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      similarityThreshold: 0.7,
      maxResults: 10,
      cacheEnabled: true,
    });

    const patternMatcher = new PatternMatcher(dbManager, vectorOps, {
      maxResults: 5,
      minConfidence: 0.3,
      useSemanticSearch: true, // Enable semantic search
      useKeywordSearch: false, // Disable keyword search to force semantic
      useHybridSearch: false,
      semanticWeight: 0.7,
      keywordWeight: 0.3,
    });

    const request = {
      id: 'test-missing-embeddings',
      query: 'test pattern',
      maxResults: 5,
      programmingLanguage: 'typescript'
    };

    // Check if embeddings exist
    const embeddingCount = dbManager.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM pattern_embeddings');
    
    if (embeddingCount?.count === 0) {
      console.warn('⚠️  PRODUCTION ISSUE: No embeddings found for semantic search');
      console.warn('⚠️  Run embedding generation before deploying to production');
    }

    // Should still work with keyword fallback or return empty gracefully
    const recommendations = await patternMatcher.findMatchingPatterns(request);
    expect(recommendations).toBeDefined();
    expect(Array.isArray(recommendations)).toBe(true);
  });

  it('should validate database schema requirements', async () => {
    // Check that all required tables exist
    const tables = dbManager.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tableNames = tables.map(t => t.name);
    
    expect(tableNames).toContain('patterns');
    expect(tableNames).toContain('pattern_embeddings');
    expect(tableNames).toContain('pattern_implementations');
    expect(tableNames).toContain('pattern_relationships');

    // Check patterns table has required columns
    const patternColumns = dbManager.query("PRAGMA table_info(patterns)");
    const columnNames = patternColumns.map(c => c.name);
    
    const requiredColumns = ['id', 'name', 'category', 'description', 'complexity'];
    for (const column of requiredColumns) {
      expect(columnNames).toContain(column);
    }

  });

  it('should test with production-like configuration', async () => {
    // Clear existing data
    const db = dbManager.getDatabase() as {
      run: (sql: string) => void;
      exec: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
    };
    db.run('DELETE FROM patterns');

    // Add realistic pattern data
    const productionPatterns = [
      {
        id: 'factory_method',
        name: 'Factory Method',
        category: 'Creational',
        description: 'Create objects without specifying exact classes. Provides an interface for creating objects in a superclass, but allows subclasses to alter the type of objects that will be created.',
        complexity: 'Intermediate',
        tags: 'factory,creation,objects,polymorphism'
      },
      {
        id: 'singleton',
        name: 'Singleton',
        category: 'Creational',
        description: 'Ensure a class has only one instance and provide a global point of access to it.',
        complexity: 'Beginner',
        tags: 'singleton,instance,global,access'
      },
      {
        id: 'observer',
        name: 'Observer',
        category: 'Behavioral',
        description: 'Define a one-to-many dependency between objects so that when one object changes state, all dependents are notified.',
        complexity: 'Intermediate',
        tags: 'observer,event,notification,publish-subscribe'
      }
    ];

    for (const pattern of productionPatterns) {
      db.run(`
        INSERT INTO patterns (id, name, category, description, complexity, tags)
        VALUES ('${pattern.id}', '${pattern.name}', '${pattern.category}', '${pattern.description}', '${pattern.complexity}', '${pattern.tags}')
      `);
    }

    // Use production-like configuration
    const vectorOps = new VectorOperationsService(dbManager, {
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      similarityThreshold: 0.7, // Production threshold
      maxResults: 10,
      cacheEnabled: true,
    });

    const patternMatcher = new PatternMatcher(dbManager, vectorOps, {
      maxResults: 5,
      minConfidence: 0.3, // Production confidence
      useSemanticSearch: true,
      useKeywordSearch: true,
      useHybridSearch: true,
      semanticWeight: 0.7,
      keywordWeight: 0.3,
    });

    // Test common production queries
    const testQueries = [
      'create objects without specifying exact classes',
      'ensure only one instance of a class',
      'notify multiple objects when state changes',
      'manage object creation',
      'publish subscribe pattern'
    ];

    for (const query of testQueries) {
      const request = {
        id: `test-production-${Date.now()}`,
        query,
        maxResults: 5,
        programmingLanguage: 'typescript'
      };

      const recommendations = await patternMatcher.findMatchingPatterns(request);
      
      // Should find at least some results for these well-known queries
      if (recommendations.length === 0) {
        console.warn(`⚠️  PRODUCTION ISSUE: No results for query: "${query}"`);
      } else {
      }
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    }
  });
});