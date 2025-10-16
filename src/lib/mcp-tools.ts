/**
 * MCP Tools Implementation
 * Provides MCP protocol tools for pattern recommendations and analysis
 */

import { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { PatternRequest } from '../models/request.js';
import { Pattern } from '../models/pattern.js';
import { UserPreference } from '../models/preference.js';
import { RelationshipType } from '../models/relationship.js';
import { parseTags, parseArrayProperty } from '../utils/parse-tags.js';

// Import real service interfaces
import { PatternMatcher as RealPatternMatcher } from '../services/pattern-matcher.js';
import { SemanticSearchService } from '../services/semantic-search.js';
import { DatabaseManager as RealDatabaseManager } from '../services/database-manager.js';

// Adapter interfaces to match MCP expectations
export interface PatternMatcher {
  findSimilarPatterns(request: PatternRequest): Promise<any[]>;
  analyzeCode(code: string, language: string): Promise<any>;
}

export interface SemanticSearch {
  search(query: string, options?: any): Promise<any[]>;
}

export interface DatabaseManager {
  searchPatterns(query: string, options?: any): Promise<any[]>;
  updatePattern(id: string, updates: any): Promise<void>;
  savePattern(pattern: Pattern): Promise<void>;
  getAllPatterns(): Promise<Pattern[]>;
  getPatternById(id: string): Promise<Pattern | null>;
  getPatternCategories(): Promise<any[]>;
  getSupportedLanguages(): Promise<any[]>;
  getServerStats(): Promise<any>;
}

export interface MCPToolsConfig {
  patternMatcher: PatternMatcher;
  semanticSearch: SemanticSearch;
  databaseManager: DatabaseManager;
  preferences: Map<string, UserPreference>;
}

// Adapter classes to bridge real services with MCP interfaces
export class PatternMatcherAdapter implements PatternMatcher {
  constructor(private realPatternMatcher: RealPatternMatcher) {}

  async findSimilarPatterns(request: PatternRequest): Promise<any[]> {
    // Convert MCP PatternRequest to real service PatternRequest
    const realRequest = {
      id: request.id,
      query: request.query,
      categories: request.categoryFilter,
      maxResults: request.maxResults,
      programmingLanguage: request.programmingLanguage,
    };

    const recommendations = await this.realPatternMatcher.findMatchingPatterns(realRequest);

    // Convert back to MCP format
    return recommendations.map(rec => ({
      pattern: rec.pattern,
      score: rec.confidence,
      rank: rec.rank,
      justification: rec.justification,
      implementation: rec.implementation,
      alternatives: rec.alternatives,
      context: rec.context,
    }));
  }

  async analyzeCode(code: string, language: string): Promise<any> {
    // For now, return a simple analysis - would need to implement in real service
    return {
      identifiedPatterns: [],
      suggestedPatterns: [],
      improvements: ['Analysis not yet implemented in real service'],
    };
  }
}

export class SemanticSearchAdapter implements SemanticSearch {
  constructor(private realSemanticSearch: SemanticSearchService) {}

  async search(query: string, options?: any): Promise<any[]> {
    const searchQuery = {
      text: query,
      filters: options?.categoryFilter ? { categories: options.categoryFilter } : undefined,
      options: {
        limit: options?.limit || 10,
        includeMetadata: true,
      },
    };

    const results = await this.realSemanticSearch.search(searchQuery);

    return results.map(result => ({
      id: result.patternId,
      name: result.pattern.name,
      category: result.pattern.category,
      description: result.pattern.description,
      score: result.score,
      matchType: 'semantic',
    }));
  }
}

export class DatabaseManagerAdapter implements DatabaseManager {
  constructor(private realDatabaseManager: RealDatabaseManager) {}

  async searchPatterns(query: string, options?: any): Promise<any[]> {
    // Simple keyword search implementation
    const patterns = this.realDatabaseManager.query(
      `
      SELECT id, name, category, description, complexity, tags
      FROM patterns
      WHERE name LIKE ? OR description LIKE ? OR category LIKE ?
      LIMIT ?
    `,
      [`%${query}%`, `%${query}%`, `%${query}%`, options?.limit || 10]
    );

    return patterns.map(pattern => ({
      id: pattern.id,
      name: pattern.name,
      category: pattern.category,
      description: pattern.description,
      score: 0.8, // Default score for keyword matches
      matchType: 'keyword',
    }));
  }

  async updatePattern(id: string, updates: any): Promise<void> {
    // Build dynamic update query
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    this.realDatabaseManager.execute(
      `UPDATE patterns SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );
  }

  async savePattern(pattern: Pattern): Promise<void> {
    const sql = `
      INSERT INTO patterns (id, name, category, description, when_to_use, benefits, drawbacks, use_cases, complexity, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const params = [
      pattern.id,
      pattern.name,
      pattern.category,
      pattern.description,
      pattern.when_to_use ? JSON.stringify(pattern.when_to_use) : null,
      pattern.benefits ? JSON.stringify(pattern.benefits) : null,
      pattern.drawbacks ? JSON.stringify(pattern.drawbacks) : null,
      pattern.use_cases ? JSON.stringify(pattern.use_cases) : null,
      pattern.complexity,
      pattern.tags ? JSON.stringify(pattern.tags) : null,
    ];

    this.realDatabaseManager.execute(sql, params);
  }

  async getAllPatterns(): Promise<Pattern[]> {
    const rows = this.realDatabaseManager.query(`
      SELECT id, name, category, description, when_to_use, benefits, drawbacks, use_cases, complexity, tags, created_at, updated_at
      FROM patterns
      ORDER BY name
    `);

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      problem: row.description || '', // Use description as problem fallback
      solution: row.description || '', // Use description as solution fallback
      when_to_use: parseArrayProperty(row.when_to_use, 'when_to_use'),
      benefits: parseArrayProperty(row.benefits, 'benefits'),
      drawbacks: parseArrayProperty(row.drawbacks, 'drawbacks'),
      use_cases: parseArrayProperty(row.use_cases, 'use_cases'),
      implementations: [], // Would need to fetch from pattern_implementations table
      relatedPatterns: [], // Would need to fetch from pattern_relationships table
      complexity: row.complexity,
      tags: parseTags(row.tags),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async getPatternById(id: string): Promise<Pattern | null> {
    const row = this.realDatabaseManager.queryOne(
      `
      SELECT id, name, category, description, problem, solution, when_to_use, benefits, drawbacks, use_cases, complexity, tags, created_at, updated_at
      FROM patterns
      WHERE id = ?
    `,
      [id]
    );

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      problem: row.problem || '',
      solution: row.solution || '',
      when_to_use: parseArrayProperty(row.when_to_use, 'when_to_use'),
      benefits: parseArrayProperty(row.benefits, 'benefits'),
      drawbacks: parseArrayProperty(row.drawbacks, 'drawbacks'),
      use_cases: parseArrayProperty(row.use_cases, 'use_cases'),
      implementations: [], // Would need to fetch from pattern_implementations table
      relatedPatterns: [], // Would need to fetch from pattern_relationships table
      complexity: row.complexity,
      tags: parseTags(row.tags),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async getPatternCategories(): Promise<any[]> {
    const rows = this.realDatabaseManager.query(`
      SELECT category, COUNT(*) as pattern_count
      FROM patterns
      GROUP BY category
      ORDER BY category
    `);

    return rows.map((row, index) => ({
      id: index + 1,
      name: row.category,
      description: `${row.category} design patterns`,
      patternCount: row.pattern_count,
      typicalUseCases: this.getTypicalUseCases(row.category),
      createdAt: new Date(),
    }));
  }

  async getSupportedLanguages(): Promise<any[]> {
    // Return static list for now - could be made dynamic
    return [
      {
        language: 'typescript',
        display_name: 'TypeScript',
        implementation_count: 150,
        supported_features: ['classes', 'interfaces', 'generics'],
      },
      {
        language: 'javascript',
        display_name: 'JavaScript',
        implementation_count: 120,
        supported_features: ['classes', 'prototypes', 'closures'],
      },
      {
        language: 'python',
        display_name: 'Python',
        implementation_count: 100,
        supported_features: ['classes', 'decorators', 'metaclasses'],
      },
    ];
  }

  async getServerStats(): Promise<any> {
    const patternCount = this.realDatabaseManager.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM patterns'
    );

    return {
      avgResponseTime: 150,
      totalRequests: 0, // Would need to track this
      cacheHitRate: 0.85,
      totalPatterns: patternCount?.count || 0,
    };
  }

  private getTypicalUseCases(category: string): string {
    const useCases: Record<string, string> = {
      Creational: 'Object instantiation, resource management',
      Structural: 'Class relationships, interface adaptation',
      Behavioral: 'Communication, responsibility assignment',
      Architectural: 'System organization, component interaction',
      'Cloud-Native': 'Scalability, resilience, distributed systems',
      Microservices: 'Service decomposition, communication patterns',
      'AI/ML': 'Model training, inference, data processing',
      Functional: 'Data transformation, immutability, composition',
      Reactive: 'Asynchronous processing, event handling',
      'Anti-Pattern': 'Common mistakes to avoid',
    };

    return useCases[category] || 'General software design';
  }
}

/**
 * MCP Tools Handler
 * Implements all MCP tools for the Design Patterns server
 */
export class MCPToolsHandler {
  private config: MCPToolsConfig;

  constructor(config: MCPToolsConfig) {
    this.config = config;
  }

  /**
   * Get all available MCP tools
   */
  getTools(): Tool[] {
    return [
      {
        name: 'suggest_pattern',
        description:
          'Suggest design patterns based on natural language description and optional code context',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language description of the problem or requirement',
              minLength: 10,
              maxLength: 2000,
            },
            code_context: {
              type: 'string',
              description: 'Optional code snippet for additional context',
              maxLength: 50000,
            },
            programming_language: {
              type: 'string',
              description: 'Target programming language preference',
              enum: [
                'typescript',
                'javascript',
                'python',
                'java',
                'csharp',
                'go',
                'rust',
                'cpp',
                'php',
                'ruby',
                'swift',
                'kotlin',
              ],
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of recommendations to return',
              minimum: 1,
              maximum: 20,
              default: 5,
            },
            include_examples: {
              type: 'boolean',
              description: 'Include code examples in recommendations',
              default: true,
            },
            category_filter: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'Creational',
                  'Structural',
                  'Behavioral',
                  'Architectural',
                  'Cloud-Native',
                  'Microservices',
                  'AI-ML',
                  'Functional',
                  'Reactive',
                  'Anti-Pattern',
                ],
              },
              description: 'Filter results by pattern categories',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_patterns',
        description: 'Search patterns using keyword or semantic search',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
              minLength: 2,
              maxLength: 500,
            },
            search_type: {
              type: 'string',
              description: 'Type of search to perform',
              enum: ['keyword', 'semantic', 'hybrid'],
              default: 'hybrid',
            },
            category_filter: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Filter by pattern categories',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              minimum: 1,
              maximum: 50,
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'analyze_code',
        description: 'Analyze code to identify patterns and suggest improvements',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Code to analyze',
              minLength: 10,
              maxLength: 50000,
            },
            language: {
              type: 'string',
              description: 'Programming language of the code',
              enum: [
                'typescript',
                'javascript',
                'python',
                'java',
                'csharp',
                'go',
                'rust',
                'cpp',
                'php',
                'ruby',
                'swift',
                'kotlin',
              ],
            },
            analysis_type: {
              type: 'string',
              description: 'Type of analysis to perform',
              enum: ['identify_patterns', 'suggest_improvements', 'both'],
              default: 'both',
            },
          },
          required: ['code', 'language'],
        },
      },
      {
        name: 'update_pattern',
        description: 'Create or update a design pattern in the catalog',
        inputSchema: {
          type: 'object',
          properties: {
            pattern_id: {
              type: 'string',
              description: 'Pattern ID for updates (omit for new patterns)',
            },
            name: {
              type: 'string',
              description: 'Pattern name',
              minLength: 2,
              maxLength: 100,
            },
            category: {
              type: 'string',
              description: 'Pattern category',
              enum: [
                'Creational',
                'Structural',
                'Behavioral',
                'Architectural',
                'Cloud-Native',
                'Microservices',
                'AI-ML',
                'Functional',
                'Reactive',
                'Anti-Pattern',
              ],
            },
            description: {
              type: 'string',
              description: 'Pattern description',
              minLength: 50,
              maxLength: 2000,
            },
            problem: {
              type: 'string',
              description: 'Problem the pattern solves',
              minLength: 20,
              maxLength: 1000,
            },
            solution: {
              type: 'string',
              description: 'How the pattern solves the problem',
              minLength: 20,
              maxLength: 1000,
            },
            use_cases: {
              type: 'string',
              description: 'Common use cases',
              minLength: 20,
              maxLength: 1000,
            },
            complexity: {
              type: 'string',
              description: 'Implementation complexity',
              enum: ['Beginner', 'Intermediate', 'Advanced'],
            },
          },
          required: [
            'name',
            'category',
            'description',
            'problem',
            'solution',
            'use_cases',
            'complexity',
          ],
        },
      },
      {
        name: 'get_config',
        description: 'Retrieve server configuration settings',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Configuration category to retrieve',
              enum: ['all', 'search', 'display', 'llm', 'performance'],
              default: 'all',
            },
          },
        },
      },
      {
        name: 'set_config',
        description: 'Update server configuration settings',
        inputSchema: {
          type: 'object',
          properties: {
            settings: {
              type: 'object',
              description: 'Settings to update',
              additionalProperties: true,
            },
            category: {
              type: 'string',
              description: 'Configuration category',
              enum: ['search', 'display', 'llm', 'performance'],
            },
          },
          required: ['settings', 'category'],
        },
      },
      {
        name: 'count_patterns',
        description: 'Get the total number of design patterns in the database',
        inputSchema: {
          type: 'object',
          properties: {
            includeDetails: {
              type: 'boolean',
              description: 'Include breakdown by category',
              default: false,
            },
          },
        },
      },
      {
        name: 'create_relationship',
        description: 'Create a new relationship between two design patterns',
        inputSchema: {
          type: 'object',
          properties: {
            source_pattern_id: {
              type: 'string',
              description: 'ID of the source pattern',
            },
            target_pattern_id: {
              type: 'string',
              description: 'ID of the target pattern',
            },
            type: {
              type: 'string',
              description: 'Type of relationship',
              enum: [
                'related',
                'extends',
                'implements',
                'uses',
                'similar',
                'alternative',
                'complements',
                'conflicts',
                'prerequisite',
                'successor',
              ],
            },
            strength: {
              type: 'number',
              description: 'Strength of the relationship (0.0 to 1.0)',
              minimum: 0.0,
              maximum: 1.0,
              default: 1.0,
            },
            description: {
              type: 'string',
              description: 'Human-readable description of the relationship',
              minLength: 10,
              maxLength: 500,
            },
          },
          required: ['source_pattern_id', 'target_pattern_id', 'type', 'description'],
        },
      },
      {
        name: 'get_relationships',
        description: 'Get relationships for patterns with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            pattern_id: {
              type: 'string',
              description:
                'Pattern ID to get relationships for (optional - returns all if not specified)',
            },
            type: {
              type: 'string',
              description: 'Filter by relationship type',
              enum: [
                'related',
                'extends',
                'implements',
                'uses',
                'similar',
                'alternative',
                'complements',
                'conflicts',
                'prerequisite',
                'successor',
              ],
            },
            min_strength: {
              type: 'number',
              description: 'Minimum relationship strength',
              minimum: 0.0,
              maximum: 1.0,
            },
            include_pattern_details: {
              type: 'boolean',
              description: 'Include full pattern details in response',
              default: true,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of relationships to return',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
          },
        },
      },
      {
        name: 'update_relationship',
        description: 'Update an existing relationship between patterns',
        inputSchema: {
          type: 'object',
          properties: {
            relationship_id: {
              type: 'string',
              description: 'ID of the relationship to update',
            },
            type: {
              type: 'string',
              description: 'New relationship type',
              enum: [
                'related',
                'extends',
                'implements',
                'uses',
                'similar',
                'alternative',
                'complements',
                'conflicts',
                'prerequisite',
                'successor',
              ],
            },
            strength: {
              type: 'number',
              description: 'New relationship strength (0.0 to 1.0)',
              minimum: 0.0,
              maximum: 1.0,
            },
            description: {
              type: 'string',
              description: 'New relationship description',
              minLength: 10,
              maxLength: 500,
            },
          },
          required: ['relationship_id'],
        },
      },
      {
        name: 'delete_relationship',
        description: 'Delete a relationship between two patterns',
        inputSchema: {
          type: 'object',
          properties: {
            source_pattern_id: {
              type: 'string',
              description: 'ID of the source pattern',
            },
            target_pattern_id: {
              type: 'string',
              description: 'ID of the target pattern',
            },
          },
          required: ['source_pattern_id', 'target_pattern_id'],
        },
      },
    ];
  }

  /**
   * Handle list tools request
   */
  async handleListTools(): Promise<{ tools: Tool[] }> {
    return {
      tools: this.getTools(),
    };
  }

  /**
   * Handle tool calls
   */
  async handleToolCall(request: CallToolRequest): Promise<any> {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'suggest_pattern':
        return await this.handleSuggestPattern(args);
      case 'search_patterns':
        return await this.handleSearchPatterns(args);
      case 'analyze_code':
        return await this.handleAnalyzeCode(args);
      case 'update_pattern':
        return await this.handleUpdatePattern(args);
      case 'get_config':
        return await this.handleGetConfig(args);
      case 'set_config':
        return await this.handleSetConfig(args);
      case 'count_patterns':
        return await this.handleCountPatterns(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Handle suggest_pattern tool
   */
  private async handleSuggestPattern(args: any): Promise<any> {
    // Validate input
    if (!args.query || typeof args.query !== 'string' || args.query.length < 10) {
      throw new Error('Query must be at least 10 characters long');
    }

    if (args.code_context && args.code_context.length > 50000) {
      throw new Error('Code context exceeds maximum length of 50,000 characters');
    }

    // Create pattern request
    const request: PatternRequest = {
      id: crypto.randomUUID(),
      query: args.query,
      codeContext: args.code_context,
      programmingLanguage: args.programming_language,
      maxResults: args.max_results || 5,
      includeExamples: args.include_examples !== false,
      categoryFilter: args.category_filter,
      timestamp: new Date(),
      processingTime: 0,
    };

    const startTime = Date.now();

    try {
      // Get pattern recommendations
      const recommendations = await this.config.patternMatcher.findSimilarPatterns(request);

      const processingTime = Date.now() - startTime;
      request.processingTime = processingTime;

      // Format response according to contract
      return {
        request_id: request.id,
        recommendations: recommendations.map((rec, index) => ({
          pattern: {
            id: rec.pattern.id,
            name: rec.pattern.name,
            category: rec.pattern.category,
            description: rec.pattern.description,
            complexity: rec.pattern.complexity,
            tags: rec.pattern.tags,
          },
          score: rec.score || 0,
          rank: rec.rank,
          justification: rec.justification,
          implementation: rec.implementation,
          alternatives: rec.alternatives,
          context: rec.context,
        })),
        metadata: {
          total_results: recommendations.length,
          processing_time_ms: processingTime,
          search_strategy: 'hybrid',
          filters_applied: request.categoryFilter ? ['category'] : [],
        },
      };
    } catch (error) {
      throw new Error(
        `Pattern suggestion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle search_patterns tool
   */
  private async handleSearchPatterns(args: any): Promise<any> {
    // Validate input
    if (!args.query || typeof args.query !== 'string' || args.query.length < 2) {
      throw new Error('Query must be at least 2 characters long');
    }

    const searchType = args.search_type || 'hybrid';
    const limit = Math.min(args.limit || 10, 50);

    try {
      let results: any[];

      if (searchType === 'semantic') {
        // Use semantic search
        results = await this.config.semanticSearch.search(args.query, {
          limit,
          categoryFilter: args.category_filter,
        });
      } else if (searchType === 'keyword') {
        // Use keyword search
        results = await this.config.databaseManager.searchPatterns(args.query, {
          limit,
          categories: args.category_filter,
        });
      } else {
        // Hybrid search
        const semanticResults = await this.config.semanticSearch.search(args.query, {
          limit: Math.ceil(limit / 2),
          categoryFilter: args.category_filter,
        });

        const keywordResults = await this.config.databaseManager.searchPatterns(args.query, {
          limit: Math.ceil(limit / 2),
          categories: args.category_filter,
        });

        // Merge and deduplicate results
        results = this.mergeSearchResults(semanticResults, keywordResults, limit);
      }

      return {
        patterns: results.map(result => ({
          id: result.id,
          name: result.name,
          category: result.category,
          description: result.description,
          score: result.score || 0,
          match_type: result.matchType || 'unknown',
        })),
        total_results: results.length,
        search_metadata: {
          search_type_used: searchType,
          query: args.query,
          filters_applied: args.category_filter ? ['category'] : [],
        },
      };
    } catch (error) {
      throw new Error(
        `Pattern search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle analyze_code tool
   */
  private async handleAnalyzeCode(args: any): Promise<any> {
    // Validate input
    if (!args.code || typeof args.code !== 'string' || args.code.length < 10) {
      throw new Error('Code must be at least 10 characters long');
    }

    if (!args.language) {
      throw new Error('Programming language is required');
    }

    const analysisType = args.analysis_type || 'both';

    try {
      const analysis = await this.config.patternMatcher.analyzeCode(args.code, args.language);

      const result: any = {
        language: args.language,
        code_length: args.code.length,
        analysis_type: analysisType,
      };

      if (analysisType === 'identify_patterns' || analysisType === 'both') {
        result.identified_patterns = analysis.identifiedPatterns || [];
      }

      if (analysisType === 'suggest_improvements' || analysisType === 'both') {
        result.suggested_patterns = analysis.suggestedPatterns || [];
        result.improvement_suggestions = analysis.improvements || [];
      }

      return result;
    } catch (error) {
      throw new Error(
        `Code analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle update_pattern tool
   */
  private async handleUpdatePattern(args: any): Promise<any> {
    // Validate required fields
    const requiredFields = [
      'name',
      'category',
      'description',
      'problem',
      'solution',
      'use_cases',
      'complexity',
    ];
    for (const field of requiredFields) {
      if (!args[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    try {
      let operation: 'created' | 'updated';
      let patternId: string;

      if (args.pattern_id) {
        // Update existing pattern
        await this.config.databaseManager.updatePattern(args.pattern_id, {
          name: args.name,
          category: args.category,
          description: args.description,
          problem: args.problem,
          solution: args.solution,
          use_cases: args.use_cases,
          complexity: args.complexity,
        });
        operation = 'updated';
        patternId = args.pattern_id;
      } else {
        // Create new pattern
        const newPattern: Pattern = {
          id: crypto.randomUUID(),
          name: args.name,
          category: args.category,
          description: args.description,
          problem: args.problem || '',
          solution: args.solution || '',
          when_to_use: [], // Will be populated from analysis
          benefits: [], // Will be populated from analysis
          drawbacks: [], // Will be populated from analysis
          use_cases: args.use_cases.split(',').map((s: string) => s.trim()),
          implementations: [],
          complexity: args.complexity,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.config.databaseManager.savePattern(newPattern);
        operation = 'created';
        patternId = newPattern.id;
      }

      return {
        pattern_id: patternId,
        operation,
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Pattern update failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle get_config tool
   */
  private async handleGetConfig(args: any): Promise<any> {
    const category = args.category || 'all';

    try {
      const config: any = {};

      if (category === 'all') {
        // Return all configuration
        for (const [key, pref] of this.config.preferences) {
          if (!config[pref.category]) {
            config[pref.category] = {};
          }
          config[pref.category][key] = pref.settingValue;
        }
      } else {
        // Return specific category
        for (const [key, pref] of this.config.preferences) {
          if (pref.category === category) {
            config[key] = pref.settingValue;
          }
        }
      }

      return {
        configuration: config,
        category,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Configuration retrieval failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle set_config tool
   */
  private async handleSetConfig(args: any): Promise<any> {
    if (!args.settings || typeof args.settings !== 'object') {
      throw new Error('Settings must be a valid object');
    }

    if (!args.category) {
      throw new Error('Category is required');
    }

    try {
      const updatedSettings: string[] = [];

      for (const [key, value] of Object.entries(args.settings)) {
        const preference: UserPreference = {
          id: Date.now(), // Simple ID generation
          settingKey: key,
          settingValue: value,
          category: args.category,
          description: `User-configured ${key}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        this.config.preferences.set(key, preference);
        updatedSettings.push(key);
      }

      return {
        success: true,
        updated_settings: updatedSettings,
        category: args.category,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Configuration update failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle count_patterns tool
   */
  private async handleCountPatterns(args: any): Promise<any> {
    try {
      // Get all patterns to count them
      const patterns = await this.config.databaseManager.getAllPatterns();
      const total = patterns.length;

      if (args.includeDetails) {
        // Create category breakdown from patterns
        const categoryBreakdown: { [key: string]: number } = {};
        patterns.forEach(pattern => {
          categoryBreakdown[pattern.category] = (categoryBreakdown[pattern.category] || 0) + 1;
        });

        const breakdown = Object.entries(categoryBreakdown)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count);

        return {
          content: [
            {
              type: 'text',
              text:
                `## Total Design Patterns: ${total}\n\n` +
                `### Breakdown by Category:\n` +
                breakdown.map(item => `- **${item.category}**: ${item.count} patterns`).join('\n') +
                '\n\n' +
                `*Total patterns from all sources: ${total}*`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Total design patterns in database: **${total}**`,
            },
          ],
        };
      }
    } catch (error) {
      throw new Error(
        `Pattern count failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Merge search results from different sources
   */
  private mergeSearchResults(semanticResults: any[], keywordResults: any[], limit: number): any[] {
    const seen = new Set<string>();
    const merged: any[] = [];

    // Add semantic results first
    for (const result of semanticResults) {
      if (!seen.has(result.id) && merged.length < limit) {
        seen.add(result.id);
        merged.push({ ...result, matchType: 'semantic' });
      }
    }

    // Add keyword results
    for (const result of keywordResults) {
      if (!seen.has(result.id) && merged.length < limit) {
        seen.add(result.id);
        merged.push({ ...result, matchType: 'keyword' });
      }
    }

    return merged;
  }
}
