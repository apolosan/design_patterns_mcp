/**
 * MCP Implementation Tests
 * Tests our MCP tools and resources implementation
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { MCPToolsHandler } from '../../src/lib/mcp-tools.js';
import { MCPResourcesHandler } from '../../src/lib/mcp-resources.js';
import {
  CallToolRequest,
  ReadResourceRequest,
  ListResourcesRequest,
} from '@modelcontextprotocol/sdk/types.js';

describe('MCP Implementation Tests', () => {
  let toolsHandler: MCPToolsHandler;
  let resourcesHandler: MCPResourcesHandler;

  beforeAll(async () => {
    // Initialize handlers with placeholder services
    const patternMatcher = {
      findSimilarPatterns: async (request: any) => [
        {
          pattern: {
            id: 'singleton',
            name: 'Singleton',
            category: 'Creational',
            description: 'Ensure a class has only one instance',
            problem: 'Need to ensure only one instance exists',
            solution: 'Use private constructor and static instance',
            when_to_use: ['Need single instance', 'Global access required'],
            benefits: ['Controlled access', 'Reduced pollution'],
            drawbacks: ['Testing difficulty', 'Tight coupling'],
            use_cases: ['Database connections', 'Configuration'],
            implementations: [
              {
                language: 'typescript',
                code: 'class Singleton { private static instance: Singleton; ... }',
                explanation: 'TypeScript Singleton implementation',
              },
            ],
            complexity: 'Low',
            popularity: 0.8,
            tags: ['creational', 'single-instance'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          score: 0.85,
          rank: 1,
          justification: 'Matches requirement for single instance',
          implementation: 'class Singleton { private static instance: Singleton; ... }',
          alternatives: [],
          context: 'General purpose application',
        },
      ],
      analyzeCode: async (code: string, language: string) => ({
        patterns: [
          {
            name: 'Singleton',
            confidence: 0.8,
            location: 'line 1',
            description: 'Code appears to implement singleton pattern',
          },
        ],
        suggestions: [
          {
            type: 'improvement',
            message: 'Consider using dependency injection',
            severity: 'info' as const,
          },
        ],
        summary: 'Code analysis completed',
      }),
    };

    const semanticSearch = {
      search: async (query: string, options?: any) => [
        {
          pattern: {
            id: 'singleton',
            name: 'Singleton',
            category: 'Creational',
            description: 'Ensure a class has only one instance',
            problem: 'Need to ensure only one instance exists',
            solution: 'Use private constructor and static instance',
            when_to_use: ['Need single instance', 'Global access required'],
            benefits: ['Controlled access', 'Reduced pollution'],
            drawbacks: ['Testing difficulty', 'Tight coupling'],
            use_cases: ['Database connections', 'Configuration'],
            implementations: [
              {
                language: 'typescript',
                code: 'class Singleton { private static instance: Singleton; ... }',
                explanation: 'TypeScript Singleton implementation',
              },
            ],
            complexity: 'Low',
            popularity: 0.8,
            tags: ['creational', 'single-instance'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          score: 0.9,
        },
      ],
    };

    const patternService = {
      getPattern: async (id: string) => null,
      searchPatterns: async (query: string) => [],
      getAllPatterns: async () => [],
      getPatternCategories: async () => [],
    };

    const databaseManager = {
      searchPatterns: async (query: string, options?: any) => [
        {
          pattern: {
            id: 'factory-method',
            name: 'Factory Method',
            category: 'Creational',
            description: 'Define interface for creating object',
            problem: 'Need to create objects without specifying exact class',
            solution: 'Define interface for creating object, let subclasses decide',
            when_to_use: [
              'Object creation varies by subclass',
              'Need to decouple client from concrete classes',
            ],
            benefits: [
              'Eliminates need to bind application to specific classes',
              'Single Responsibility',
            ],
            drawbacks: ['May result in many subclasses', 'Can complicate code'],
            use_cases: ['Framework creation', 'Plugin systems'],
            implementations: [
              {
                language: 'typescript',
                code: 'abstract class Creator { abstract factoryMethod(): Product; }',
                explanation: 'Abstract creator with factory method',
              },
            ],
            complexity: 'Medium',
            popularity: 0.7,
            tags: ['creational', 'factory'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          score: 0.7,
        },
      ],
      updatePattern: async (id: string, updates: any) => {},
      savePattern: async (pattern: any) => {},
      getAllPatterns: async () => [
        {
          id: 'singleton',
          name: 'Singleton',
          category: 'Creational',
          description: 'Ensure a class has only one instance',
          problem: 'Need to ensure only one instance exists',
          solution: 'Use private constructor and static instance',
          when_to_use: ['Need single instance', 'Global access required'],
          benefits: ['Controlled access', 'Reduced pollution'],
          drawbacks: ['Testing difficulty', 'Tight coupling'],
          use_cases: ['Database connections', 'Configuration'],
          implementations: [
            {
              language: 'typescript',
              code: 'class Singleton { private static instance: Singleton; ... }',
              explanation: 'TypeScript Singleton implementation',
            },
          ],
          complexity: 'Low',
          popularity: 0.8,
          tags: ['creational', 'single-instance'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      getPatternById: async (id: string) => {
        if (id === 'singleton') {
          return {
            id: 'singleton',
            name: 'Singleton',
            category: 'Creational',
            description: 'Ensure a class has only one instance',
            problem: 'Need to ensure only one instance exists',
            solution: 'Use private constructor and static instance',
            when_to_use: ['Need single instance', 'Global access required'],
            benefits: ['Controlled access', 'Reduced pollution'],
            drawbacks: ['Testing difficulty', 'Tight coupling'],
            use_cases: ['Database connections', 'Configuration'],
            implementations: [
              {
                language: 'typescript',
                code: 'class Singleton { private static instance: Singleton; ... }',
                explanation: 'TypeScript Singleton implementation',
              },
            ],
            complexity: 'Low',
            popularity: 0.8,
            tags: ['creational', 'single-instance'],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return null;
      },
      getPatternCategories: async () => [
        {
          id: 1,
          name: 'Creational',
          description: 'Patterns for object creation',
          patternCount: 5,
          typicalUseCases: 'Object instantiation, resource management',
          createdAt: new Date(),
          updatedAt: new Date(),
          count: 5,
        },
      ],
      getSupportedLanguages: async () => [
        {
          language: 'typescript',
          count: 150,
        },
      ],
      getServerStats: async () => ({
        totalPatterns: 622,
        totalCategories: 12,
        avgResponseTime: 150,
        totalRequests: 42,
        cacheHitRate: 0.85,
      }),
    };

    toolsHandler = new MCPToolsHandler({
      patternMatcher,
      semanticSearch,
      databaseManager,
      patternService,
      preferences: new Map(),
    });

    resourcesHandler = new MCPResourcesHandler({
      databaseManager,
      serverVersion: '0.1.0',
      totalPatterns: 200,
    });
  });

  describe('MCP Tools', () => {
    test('suggest_pattern tool returns valid response', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'suggest_pattern',
          arguments: {
            query:
              'I need to create different types of database connections based on configuration',
            programming_language: 'typescript',
            max_results: 3,
            include_examples: true,
          },
        },
      };

      const response = await toolsHandler.handleToolCall(request);

      expect(response).toHaveProperty('request_id');
      expect(response).toHaveProperty('recommendations');
      expect(response).toHaveProperty('metadata');

      expect(Array.isArray(response.recommendations)).toBe(true);
      expect(response.recommendations.length).toBeGreaterThan(0);

      const recommendation = response.recommendations[0];
      expect(recommendation).toHaveProperty('pattern');
      expect(recommendation).toHaveProperty('score');
      expect(recommendation).toHaveProperty('rank');
      expect(recommendation).toHaveProperty('justification');

      expect(recommendation.pattern).toHaveProperty('id');
      expect(recommendation.pattern).toHaveProperty('name');
      expect(recommendation.pattern).toHaveProperty('category');
    });

    test('search_patterns tool returns valid response', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'search_patterns',
          arguments: {
            query: 'singleton',
            search_type: 'keyword',
            limit: 5,
          },
        },
      };

      const response = await toolsHandler.handleToolCall(request);

      expect(response).toHaveProperty('patterns');
      expect(response).toHaveProperty('total_results');
      expect(Array.isArray(response.patterns)).toBe(true);

      const result = response.patterns[0];
      expect(result).toHaveProperty('pattern');
      expect(result).toHaveProperty('score');
      expect(result.pattern).toHaveProperty('id');
      expect(result.pattern).toHaveProperty('name');
      expect(result.pattern).toHaveProperty('category');
    });

    test('analyze_code tool returns valid response', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'analyze_code',
          arguments: {
            code: 'class Singleton { private static instance: Singleton; }',
            language: 'typescript',
            analysis_type: 'identify_patterns',
          },
        },
      };

      const response = await toolsHandler.handleToolCall(request);

      expect(response).toHaveProperty('language');
      expect(response).toHaveProperty('identified_patterns');
      expect(Array.isArray(response.identified_patterns)).toBe(true);
    });
  });

  describe('MCP Resources', () => {
    test('patterns resource returns valid data', async () => {
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'patterns',
        },
      };

      const response = await resourcesHandler.handleResourceRead(request);

      expect(response).toHaveProperty('contents');
      expect(Array.isArray(response.contents)).toBe(true);

      const content = response.contents[0];
      expect(content).toHaveProperty('uri');
      expect(content).toHaveProperty('mimeType');
      expect(content.mimeType).toBe('application/json');

      const patterns = JSON.parse(content.text);
      expect(Array.isArray(patterns)).toBe(true);
    });

    test('pattern/{id} resource returns valid data', async () => {
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'pattern/singleton',
        },
      };

      const response = await resourcesHandler.handleResourceRead(request);

      expect(response).toHaveProperty('contents');
      const content = response.contents[0];
      expect(content.mimeType).toBe('application/json');

      const pattern = JSON.parse(content.text);
      expect(pattern).toHaveProperty('id');
      expect(pattern).toHaveProperty('name');
      expect(pattern).toHaveProperty('category');
    });

    test('categories resource returns valid data', async () => {
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'categories',
        },
      };

      const response = await resourcesHandler.handleResourceRead(request);

      expect(response).toHaveProperty('contents');
      const content = response.contents[0];
      expect(content.mimeType).toBe('application/json');

      const categories = JSON.parse(content.text);
      expect(Array.isArray(categories)).toBe(true);
    });

    test('server_info resource returns valid data', async () => {
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'server_info',
        },
      };

      const response = await resourcesHandler.handleResourceRead(request);

      expect(response).toHaveProperty('contents');
      const content = response.contents[0];
      expect(content.mimeType).toBe('application/json');

      const serverInfo = JSON.parse(content.text);
      expect(serverInfo).toHaveProperty('server_version');
      expect(serverInfo).toHaveProperty('total_patterns');
    });

    test('resource listing returns available resources', async () => {
      const request: ListResourcesRequest = {
        method: 'resources/list',
        params: {},
      };

      const response = await resourcesHandler.handleResourceList(request);

      expect(response).toHaveProperty('resources');
      expect(Array.isArray(response.resources)).toBe(true);
      expect(response.resources.length).toBeGreaterThan(0);

      const resource = response.resources[0];
      expect(resource).toHaveProperty('uri');
      expect(resource).toHaveProperty('mimeType');
    });
  });
});
