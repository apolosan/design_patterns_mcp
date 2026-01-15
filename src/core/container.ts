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
import { CacheService } from '../services/cache.js';
import type { MCPServerConfig } from '../mcp-server.js';

// New services for Blended RAG
import { HybridSearchEngine } from '../services/hybrid-search-engine.js';
import { EmbeddingCompressor } from '../services/embedding-compressor.js';
import { AdvancedEmbeddingCompressor, createAdvancedEmbeddingCompressor } from '../services/advanced-embedding-compressor.js';
import { TelemetryService } from '../services/telemetry-service.js';
import { GraphVectorService } from '../services/graph-vector-service.js';
import { SearchMediator } from '../handlers/search-mediator.js';
import { HybridSearchCombiner } from '../handlers/hybrid-search-combiner.js';
import { SemanticSearchHandler } from '../handlers/semantic-search-handler.js';
import { KeywordSearchHandler } from '../handlers/keyword-search-handler.js';
import { RecommendationBuilder } from '../handlers/recommendation-builder.js';
import { FuzzyInferenceEngine } from '../services/fuzzy-inference.js';
import { FuzzyDefuzzificationEngine } from '../services/fuzzy-defuzzification.js';
import { MultiLevelCache, createMultiLevelCache, CacheServiceInterface } from '../services/multi-level-cache.js';

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

  // New Blended RAG Services
  HYBRID_SEARCH_ENGINE: Symbol('HybridSearchEngine'),
  EMBEDDING_COMPRESSOR: Symbol('EmbeddingCompressor'),
  TELEMTRY_SERVICE: Symbol('TelemetryService'),
  GRAPH_VECTOR_SERVICE: Symbol('GraphVectorService'),
  SEARCH_MEDIATOR: Symbol('SearchMediator'),
  HYBRID_SEARCH_COMBINER: Symbol('HybridSearchCombiner'),
  SEMANTIC_SEARCH_HANDLER: Symbol('SemanticSearchHandler'),
  KEYWORD_SEARCH_HANDLER: Symbol('KeywordSearchHandler'),
  RECOMMENDATION_BUILDER: Symbol('RecommendationBuilder'),
  FUZZY_INFERENCE: Symbol('FuzzyInferenceEngine'),
  FUZZY_DEFUZZIFICATION: Symbol('FuzzyDefuzzificationEngine'),

  // Multi-Level Cache
  MULTI_LEVEL_CACHE_SERVICE: Symbol('MultiLevelCacheService'),

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
  HYBRID_SEARCH_HEALTH_CHECK: Symbol('HybridSearchHealthCheck'),

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
    const compressor = container.getService<AdvancedEmbeddingCompressor | EmbeddingCompressor>(TOKENS.EMBEDDING_COMPRESSOR);
    return new VectorOperationsService(db, {
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      similarityThreshold: 0.3,
      maxResults: 10,
      cacheEnabled: true,
      enableCompression: true,
      compressionConfig: {
        targetVariance: 0.95,
        maxDimensions: 128,
        quantizationBits: 8,
        minAccuracyDrop: 0.05,
      },
    }, compressor);
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

  // Register cache service (legacy - for backward compatibility)
  container.registerSingleton(TOKENS.CACHE_SERVICE, () => {
    return new CacheService();
  });

  // Register Multi-Level Cache Service (new - Phase 2.2)
  container.registerSingleton(TOKENS.MULTI_LEVEL_CACHE_SERVICE, () => {
    const db = container.has(TOKENS.DATABASE_MANAGER)
      ? container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER)
      : undefined;
    const telemetry = container.has(TOKENS.TELEMTRY_SERVICE)
      ? container.getService<TelemetryService>(TOKENS.TELEMTRY_SERVICE)
      : undefined;
    return createMultiLevelCache(db, telemetry);
  });

  // Register new Blended RAG services

  // Embedding Compressor (Advanced)
  container.registerSingleton(TOKENS.EMBEDDING_COMPRESSOR, () => {
    // Use advanced compressor with configuration from arXiv 2402.06761
    return createAdvancedEmbeddingCompressor({
      targetVariance: 0.95,
      maxDimensions: 128,
      quantizationBits: 8,
      useKnowledgeDistillation: true,
      productQuantizationClusters: 256,
      adaptiveThreshold: 0.7,
      minAccuracyDrop: 0.05,
    });
  });

  // Telemetry Service (singleton)
  container.registerSingleton(TOKENS.TELEMTRY_SERVICE, () => {
    const enableTelemetry = config.enableTelemetry !== false;
    return new TelemetryService({
      enabled: enableTelemetry,
      logTraces: config.logLevel === 'debug',
      logMetrics: true,
      logEvaluations: true,
      sampleRate: 1.0,
      retentionHours: 24,
    });
  });

  // Graph Vector Service
  container.registerSingleton(TOKENS.GRAPH_VECTOR_SERVICE, () => {
    const vectorOps = container.getService<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    const telemetry = container.getService<TelemetryService>(TOKENS.TELEMTRY_SERVICE);
    return new GraphVectorService(vectorOps, db, {
      k: 10,
      maxHops: 2,
      edgeWeightThreshold: 0.2,
      useMetadataEdges: true,
      rebuildInterval: 3600000,
    }, telemetry);
  });

  // Hybrid Search Engine
  container.registerSingleton(TOKENS.HYBRID_SEARCH_ENGINE, () => {
    const vectorOps = container.getService<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    const cache = container.getService<CacheService>(TOKENS.CACHE_SERVICE);
    const telemetry = container.getService<TelemetryService>(TOKENS.TELEMTRY_SERVICE);
    return new HybridSearchEngine(vectorOps, db, cache, {
      denseWeight: 0.6,
      sparseWeight: 0.4,
      boostExactMatches: true,
      minDiversityScore: 0.15,
      maxResults: 10,
      similarityThreshold: 0.3,
    }, telemetry);
  });

  // Search Handlers
  container.registerSingleton(TOKENS.SEMANTIC_SEARCH_HANDLER, () => {
    const vectorOps = container.getService<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
    const cache = container.getService<CacheService>(TOKENS.CACHE_SERVICE);
    return new SemanticSearchHandler(vectorOps, cache, {
      maxResults: 20,
      minConfidence: 0.05,
      similarityThreshold: 0.3,
    });
  });

  container.registerSingleton(TOKENS.KEYWORD_SEARCH_HANDLER, () => {
    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    return new KeywordSearchHandler(db, {
      maxResults: 20,
      minConfidence: 0.05,
      broadSearchThreshold: 0.01,
    });
  });

  container.registerSingleton(TOKENS.HYBRID_SEARCH_COMBINER, () => {
    return new HybridSearchCombiner();
  });

  container.registerSingleton(TOKENS.RECOMMENDATION_BUILDER, () => {
    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    return new RecommendationBuilder(db);
  });

  // Fuzzy Logic Engines
  container.registerSingleton(TOKENS.FUZZY_INFERENCE, () => {
    return new FuzzyInferenceEngine();
  });

  container.registerSingleton(TOKENS.FUZZY_DEFUZZIFICATION, () => {
    return new FuzzyDefuzzificationEngine();
  });

  // Search Mediator (main orchestrator)
  container.registerSingleton(TOKENS.SEARCH_MEDIATOR, () => {
    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    const vectorOps = container.getService<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
    const cache = container.getService<CacheService>(TOKENS.CACHE_SERVICE);
    return new SearchMediator(db, vectorOps, cache, {
      maxResults: 5,
      minConfidence: 0.05,
      useSemanticSearch: true,
      useKeywordSearch: true,
      useHybridSearch: true,
      useFuzzyRefinement: config.enableFuzzyLogic ?? true,
      cacheResultsTTL: 1800000,
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

  // Hybrid search health check
  container.registerSingleton(TOKENS.HYBRID_SEARCH_HEALTH_CHECK, () => {
    const hybridEngine = container.getService<HybridSearchEngine>(TOKENS.HYBRID_SEARCH_ENGINE);
    const telemetry = container.getService<TelemetryService>(TOKENS.TELEMTRY_SERVICE);
    
    // Simple health check for hybrid search
    return {
      name: 'HybridSearch',
      tags: ['search', 'hybrid', 'critical'],
      check: async () => {
        const health = telemetry.getHealthMetrics();
        const stats = hybridEngine.getStats();
        
        // Check if search rate is reasonable (not too high to indicate errors)
        const isHealthy = health.errorRate < 0.1 && health.avgLatency < 5000;
        
        return {
          name: 'HybridSearch',
          status: isHealthy ? 'healthy' : 'unhealthy',
          message: isHealthy ? 'Search engine operational' : 'Search engine performance degraded',
          timestamp: new Date().toISOString(),
          duration: 0,
          tags: ['search', 'hybrid', 'critical'],
          metadata: {
            searchRate: health.searchRate,
            avgLatency: health.avgLatency,
            errorRate: health.errorRate,
            cacheHitRate: health.cacheHitRate,
            sparseStats: stats.sparseStats,
          },
        };
      },
      timeout: 5000,
      isEnabled: () => true,
    } as any; // Type assertion for HealthCheck interface
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

    // Note: Hybrid search health check is optional and registered separately if needed
    return healthService;
  });

  return container;
}