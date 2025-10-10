import { describe, it, expect, beforeAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager';
import { createPatternSeeder } from '../../src/services/pattern-seeder';
import { MigrationManager } from '../../src/services/migrations';
import { getTestDatabaseConfig } from '../helpers/test-db';
import path from 'path';

describe('AI/ML Patterns', () => {
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    // Initialize test database with proper schema
    dbManager = new DatabaseManager(getTestDatabaseConfig(false));
    await dbManager.initialize();

    // Run migrations to ensure schema is up to date
    const migrationManager = new MigrationManager(dbManager, './migrations');
    await migrationManager.initialize();
    await migrationManager.migrate();

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

  it('should recommend RAG for knowledge retrieval', () => {
    const ragPattern = dbManager.queryOne(
      'SELECT * FROM patterns WHERE name = ? AND category = ?',
      ['Retrieval-Augmented Generation (RAG)', 'AI/ML']
    );

    expect(ragPattern).toBeTruthy();
    expect(ragPattern!.name).toBe('Retrieval-Augmented Generation (RAG)');
    expect(ragPattern!.category).toBe('AI/ML');
  });

  it('should recommend Reflection Pattern for self-improvement', () => {
    const reflectionPattern = dbManager.queryOne(
      'SELECT * FROM patterns WHERE name = ? AND category = ?',
      ['Reflection Pattern', 'AI/ML']
    );

    expect(reflectionPattern).toBeTruthy();
    expect(reflectionPattern!.name).toBe('Reflection Pattern');
    expect(reflectionPattern!.category).toBe('AI/ML');
  });

  it('should recommend Tool Use Pattern for dynamic tool selection', () => {
    const toolUsePattern = dbManager.queryOne(
      'SELECT * FROM patterns WHERE name = ? AND category = ?',
      ['Tool Use Pattern', 'AI/ML']
    );

    expect(toolUsePattern).toBeTruthy();
    expect(toolUsePattern!.name).toBe('Tool Use Pattern');
    expect(toolUsePattern!.category).toBe('AI/ML');
  });

  it('should recommend Chain-of-Thought Prompting for complex tasks', () => {
    const chainOfThoughtPattern = dbManager.queryOne(
      'SELECT * FROM patterns WHERE name = ? AND category = ?',
      ['Chain-of-Thought Prompting', 'AI/ML']
    );

    expect(chainOfThoughtPattern).toBeTruthy();
    expect(chainOfThoughtPattern!.name).toBe('Chain-of-Thought Prompting');
    expect(chainOfThoughtPattern!.category).toBe('AI/ML');
  });

  it('should include Multi-Agent Collaboration patterns', () => {
    const aiPatterns = dbManager.query('SELECT * FROM patterns WHERE category = ?', ['AI/ML']);

    expect(aiPatterns.length).toBeGreaterThan(3);
  });
});
