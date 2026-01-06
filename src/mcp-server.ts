#!/usr/bin/env node
/**
 * MCP Server for Design Patterns
 * Main server implementation following MCP protocol
 * Simplified and clean implementation focusing on core functionality
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import { fileURLToPath } from 'url';

import { DatabaseManager } from './services/database-manager.js';
import { VectorOperationsService } from './services/vector-operations.js';
import { PatternMatcher } from './services/pattern-matcher.js';
import { SemanticSearchService } from './services/semantic-search.js';
import { LLMBridgeService } from './services/llm-bridge.js';
import { MigrationManager } from './services/migrations.js';
import { PatternSeeder } from './services/pattern-seeder.js';
import { logger } from './services/logger.js';
import { parseTags, parseArrayProperty } from './utils/parse-tags.js';
import { MCPRateLimiter } from './utils/rate-limiter.js';
import { InputValidator } from './utils/input-validation.js';
import { SimpleContainer, configureContainer, TOKENS } from './core/container.js';
import { MCPServerConfigBuilder } from './core/config-builder.js';
import { HealthCheckService } from './health/health-check-service.js';
import { HealthStatus } from './health/types.js';
import type { Logger } from './services/logger.js';

export interface MCPServerConfig {
  databasePath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableLLM: boolean;
  maxConcurrentRequests: number;
  enableFuzzyLogic?: boolean;
}

interface PatternRow {
  id: string;
  name: string;
  category: string;
  description?: string;
  when_to_use?: string;
  benefits?: string;
  drawbacks?: string;
  use_cases?: string;
  complexity?: string;
  tags?: string;
  examples?: string;
  created_at?: string;
}

interface PatternExample {
  language: string;
  code: string;
  description?: string;
  explanation?: string;
}

interface CountResult {
  count: number;
}

interface PatternImplementation {
  language: string;
  code: string;
  explanation?: string;
}

class DesignPatternsMCPServer {
  private server: Server;
  private db: DatabaseManager;
  private vectorOps: VectorOperationsService;
  private patternMatcher: PatternMatcher;
  private semanticSearch!: SemanticSearchService;
  private llmBridge: LLMBridgeService | null = null;
  private migrationManager: MigrationManager;
  private patternSeeder: PatternSeeder;
  private config: MCPServerConfig;
  private rateLimiter: MCPRateLimiter;
  private container?: SimpleContainer;
  private logger: Logger;
  private healthCheckService?: HealthCheckService;

  constructor(configBuilder: MCPServerConfigBuilder | MCPServerConfig, container?: SimpleContainer) {
    // Build configuration using Builder Pattern if provided, otherwise use legacy config
    this.config = configBuilder instanceof MCPServerConfigBuilder
      ? configBuilder.build()
      : configBuilder;
    this.container = container;

    // Use logger from container if available, otherwise use global logger
    this.logger = container ? container.getService<Logger>(TOKENS.LOGGER) : logger;

    // Initialize health check service
    this.healthCheckService = new HealthCheckService({ enabled: true, timeout: 30000 });



    // Use DI container if provided, otherwise fallback to direct instantiation
    if (container) {
      // Resolve dependencies from container
    this.db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    this.vectorOps = container.getService<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
    this.semanticSearch = container.getService<SemanticSearchService>(TOKENS.SEMANTIC_SEARCH);
    this.patternMatcher = container.getService<PatternMatcher>(TOKENS.PATTERN_MATCHER);
    this.migrationManager = container.getService<MigrationManager>(TOKENS.MIGRATION_MANAGER);
    this.patternSeeder = container.getService<PatternSeeder>(TOKENS.PATTERN_SEEDER);
    this.rateLimiter = container.getService<MCPRateLimiter>(TOKENS.RATE_LIMITER);

    // Get health check service from container
    this.healthCheckService = container.getService<HealthCheckService>(TOKENS.HEALTH_CHECK_SERVICE);

      // Optional LLM bridge
      if (this.config.enableLLM && container.has(TOKENS.LLM_BRIDGE)) {
        this.llmBridge = container.getService<LLMBridgeService>(TOKENS.LLM_BRIDGE);
      }
    } else {
      // Fallback to direct instantiation for backward compatibility
      // Initialize database
      this.db = new DatabaseManager({
        filename: this.config.databasePath,
        options: {
        verbose:
          this.config.logLevel === 'debug'
            ? (message: string) => this.logger.debug('database', message)
            : undefined,
        },
      });

      // Initialize services
      this.vectorOps = new VectorOperationsService(this.db, {
        model: 'all-MiniLM-L6-v2',
        dimensions: 384,
        similarityThreshold: 0.3,
        maxResults: 10,
        cacheEnabled: true,
      });

      // Initialize semantic search service
      this.semanticSearch = new SemanticSearchService(this.db, this.vectorOps, {
        modelName: 'all-MiniLM-L6-v2',
        maxResults: 10,
        similarityThreshold: 0.3,
        contextWindow: 512,
        useQueryExpansion: false,
        useReRanking: true,
      });

      this.patternMatcher = new PatternMatcher(this.db, this.vectorOps, {
        maxResults: 5,
        minConfidence: 0.05, // Lower threshold for more results
        useSemanticSearch: true,
        useKeywordSearch: true,
        useHybridSearch: true,
        semanticWeight: 0.7,
        keywordWeight: 0.3,
        useFuzzyRefinement: this.config.enableFuzzyLogic ?? true, // Enable fuzzy refinement by default
      });

      if (this.config.enableLLM) {
        this.llmBridge = new LLMBridgeService(this.db, {

          provider: 'ollama',
          model: 'llama3.2',
          maxTokens: 2000,
          temperature: 0.3,
          timeout: 30000, // 30 seconds
        });
      }

      // Get the directory of the current module
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      // Resolve path relative to project root
      // When running from src/, no need to go up
      // When running from dist/src/, go up two levels
      const isCompiled = __dirname.includes('dist');
      const projectRoot = isCompiled
        ? path.resolve(__dirname, '..', '..')
        : path.resolve(__dirname, '..');
      const patternsPath = path.join(projectRoot, 'data', 'patterns');

      this.migrationManager = new MigrationManager(this.db);
      this.patternSeeder = new PatternSeeder(this.db, {
        patternsPath,
        batchSize: 100,
        skipExisting: true,
      });

      // Initialize rate limiter
      this.rateLimiter = new MCPRateLimiter({
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 1000,
        maxConcurrentRequests: this.config.maxConcurrentRequests,
        burstLimit: 20,
      });
    }

    // Initialize services
    this.vectorOps = new VectorOperationsService(this.db, {
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      similarityThreshold: 0.3,
      maxResults: 10,
      cacheEnabled: true,
    });

    // Initialize semantic search service
    this.semanticSearch = new SemanticSearchService(this.db, this.vectorOps, {
      modelName: 'all-MiniLM-L6-v2',
      maxResults: 10,
      similarityThreshold: 0.3,
      contextWindow: 512,
      useQueryExpansion: false,
      useReRanking: true,
    });

    this.patternMatcher = new PatternMatcher(this.db, this.vectorOps, {
      maxResults: 5,
      minConfidence: 0.05, // Lower threshold for more results
      useSemanticSearch: true,
      useKeywordSearch: true,
      useHybridSearch: true,
      semanticWeight: 0.7,
      keywordWeight: 0.3,
        useFuzzyRefinement: this.config.enableFuzzyLogic ?? true, // Enable fuzzy refinement by default
    });

    if (this.config.enableLLM) {
      this.llmBridge = new LLMBridgeService(this.db, {
        provider: 'ollama',
        model: 'llama3.2',
        maxTokens: 2000,
        temperature: 0.3,
        timeout: 30000, // 30 seconds
      });
    }

    // Get the directory of the current module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Resolve path relative to project root
    // When running from src/, no need to go up
    // When running from dist/src/, go up two levels
    const isCompiled = __dirname.includes('dist');
    const projectRoot = isCompiled
      ? path.resolve(__dirname, '..', '..')
      : path.resolve(__dirname, '..');
    const patternsPath = path.join(projectRoot, 'data', 'patterns');

    this.migrationManager = new MigrationManager(this.db);
    this.patternSeeder = new PatternSeeder(this.db, {
      patternsPath,
      batchSize: 100,
      skipExisting: true,
    });

    // Initialize rate limiter
    this.rateLimiter = new MCPRateLimiter({
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
      burstLimit: 20,
    });

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'design-patterns-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      return {
        tools: [
          {
            name: 'find_patterns',
            description:
              'Find design patterns matching a problem description using semantic search',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Natural language description of the problem or requirements',
                },
                categories: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional: Pattern categories to search in',
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of recommendations to return',
                  default: 5,
                },
                programmingLanguage: {
                  type: 'string',
                  description: 'Target programming language for implementation examples',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'search_patterns',
            description: 'Search patterns by keyword or semantic similarity',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query',
                },
                searchType: {
                  type: 'string',
                  enum: ['keyword', 'semantic', 'hybrid'],
                  default: 'hybrid',
                },
                limit: {
                  type: 'number',
                  default: 10,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_pattern_details',
            description: 'Get detailed information about a specific pattern',
            inputSchema: {
              type: 'object',
              properties: {
                patternId: {
                  type: 'string',
                  description: 'Pattern ID to get details for',
                },
              },
              required: ['patternId'],
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
            name: 'get_health_status',
            description: 'Get the health status of all system services',
            inputSchema: {
              type: 'object',
              properties: {
                checkName: {
                  type: 'string',
                  description: 'Optional: Check only a specific health check by name',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional: Filter health checks by tags (e.g., ["database", "critical"])',
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls with rate limiting
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      // Apply rate limiting to tool calls
      const rateLimitedHandler = this.rateLimiter.wrapToolHandler(
        async (toolName: string, toolArgs: unknown) => {
          switch (toolName) {
            case 'find_patterns':
              return await this.handleFindPatterns(toolArgs);
            case 'search_patterns':
              return await this.handleSearchPatterns(toolArgs);
            case 'get_pattern_details':
              return await this.handleGetPatternDetails(toolArgs);
            case 'count_patterns':
              return this.handleCountPatterns(toolArgs);
            case 'get_health_status':
              return await this.handleGetHealthStatus(toolArgs);
            default:
              throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
          }
        },
        name
      );

      return await rateLimitedHandler(name, args);
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, () => {
      return {
        resources: [
          {
            uri: 'patterns',
            name: 'Design Patterns',
            description: 'Complete catalog of design patterns',
            mimeType: 'application/json',
          },
          {
            uri: 'categories',
            name: 'Pattern Categories',
            description: 'All available pattern categories',
            mimeType: 'application/json',
          },
          {
            uri: 'server_info',
            name: 'Server Information',
            description: 'Server status and configuration',
            mimeType: 'application/json',
          },
        ],
      };
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, request => {
      const { uri } = request.params;

      switch (uri) {
        case 'patterns':
          return this.handleReadPatterns();
        case 'categories':
          return this.handleReadCategories();
        case 'server_info':
          return this.handleReadServerInfo();
        default:
          throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }
    });

    // Error handling
    this.server.onerror = error => {
      this.logger.error(
        'mcp-server',
        'Server error',
        error instanceof Error ? error : new Error(String(error))
      );
    };
  }

  // Tool handlers
  private async handleFindPatterns(args: unknown): Promise<CallToolResult> {
    const validatedArgs = InputValidator.validateFindPatternsArgs(args);
    const request = {
      id: crypto.randomUUID(),
      query: validatedArgs.query,
      categories: validatedArgs.categories,
      maxResults: validatedArgs.maxResults,
      programmingLanguage: validatedArgs.programmingLanguage,
    };

    const recommendations = await this.patternMatcher.findMatchingPatterns(request);

    return {
      content: [
        {
          type: 'text',
          text:
            `Found ${recommendations.length} pattern recommendations:\n\n` +
            recommendations
              .map(
                (rec, index) =>
                  `${index + 1}. **${rec.pattern.name}** (${rec.pattern.category})\n` +
                  `   Confidence: ${(rec.confidence * 100).toFixed(1)}%\n` +
                  `   Rationale: ${rec.justification.primaryReason}\n` +
                  `   Benefits: ${rec.justification.benefits.join(', ')}\n`
              )
              .join('\n'),
        },
      ],
    };
  }

  private async handleSearchPatterns(args: unknown): Promise<CallToolResult> {
    const validatedArgs = InputValidator.validateSearchPatternsArgs(args);
    const query = {
      text: validatedArgs.query,
      filters: {},
      options: {
        limit: validatedArgs.limit,
        includeMetadata: true,
      },
    };

    const results = await this.semanticSearch.search(query);

    return {
      content: [
        {
          type: 'text',
          text:
            `Search results for "${validatedArgs.query}":\n\n` +
            results
              .map(
                (result, index) =>
                  `${index + 1}. **${result.pattern.name}** (${result.pattern.category})\n` +
                  `   Score: ${(result.score * 100).toFixed(1)}%\n` +
                  `   Description: ${result.pattern.description}\n`
              )
              .join('\n'),
        },
      ],
    };
  }

  private async handleGetPatternDetails(args: unknown): Promise<CallToolResult> {
    const validatedArgs = InputValidator.validateGetPatternDetailsArgs(args);
    const pattern = this.db.queryOne<PatternRow>(
      `
      SELECT id, name, category, description, when_to_use, benefits,
             drawbacks, use_cases, complexity, tags, examples, created_at
      FROM patterns WHERE id = ?
    `,
      [validatedArgs.patternId]
    );

    if (!pattern) {
      // Try to find similar patterns using semantic search
      const similarPatterns = await this.semanticSearch.search({
        text: validatedArgs.patternId,
        options: {
          limit: 3,
          includeMetadata: true,
        },
      });

      if (similarPatterns.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Pattern "${validatedArgs.patternId}" not found. Here are similar patterns:\n\n${similarPatterns
                .map(
                  (p, i) =>
                    `${i + 1}. **${p.pattern.name}** (${p.pattern.category})\n   ${p.pattern.description}\n   Score: ${(p.score * 100).toFixed(1)}%`
                )
                .join('\n\n')}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Pattern "${validatedArgs.patternId}" not found and no similar patterns were found.`,
            },
          ],
        };
      }
    }

    // At this point pattern is guaranteed to exist
    const patternData: PatternRow = pattern;

    const implementations = this.db.query<PatternImplementation>(
      `
      SELECT language, code, explanation FROM pattern_implementations
      WHERE pattern_id = ? LIMIT 3
    `,
      [validatedArgs.patternId]
    );

    // Parse code examples if available
    let examplesText = '';
    if (patternData.examples) {
      try {
        const examples = JSON.parse(patternData.examples) as Record<string, PatternExample>;
        const exampleKeys = Object.keys(examples);

        if (exampleKeys.length > 0) {
          examplesText = '\n\n**Code Examples:**\n';
          exampleKeys.forEach(lang => {
            const example = examples[lang];
            examplesText += `\n### ${lang.charAt(0).toUpperCase() + lang.slice(1)}\n`;
            if (example.description) {
              examplesText += `${example.description}\n\n`;
            }
            examplesText += `\`\`\`${lang}\n${example.code}\n\`\`\`\n`;
          });
        }
      } catch (e) {
        // If parsing fails, skip examples
      }
    }

    return {
      content: [
        {
          type: 'text',
          text:
            `# ${patternData.name} (${patternData.category})\n\n` +
            `**Description:** ${patternData.description ?? 'No description available'}\n\n` +
            `**When to Use:** ${parseArrayProperty(patternData.when_to_use).join(', ')}\n\n` +
            `**Benefits:** ${parseArrayProperty(patternData.benefits).join(', ')}\n\n` +
            `**Drawbacks:** ${parseArrayProperty(patternData.drawbacks).join(', ')}\n\n` +
            `**Use Cases:** ${parseArrayProperty(patternData.use_cases).join(', ')}\n\n` +
            `**Complexity:** ${patternData.complexity ?? 'Unknown'}\n\n` +
            `**Tags:** ${parseTags(patternData.tags).join(', ')}\n` +
            examplesText +
            (implementations.length > 0
              ? `\n\n**Implementations:**\n` +
                implementations
                  .map(
                    impl =>
                      `\n### ${impl.language}\n\`\`\`${impl.language.toLowerCase()}\n${impl.code}\n\`\`\`\n${impl.explanation}`
                  )
                  .join('\n')
              : ''),
        },
      ],
    };
  }

  private handleCountPatterns(args: unknown): CallToolResult {
    try {
      const validatedArgs = InputValidator.validateCountPatternsArgs(args);
      // OPTIMIZATION: Use COUNT instead of loading all rows
      const totalResult = this.db.queryOne<{ total: number }>(
        'SELECT COUNT(*) as total FROM patterns'
      );
      const total = totalResult?.total ?? 0;

      if (validatedArgs.includeDetails) {
        // Get category breakdown efficiently
        const breakdown = this.db.query<{ category: string; count: number }>(
          'SELECT category, COUNT(*) as count FROM patterns GROUP BY category ORDER BY count DESC'
        );

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
      throw new McpError(
        ErrorCode.InternalError,
        `Pattern count failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleGetHealthStatus(args: unknown): Promise<CallToolResult> {
    try {
      if (!this.healthCheckService) {
        return {
          content: [
            {
              type: 'text',
              text: 'Health check service is not available. Health checks require DI container initialization.',
            },
          ],
        };
      }

      const validatedArgs = InputValidator.validateGetHealthStatusArgs(args);

      let report;
      if (validatedArgs.checkName) {
        // Get specific health check
        const result = await this.healthCheckService.check(validatedArgs.checkName);
        report = {
          overall: result.status,
          timestamp: new Date().toISOString(),
          duration: result.duration,
          checks: [result],
          summary: {
            total: 1,
            healthy: result.status === HealthStatus.HEALTHY ? 1 : 0,
            degraded: result.status === HealthStatus.DEGRADED ? 1 : 0,
            unhealthy: result.status === HealthStatus.UNHEALTHY ? 1 : 0,
            unknown: result.status === HealthStatus.UNKNOWN ? 1 : 0,
          },
        };
      } else if (validatedArgs.tags && validatedArgs.tags.length > 0) {
        // Get health checks by tags
        report = await this.healthCheckService.checkByTags(validatedArgs.tags);
      } else {
        // Get all health checks
        report = await this.healthCheckService.checkAll();
      }

      // Format the response
      let response = `## System Health Report\n\n`;
      response += `**Overall Status:** ${report.overall.toUpperCase()}\n`;
      response += `**Timestamp:** ${new Date(report.timestamp).toLocaleString()}\n`;
      response += `**Total Duration:** ${Math.round(report.duration)}ms\n\n`;

      response += `### Summary\n`;
      response += `- **Total Checks:** ${report.summary.total}\n`;
      response += `- **Healthy:** ${report.summary.healthy}\n`;
      response += `- **Degraded:** ${report.summary.degraded}\n`;
      response += `- **Unhealthy:** ${report.summary.unhealthy}\n`;
      response += `- **Unknown:** ${report.summary.unknown}\n\n`;

      response += `### Individual Check Results\n\n`;
      report.checks.forEach((check, index) => {
        response += `${index + 1}. **${check.name}**\n`;
        response += `   - **Status:** ${check.status.toUpperCase()}\n`;
        response += `   - **Duration:** ${Math.round(check.duration)}ms\n`;
        response += `   - **Message:** ${check.message}\n`;

        if (check.details) {
          response += `   - **Details:** ${JSON.stringify(check.details, null, 2)}\n`;
        }

        if (check.tags && check.tags.length > 0) {
          response += `   - **Tags:** ${check.tags.join(', ')}\n`;
        }

        response += `\n`;
      });

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Resource handlers
  private handleReadPatterns(): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
    // OPTIMIZATION: Add pagination with LIMIT to prevent loading all 574+ patterns
    const patterns = this.db.query(
      'SELECT id, name, category, description, complexity, tags FROM patterns ORDER BY name LIMIT 100'
    );

    return {
      contents: [
        {
          uri: 'patterns',
          mimeType: 'application/json',
          text: JSON.stringify(patterns, null, 2),
        },
      ],
    };
  }

  private handleReadCategories(): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
    const categories = this.db.query(`
      SELECT category, COUNT(*) as count 
      FROM patterns 
      GROUP BY category 
      ORDER BY category
    `);

    return {
      contents: [
        {
          uri: 'categories',
          mimeType: 'application/json',
          text: JSON.stringify(categories, null, 2),
        },
      ],
    };
  }

  private handleReadServerInfo(): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
    const info = {
      name: 'Design Patterns MCP Server',
      version: '0.1.0',
      status: 'running',
      database: {
        path: this.config.databasePath,
        patternCount: this.db.queryOne<CountResult>('SELECT COUNT(*) as count FROM patterns')?.count ?? 0,
      },
      features: {
        semanticSearch: true,
        llmBridge: this.config.enableLLM,
        caching: true,
      },
      config: {
        logLevel: this.config.logLevel,
        maxConcurrentRequests: this.config.maxConcurrentRequests,
      },
    };

    return {
      contents: [
        {
          uri: 'server_info',
          mimeType: 'application/json',
          text: JSON.stringify(info, null, 2),
        },
      ],
    };
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('mcp-server', 'Initializing Design Patterns MCP Server', {
        databasePath: this.config.databasePath,
        logLevel: this.config.logLevel,
      });

      await this.db.initialize();
      this.migrationManager.initialize();
      await this.migrationManager.migrate();
      await this.patternSeeder.seedAll();

      // LLMBridge doesn't require initialization
      if (this.llmBridge) {
        this.logger.info('mcp-server', 'LLM Bridge configured');
      }

      this.logger.info('mcp-server', 'Design Patterns MCP Server initialized successfully');
    } catch (error) {
      this.logger.error(
        'mcp-server',
        'Failed to initialize server',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('mcp-server', 'Server started and listening on stdio');
  }

  async stop(): Promise<void> {
    try {
      await this.db.close();
      await this.server.close();
      this.logger.info('mcp-server', 'Server stopped');
    } catch (error) {
      this.logger.error(
        'mcp-server',
        'Error stopping server',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }
}

// Export server creation functions
export function createDesignPatternsServer(config: MCPServerConfig): DesignPatternsMCPServer {
  return new DesignPatternsMCPServer(config);
}

// Create server with dependency injection (recommended)
export function createDesignPatternsServerWithDI(config: MCPServerConfig): DesignPatternsMCPServer {
  const container = configureContainer(config);
  return new DesignPatternsMCPServer(config, container);
}

// Main execution when run directly
async function main(): Promise<void> {
  // Build configuration using Builder Pattern
  const config = MCPServerConfigBuilder.fromEnvironment().build();

  const server = createDesignPatternsServer(config);

  try {
    await server.initialize();
    await server.start();
  } catch (error) {
    logger.error(
      'main',
      'Failed to start server',
      error instanceof Error ? error : new Error(String(error))
    );
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info('main', `Received ${signal}, shutting down gracefully`);
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      logger.error(
        'main',
        'Error during shutdown',
        error instanceof Error ? error : new Error(String(error))
      );
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((error: unknown) => {
      logger.error('main', 'Error during SIGINT shutdown', error instanceof Error ? error : new Error(String(error)));
      process.exit(1);
    });
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((error: unknown) => {
      logger.error('main', 'Error during SIGTERM shutdown', error instanceof Error ? error : new Error(String(error)));
      process.exit(1);
    });
  });
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
