/**
 * Integration Tests for Abstract Server Pattern and Code Examples Feature
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  DatabaseManager,
  initializeDatabaseManager,
  closeDatabaseManager,
} from '../../src/services/database-manager';
import { getPatternStorageService } from '../../src/services/pattern-storage';
import { getTestDatabaseConfig } from '../helpers/test-db';
import Database from 'better-sqlite3';

describe('Abstract Server Pattern Integration Tests', () => {
  let db: DatabaseManager;
  let sqliteDb: Database.Database;

  beforeAll(async () => {
    db = await initializeDatabaseManager(getTestDatabaseConfig(false));
    sqliteDb = new Database(getTestDatabaseConfig(false).filename);
  });

  afterAll(async () => {
    await closeDatabaseManager();
    sqliteDb.close();
  });

  describe('Pattern Existence', () => {
    it('should have Abstract Server pattern in database', () => {
      const pattern = sqliteDb.prepare('SELECT * FROM patterns WHERE id = ?').get('abstract-server') as any;

      expect(pattern).toBeDefined();
      expect(pattern.name).toBe('Abstract Server');
      expect(pattern.category).toBe('Structural');
    });

    it('should have at least 574 total patterns including Abstract Server, new patterns, and SQL patterns', () => {
      const result = sqliteDb.prepare('SELECT COUNT(*) as count FROM patterns').get() as { count: number };

      expect(result?.count).toBeGreaterThanOrEqual(574);
    });
  });

  describe('Code Examples Feature', () => {
    it('should have examples column in patterns table', () => {
      const tableInfo = sqliteDb.prepare('PRAGMA table_info(patterns)').all();
      const examplesColumn = tableInfo.find((col: any) => col.name === 'examples') as any;

      expect(examplesColumn).toBeDefined();
      expect(examplesColumn.type).toBe('TEXT');
    });

    it('should have code examples for Abstract Server pattern', () => {
      const pattern = sqliteDb.prepare('SELECT examples FROM patterns WHERE id = ?').get('abstract-server') as any;

      expect(pattern).toBeDefined();
      expect(pattern.examples).toBeDefined();
      expect(pattern.examples).not.toBeNull();
      expect(typeof pattern.examples).toBe('string');
      expect(pattern.examples.length).toBeGreaterThan(0);
    });

    it('should have valid JSON in examples field', () => {
      const pattern = sqliteDb.prepare('SELECT examples FROM patterns WHERE id = ?').get('abstract-server') as any;

      expect(() => {
        JSON.parse(pattern.examples);
      }).not.toThrow();
    });

    it('should have examples in multiple languages', () => {
      const pattern = sqliteDb.prepare('SELECT examples FROM patterns WHERE id = ?').get('abstract-server') as any;

      const examples = JSON.parse(pattern.examples);

      expect(examples).toHaveProperty('typescript');
      expect(examples).toHaveProperty('clojure');
      expect(examples).toHaveProperty('python');
      expect(examples).toHaveProperty('java');
    });

    it('should have proper structure for each example', () => {
      const pattern = sqliteDb.prepare('SELECT examples FROM patterns WHERE id = ?').get('abstract-server') as any;

      const examples = JSON.parse(pattern.examples);
      const tsExample = examples.typescript;

      expect(tsExample).toHaveProperty('description');
      expect(tsExample).toHaveProperty('code');
      expect(typeof tsExample.description).toBe('string');
      expect(typeof tsExample.code).toBe('string');
      expect(tsExample.code.length).toBeGreaterThan(100);
    });
  });

  describe('Pattern Content Validation', () => {
    it('should have correct pattern properties', () => {
      const pattern = sqliteDb.prepare('SELECT * FROM patterns WHERE id = ?').get('abstract-server') as any;

      expect(pattern.description).toContain('abstraction layer');
      expect(pattern.description).toContain('Dependency Inversion Principle');
      expect(pattern.when_to_use).toContain('decouple');
      expect(pattern.benefits).toContain('Loose coupling');
      expect(pattern.use_cases).toContain('Database access');
      expect(pattern.complexity).toBe('Medium');
      expect(pattern.tags).toContain('dependency-inversion');
    });
  });

  describe('Pattern Storage Service Integration', () => {
    it('should retrieve Abstract Server pattern via storage service', async () => {
      const storage = getPatternStorageService();
      const pattern = await storage.getPattern('abstract-server');

      expect(pattern).toBeDefined();
      expect(pattern?.id).toBe('abstract-server');
      expect(pattern?.name).toBe('Abstract Server');
    });

    it('should include Abstract Server in all patterns list', async () => {
      const storage = getPatternStorageService();
      const patterns = await storage.getAllPatterns();

      const abstractServer = patterns.find(p => p.id === 'abstract-server');
      expect(abstractServer).toBeDefined();
      expect(patterns.length).toBeGreaterThanOrEqual(574);
    });
  });

  describe('Examples in Other Patterns', () => {
    it('should allow patterns without examples (optional feature)', () => {
      const patterns = sqliteDb.prepare('SELECT id, name, examples FROM patterns WHERE examples IS NULL LIMIT 5').all();

      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach((pattern: any) => {
        expect(pattern.examples).toBeNull();
      });
    });

    it('should maintain backward compatibility for patterns without examples', () => {
      const patternWithoutExamples = sqliteDb.prepare('SELECT * FROM patterns WHERE examples IS NULL LIMIT 1').get() as any;

      expect(patternWithoutExamples).toBeDefined();
      expect(patternWithoutExamples.id).toBeDefined();
      expect(patternWithoutExamples.name).toBeDefined();
      expect(patternWithoutExamples.description).toBeDefined();
    });
  });
});
