/**
 * Server Builder Pattern
 * Provides a fluent interface for configuring and building the MCP server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SimpleContainer, ServiceContainer, TOKENS } from '../core/container.js';
import { DatabaseManager } from '../services/database-manager.js';
import { PatternMatcher } from '../services/pattern-matcher.js';
import { SemanticSearchService } from '../services/semantic-search.js';
import { VectorOperationsService } from '../services/vector-operations.js';
import { LLMBridgeService } from '../services/llm-bridge.js';
import { SqlitePatternRepository } from '../repositories/pattern-repository.js';
import { SqliteRelationshipRepository } from '../repositories/relationship-repository.js';
import {
  KeywordSearchStrategy,
  SemanticSearchStrategy,
  HybridSearchStrategy,
  SearchStrategy,
} from '../strategies/search-strategy.js';
import { DefaultServiceFactory } from '../factories/service-factory.js';
import { MCPToolsHandler } from '../lib/mcp-tools.js';
import { MCPResourcesHandler } from '../lib/mcp-resources.js';
import { logger } from '../services/logger.js';

export interface DatabaseConfig {
  filename: string;
  options?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message?: any, ...additionalArgs: any[]) => void;
  };
}

export interface SearchConfig {
  strategy?: 'keyword' | 'semantic' | 'hybrid';
  semanticModel?: string;
  maxResults?: number;
  similarityThreshold?: number;
  hybridWeights?: {
    keyword: number;
    semantic: number;
  };
}

export interface LLMConfig {
  provider?: 'openai' | 'anthropic' | 'ollama' | 'none';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface ServerConfig {
  name?: string;
  version?: string;
  description?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableCache?: boolean;
  cacheSize?: number;
  cacheTTL?: number;
}

export class MCPServerBuilder {
  private container: ServiceContainer;
  private databaseConfig?: DatabaseConfig;
  private searchConfig: SearchConfig = {};
  private llmConfig: LLMConfig = {};
  private serverConfig: ServerConfig = {};
  private factory?: DefaultServiceFactory;

  constructor() {
    this.container = new SimpleContainer();
    this.container.registerValue(TOKENS.CONTAINER, this.container);
  }

  /**
   * Configure database settings
   */
  withDatabase(config: DatabaseConfig): this {
    this.databaseConfig = config;
    return this;
  }

  /**
   * Configure search strategy and settings
   */
  withSearch(config: SearchConfig): this {
    this.searchConfig = config;
    return this;
  }

  /**
   * Configure LLM integration
   */
  withLLM(config: LLMConfig): this {
    this.llmConfig = config;
    return this;
  }

  /**
   * Configure server metadata and behavior
   */
  withServerConfig(config: ServerConfig): this {
    this.serverConfig = config;
    return this;
  }

  /**
   * Use a custom service factory
   */
  withServiceFactory(factory: DefaultServiceFactory): this {
    this.factory = factory;
    return this;
  }

  /**
   * Register a custom service in the container
   */
  registerService<T>(token: symbol, factory: () => T, singleton: boolean = false): this {
    if (singleton) {
      this.container.registerSingleton(token, factory);
    } else {
      this.container.register(token, factory);
    }
    return this;
  }

  /**
   * Build and configure the MCP server
   */
  async build(): Promise<Server> {
    // Validate configuration
    this.validateConfiguration();

    // Register all services
    await this.registerServices();

    // Create and configure MCP server
    return this.createMCPServer();
  }

  private validateConfiguration(): void {
    if (!this.databaseConfig) {
      throw new Error('Database configuration is required. Use withDatabase() to configure.');
    }

    // Set defaults
    this.serverConfig.name = this.serverConfig.name || 'design-patterns-mcp';
    this.serverConfig.version = this.serverConfig.version || '1.0.0';
    this.serverConfig.description =
      this.serverConfig.description ||
      'MCP server providing intelligent design pattern recommendations';
    this.serverConfig.logLevel = this.serverConfig.logLevel || 'info';

    this.searchConfig.strategy = this.searchConfig.strategy || 'hybrid';
    this.searchConfig.maxResults = this.searchConfig.maxResults || 10;
    this.searchConfig.similarityThreshold = this.searchConfig.similarityThreshold || 0.1;
  }

  private async registerServices(): Promise<void> {
    // Create service factory
    if (!this.factory) {
      this.factory = new DefaultServiceFactory(this.container);
    }
    this.container.registerValue(TOKENS.SERVICE_FACTORY, this.factory);

    // Register configuration objects
    this.container.registerValue(TOKENS.DATABASE_CONFIG, this.databaseConfig);
    this.container.registerValue(TOKENS.SEARCH_CONFIG, this.searchConfig);
    this.container.registerValue(TOKENS.SERVER_CONFIG, this.serverConfig);

    // Register DatabaseManager (singleton)
    this.container.registerSingleton(TOKENS.DATABASE_MANAGER, () => {
      const dbManager = new DatabaseManager(this.databaseConfig!);
      dbManager.initialize();
      return dbManager;
    });

    // Register Repository
    this.container.registerSingleton(TOKENS.PATTERN_REPOSITORY, () => {
      const dbManager = this.container.get<DatabaseManager>(TOKENS.DATABASE_MANAGER);
      return new SqlitePatternRepository(dbManager);
    });

    // Register Relationship Repository
    this.container.registerSingleton(TOKENS.RELATIONSHIP_REPOSITORY, () => {
      const dbManager = this.container.get<DatabaseManager>(TOKENS.DATABASE_MANAGER);
      return new SqliteRelationshipRepository(dbManager);
    });

    // Register Vector Operations
    this.container.registerSingleton(TOKENS.VECTOR_OPERATIONS, () => {
      const dbManager = this.container.get<DatabaseManager>(TOKENS.DATABASE_MANAGER);
      const vectorConfig = {
        model: (this.searchConfig.semanticModel || 'all-MiniLM-L6-v2') as 'all-MiniLM-L6-v2',
        dimensions: 384, // MiniLM-L6-v2 dimensions
        similarityThreshold: this.searchConfig.similarityThreshold || 0.3,
        maxResults: this.searchConfig.maxResults || 10,
        cacheEnabled: true,
      };
      return new VectorOperationsService(dbManager, vectorConfig);
    });

    // Register Semantic Search
    this.container.registerSingleton(TOKENS.SEMANTIC_SEARCH, () => {
      const dbManager = this.container.get<DatabaseManager>(TOKENS.DATABASE_MANAGER);
      const vectorOps = this.container.get<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
      return new SemanticSearchService(dbManager, vectorOps, {
        modelName: this.searchConfig.semanticModel || 'all-MiniLM-L6-v2',
        maxResults: this.searchConfig.maxResults || 10,
        similarityThreshold: this.searchConfig.similarityThreshold || 0.3,
        contextWindow: 512,
        useQueryExpansion: false,
        useReRanking: false,
      });
    });

    // Register LLM Bridge if configured
    if (this.llmConfig.provider && this.llmConfig.provider !== 'none') {
      this.container.registerSingleton(TOKENS.LLM_BRIDGE, () => {
        return this.factory!.createLLMBridge(this.llmConfig);
      });
    }

    // Register Search Strategy based on configuration
    this.container.register(TOKENS.SEARCH_STRATEGY, () => {
      return this.createSearchStrategy();
    });

    // Register Pattern Matcher
    this.container.registerSingleton(TOKENS.PATTERN_MATCHER, () => {
      const dbManager = this.container.get<DatabaseManager>(TOKENS.DATABASE_MANAGER);
      const searchStrategy = this.container.get<SearchStrategy>(TOKENS.SEARCH_STRATEGY);
      const repository = this.container.get<SqlitePatternRepository>(TOKENS.PATTERN_REPOSITORY);

      const llmBridge = this.container.has(TOKENS.LLM_BRIDGE)
        ? this.container.get<LLMBridgeService>(TOKENS.LLM_BRIDGE)
        : undefined;

      const vectorOps = this.container.get<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
      return new PatternMatcher(dbManager, vectorOps, {
        maxResults: this.searchConfig.maxResults || 10,
        minConfidence: this.searchConfig.similarityThreshold || 0.3,
        useSemanticSearch:
          this.searchConfig.strategy === 'semantic' || this.searchConfig.strategy === 'hybrid',
        useKeywordSearch:
          this.searchConfig.strategy === 'keyword' || this.searchConfig.strategy === 'hybrid',
        useHybridSearch: this.searchConfig.strategy === 'hybrid',
        semanticWeight: this.searchConfig.hybridWeights?.semantic || 0.7,
        keywordWeight: this.searchConfig.hybridWeights?.keyword || 0.3,
      });
    });
  }

  private createSearchStrategy(): SearchStrategy {
    const repository = this.container.get<SqlitePatternRepository>(TOKENS.PATTERN_REPOSITORY);

    switch (this.searchConfig.strategy) {
      case 'keyword':
        return new KeywordSearchStrategy(repository);

      case 'semantic': {
        const semanticSearch = this.container.get<SemanticSearchService>(TOKENS.SEMANTIC_SEARCH);
        return new SemanticSearchStrategy(semanticSearch, repository);
      }

      case 'hybrid':
      default: {
        const semanticSearch = this.container.get<SemanticSearchService>(TOKENS.SEMANTIC_SEARCH);
        const keywordStrategy = new KeywordSearchStrategy(repository);
        const semanticStrategy = new SemanticSearchStrategy(semanticSearch, repository);

        const weights = this.searchConfig.hybridWeights || { keyword: 0.4, semantic: 0.6 };
        return new HybridSearchStrategy(
          keywordStrategy,
          semanticStrategy,
          weights.keyword,
          weights.semantic
        );
      }
    }
  }

  private async createMCPServer(): Promise<Server> {
    // Create MCP server instance
    const server = new Server(
      {
        name: this.serverConfig.name!,
        version: this.serverConfig.version!,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Get required services from container
    const patternMatcher = this.container.get<PatternMatcher>(TOKENS.PATTERN_MATCHER);
    const repository = this.container.get<SqlitePatternRepository>(TOKENS.PATTERN_REPOSITORY);
    const dbManager = this.container.get<DatabaseManager>(TOKENS.DATABASE_MANAGER);

    // Create and register MCP handlers
    const toolsHandler = new MCPToolsHandler({
      patternMatcher: patternMatcher as any, // TODO: Add proper adapter
      semanticSearch: {} as any, // TODO: Add semantic search
      databaseManager: dbManager as any, // TODO: Add proper adapter
      preferences: new Map(),
    });
    // Get actual pattern count
    const patternCount = await repository.count();

    const resourcesHandler = new MCPResourcesHandler({
      databaseManager: dbManager as any, // TODO: Add proper adapter
      serverVersion: this.serverConfig.version || '1.0.0',
      totalPatterns: patternCount,
    });

    // Register tool and resource handlers
    // TODO: Implement registerHandlers methods
    // toolsHandler.registerHandlers(server);
    // resourcesHandler.registerHandlers(server);

    logger.info('ServerBuilder', 'MCP Server built successfully', {
      name: this.serverConfig.name,
      version: this.serverConfig.version,
      searchStrategy: this.searchConfig.strategy,
      llmEnabled: !!this.llmConfig.provider && this.llmConfig.provider !== 'none',
    });

    return server;
  }

  /**
   * Build and start the server with stdio transport
   */
  async buildAndStart(): Promise<void> {
    const server = await this.build();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    logger.info('ServerBuilder', 'MCP Server started with stdio transport');
  }

  /**
   * Create a pre-configured builder for development
   */
  static development(): MCPServerBuilder {
    return new MCPServerBuilder()
      .withDatabase({
        filename: './data/design-patterns.db',
        options: { readonly: false, fileMustExist: false },
      })
      .withSearch({
        strategy: 'hybrid',
        maxResults: 10,
        similarityThreshold: 0.3,
      })
      .withServerConfig({
        logLevel: 'debug',
        enableCache: true,
      });
  }

  /**
   * Create a pre-configured builder for production
   */
  static production(): MCPServerBuilder {
    return new MCPServerBuilder()
      .withDatabase({
        filename: process.env.DB_PATH || '/var/lib/design-patterns/patterns.db',
        options: { readonly: true, fileMustExist: true },
      })
      .withSearch({
        strategy: 'hybrid',
        maxResults: 20,
        similarityThreshold: 0.4,
      })
      .withServerConfig({
        logLevel: 'info',
        enableCache: true,
        cacheSize: 1000,
        cacheTTL: 3600,
      });
  }
}
