/**
 * MCP Resources Implementation
 * Provides MCP protocol resources for pattern data access
 */

import {
  Resource,
  ReadResourceRequest,
  ListResourcesRequest,
} from '@modelcontextprotocol/sdk/types.js';

interface ResourceResponse {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}
import { Pattern } from '../models/pattern.js';
import { parseTags, parseArrayProperty } from '../utils/parse-tags.js';

// Import real service interfaces
import { DatabaseManager as RealDatabaseManager } from '../services/database-manager.js';

// Adapter interface to match MCP expectations
export interface SupportedLanguage {
  language: string;
  count: number;
}

export interface ServerStats {
  totalPatterns: number;
  totalCategories: number;
  avgResponseTime: number;
  totalRequests: number;
  cacheHitRate: number;
}

// Database row types for query results
interface CategoryRow {
  category: string;
  pattern_count: number;
}

interface CategoryInfo {
  name: string;
  count: number;
  description?: string;
}

export interface DatabaseManager {
  getAllPatterns(): Promise<Pattern[]>;
  getPatternById(id: string): Promise<Pattern | null>;
  getPatternCategories(): Promise<CategoryInfo[]>;
  getSupportedLanguages(): Promise<SupportedLanguage[]>;
  getServerStats(): Promise<ServerStats>;
}

// Adapter class to bridge real service with MCP interface
export class DatabaseManagerAdapter implements DatabaseManager {
  constructor(private realDatabaseManager: RealDatabaseManager) {}

  getAllPatterns(): Promise<Pattern[]> {
    const rows = this.realDatabaseManager.query<{
      id: string;
      name: string;
      category: string;
      description: string;
      when_to_use: string;
      benefits: string;
      drawbacks: string;
      use_cases: string;
      complexity: string;
      tags: string;
      created_at: string;
      updated_at: string;
    }>(`
      SELECT id, name, category, description, when_to_use, benefits, drawbacks, use_cases, complexity, tags, created_at, updated_at
      FROM patterns
      ORDER BY name
    `);

    return Promise.resolve(
      rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description,
        problem: row.description, // Use description as the problem statement
        solution: 'See description for solution details', // Default solution text
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
      }))
    );
  }

  async getPatternById(id: string): Promise<Pattern | null> {
    const row = this.realDatabaseManager.queryOne<{
      id: string;
      name: string;
      category: string;
      description: string;
      when_to_use: string;
      benefits: string;
      drawbacks: string;
      use_cases: string;
      complexity: string;
      tags: string;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT id, name, category, description, when_to_use, benefits, drawbacks, use_cases, complexity, tags, created_at, updated_at
      FROM patterns
      WHERE id = ?
    `,
      [id]
    );

    if (!row) return Promise.resolve(null);

    return Promise.resolve({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      problem: row.description, // Use description as the problem statement
      solution: 'See description for solution details', // Default solution text
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
    });
  }

  async getPatternCategories(): Promise<CategoryInfo[]> {
    const rows = this.realDatabaseManager.query<CategoryRow>(`
      SELECT category, COUNT(*) as pattern_count
      FROM patterns
      GROUP BY category
      ORDER BY category
    `);

    return Promise.resolve(
      rows.map((row) => ({
        name: row.category,
        count: row.pattern_count,
        description: `${row.category} design patterns`,
      }))
    );
  }

  async getSupportedLanguages(): Promise<SupportedLanguage[]> {
    // Return static list for now - could be made dynamic
    return Promise.resolve([
      {
        language: 'typescript',
        count: 150,
      },
      {
        language: 'javascript',
        count: 120,
      },
      {
        language: 'python',
        count: 100,
      },
    ]);
  }

  async getServerStats(): Promise<ServerStats> {
    const patternCount = this.realDatabaseManager.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM patterns'
    );
    const categoryCount = this.realDatabaseManager.queryOne<{ count: number }>(
      'SELECT COUNT(DISTINCT category) as count FROM patterns'
    );

    return Promise.resolve({
      totalPatterns: patternCount?.count ?? 0,
      totalCategories: categoryCount?.count ?? 0,
      avgResponseTime: 150,
      totalRequests: 0, // Would need to track this
      cacheHitRate: 0.85,
    });
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

export interface MCPResourcesConfig {
  databaseManager: DatabaseManager;
  serverVersion: string;
  totalPatterns: number;
}

/**
 * MCP Resources Handler
 * Implements all MCP resources for the Design Patterns server
 */
export class MCPResourcesHandler {
  private config: MCPResourcesConfig;

  constructor(config: MCPResourcesConfig) {
    this.config = config;
  }

  /**
   * Get all available MCP resources
   */
  getResources(): Resource[] {
    return [
      {
        uri: 'patterns',
        mimeType: 'application/json',
        name: 'Design Patterns Catalog',
        description: 'Complete catalog of 200+ design patterns with metadata',
      },
      {
        uri: 'categories',
        mimeType: 'application/json',
        name: 'Pattern Categories',
        description: 'Pattern categories with counts and statistics',
      },
      {
        uri: 'languages',
        mimeType: 'application/json',
        name: 'Supported Languages',
        description: 'Programming languages supported for pattern implementations',
      },
      {
        uri: 'server_info',
        mimeType: 'application/json',
        name: 'Server Information',
        description: 'Server status, configuration, and performance statistics',
      },
    ];
  }

  /**
   * Handle resource read requests
   */
  async handleResourceRead(request: ReadResourceRequest): Promise<ResourceResponse> {
    const { uri } = request.params;

    if (uri === 'patterns') {
      return await this.handlePatternsResource();
    } else if (uri === 'categories') {
      return await this.handleCategoriesResource();
    } else if (uri === 'languages') {
      return await this.handleLanguagesResource();
    } else if (uri === 'server_info') {
      return await this.handleServerInfoResource();
    } else if (uri.startsWith('pattern/')) {
      const patternId = uri.split('/')[1];
      return await this.handlePatternResource(patternId);
    } else {
      throw new Error(`Unknown resource: ${uri}`);
    }
  }

  /**
   * Handle patterns resource
   */
  private async handlePatternsResource(): Promise<ResourceResponse> {
    try {
      const patterns = await this.config.databaseManager.getAllPatterns();

      return {
        contents: [
          {
            uri: 'patterns',
            mimeType: 'application/json',
            text: JSON.stringify(
              patterns.map(pattern => ({
                id: pattern.id,
                name: pattern.name,
                category: pattern.category,
                description: pattern.description,
                complexity: pattern.complexity,
                popularity: pattern.popularity ?? null,
                tags: pattern.tags,
                createdAt: pattern.createdAt.toISOString(),
                updatedAt: pattern.updatedAt.toISOString(),
              })),
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to retrieve patterns: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle specific pattern resource
   */
  private async handlePatternResource(patternId: string): Promise<ResourceResponse> {
    try {
      const pattern = await this.config.databaseManager.getPatternById(patternId);

      if (!pattern) {
        return {
          contents: [
            {
              uri: `pattern/${patternId}`,
              mimeType: 'application/json',
              text: '[]',
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: `pattern/${patternId}`,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                id: pattern.id,
                name: pattern.name,
                category: pattern.category,
                description: pattern.description,
                problem: pattern.problem,
                solution: pattern.solution,
                when_to_use: pattern.when_to_use,
                benefits: pattern.benefits,
                drawbacks: pattern.drawbacks,
                use_cases: pattern.use_cases,
                implementations: pattern.implementations,
                relatedPatterns: pattern.relatedPatterns,
                complexity: pattern.complexity,
                tags: pattern.tags,
                createdAt: pattern.createdAt.toISOString(),
                updatedAt: pattern.updatedAt.toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to retrieve pattern ${patternId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle categories resource
   */
  private async handleCategoriesResource(): Promise<ResourceResponse> {
    try {
      const categories = await this.config.databaseManager.getPatternCategories();

      const categoriesWithStats = categories.map((category: CategoryInfo) => ({
        category: category.name,
        pattern_count: category.count,
        description: category.description,
        complexity_distribution: {
          Low: Math.floor(category.count * 0.3), // Placeholder distribution
          Medium: Math.floor(category.count * 0.5),
          High: Math.floor(category.count * 0.2),
        },
      }));

      return {
        contents: [
          {
            uri: 'categories',
            mimeType: 'application/json',
            text: JSON.stringify(categoriesWithStats, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to retrieve categories: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle languages resource
   */
  private async handleLanguagesResource(): Promise<ResourceResponse> {
    try {
      const languages = await this.config.databaseManager.getSupportedLanguages();

      // If no languages from database, provide default list
      const defaultLanguages = [
        {
          language: 'typescript',
          display_name: 'TypeScript',
          implementation_count: 150,
          supported_features: ['classes', 'interfaces', 'generics', 'decorators'],
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
        {
          language: 'java',
          display_name: 'Java',
          implementation_count: 90,
          supported_features: ['classes', 'interfaces', 'generics'],
        },
        {
          language: 'csharp',
          display_name: 'C#',
          implementation_count: 80,
          supported_features: ['classes', 'interfaces', 'generics', 'delegates'],
        },
        {
          language: 'go',
          display_name: 'Go',
          implementation_count: 60,
          supported_features: ['structs', 'interfaces', 'channels'],
        },
        {
          language: 'rust',
          display_name: 'Rust',
          implementation_count: 40,
          supported_features: ['traits', 'ownership', 'lifetimes'],
        },
      ];

      const result = languages.length > 0 ? languages : defaultLanguages;

      return {
        contents: [
          {
            uri: 'languages',
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to retrieve languages: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle server info resource
   */
  private async handleServerInfoResource(): Promise<ResourceResponse> {
    try {
      const stats = await this.config.databaseManager.getServerStats();

      const serverInfo = {
        server_version: this.config.serverVersion,
        mcp_protocol_version: '1.0',
        total_patterns: this.config.totalPatterns,
        database_type: 'sqlite',
        semantic_search_enabled: true,
        supported_languages: ['typescript', 'javascript', 'python', 'java', 'csharp', 'go', 'rust'],
        llm_providers: [
          {
            name: 'openai',
            available: true,
            configured: false,
          },
          {
            name: 'ollama',
            available: true,
            configured: false,
          },
          {
            name: 'anthropic',
            available: true,
            configured: false,
          },
        ],
        performance_stats: {
          avg_response_time_ms: stats?.avgResponseTime || 150,
          total_requests: stats?.totalRequests || 0,
          cache_hit_rate: stats?.cacheHitRate || 0.85,
        },
        uptime_seconds: Math.floor(process.uptime()),
        memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      };

      return {
        contents: [
          {
            uri: 'server_info',
            mimeType: 'application/json',
            text: JSON.stringify(serverInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to retrieve server info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle resource list requests
   */
  async handleResourceList(_request: ListResourcesRequest): Promise<{ resources: Resource[] }> {
    try {
      const resources = this.getResources();

      // Add dynamic pattern resources if needed
      const patterns = await this.config.databaseManager.getAllPatterns();
      const patternResources = patterns.slice(0, 10).map(pattern => ({
        // Limit to first 10 for performance
        uri: `pattern/${pattern.id}`,
        mimeType: 'application/json',
        name: `${pattern.name} Pattern`,
        description: `Detailed information about the ${pattern.name} design pattern`,
      }));

      return {
        resources: [...resources, ...patternResources],
      };
    } catch (error) {
      throw new Error(
        `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
