/**
 * Unit Tests for RelationshipRepository
 * Tests the SQLite implementation of relationship data access operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteRelationshipRepository } from '../../src/repositories/relationship-repository.js';
import { DatabaseManager } from '../../src/services/database-manager.js';
import type {
  CreateRelationshipInput,
  UpdateRelationshipInput,
} from '../../src/models/relationship.js';

describe('SqliteRelationshipRepository', () => {
  let dbManager: DatabaseManager;
  let repository: SqliteRelationshipRepository;

  beforeEach(async () => {
    // Create in-memory database for testing
    dbManager = new DatabaseManager({
      filename: ':memory:',
      options: { readonly: false },
    });
    await dbManager.initialize();

    // Initialize schema
    dbManager.execute('DROP TABLE IF EXISTS pattern_relationships');
    dbManager.execute('DROP TABLE IF EXISTS patterns');

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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // Insert test patterns
    dbManager.execute(`
      INSERT INTO patterns (id, name, category, description, complexity)
      VALUES
        ('adapter', 'Adapter', 'Structural', 'Allows incompatible interfaces to work together', 'Low'),
        ('facade', 'Facade', 'Structural', 'Provides a simplified interface to a complex subsystem', 'Low'),
        ('singleton', 'Singleton', 'Creational', 'Ensures only one instance exists', 'Low')
    `);

    repository = new SqliteRelationshipRepository(dbManager);
  });

  afterEach(() => {
    // Clean up
    dbManager.close();
  });

  describe('save', () => {
    it('should create a new relationship', async () => {
      const input: CreateRelationshipInput = {
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Both are structural patterns that deal with interfaces',
      };

      const relationship = await repository.save(input);

      expect(relationship).toBeDefined();
      expect(relationship.id).toBeDefined();
      expect(relationship.sourcePatternId).toBe('adapter');
      expect(relationship.targetPatternId).toBe('facade');
      expect(relationship.type).toBe('related');
      expect(relationship.strength).toBe(1.0);
      expect(relationship.description).toBe(
        'Both are structural patterns that deal with interfaces'
      );
      expect(relationship.createdAt).toBeInstanceOf(Date);
    });

    it('should use custom strength when provided', async () => {
      const input: CreateRelationshipInput = {
        sourcePatternId: 'adapter',
        targetPatternId: 'singleton',
        type: 'uses',
        strength: 0.8,
        description: 'Adapter can use Singleton for instance management',
      };

      const relationship = await repository.save(input);
      expect(relationship.strength).toBe(0.8);
    });

    it('should throw error when relationship already exists', async () => {
      const input: CreateRelationshipInput = {
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Test relationship',
      };

      await repository.save(input);

      await expect(repository.save(input)).rejects.toThrow(
        'Relationship between adapter and facade already exists'
      );
    });

    it('should throw error when source pattern does not exist', async () => {
      const input: CreateRelationshipInput = {
        sourcePatternId: 'nonexistent',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Test relationship',
      };

      await expect(repository.save(input)).rejects.toThrow();
    });
  });

  describe('findBySourceId', () => {
    it('should return relationships for source pattern', async () => {
      // Create test relationships
      await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Both structural',
      });

      await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'singleton',
        type: 'uses',
        description: 'Adapter uses Singleton',
      });

      const relationships = await repository.findBySourceId('adapter');

      expect(relationships).toHaveLength(2);
      expect(relationships[0].sourcePatternId).toBe('adapter');
      expect(relationships[1].sourcePatternId).toBe('adapter');
    });

    it('should return empty array when no relationships exist', async () => {
      const relationships = await repository.findBySourceId('nonexistent');
      expect(relationships).toEqual([]);
    });
  });

  describe('findByTargetId', () => {
    it('should return relationships for target pattern', async () => {
      await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Both structural',
      });

      const relationships = await repository.findByTargetId('facade');

      expect(relationships).toHaveLength(1);
      expect(relationships[0].targetPatternId).toBe('facade');
    });
  });

  describe('findByType', () => {
    it('should return relationships of specific type', async () => {
      await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Both structural',
      });

      await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'singleton',
        type: 'uses',
        description: 'Adapter uses Singleton',
      });

      const relationships = await repository.findByType('related');

      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe('related');
    });
  });

  describe('findByPatternId', () => {
    it('should return all relationships for a pattern', async () => {
      await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Both structural',
      });

      await repository.save({
        sourcePatternId: 'singleton',
        targetPatternId: 'adapter',
        type: 'uses',
        description: 'Singleton used by Adapter',
      });

      const relationships = await repository.findByPatternId('adapter');

      expect(relationships).toHaveLength(2);
      const sources = relationships.map(r => r.sourcePatternId);
      const targets = relationships.map(r => r.targetPatternId);
      expect(sources).toContain('adapter');
      expect(targets).toContain('adapter');
    });
  });

  describe('update', () => {
    it('should update relationship properties', async () => {
      const created = await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        strength: 0.5,
        description: 'Original description',
      });

      const updateInput: UpdateRelationshipInput = {
        id: created.id,
        type: 'extends',
        strength: 0.8,
        description: 'Updated description',
      };

      const updated = await repository.update(created.id, updateInput);

      expect(updated).toBeDefined();
      expect(updated!.type).toBe('extends');
      expect(updated!.strength).toBe(0.8);
      expect(updated!.description).toBe('Updated description');
    });

    it('should return null when relationship does not exist', async () => {
      const updateInput: UpdateRelationshipInput = {
        id: 'nonexistent',
        type: 'related',
      };

      const result = await repository.update('nonexistent', updateInput);
      expect(result).toBeNull();
    });

    it('should handle partial updates', async () => {
      const created = await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        strength: 0.5,
        description: 'Original description',
      });

      const updateInput: UpdateRelationshipInput = {
        id: created.id,
        strength: 0.9, // Only update strength
      };

      const updated = await repository.update(created.id, updateInput);

      expect(updated!.type).toBe('related'); // Unchanged
      expect(updated!.strength).toBe(0.9); // Updated
      expect(updated!.description).toBe('Original description'); // Unchanged
    });
  });

  describe('delete', () => {
    it('should delete relationship by source and target ids', async () => {
      // First create a relationship
      const created = await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Test relationship for deletion',
      });

      // Verify it exists
      const existsBefore = await repository.exists('adapter', 'facade');
      expect(existsBefore).toBe(true);

      const deleted = await repository.delete('adapter', 'facade');
      expect(deleted).toBe(true);

      // Verify deletion
      const relationships = await repository.findByPatternId('adapter');
      expect(relationships).toHaveLength(0);
    });

    it('should return false when relationship does not exist', async () => {
      const deleted = await repository.delete('nonexistent', 'facade');
      expect(deleted).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when relationship exists', async () => {
      await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Test relationship',
      });

      const exists = await repository.exists('adapter', 'facade');
      expect(exists).toBe(true);
    });

    it('should return false when relationship does not exist', async () => {
      const exists = await repository.exists('adapter', 'facade');
      expect(exists).toBe(false);
    });
  });

  describe('findById', () => {
    it('should return relationship by id', async () => {
      const created = await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Test relationship',
      });

      const found = await repository.findById(created.id);
      expect(found!.id).toBe(created.id);
      expect(found!.sourcePatternId).toBe(created.sourcePatternId);
      expect(found!.targetPatternId).toBe(created.targetPatternId);
      expect(found!.type).toBe(created.type);
      expect(found!.description).toBe(created.description);
    });

    it('should return null when relationship does not exist', async () => {
      const found = await repository.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('count', () => {
    it('should count all relationships', async () => {
      await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Test 1',
      });

      await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'singleton',
        type: 'uses',
        description: 'Test 2',
      });

      const count = await repository.count();
      expect(count).toBe(2);
    });

    it('should count relationships with filters', async () => {
      await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'facade',
        type: 'related',
        description: 'Test 1',
      });

      await repository.save({
        sourcePatternId: 'adapter',
        targetPatternId: 'singleton',
        type: 'uses',
        description: 'Test 2',
      });

      const count = await repository.count({ type: 'related' });
      expect(count).toBe(1);
    });
  });
});
