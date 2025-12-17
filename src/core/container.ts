/**
 * Dependency Injection Container
 * Provides inversion of control for better testability and maintainability
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseManager } from '../services/database-manager.js';
import { VectorOperationsService } from '../services/vector-operations.js';
import { SemanticSearchService } from '../services/semantic-search.js';
import { PatternMatcher } from '../services/pattern-matcher.js';
import { LLMBridgeService } from '../services/llm-bridge.js';
import { MigrationManager } from '../services/migrations.js';
import { PatternSeeder } from '../services/pattern-seeder.js';
import { MCPRateLimiter } from '../utils/rate-limiter.js';
import { logger, createLoggerWithStrategy } from '../services/logger.js';
import { ConsoleLoggingStrategy } from '../strategies/logging-strategy.js';
import { HealthCheckService } from '../health/health-check-service.js';
import { DatabaseHealthCheck } from '../health/database-health-check.js';
import { VectorOperationsHealthCheck } from '../health/vector-operations-health-check.js';
import { LLMBridgeHealthCheck } from '../health/llm-bridge-health-check.js';
import type { MCPServerConfig } from '../mcp-server.js';

export const TOKENS = {
  // Database
  DATABASE_MANAGER: Symbol('DatabaseManager'),
  STATEMENT_POOL: Symbol('StatementPool'),

  // Services
  PATTERN_SERVICE: Symbol('PatternService'),
  CACHE_SERVICE: Symbol('CacheService'),
  SEMANTIC_SEARCH: Symbol('SemanticSearchService'),
  PATTERN_MATCHER: Symbol('PatternMatcher'),
  VECTOR_OPERATIONS: Symbol('VectorOperationsService'),
  LLM_BRIDGE: Symbol('LLMBridgeService'),

  // Repositories
  PATTERN_REPOSITORY: Symbol('PatternRepository'),
  RELATIONSHIP_REPOSITORY: Symbol('RelationshipRepository'),

  // Adapters
  EMBEDDING_SERVICE_ADAPTER: Symbol('EmbeddingServiceAdapter'),

  // Infrastructure
  MIGRATION_MANAGER: Symbol('MigrationManager'),
  PATTERN_SEEDER: Symbol('PatternSeeder'),

  // Utils
  RATE_LIMITER: Symbol('MCPRateLimiter'),
  INPUT_VALIDATOR: Symbol('InputValidator'),
  LOGGER: Symbol('Logger'),

  // Strategies
  EMBEDDING_STRATEGY: Symbol('EmbeddingStrategy'),

  // Health Checks
  HEALTH_CHECK_SERVICE: Symbol('HealthCheckService'),
  DATABASE_HEALTH_CHECK: Symbol('DatabaseHealthCheck'),
  VECTOR_OPERATIONS_HEALTH_CHECK: Symbol('VectorOperationsHealthCheck'),
  LLM_BRIDGE_HEALTH_CHECK: Symbol('LLMBridgeHealthCheck'),

  // Config
  CONFIG: Symbol('MCPServerConfig'),
} as const;

export type TokenType = typeof TOKENS[keyof typeof TOKENS];

interface ServiceFactory<T = unknown> {
  (): T;
}

interface ServiceDefinition<T = unknown> {
  factory: ServiceFactory<T>;
  singleton: boolean;
  instance?: T;
}

/**
 * Simple Dependency Injection Container
 * Supports singleton and transient services with proper dependency resolution
 */
export class SimpleContainer {
  private services = new Map<TokenType, ServiceDefinition>();

  /**
   * Register a singleton service
   */
  registerSingleton<T>(token: TokenType, factory: ServiceFactory<T>): void {
    this.services.set(token, {
      factory,
      singleton: true,
    });
  }

  /**
   * Register a transient service (new instance each time)
   */
  registerTransient<T>(token: TokenType, factory: ServiceFactory<T>): void {
    this.services.set(token, {
      factory,
      singleton: false,
    });
  }

  /**
   * Register a pre-created instance
   */
  registerValue<T>(token: TokenType, instance: T): void {
    this.services.set(token, {
      factory: () => instance,
      singleton: true,
      instance,
    });
  }

  /**
   * Get a service instance
   */
  get<T>(token: TokenType): T {
    const definition = this.services.get(token);
    if (!definition) {
      throw new Error(`Service not registered for token: ${token.toString()}`);
    }

    if (definition.singleton) {
      if (!definition.instance) {
        definition.instance = definition.factory();
      }
      return definition.instance as T;
    }

    return definition.factory() as T;
  }

  /**
   * Get a service instance with type assertion
   */
  getService<T>(token: TokenType): T {
    return this.get<T>(token);
  }

  /**
   * Check if a service is registered
   */
  has(token: TokenType): boolean {
    return this.services.has(token);
  }

  /**
   * Clear all registered services (useful for testing)
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Get all registered tokens (for debugging)
   */
  getRegisteredTokens(): TokenType[] {
    return Array.from(this.services.keys());
  }
}

/**
 * Configures the DI container with all MCP server dependencies
 * Maintains backward compatibility while enabling proper dependency injection
 */
export function configureContainer(config: MCPServerConfig): SimpleContainer {
  const container = new SimpleContainer();

  // Register configuration as a value
  container.registerValue(TOKENS.CONFIG, config);

  // Register database manager
  container.registerSingleton(TOKENS.DATABASE_MANAGER, () => {
    return new DatabaseManager({
      filename: config.databasePath,
      options: {
        verbose: config.logLevel === 'debug'
          ? (message: string) => logger.debug('database', message)
          : undefined,
      },
    });
  });

  // Register vector operations service
  container.registerSingleton(TOKENS.VECTOR_OPERATIONS, () => {
    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    return new VectorOperationsService(db, {
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      similarityThreshold: 0.3,
      maxResults: 10,
      cacheEnabled: true,
    });
  });

  // Register semantic search service
  container.registerSingleton(TOKENS.SEMANTIC_SEARCH, () => {
    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    const vectorOps = container.getService<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
    return new SemanticSearchService(db, vectorOps, {
      modelName: 'all-MiniLM-L6-v2',
      maxResults: 10,
      similarityThreshold: 0.3,
      contextWindow: 512,
      useQueryExpansion: false,
      useReRanking: true,
    });
  });

  // Register pattern matcher
  container.registerSingleton(TOKENS.PATTERN_MATCHER, () => {
    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    const vectorOps = container.getService<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
    return new PatternMatcher(db, vectorOps, {
      maxResults: 5,
      minConfidence: 0.05,
      useSemanticSearch: true,
      useKeywordSearch: true,
      useHybridSearch: true,
      semanticWeight: 0.7,
      keywordWeight: 0.3,
      useFuzzyRefinement: config.enableFuzzyLogic ?? true,
    });
  });

  // Register LLM bridge (optional)
  if (config.enableLLM) {
    container.registerSingleton(TOKENS.LLM_BRIDGE, () => {
      const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
      return new LLMBridgeService(db, {
        provider: 'ollama',
        model: 'llama3.2',
        maxTokens: 2000,
        temperature: 0.3,
        timeout: 30000,
      });
    });
  }

  // Register migration manager
  container.registerSingleton(TOKENS.MIGRATION_MANAGER, () => {
    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    return new MigrationManager(db);
  });

  // Register pattern seeder
  container.registerSingleton(TOKENS.PATTERN_SEEDER, () => {
    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);

    // Get patterns path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const isCompiled = __dirname.includes('dist');
    const projectRoot = isCompiled
      ? path.resolve(__dirname, '..', '..')
      : path.resolve(__dirname, '..');
    const patternsPath = path.join(projectRoot, 'data', 'patterns');

    return new PatternSeeder(db, {
      patternsPath,
      batchSize: 100,
      skipExisting: true,
    });
  });

  // Register rate limiter
  container.registerSingleton(TOKENS.RATE_LIMITER, () => {
    return new MCPRateLimiter({
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      maxConcurrentRequests: config.maxConcurrentRequests,
      burstLimit: 20,
    });
  });

  // Register logger with strategy
  container.registerSingleton(TOKENS.LOGGER, () => {
    const strategy = new ConsoleLoggingStrategy();
    return createLoggerWithStrategy(strategy, {
      level: config.logLevel === 'debug' ? 0 : config.logLevel === 'info' ? 1 : config.logLevel === 'warn' ? 2 : 3,
      format: 'text',
      enableConsole: true,
      enableFile: false,
    });
  });

  // Register individual health checks
  container.registerSingleton(TOKENS.DATABASE_HEALTH_CHECK, () => {
    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    return new DatabaseHealthCheck(db);
  });

  container.registerSingleton(TOKENS.VECTOR_OPERATIONS_HEALTH_CHECK, () => {
    const vectorOps = container.getService<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
    return new VectorOperationsHealthCheck(vectorOps);
  });

  container.registerSingleton(TOKENS.LLM_BRIDGE_HEALTH_CHECK, () => {
    const llmBridge = config.enableLLM && container.has(TOKENS.LLM_BRIDGE)
      ? container.getService<LLMBridgeService>(TOKENS.LLM_BRIDGE)
      : null;
    return new LLMBridgeHealthCheck(llmBridge);
  });

  // Register health checks with the service
  container.registerSingleton(TOKENS.HEALTH_CHECK_SERVICE, () => {
    const healthService = new HealthCheckService({
      enabled: true,
      timeout: 30000,
    });

    // Register all health checks
    const dbCheck = container.getService<DatabaseHealthCheck>(TOKENS.DATABASE_HEALTH_CHECK);
    const vectorCheck = container.getService<VectorOperationsHealthCheck>(TOKENS.VECTOR_OPERATIONS_HEALTH_CHECK);
    const llmCheck = container.getService<LLMBridgeHealthCheck>(TOKENS.LLM_BRIDGE_HEALTH_CHECK);

    healthService.registerHealthCheck(dbCheck);
    healthService.registerHealthCheck(vectorCheck);
    healthService.registerHealthCheck(llmCheck);

    return healthService;
  });

  return container;
}