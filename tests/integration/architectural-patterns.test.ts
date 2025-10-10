import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager';
import { MigrationManager } from '../../src/services/migrations';
import { getTestDatabaseConfig } from '../helpers/test-db';

describe('Architectural Patterns', () => {
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    // Initialize test database with proper schema
    dbManager = new DatabaseManager(getTestDatabaseConfig(false));
    await dbManager.initialize();

    // Run migrations to ensure schema is up to date
    const migrationManager = new MigrationManager(dbManager, './migrations');
    await migrationManager.initialize();
    await migrationManager.migrate();

    // Create schema - use IF NOT EXISTS to avoid conflicts with other tests
    const schemaStatements = [
      `CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        when_to_use TEXT,
        benefits TEXT,
        drawbacks TEXT,
        use_cases TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS pattern_implementations (
        id TEXT PRIMARY KEY,
        pattern_id TEXT NOT NULL,
        language TEXT NOT NULL,
        approach TEXT NOT NULL,
        code TEXT NOT NULL,
        explanation TEXT NOT NULL,
        dependencies TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_patterns_category ON patterns(category)`,
    ];

    for (const statement of schemaStatements) {
      dbManager.execute(statement);
    }

    // Seed with test architectural patterns
    const architecturalPatterns = [
      {
        id: 'clean-architecture',
        name: 'Clean Architecture',
        category: 'Architectural',
        description:
          'Separates concerns by organizing code into layers with dependencies flowing inward',
      },
      {
        id: 'hexagonal-architecture',
        name: 'Hexagonal Architecture',
        category: 'Architectural',
        description:
          'Isolates core application logic from external concerns using ports and adapters',
      },
      {
        id: 'onion-architecture',
        name: 'Onion Architecture',
        category: 'Architectural',
        description: 'Organizes code in concentric layers with domain at the center',
      },
      {
        id: 'layered-architecture',
        name: 'Layered Architecture',
        category: 'Architectural',
        description: 'Organizes application into horizontal layers with defined responsibilities',
      },
      {
        id: 'domain-driven-design',
        name: 'Domain-Driven Design',
        category: 'Architectural',
        description:
          'Strategic approach to complex software development centered around modeling business domain',
      },
    ];

    for (const pattern of architecturalPatterns) {
      dbManager.execute(
        'INSERT OR IGNORE INTO patterns (id, name, category, description, complexity, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          pattern.id,
          pattern.name,
          pattern.category,
          pattern.description,
          'Medium', // complexity
          new Date().toISOString(),
        ]
      );
    }
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  it('should have Clean Architecture pattern in database', () => {
    const pattern = dbManager.queryOne('SELECT name, category FROM patterns WHERE id = ?', [
      'clean-architecture',
    ]);

    expect(pattern).toEqual({
      name: 'Clean Architecture',
      category: 'Architectural',
    });
  });

  it('should have Hexagonal Architecture pattern in database', () => {
    const pattern = dbManager.queryOne('SELECT name, category FROM patterns WHERE id = ?', [
      'hexagonal-architecture',
    ]);

    expect(pattern).toEqual({
      name: 'Hexagonal Architecture',
      category: 'Architectural',
    });
  });

  it('should have Onion Architecture pattern in database', () => {
    const pattern = dbManager.queryOne('SELECT name, category FROM patterns WHERE id = ?', [
      'onion-architecture',
    ]);

    expect(pattern).toEqual({
      name: 'Onion Architecture',
      category: 'Architectural',
    });
  });

  it('should have Domain-Driven Design pattern in database', () => {
    const pattern = dbManager.queryOne('SELECT name, category FROM patterns WHERE id = ?', [
      'domain-driven-design',
    ]);

    expect(pattern).toEqual({
      name: 'Domain-Driven Design',
      category: 'Architectural',
    });
  });

  it('should include multiple architectural patterns', () => {
    const architecturalPatterns = dbManager.query(
      'SELECT id, name, category FROM patterns WHERE category = ?',
      ['Architectural']
    );

    expect(architecturalPatterns.length).toBeGreaterThan(3);
    expect(architecturalPatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Clean Architecture', category: 'Architectural' }),
        expect.objectContaining({ name: 'Hexagonal Architecture', category: 'Architectural' }),
        expect.objectContaining({ name: 'Onion Architecture', category: 'Architectural' }),
        expect.objectContaining({ name: 'Layered Architecture', category: 'Architectural' }),
      ])
    );
  });
});
