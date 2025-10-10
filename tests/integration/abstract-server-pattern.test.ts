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

describe('Abstract Server Pattern Integration Tests', () => {
  let db: DatabaseManager;

  beforeAll(async () => {
    db = await initializeDatabaseManager(getTestDatabaseConfig(false));
  });

  afterAll(async () => {
    await closeDatabaseManager();
  });

  describe('Pattern Existence', () => {
    it('should have Abstract Server pattern in database', () => {
      const pattern = db.queryOne('SELECT * FROM patterns WHERE id = ?', ['abstract-server']);

      expect(pattern).toBeDefined();
      expect(pattern.name).toBe('Abstract Server');
      expect(pattern.category).toBe('Structural');
    });

    it('should have at least 574 total patterns including Abstract Server, new patterns, and SQL patterns', () => {
      const result = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM patterns');

      expect(result?.count).toBeGreaterThanOrEqual(574);
    });
  });

  describe('Code Examples Feature', () => {
    it('should have examples column in patterns table', () => {
      const tableInfo = db.query('PRAGMA table_info(patterns)');
      const examplesColumn = tableInfo.find((col: any) => col.name === 'examples');

      expect(examplesColumn).toBeDefined();
      expect(examplesColumn.type).toBe('TEXT');
    });

    it('should have code examples for Abstract Server pattern', () => {
      const pattern = db.queryOne('SELECT examples FROM patterns WHERE id = ?', [
        'abstract-server',
      ]);

      expect(pattern).toBeDefined();
      expect(pattern.examples).toBeDefined();
      expect(pattern.examples).not.toBeNull();
      expect(typeof pattern.examples).toBe('string');
      expect(pattern.examples.length).toBeGreaterThan(0);
    });

    it('should have valid JSON in examples field', () => {
      const pattern = db.queryOne('SELECT examples FROM patterns WHERE id = ?', [
        'abstract-server',
      ]);

      expect(() => {
        JSON.parse(pattern.examples);
      }).not.toThrow();
    });

    it('should have examples in multiple languages', () => {
      const pattern = db.queryOne('SELECT examples FROM patterns WHERE id = ?', [
        'abstract-server',
      ]);

      const examples = JSON.parse(pattern.examples);

      expect(examples).toHaveProperty('typescript');
      expect(examples).toHaveProperty('clojure');
      expect(examples).toHaveProperty('python');
      expect(examples).toHaveProperty('java');
    });

    it('should have proper structure for each example', () => {
      const pattern = db.queryOne('SELECT examples FROM patterns WHERE id = ?', [
        'abstract-server',
      ]);

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
      const pattern = db.queryOne('SELECT * FROM patterns WHERE id = ?', ['abstract-server']);

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
      const patterns = db.query(
        'SELECT id, name, examples FROM patterns WHERE examples IS NULL LIMIT 5'
      );

      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach((pattern: any) => {
        expect(pattern.examples).toBeNull();
      });
    });

    it('should maintain backward compatibility for patterns without examples', () => {
      const patternWithoutExamples = db.queryOne(
        'SELECT * FROM patterns WHERE examples IS NULL LIMIT 1'
      );

      expect(patternWithoutExamples).toBeDefined();
      expect(patternWithoutExamples.id).toBeDefined();
      expect(patternWithoutExamples.name).toBeDefined();
      expect(patternWithoutExamples.description).toBeDefined();
    });
  });
});
