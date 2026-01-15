/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseManager, initializeDatabaseManager } from '../../src/services/database-manager';
import { parseTags } from '../../src/utils/parse-tags';
import { getTestDatabaseConfig } from '../helpers/test-db';

describe('Pattern Searchability Tests', () => {
  let db: DatabaseManager;

  beforeAll(async () => {
    db = await initializeDatabaseManager(getTestDatabaseConfig(true));
  });

  afterAll(async () => {
    await db.close();
  });

  it('should have patterns loaded in database', () => {
    const patterns = db.query<{ count: number }>('SELECT COUNT(*) as count FROM patterns');
    expect(patterns[0]?.count).toBeGreaterThan(0);
  });

  it('should have Data Management patterns searchable', () => {
    const dataPatterns = db.query<{ name: string }>('SELECT name FROM patterns WHERE category = ?', [
      'Data Management',
    ]);
    expect(dataPatterns.length).toBeGreaterThan(0);
  });

  it('should have Behavioral patterns searchable', () => {
    const behavioralPatterns = db.query<{ name: string }>('SELECT name FROM patterns WHERE category = ?', [
      'Behavioral',
    ]);
    expect(behavioralPatterns.length).toBeGreaterThan(0);
  });

  it('should have Integration patterns searchable', () => {
    const integrationPatterns = db.query<{ name: string }>('SELECT name FROM patterns WHERE category = ?', [
      'Integration',
    ]);
    expect(integrationPatterns.length).toBeGreaterThan(0);
  });

  it('should have architectural patterns searchable', () => {
    const archPatterns = db.query<{ name: string }>('SELECT name FROM patterns WHERE category = ?', [
      'Architectural',
    ]);
    expect(archPatterns.length).toBeGreaterThan(0);
  });

  it('should have cloud-native patterns searchable', () => {
    const cloudPatterns = db.query<{ name: string }>('SELECT name FROM patterns WHERE category = ?', [
      'Cloud-Native',
    ]);
    expect(cloudPatterns.length).toBeGreaterThan(0);
  });

  it('should have AI/ML patterns searchable', () => {
    const aiPatterns = db.query<{ name: string }>('SELECT name FROM patterns WHERE category = ?', ['AI/ML']);
    expect(aiPatterns.length).toBeGreaterThan(0);
  });

  it('should support keyword search', () => {
    const singletonResults = db.query<{ name: string }>('SELECT name FROM patterns WHERE name LIKE ?', [
      '%Singleton%',
    ]);
    expect(singletonResults.length).toBeGreaterThan(0);
    expect(singletonResults[0].name.toLowerCase()).toContain('singleton');
  });

  it('should support category filtering', () => {
    const categories = [
      'Behavioral',
      'Architectural',
      'Cloud-Native',
      'AI/ML',
      'Functional',
      'Reactive',
      'Anti-Pattern',
      'Integration',
      'Data Management',
      'Performance',
      'Security',
      'Testing',
    ];
    for (const category of categories) {
      const patterns = db.query<{ name: string }>('SELECT name FROM patterns WHERE category = ?', [category]);
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach((pattern) => {
        expect(pattern.name).toBeDefined();
        expect(typeof pattern.name).toBe('string');
      });
    }
  });

  it('should have pattern metadata', () => {
    const patterns = db.query<{ name: string; description: string; complexity: string }>('SELECT name, description, complexity FROM patterns LIMIT 5');
    patterns.forEach((pattern) => {
      expect(pattern.name).toBeDefined();
      expect(pattern.description).toBeDefined();
      expect(pattern.complexity).toBeDefined();
      expect(pattern.description.length).toBeGreaterThan(10);
      expect(['Low', 'Medium', 'High', 'Very High']).toContain(pattern.complexity);
    });
  });

  it('should have patterns loaded in database', () => {
    const count = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM patterns');
    expect(count?.count).toBeGreaterThanOrEqual(30); // We have 39 patterns loaded
  });

  it('should have patterns with tags', () => {
    const patternsWithTags = db.query<{ name: string; tags: string }>(
      'SELECT name, tags FROM patterns WHERE tags IS NOT NULL AND tags != "" LIMIT 5'
    );
    expect(patternsWithTags.length).toBeGreaterThan(0);
    patternsWithTags.forEach((pattern) => {
      expect(pattern.tags).toBeDefined();
      // Tags should be parseable JSON
      const tags = parseTags(pattern.tags);
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);
    });
  });

  it('should have Kotlin patterns searchable', () => {
    const kotlinPatterns = [
      'Coroutines Pattern',
      'Structured Concurrency Pattern',
      'Channels Pattern',
      'Flows Pattern',
      'Sequences Pattern',
      'Data Classes Pattern',
      'Sealed Classes Pattern',
      'Companion Objects Pattern',
      'Extension Functions Pattern',
      'Operator Overloading Pattern',
      'Inline Functions Pattern',
      'Expressions vs Statements Pattern',
      'Pure Functions Pattern',
      'Closures Pattern',
    ];

    for (const patternName of kotlinPatterns) {
      const pattern = db.queryOne<{ id: string; name: string; category: string }>('SELECT id, name, category FROM patterns WHERE name = ?', [
        patternName,
      ]);
      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe(patternName);
      expect(pattern?.category).toBeDefined();
    }
  });

  it('should have Kotlin pattern relationships', () => {
    const kotlinRelationships = db.query<{ source_pattern_id: string; target_pattern_id: string; type: string; description: string }>(`
      SELECT pr.source_pattern_id, pr.target_pattern_id, pr.type, pr.description
      FROM pattern_relationships pr
      WHERE pr.target_pattern_id IN ('flows', 'channels', 'companion-objects', 'extension-functions', 'sealed-classes')
    `);

    expect(kotlinRelationships.length).toBeGreaterThan(0);

    // Check specific relationships
    const observerFlows = kotlinRelationships.find(
      (r) => r.source_pattern_id === 'observer' && r.target_pattern_id === 'flows'
    );
    expect(observerFlows).toBeDefined();
    expect(observerFlows?.type).toBe('enhances');
    expect(observerFlows?.description).toContain('Flows provide a more composable');

    const producerConsumerChannels = kotlinRelationships.find(
      (r) => r.source_pattern_id === 'producer-consumer' && r.target_pattern_id === 'channels'
    );
    expect(producerConsumerChannels).toBeDefined();
    expect(producerConsumerChannels?.type).toBe('enhances');
  });

  it('should support Kotlin-specific keyword search', () => {
    // Test searching for Kotlin-specific terms
    const kotlinTerms = [
      'coroutines',
      'flows',
      'sealed classes',
      'data classes',
      'extension functions',
    ];

    for (const term of kotlinTerms) {
      const patterns = db.query<{ name: string }>(
        'SELECT name FROM patterns WHERE name LIKE ? OR description LIKE ?',
        [`%${term}%`, `%${term}%`]
      );
      expect(patterns.length).toBeGreaterThan(0);
    }
  });
});
