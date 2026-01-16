/**
 * Integration tests for Blended RAG Architecture
 * Testing complete search pipeline with dense + sparse + graph augmentation
 * Based on arXiv 2404.07220 (Blended RAG) and 2409.17383 (VectorSearch)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VectorOperationsService } from '../../src/services/vector-operations.js';
import { CacheService } from '../../src/services/cache.js';
import { HybridSearchEngine } from '../../src/services/hybrid-search-engine.js';
import { SearchMediator } from '../../src/handlers/search-mediator.js';
import { createTempDatabasePath, cleanupTempDatabase } from '../helpers/test-db.js';
import type { PatternRequest } from '../../src/types/search-types.js';
import { DatabaseManager } from '../../src/services/database-manager.js';

describe('Blended RAG Integration', () => {
  let db: DatabaseManager;
  let vectorOps: VectorOperationsService;
  let cache: CacheService;
  let hybridEngine: HybridSearchEngine;
  let searchMediator: SearchMediator;
  let tempDbPath: string;

  beforeEach(async () => {
    // Setup test database
    tempDbPath = createTempDatabasePath('blended-rag-test');
    db = new DatabaseManager({ filename: tempDbPath, options: { readonly: false } });
    await db.initialize();
    
    // Create patterns table
    await db.execDDL(`
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
        code_examples TEXT,
        relationships TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create pattern_relationships table
    await db.execDDL(`
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

    // Create pattern_implementations table
    await db.execDDL(`
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

    // Create sparse_terms table for hybrid search engine
    await db.execDDL(`
      CREATE TABLE sparse_terms (
        pattern_id TEXT NOT NULL,
        term TEXT NOT NULL,
        term_frequency INTEGER NOT NULL,
        PRIMARY KEY (pattern_id, term)
      )
    `);
    
    // Mock vector operations service
    vectorOps = {
      searchSimilar: () => [
        { 
          patternId: 'factory', 
          score: 0.85, 
          distance: 0.15, 
          rank: 1,
          pattern: { id: 'factory', name: 'Factory Pattern', category: 'Creational', description: 'Creates objects without specifying exact class', tags: [] }
        },
        { 
          patternId: 'builder', 
          score: 0.75, 
          distance: 0.25, 
          rank: 2,
          pattern: { id: 'builder', name: 'Builder Pattern', category: 'Creational', description: 'Constructs complex objects step by step', tags: [] }
        },
        { 
          patternId: 'singleton', 
          score: 0.7, 
          distance: 0.3, 
          rank: 3,
          pattern: { id: 'singleton', name: 'Singleton Pattern', category: 'Creational', description: 'Ensures a class has only one instance', tags: [] }
        },
        { 
          patternId: 'abstract-factory', 
          score: 0.65, 
          distance: 0.35, 
          rank: 4,
          pattern: { id: 'abstract-factory', name: 'Abstract Factory Pattern', category: 'Creational', description: 'Provides an interface for creating families of related objects', tags: [] }
        },
        { 
          patternId: 'factory-method', 
          score: 0.6, 
          distance: 0.4, 
          rank: 5,
          pattern: { id: 'factory-method', name: 'Factory Method Pattern', category: 'Creational', description: 'Defines an interface for creating an object, but lets subclasses decide which class to instantiate', tags: [] }
        },
        { 
          patternId: 'prototype', 
          score: 0.55, 
          distance: 0.45, 
          rank: 6,
          pattern: { id: 'prototype', name: 'Prototype Pattern', category: 'Creational', description: 'Creates new objects by copying an existing object', tags: [] }
        },
      ],
      findSimilarPatterns: () => [
        { patternId: 'abstract-factory', score: 0.8 },
        { patternId: 'factory-method', score: 0.75 },
      ],
      // Add other required methods
      storeEmbedding: async () => {},
      createVectorIndex: () => {},
      hasVectorIndex: () => false,
    } as unknown as VectorOperationsService;

    cache = new CacheService();
    
    // Create hybrid search engine
    hybridEngine = new HybridSearchEngine(vectorOps, db, cache, {
      denseWeight: 0.6,
      sparseWeight: 0.4,
      maxResults: 10,
      similarityThreshold: 0.3,
    });

    // Create search mediator
    searchMediator = new SearchMediator(db, vectorOps, cache, {
      maxResults: 5,
      minConfidence: 0.05,
      useSemanticSearch: true,
      useKeywordSearch: true,
      useHybridSearch: true,
      useFuzzyRefinement: true,
      cacheResultsTTL: 30000,
    });
  });

  afterEach(async () => {
    await db.close();
    cleanupTempDatabase(tempDbPath);
  });

  describe('HybridSearchEngine', () => {
    it('should perform blended search with dense + sparse indexes', async () => {
      // Insert test patterns
      await db.execute(
        `INSERT INTO patterns (id, name, category, description, complexity, tags, code_examples, relationships, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'factory',
          'Factory Pattern',
          'Creational',
          'Creates objects without specifying exact class',
          'Low',
          JSON.stringify(['creational', 'design', 'patterns']),
          JSON.stringify(['example1', 'example2']),
          JSON.stringify([]),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      await db.execute(
        `INSERT INTO patterns (id, name, category, description, complexity, tags, code_examples, relationships, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'builder',
          'Builder Pattern',
          'Creational',
          'Constructs complex objects step by step',
          'Medium',
          JSON.stringify(['creational', 'design', 'patterns']),
          JSON.stringify(['example1', 'example2']),
          JSON.stringify([]),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      const queryEmbedding = new Array(384).fill(0.1);
      const results = await hybridEngine.search('factory pattern', queryEmbedding);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Verify result structure
      results.forEach(result => {
        expect(result).toHaveProperty('patternId');
        expect(result).toHaveProperty('finalScore');
        expect(result.finalScore).toBeGreaterThanOrEqual(0);
        expect(result.finalScore).toBeLessThanOrEqual(1);
        expect(result).toHaveProperty('matchTypes');
        expect(result).toHaveProperty('reasons');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('queryAnalysis');
        expect(result.metadata).toHaveProperty('weights');
      });
    });

    it('should analyze query types correctly', () => {
      const analysis1 = hybridEngine.analyzeQuery('factory pattern');
      expect(analysis1.queryType).toBe('specific');
      expect(['sparse', 'hybrid']).toContain(analysis1.recommendedStrategy);

      const analysis2 = hybridEngine.analyzeQuery(
        'how to implement design patterns for better software architecture'
      );
      expect(['exploratory', 'balanced']).toContain(analysis2.queryType);
      expect(['dense', 'hybrid']).toContain(analysis2.recommendedStrategy);

      const analysis3 = hybridEngine.analyzeQuery('design patterns for web apps');
      expect(['balanced', 'specific']).toContain(analysis3.queryType);
      expect(['hybrid', 'sparse']).toContain(analysis3.recommendedStrategy);
    });

    it('should apply semantic compression for diversity', async () => {
      // Insert multiple similar patterns
      const patterns = [
        ['factory', 'Factory Pattern', 'Creational', 'Creates objects'],
        ['abstract-factory', 'Abstract Factory', 'Creational', 'Creates families'],
        ['factory-method', 'Factory Method', 'Creational', 'Defers instantiation'],
        ['builder', 'Builder Pattern', 'Creational', 'Constructs objects'],
        ['singleton', 'Singleton Pattern', 'Creational', 'Single instance'],
      ];

      for (const [id, name, category, description] of patterns) {
        await db.execute(
          `INSERT INTO patterns (id, name, category, description, complexity, tags, code_examples, relationships, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            name,
            category,
            description,
            'Low',
            JSON.stringify(['creational', 'design', 'patterns']),
            JSON.stringify(['example']),
            JSON.stringify([]),
            new Date().toISOString(),
            new Date().toISOString(),
          ]
        );
      }

      const queryEmbedding = new Array(384).fill(0.1);
      const results = await hybridEngine.search('creational patterns', queryEmbedding);

      // Should have diversity scores
      results.forEach(result => {
        expect(result).toHaveProperty('diversityScore');
        expect(result.diversityScore).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('SearchMediator', () => {
    it('should coordinate search operations using mediator pattern', async () => {
      // Insert test pattern
      await db.execute(
        `INSERT INTO patterns (id, name, category, description, complexity, tags, code_examples, relationships, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'factory',
          'Factory Pattern',
          'Creational',
          'Creates objects without specifying exact class',
          'Low',
          JSON.stringify(['creational', 'design', 'patterns']),
          JSON.stringify(['example1', 'example2']),
          JSON.stringify([]),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      const request: PatternRequest = {
        id: 'test-request-1',
        query: 'factory pattern',
        maxResults: 5,
        programmingLanguage: 'TypeScript',
      };

      const recommendations = await searchMediator.search(request);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      
      if (recommendations.length > 0) {
        const recommendation = recommendations[0];
        expect(recommendation).toHaveProperty('pattern');
        expect(recommendation).toHaveProperty('confidence');
        expect(recommendation).toHaveProperty('justification');
        expect(recommendation.justification).toHaveProperty('supportingReasons');
      }
    });

    it('should cache search results', async () => {
      await db.execute(
        `INSERT INTO patterns (id, name, category, description, complexity, tags, code_examples, relationships, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'singleton',
          'Singleton Pattern',
          'Creational',
          'Ensures a class has only one instance',
          'Low',
          JSON.stringify(['creational', 'design', 'patterns']),
          JSON.stringify(['example']),
          JSON.stringify([]),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      const request: PatternRequest = {
        id: 'test-request-2',
        query: 'singleton pattern',
        maxResults: 3,
      };

      // First search (should cache)
      const results1 = await searchMediator.search(request);
      
      // Second search (should use cache)
      const results2 = await searchMediator.search(request);

      expect(results1).toEqual(results2);
    });

    it('should apply fuzzy refinement when enabled', async () => {
      await db.execute(
        `INSERT INTO patterns (id, name, category, description, complexity, tags, code_examples, relationships, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'strategy',
          'Strategy Pattern',
          'Behavioral',
          'Defines a family of algorithms',
          'Medium',
          JSON.stringify(['behavioral', 'design', 'patterns']),
          JSON.stringify(['example']),
          JSON.stringify([]),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      const request: PatternRequest = {
        id: 'test-request-3',
        query: 'strategy pattern for algorithms',
        maxResults: 3,
        programmingLanguage: 'Java',
      };

      const recommendations = await searchMediator.search(request);

      if (recommendations.length > 0) {
        const recommendation = recommendations[0];
        expect(recommendation.justification).toHaveProperty('fuzzyReasoning');
        expect(recommendation.justification).toHaveProperty('fuzzyConfidence');
      }
    });
  });

  describe('Performance Metrics', () => {
    it('should complete search within reasonable time', async () => {
      // Insert multiple patterns for realistic test
      const patterns = [
        ['factory', 'Factory Pattern', 'Creational', 'Creates objects'],
        ['builder', 'Builder Pattern', 'Creational', 'Constructs objects'],
        ['singleton', 'Singleton Pattern', 'Creational', 'Single instance'],
        ['observer', 'Observer Pattern', 'Behavioral', 'Publish-subscribe'],
        ['strategy', 'Strategy Pattern', 'Behavioral', 'Algorithm family'],
        ['adapter', 'Adapter Pattern', 'Structural', 'Interface conversion'],
      ];

      for (const [id, name, category, description] of patterns) {
        await db.execute(
          `INSERT INTO patterns (id, name, category, description, complexity, tags, code_examples, relationships, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            name,
            category,
            description,
            'Low',
            JSON.stringify([category.toLowerCase(), 'design', 'patterns']),
            JSON.stringify(['example']),
            JSON.stringify([]),
            new Date().toISOString(),
            new Date().toISOString(),
          ]
        );
      }

      const startTime = Date.now();
      const queryEmbedding = new Array(384).fill(0.1);
      const results = await hybridEngine.search('design patterns', queryEmbedding);
      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Log performance for monitoring
      console.log(`Blended RAG search completed in ${duration}ms with ${results.length} results`);
    });

    it('should handle concurrent searches', async () => {
      const queries = [
        'factory pattern',
        'builder pattern',
        'singleton pattern',
        'observer pattern',
      ];

      const queryEmbedding = new Array(384).fill(0.1);
      const searchPromises = queries.map(query => 
        hybridEngine.search(query, queryEmbedding)
      );

      const startTime = Date.now();
      const results = await Promise.all(searchPromises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(queries.length);
      results.forEach(resultSet => {
        expect(Array.isArray(resultSet)).toBe(true);
      });

      console.log(`Concurrent searches (${queries.length}) completed in ${duration}ms`);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty database gracefully', async () => {
      // Create a separate hybrid engine with empty vector ops for this test
      const emptyVectorOps = {
        searchSimilar: () => [],
        findSimilarPatterns: () => [],
        storeEmbedding: async () => {},
        createVectorIndex: () => {},
        hasVectorIndex: () => false,
      } as unknown as VectorOperationsService;

      const emptyHybridEngine = new HybridSearchEngine(emptyVectorOps, db, cache, {
        denseWeight: 0.6,
        sparseWeight: 0.4,
        maxResults: 10,
        similarityThreshold: 0.3,
      });

      const queryEmbedding = new Array(384).fill(0.1);
      const results = await emptyHybridEngine.search('factory pattern', queryEmbedding);

      expect(results).toEqual([]);
    });

    it('should handle malformed queries', async () => {
      const queryEmbedding = new Array(384).fill(0.1);
      const results = await hybridEngine.search('', queryEmbedding);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle search mediator errors gracefully', async () => {
      const request: PatternRequest = {
        id: 'test-request-4',
        query: '',
        maxResults: 5,
      };

      const recommendations = await searchMediator.search(request);
      
      expect(recommendations).toEqual([]);
    });
  });
});