/**
 * Unit Tests for LLM Bridge Service
 * Tests LLM integration functionality with mocked external calls
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { LLMBridgeService } from '../../src/services/llm-bridge.js';

// Mock the database manager
vi.mock('../../src/services/database-manager.js');

describe('LLM Bridge Service', () => {
  let llmBridge: LLMBridgeService;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock database
    mockDb = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue(null),
      execute: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({ databaseSize: 1000 }),
    };

    llmBridge = new LLMBridgeService(mockDb, {
      provider: 'ollama',
      model: 'llama3.2',
      maxTokens: 2000,
      temperature: 0.3,
      timeout: 30000,
    });
  });

  test('should initialize with correct configuration', () => {
    expect(llmBridge).toBeDefined();
    expect(typeof llmBridge.analyzePatterns).toBe('function');
    expect(typeof llmBridge.generateImplementationGuidance).toBe('function');
    expect(typeof llmBridge.explainPatternRelationships).toBe('function');
    expect(typeof llmBridge.generateCodeExample).toBe('function');
    expect(typeof llmBridge.enhanceRecommendations).toBe('function');
  });

  test('should handle analyzePatterns with fallback when LLM fails', async () => {
    const request = {
      problemDescription: 'Need to manage shared resources in a web application',
      codeSnippet: 'class Database { connect() {} }',
      programmingLanguage: 'TypeScript',
      context: {
        existingPatterns: ['Singleton', 'Factory'],
        constraints: ['scalability', 'maintainability'],
      },
    };

    // Mock LLM call to fail
    const originalCallLLM = (llmBridge as any).callLLM;
    (llmBridge as any).callLLM = vi.fn().mockRejectedValue(new Error('LLM unavailable'));

    const result = await llmBridge.analyzePatterns(request);

    expect(result).toBeDefined();
    expect(result.detectedPatterns).toBeDefined();
    expect(result.recommendations).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);

    // Restore original method
    (llmBridge as any).callLLM = originalCallLLM;
  });

  test('should generate implementation guidance', async () => {
    const result = await llmBridge.generateImplementationGuidance(
      'Observer',
      'TypeScript',
      { experienceLevel: 'intermediate' }
    );

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('should explain pattern relationships', async () => {
    const result = await llmBridge.explainPatternRelationships(
      'Observer',
      'Mediator',
      'When both patterns are used together'
    );

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('should generate code examples', async () => {
    const result = await llmBridge.generateCodeExample(
      'Singleton',
      'JavaScript',
      'database connection pool'
    );

    expect(result).toBeDefined();
    expect(result.code).toBeDefined();
    expect(result.explanation).toBeDefined();
    expect(typeof result.code).toBe('string');
    expect(typeof result.explanation).toBe('string');
  });

  test('should enhance recommendations', async () => {
    const baseRecommendations = [
      {
        patternName: 'Singleton',
        confidence: 0.8,
        reasoning: 'Good for shared resources',
        benefits: ['Ensures single instance'],
        drawbacks: ['Can make testing difficult'],
      },
    ];

    const userContext = {
      experienceLevel: 'beginner' as const,
      projectType: 'web application',
    };

    const result = await llmBridge.enhanceRecommendations(baseRecommendations, userContext);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test('should get pattern info from database', async () => {
    // Mock database to return pattern data
    mockDb.queryOne.mockImplementation((query: string, params: any[]) => {
      if (query.includes('patterns') && params[0] === 'Singleton') {
        return Promise.resolve({
          id: 'singleton',
          name: 'Singleton',
          description: 'Ensures only one instance exists',
          category: 'Creational',
        });
      }
      return Promise.resolve(null);
    });

    const result = await (llmBridge as any).getPatternInfo('Singleton');

    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(Object);
    // The method transforms the data, so we check that it has the expected properties
    expect(result).toHaveProperty('when_to_use');
    expect(result).toHaveProperty('benefits');
    expect(Array.isArray(result.when_to_use)).toBe(true);
    expect(Array.isArray(result.benefits)).toBe(true);
  });

  test('should handle health status check', async () => {
    const health = await llmBridge.getHealthStatus();

    expect(health).toBeDefined();
    expect(health.healthy).toBeDefined();
    expect(health.provider).toBe('ollama');
    expect(health.model).toBe('llama3.2');
  });

  test('should build analysis prompt correctly', () => {
    const request = {
      problemDescription: 'Need to manage shared resources in a web application',
      codeSnippet: 'class Database { connect() {} }',
      programmingLanguage: 'TypeScript',
      context: {
        existingPatterns: ['Singleton', 'Factory'],
        constraints: ['scalability', 'maintainability'],
      },
    };

    const prompt = (llmBridge as any).buildAnalysisPrompt(request);

    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('Need to manage shared resources');
    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('Singleton');
    expect(prompt).toContain('Factory');
  });

  test('should build implementation prompt correctly', () => {
    const pattern = { name: 'Observer', description: 'Publish-subscribe pattern' };
    const context = { experienceLevel: 'intermediate' as const };

    const prompt = (llmBridge as any).buildImplementationPrompt(pattern, 'TypeScript', context);

    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('Observer');
    expect(prompt).toContain('TypeScript');
  });

  test('should handle different LLM providers', () => {
    const providers = ['openai', 'anthropic', 'ollama', 'local'] as const;

    providers.forEach(provider => {
      const service = new LLMBridgeService(mockDb, {
        provider,
        model: 'test-model',
        maxTokens: 1000,
        temperature: 0.5,
        timeout: 10000,
      });

      expect(service).toBeDefined();
    });
  });

  test('should merge enhancements correctly', () => {
    const baseRecommendations = [
      {
        pattern: 'Singleton',
        confidence: 0.8,
        reasoning: 'Good for shared resources',
        alternatives: ['Factory'],
      },
    ];

    const enhancements = [
      {
        pattern: 'Singleton',
        enhancedReasoning: 'Excellent for database connections',
        additionalAlternatives: ['Monostate'],
        priority: 'high' as const,
      },
    ];

    const result = (llmBridge as any).mergeEnhancements(baseRecommendations, enhancements);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].reasoning).toContain('Excellent for database connections');
  });

  test('should handle fallback analysis when LLM fails', () => {
    const request = {
      problemDescription: 'Test problem description',
      context: {
        existingPatterns: ['Unknown Pattern'],
        constraints: ['test constraints'],
      },
    };

    const result = (llmBridge as any).getFallbackAnalysis(request);

    expect(result).toBeDefined();
    expect(result.detectedPatterns).toBeDefined();
    expect(result.recommendations).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});