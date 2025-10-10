/**
 * Abstract Factory Pattern for Service Creation
 * Encapsulates the creation logic for all services with proper dependency management
 */

import type { ServiceContainer } from '../core/container.js';
import { TOKENS } from '../core/container.js';
import { DatabaseManager } from '../services/database-manager.js';
import { PatternMatcher } from '../services/pattern-matcher.js';
import { SemanticSearchService } from '../services/semantic-search.js';
import { VectorOperationsService } from '../services/vector-operations.js';
import { LLMBridgeService } from '../services/llm-bridge.js';
import { ConfigManager } from '../services/config-manager.js';
import { CacheService } from '../services/cache.js';
import { PerformanceMonitor } from '../services/performance-monitor.js';
import { SqlitePatternRepository } from '../repositories/pattern-repository.js';
import type { 
  PatternRepository, 
  CategoryRepository,
  ImplementationRepository,
  VectorRepository 
} from '../repositories/interfaces.js';
import type { LLMAdapter } from '../adapters/llm-adapter.js';
import { OpenAIAdapter, AnthropicAdapter, OllamaAdapter } from '../adapters/llm-adapters.js';
import type { DatabaseConfig, SearchConfig, LLMConfig, ServerConfig } from '../builders/server-builder.js';

/**
 * Abstract factory interface for creating services
 */
export interface ServiceFactory {
  // Core services
  createDatabaseManager(config: DatabaseConfig): DatabaseManager;
  createConfigManager(config: ServerConfig): ConfigManager;
  
  // Repository services
  createPatternRepository(): PatternRepository;
  createCategoryRepository(): CategoryRepository;
  createImplementationRepository(): ImplementationRepository;
  createVectorRepository(): VectorRepository;
  
  // Search and matching services
  createPatternMatcher(config?: any): PatternMatcher;
  createSemanticSearch(config?: SearchConfig): SemanticSearchService;
  createVectorOperations(): VectorOperationsService;
  
  // External service adapters
  createLLMAdapter(config: LLMConfig): LLMAdapter | null;
  createLLMBridge(config: LLMConfig): LLMBridgeService | null;
  
  // Utility services
  createCacheService(config?: any): CacheService;
  createPerformanceMonitor(): PerformanceMonitor;
}

/**
 * Default implementation of the service factory
 */
export class DefaultServiceFactory implements ServiceFactory {
  constructor(private container: ServiceContainer) {}

  createDatabaseManager(config: DatabaseConfig): DatabaseManager {
    const dbManager = new DatabaseManager(config);
    dbManager.initialize();
    return dbManager;
  }

  createConfigManager(config: ServerConfig): ConfigManager {
    // TODO: Inject proper logger and error handler
    const logger = {} as any; // Mock logger for now
    const errorHandler = {} as any; // Mock error handler for now
    return new ConfigManager(logger, errorHandler);
  }

  createPatternRepository(): PatternRepository {
    const dbManager = this.container.get<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    return new SqlitePatternRepository(dbManager);
  }

  createCategoryRepository(): CategoryRepository {
    throw new Error('CategoryRepository not implemented yet');
  }

  createImplementationRepository(): ImplementationRepository {
    throw new Error('ImplementationRepository not implemented yet');
  }

  createVectorRepository(): VectorRepository {
    throw new Error('VectorRepository not implemented yet');
  }

  createPatternMatcher(config?: any): PatternMatcher {
    const dbManager = this.container.get<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    const repository = this.container.get<PatternRepository>(TOKENS.PATTERN_REPOSITORY);
    const searchStrategy = this.container.get(TOKENS.SEARCH_STRATEGY);
    
    const llmBridge = this.container.has(TOKENS.LLM_BRIDGE)
      ? this.container.get<LLMBridgeService>(TOKENS.LLM_BRIDGE)
      : undefined;

    const vectorOps = this.container.get<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
    const patternMatcherConfig = {
      maxResults: 10,
      minConfidence: 0.3,
      useSemanticSearch: true,
      useKeywordSearch: true,
      useHybridSearch: true,
      semanticWeight: 0.7,
      keywordWeight: 0.3,
      ...(config || {})
    };
    return new PatternMatcher(dbManager, vectorOps, patternMatcherConfig);
  }

  createSemanticSearch(config?: SearchConfig): SemanticSearchService {
    const dbManager = this.container.get<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    const vectorOps = this.container.get<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
    
    return new SemanticSearchService(dbManager, vectorOps, {
      modelName: config?.semanticModel || 'all-MiniLM-L6-v2',
      maxResults: config?.maxResults || 10,
      similarityThreshold: config?.similarityThreshold || 0.3,
      contextWindow: 512,
      useQueryExpansion: false,
      useReRanking: false
    });
  }

  createVectorOperations(): VectorOperationsService {
    const dbManager = this.container.get<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    const vectorConfig = {
      model: 'all-MiniLM-L6-v2' as const,
      dimensions: 384,
      similarityThreshold: 0.3,
      maxResults: 10,
      cacheEnabled: true
    };
    return new VectorOperationsService(dbManager, vectorConfig);
  }

  createLLMAdapter(config: LLMConfig): LLMAdapter | null {
    if (!config.provider || config.provider === 'none') {
      return null;
    }

    switch (config.provider) {
      case 'openai':
        if (!config.apiKey) {
          throw new Error('OpenAI API key is required');
        }
        return new OpenAIAdapter({
          apiKey: config.apiKey,
          model: config.model || 'gpt-3.5-turbo',
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens || 1000
        });

      case 'anthropic':
        if (!config.apiKey) {
          throw new Error('Anthropic API key is required');
        }
        return new AnthropicAdapter({
          apiKey: config.apiKey,
          model: config.model || 'claude-3-haiku-20240307',
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens || 1000
        });

      case 'ollama':
        return new OllamaAdapter({
          baseUrl: config.baseUrl || 'http://localhost:11434',
          model: config.model || 'llama2',
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens || 1000
        });

      default:
        throw new Error(`Unknown LLM provider: ${config.provider}`);
    }
  }

  createLLMBridge(config: LLMConfig): LLMBridgeService | null {
    const adapter = this.createLLMAdapter(config);
    if (!adapter) {
      return null;
    }

    const dbManager = this.container.get<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    // Convert config to match llm-bridge LLMConfig interface
    const bridgeConfig = {
      provider: (config.provider === 'none' ? 'local' : config.provider) as 'openai' | 'anthropic' | 'ollama' | 'local',
      model: config.model || 'gpt-3.5-turbo',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
      timeout: config.timeout || 30000
    };
    return new LLMBridgeService(dbManager, bridgeConfig);
  }

  createCacheService(config?: any): CacheService {
    return new CacheService({
      maxSize: config?.cacheSize || 100,
      defaultTTL: config?.cacheTTL || 3600,
      enableMetrics: config?.enableCache !== false
    });
  }

  createPerformanceMonitor(): PerformanceMonitor {
    // TODO: Inject proper logger and error handler
    const logger = {} as any; // Mock logger for now
    const errorHandler = {} as any; // Mock error handler for now
    const config = {
      enabled: true,
      metricsInterval: 60000,
      retentionPeriod: 86400000, // 24 hours
      slowQueryThreshold: 1000,
      enableSystemMetrics: true,
      enableDetailedLogging: false
    };
    return new PerformanceMonitor(logger, errorHandler, config);
  }
}

/**
 * Test factory for unit testing with mock services
 */
export class TestServiceFactory implements ServiceFactory {
  private mocks: Map<string, any> = new Map();

  registerMock(serviceName: string, mock: any): void {
    this.mocks.set(serviceName, mock);
  }

  createDatabaseManager(config: DatabaseConfig): DatabaseManager {
    return this.mocks.get('DatabaseManager') || new MockDatabaseManager();
  }

  createConfigManager(config: ServerConfig): ConfigManager {
    return this.mocks.get('ConfigManager') || new MockConfigManager();
  }

  createPatternRepository(): PatternRepository {
    return this.mocks.get('PatternRepository') || new MockPatternRepository();
  }

  createCategoryRepository(): CategoryRepository {
    return this.mocks.get('CategoryRepository') || new MockCategoryRepository();
  }

  createImplementationRepository(): ImplementationRepository {
    return this.mocks.get('ImplementationRepository') || new MockImplementationRepository();
  }

  createVectorRepository(): VectorRepository {
    return this.mocks.get('VectorRepository') || new MockVectorRepository();
  }

  createPatternMatcher(config?: any): PatternMatcher {
    return this.mocks.get('PatternMatcher') || new MockPatternMatcher();
  }

  createSemanticSearch(config?: SearchConfig): SemanticSearchService {
    return this.mocks.get('SemanticSearch') || new MockSemanticSearch();
  }

  createVectorOperations(): VectorOperationsService {
    return this.mocks.get('VectorOperations') || new MockVectorOperations();
  }

  createLLMAdapter(config: LLMConfig): LLMAdapter | null {
    return this.mocks.get('LLMAdapter') || null;
  }

  createLLMBridge(config: LLMConfig): LLMBridgeService | null {
    return this.mocks.get('LLMBridge') || null;
  }

  createCacheService(config?: any): CacheService {
    return this.mocks.get('CacheService') || new MockCacheService();
  }

  createPerformanceMonitor(): PerformanceMonitor {
    return this.mocks.get('PerformanceMonitor') || new MockPerformanceMonitor();
  }
}

// Mock implementations for testing (these would normally be in separate test files)
class MockDatabaseManager extends DatabaseManager {
  constructor() { 
    super({ 
      filename: ':memory:',
      options: { verbose: undefined }
    }); 
  }
}

class MockConfigManager extends ConfigManager {
  constructor() { 
    const logger = {} as any;
    const errorHandler = {} as any;
    super(logger, errorHandler);
  }
}

class MockPatternRepository implements PatternRepository {
  async findById(id: string) { return null; }
  async findByName(name: string) { return null; }
  async findAll(filters?: any) { return []; }
  async save(pattern: any) { return pattern; }
  async update(id: string, pattern: any) { return null; }
  async delete(id: string) { return false; }
  async findByCategory(category: string, limit?: number) { return []; }
  async findByTags(tags: string[], matchAll?: boolean) { return []; }
  async search(query: string, filters?: any) { return []; }
  async findByIds(ids: string[]) { return []; }
  async saveMany(patterns: any[]) { return patterns; }
  async count(filters?: any) { return 0; }
  async exists(id: string) { return false; }
}

class MockCategoryRepository implements CategoryRepository {
  async findAll() { return []; }
  async findById(id: string) { return null; }
  async findByName(name: string) { return null; }
  async save(category: any) { return category; }
  async update(id: string, category: any) { return null; }
  async delete(id: string) { return false; }
  async getPatternCount(categoryId: string) { return 0; }
}

class MockImplementationRepository implements ImplementationRepository {
  async findByPatternId(patternId: string) { return []; }
  async findByLanguage(language: string) { return []; }
  async findById(id: string) { return null; }
  async save(implementation: any) { return implementation; }
  async update(id: string, implementation: any) { return null; }
  async delete(id: string) { return false; }
  async deleteByPatternId(patternId: string) { return 0; }
}

class MockVectorRepository implements VectorRepository {
  async saveEmbedding(id: string, embedding: Float32Array) { }
  async findSimilar(embedding: Float32Array, limit: number, threshold?: number) { return []; }
  async deleteEmbedding(id: string) { return false; }
  async hasEmbedding(id: string) { return false; }
  async rebuildIndex() { }
}

class MockPatternMatcher extends PatternMatcher {
  constructor() { 
    const db = {} as any;
    const vectorOps = {} as any;
    const config = {
      maxResults: 10,
      minConfidence: 0.3,
      useSemanticSearch: true,
      useKeywordSearch: true,
      useHybridSearch: false,
      semanticWeight: 0.7,
      keywordWeight: 0.3
    };
    super(db, vectorOps, config);
  }
}

class MockSemanticSearch extends SemanticSearchService {
  constructor() { 
    const db = {} as any;
    const vectorOps = {} as any;
    const config = {
      modelName: 'all-MiniLM-L6-v2',
      maxResults: 10,
      similarityThreshold: 0.3,
      contextWindow: 512,
      useQueryExpansion: false,
      useReRanking: false
    };
    super(db, vectorOps, config);
  }
}

class MockVectorOperations extends VectorOperationsService {
  constructor() { 
    const db = {} as any;
    const config = {
      model: 'all-MiniLM-L6-v2' as const,
      dimensions: 384,
      similarityThreshold: 0.3,
      maxResults: 10,
      cacheEnabled: true
    };
    super(db, config);
  }
}

class MockCacheService extends CacheService {
  constructor() { super({}); }
}

class MockPerformanceMonitor extends PerformanceMonitor {
  constructor() { 
    const logger = {} as any;
    const errorHandler = {} as any;
    const config = {
      enabled: true,
      metricsInterval: 60000,
      retentionPeriod: 86400000,
      slowQueryThreshold: 1000,
      enableSystemMetrics: true,
      enableDetailedLogging: false
    };
    super(logger, errorHandler, config);
  }
}