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
import { DatabaseManager } from './services/database-manager.js';
import { VectorOperationsService } from './services/vector-operations.js';
import { PatternMatcher } from './services/pattern-matcher.js';
import { SemanticSearchService } from './services/semantic-search.js';
import { LLMBridgeService } from './services/llm-bridge.js';
import { MigrationManager } from './services/migrations.js';
import { PatternSeeder } from './services/pattern-seeder.js';
import { logger } from './services/logger.js';
import { MCPRateLimiter } from './utils/rate-limiter.js';
import { SearchMediator, type SearchStrategy } from './handlers/search-mediator.js';
import { CacheService } from './services/cache.js';
import { InputValidator } from './utils/input-validation.js';
import { SimpleContainer, configureContainer, TOKENS } from './core/container.js';
import { MCPServerConfigBuilder, type MCPServerConfig } from './core/config-builder.js';
import { CANONICAL_TOOL_DEFINITIONS } from './mcp/canonical-tools.js';
import {
  buildPatternRequest,
  formatFindPatternsResult,
  formatSearchResultsFromRecommendations,
} from './mcp/tool-formatters.js';
import { formatPatternDetailsText } from './mcp/pattern-details-formatter.js';
import { formatHealthReportText } from './mcp/health-formatter.js';
import { startHttpServer } from './mcp/http-transport.js';
import type { PatternRow, PatternImplementation, CountResult } from './mcp/types.js';
import { resolvePatternsPath } from './core/path-resolver.js';
import { HealthCheckService } from './health/health-check-service.js';
import { HealthStatus } from './health/types.js';
import { DatabaseHealthCheck } from './health/database-health-check.js';
import { VectorOperationsHealthCheck } from './health/vector-operations-health-check.js';
import { LLMBridgeHealthCheck } from './health/llm-bridge-health-check.js';
import type { Logger } from './services/logger.js';

export type { MCPServerConfig } from './core/config-builder.js';
export { createHttpToolHandlers } from './mcp/http-tool-handlers.js';

class DesignPatternsMCPServer {
  private server: Server;
  private db: DatabaseManager;
  private vectorOps: VectorOperationsService;
  private patternMatcher: PatternMatcher;
  private searchMediator: SearchMediator;
  private semanticSearch!: SemanticSearchService;
  private llmBridge: LLMBridgeService | null = null;
  private migrationManager: MigrationManager;
  private patternSeeder: PatternSeeder;
  private config: MCPServerConfig;
  private rateLimiter: MCPRateLimiter;
  private container?: SimpleContainer;
  private logger: Logger;
  private healthCheckService?: HealthCheckService;

  constructor(
    configBuilder: MCPServerConfigBuilder | MCPServerConfig,
    container?: SimpleContainer
  ) {
    // Build configuration using Builder Pattern if provided, otherwise use legacy config
    this.config =
      configBuilder instanceof MCPServerConfigBuilder ? configBuilder.build() : configBuilder;
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
      this.searchMediator = container.getService<SearchMediator>(TOKENS.SEARCH_MEDIATOR);
      this.migrationManager = container.getService<MigrationManager>(TOKENS.MIGRATION_MANAGER);
      this.patternSeeder = container.getService<PatternSeeder>(TOKENS.PATTERN_SEEDER);
      this.rateLimiter = container.getService<MCPRateLimiter>(TOKENS.RATE_LIMITER);

      // Get health check service from container
      this.healthCheckService = container.getService<HealthCheckService>(
        TOKENS.HEALTH_CHECK_SERVICE
      );

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

      this.searchMediator = new SearchMediator(this.db, this.vectorOps, new CacheService(), {
        maxResults: 5,
        minConfidence: 0.05,
        useSemanticSearch: true,
        useKeywordSearch: true,
        useHybridSearch: this.config.enableHybridSearch ?? true,
        useFuzzyRefinement: this.config.enableFuzzyLogic ?? true,
        cacheResultsTTL: 1800000,
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

      // Register health checks (fallback mode)
      const dbCheck = new DatabaseHealthCheck(this.db);
      const vectorCheck = new VectorOperationsHealthCheck(this.vectorOps);
      const llmCheck = new LLMBridgeHealthCheck(this.llmBridge ?? null);

      this.healthCheckService.registerHealthCheck(dbCheck);
      this.healthCheckService.registerHealthCheck(vectorCheck);
      this.healthCheckService.registerHealthCheck(llmCheck);

      const patternsPath = resolvePatternsPath(import.meta.url);

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

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'design-patterns-mcp',
        version: '0.6.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      return { tools: CANONICAL_TOOL_DEFINITIONS };
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
    const request = buildPatternRequest(validatedArgs.query, {
      categories: validatedArgs.categories,
      maxResults: validatedArgs.maxResults,
      programmingLanguage: validatedArgs.programmingLanguage,
    });

    const recommendations = await this.searchMediator.search(request);

    return {
      content: [
        {
          type: 'text',
          text: formatFindPatternsResult(recommendations),
        },
      ],
    };
  }

  private async handleSearchPatterns(args: unknown): Promise<CallToolResult> {
    const validatedArgs = InputValidator.validateSearchPatternsArgs(args);
    const request = buildPatternRequest(validatedArgs.query, {
      maxResults: validatedArgs.limit,
    });
    const searchResult = await this.searchMediator.searchByType(
      request,
      validatedArgs.searchType as SearchStrategy
    );

    return {
      content: [
        {
          type: 'text',
          text: formatSearchResultsFromRecommendations(
            validatedArgs.query,
            searchResult.searchTypeUsed,
            searchResult.degraded,
            searchResult.recommendations
          ),
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

    return {
      content: [
        {
          type: 'text',
          text: formatPatternDetailsText(patternData, implementations),
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

      return {
        content: [
          {
            type: 'text',
            text: formatHealthReportText(report),
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
  private handleReadPatterns(): {
    contents: Array<{ uri: string; mimeType: string; text: string }>;
  } {
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

  private handleReadCategories(): {
    contents: Array<{ uri: string; mimeType: string; text: string }>;
  } {
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

  private handleReadServerInfo(): {
    contents: Array<{ uri: string; mimeType: string; text: string }>;
  } {
    const info = {
      name: 'Design Patterns MCP Server',
      version: '0.6.0',
      status: 'running',
      database: {
        path: this.config.databasePath,
        patternCount:
          this.db.queryOne<CountResult>('SELECT COUNT(*) as count FROM patterns')?.count ?? 0,
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

  startHttp(): Promise<void> {
    return startHttpServer({
      config: this.config,
      mcpServer: this.server,
      healthService: this.healthCheckService,
      logger: this.logger,
      healthCacheTtlMs: this.config.healthCacheTtlMs,
    });
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

  const server = createDesignPatternsServerWithDI(config);

  try {
    await server.initialize();

    const transportMode = config.transportMode ?? 'stdio';
    if (transportMode === 'http') {
      logger.info('main', 'Starting server in HTTP mode');
      await server.startHttp();
    } else {
      logger.info('main', 'Starting server in stdio mode');
      await server.start();
    }
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
      logger.error(
        'main',
        'Error during SIGINT shutdown',
        error instanceof Error ? error : new Error(String(error))
      );
      process.exit(1);
    });
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((error: unknown) => {
      logger.error(
        'main',
        'Error during SIGTERM shutdown',
        error instanceof Error ? error : new Error(String(error))
      );
      process.exit(1);
    });
  });
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error(
      'main',
      'Fatal error',
      error instanceof Error ? error : new Error(String(error))
    );
    process.exit(1);
  });
}
