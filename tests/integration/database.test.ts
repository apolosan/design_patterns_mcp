import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager';
import { MigrationManager } from '../../src/services/migrations';
import path from 'path';

describe('Database Operations', () => {
  let dbManager: DatabaseManager;
  let migrationManager: MigrationManager;

  beforeAll(async () => {
    // Create test database in memory
    dbManager = new DatabaseManager({
      filename: ':memory:',
      options: { readonly: false },
    });

    await dbManager.initialize();

    migrationManager = new MigrationManager(dbManager);
    await migrationManager.initialize();
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  it('should create database tables', () => {
    // Create patterns table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    dbManager.execute(createTableSQL);

    // Verify table exists
    const tables = dbManager.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='patterns'
    `);

    expect(tables.length).toBe(1);
    expect(tables[0].name).toBe('patterns');
  });

  it('should insert pattern data', () => {
    // Make sure patterns table exists first
    dbManager.execute(`
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        complexity TEXT NOT NULL,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert test pattern
    const insertSQL = `
      INSERT OR REPLACE INTO patterns (id, name, category, description, complexity, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const result = dbManager.execute(insertSQL, [
      'test_pattern_1',
      'Test Pattern',
      'Creational',
      'A test pattern for database integration testing',
      'Low',
      'test,pattern,database',
    ]);

    expect(result).toBeDefined();

    // Verify pattern was inserted
    const patterns = dbManager.query('SELECT * FROM patterns WHERE id = ?', ['test_pattern_1']);
    expect(patterns.length).toBe(1);
    expect(patterns[0].name).toBe('Test Pattern');
  });

  it('should query patterns by category', () => {
    // Make sure patterns table exists first
    dbManager.execute(`
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        complexity TEXT NOT NULL,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert multiple test patterns
    const testPatterns = [
      ['pattern_1', 'Singleton', 'Creational', 'Singleton pattern', 'Low'],
      ['pattern_2', 'Factory', 'Creational', 'Factory pattern', 'Medium'],
      ['pattern_3', 'Observer', 'Behavioral', 'Observer pattern', 'Medium'],
    ];

    testPatterns.forEach(([id, name, category, description, complexity]) => {
      dbManager.execute(
        'INSERT OR REPLACE INTO patterns (id, name, category, description, complexity) VALUES (?, ?, ?, ?, ?)',
        [id, name, category, description, complexity]
      );
    });

    const category = 'Creational';
    const patterns = dbManager.query('SELECT * FROM patterns WHERE category = ?', [category]);

    expect(patterns.length).toBeGreaterThan(0);
    patterns.forEach(pattern => {
      expect(pattern.category).toBe(category);
    });
  });

  it('should handle database transactions', async () => {
    // Make sure patterns table exists first
    dbManager.execute(`
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        complexity TEXT NOT NULL,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Test transaction with multiple operations
    let transactionSuccessful = false;

    try {
      await dbManager.transaction(() => {
        // Insert multiple patterns in a transaction
        dbManager.execute(
          'INSERT OR REPLACE INTO patterns (id, name, category, description, complexity) VALUES (?, ?, ?, ?, ?)',
          ['tx_pattern_1', 'Transaction Pattern 1', 'Test', 'Test transaction', 'Low']
        );

        dbManager.execute(
          'INSERT OR REPLACE INTO patterns (id, name, category, description, complexity) VALUES (?, ?, ?, ?, ?)',
          ['tx_pattern_2', 'Transaction Pattern 2', 'Test', 'Test transaction', 'Low']
        );
      });

      transactionSuccessful = true;
    } catch (error) {
      transactionSuccessful = false;
    }

    expect(transactionSuccessful).toBe(true);

    // Verify both patterns were inserted
    const patterns = dbManager.query('SELECT * FROM patterns WHERE category = ?', ['Test']);
    expect(patterns.length).toBeGreaterThanOrEqual(2);
  });

  it('should perform pattern search queries', () => {
    // Make sure patterns table exists first
    dbManager.execute(`
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        complexity TEXT NOT NULL,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert a pattern that matches the search term
    dbManager.execute(
      'INSERT OR REPLACE INTO patterns (id, name, category, description, complexity) VALUES (?, ?, ?, ?, ?)',
      ['singleton_pattern', 'Singleton', 'Creational', 'Singleton pattern description', 'Low']
    );

    const searchTerm = 'singleton';
    const results = dbManager.query(
      `SELECT * FROM patterns 
       WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ?`,
      [`%${searchTerm}%`, `%${searchTerm}%`]
    );

    expect(results.length).toBeGreaterThan(0);
    expect((results[0] as { name: string }).name.toLowerCase()).toContain(searchTerm);
  });
});
