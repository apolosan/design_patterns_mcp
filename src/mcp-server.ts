#!/usr/bin/env node
/**
 * MCP Server for Design Patterns
 * Main server implementation following MCP protocol
 * Simplified and clean implementation focusing on core functionality
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  CallToolRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { logger } from './services/logger.js';
import { SimpleContainer, configureContainer } from './core/container.js';
import { MCPServerConfigBuilder } from './core/config-builder.js';
import { ServerFacade, type InitializedServices } from './facades/server-facade.js';
import { ToolHandlerImplementations, ResourceHandlerImplementations } from './handlers/tool-handler-implementations.js';

export interface MCPServerConfig {
  databasePath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableLLM: boolean;
  maxConcurrentRequests: number;
  enableFuzzyLogic?: boolean;
  enableTelemetry?: boolean;
  enableHybridSearch?: boolean;
  enableGraphAugmentation?: boolean;
  embeddingCompression?: boolean;
  transportMode?: 'stdio' | 'http';
  httpPort?: number;
  mcpEndpoint?: string;
  healthCheckPath?: string;
}

class DesignPatternsMCPServer {
  private server: Server;
  private config: MCPServerConfig;
  private facade: ServerFacade;
  private services: InitializedServices | null = null;
  private toolHandlers: ToolHandlerImplementations | null = null;
  private resourceHandlers: ResourceHandlerImplementations | null = null;

  constructor(configBuilder: MCPServerConfigBuilder | MCPServerConfig, container?: SimpleContainer) {
    // Build configuration using Builder Pattern if provided, otherwise use legacy config
    this.config = configBuilder instanceof MCPServerConfigBuilder
      ? configBuilder.build()
      : configBuilder;

    this.facade = new ServerFacade(this.config, container || null);

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'design-patterns-mcp',
        version: '0.4.3',
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

      if (!this.services || !this.toolHandlers) {
        throw new McpError(ErrorCode.InternalError, 'Server not initialized');
      }

      const toolHandlers = this.toolHandlers;

      // Apply rate limiting to tool calls
      const rateLimitedHandler = this.services.rateLimiter.wrapToolHandler(
        async (toolName: string, toolArgs: unknown) => {
          switch (toolName) {
            case 'find_patterns':
              return await toolHandlers.handleFindPatterns(toolArgs);
            case 'search_patterns':
              return await toolHandlers.handleSearchPatterns(toolArgs);
            case 'get_pattern_details':
              return await toolHandlers.handleGetPatternDetails(toolArgs);
            case 'count_patterns':
              return await toolHandlers.handleCountPatterns(toolArgs);
            case 'get_health_status':
              return await toolHandlers.handleGetHealthStatus(toolArgs);
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

      if (!this.resourceHandlers) {
        throw new McpError(ErrorCode.InternalError, 'Server not initialized');
      }

      const resourceHandlers = this.resourceHandlers;

      switch (uri) {
        case 'patterns':
          return resourceHandlers.handleReadPatterns();
        case 'categories':
          return resourceHandlers.handleReadCategories();
        case 'server_info':
          return resourceHandlers.handleReadServerInfo(this.config);
        default:
          throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }
    });

    // Error handling
    this.server.onerror = error => {
      logger.error(
        'mcp-server',
        'Server error',
        error instanceof Error ? error : new Error(String(error))
      );
    };
  }

  // Tool and Resource handlers are now extracted to tool-handler-implementations.ts

  async initialize(): Promise<void> {
    try {
      logger.info('mcp-server', 'Initializing Design Patterns MCP Server', {
        databasePath: this.facade.getConfig().databasePath,
        logLevel: this.facade.getConfig().logLevel,
      });

      // Initialize all services via facade
      this.services = await this.facade.initialize();
      await this.facade.initializeDatabase(this.services);

      // Initialize handlers
      this.toolHandlers = new ToolHandlerImplementations(this.services);
      this.resourceHandlers = new ResourceHandlerImplementations(this.services);

      logger.info('mcp-server', 'Design Patterns MCP Server initialized successfully');
    } catch (error) {
      logger.error(
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
    logger.info('mcp-server', 'Server started and listening on stdio');
  }

  async startHttp(): Promise<void> {
    const config = this.facade.getConfig();
    const port = config.httpPort || 3000;
    const healthPath = config.healthCheckPath || '/health';
    const mcpServer = this.server;

    Bun.serve({
      port,
      idleTimeout: 255,
      async fetch(req: Request): Promise<Response> {
        const url = new URL(req.url);

        if (url.pathname === healthPath || url.pathname === '/health') {
          return new Response('OK', { status: 200 });
        }

        if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
          const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
          });

          await mcpServer.connect(transport);
          return transport.handleRequest(req);
        }

        return new Response('Not Found', { status: 404 });
      },
    });

    logger.info('mcp-server', `HTTP server listening on port ${port}`);
  }

  async stop(): Promise<void> {
    try {
      if (this.services) {
        await this.services.db.close();
      }
      await this.server.close();
      logger.info('mcp-server', 'Server stopped');
    } catch (error) {
      logger.error(
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
