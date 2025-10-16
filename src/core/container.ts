/**
 * Dependency Injection Container
 * Manages service lifecycles and dependencies for better testability and maintainability
 */

export interface ServiceContainer {
  register<T>(token: symbol, factory: () => T): void;
  registerSingleton<T>(token: symbol, factory: () => T): void;
  registerValue<T>(token: symbol, value: T): void;
  get<T>(token: symbol): T;
  has(token: symbol): boolean;
  reset(): void;
}

export class SimpleContainer implements ServiceContainer {
  private services = new Map<symbol, () => any>();
  private singletons = new Map<symbol, any>();
  private values = new Map<symbol, any>();

  register<T>(token: symbol, factory: () => T): void {
    this.services.set(token, factory);
  }

  registerSingleton<T>(token: symbol, factory: () => T): void {
    this.register(token, () => {
      if (!this.singletons.has(token)) {
        this.singletons.set(token, factory());
      }
      return this.singletons.get(token);
    });
  }

  registerValue<T>(token: symbol, value: T): void {
    this.values.set(token, value);
  }

  get<T>(token: symbol): T {
    if (this.values.has(token)) {
      return this.values.get(token);
    }

    const factory = this.services.get(token);
    if (!factory) {
      throw new Error(`Service not registered: ${token.toString()}`);
    }
    return factory();
  }

  has(token: symbol): boolean {
    return this.services.has(token) || this.values.has(token);
  }

  reset(): void {
    this.services.clear();
    this.singletons.clear();
    this.values.clear();
  }
}

// Service tokens for dependency injection
export const TOKENS = {
  // Core services
  DATABASE_MANAGER: Symbol('DatabaseManager'),
  CONTAINER: Symbol('Container'),
  CACHE_SERVICE: Symbol('CacheService'),

  // Pattern services
  PATTERN_REPOSITORY: Symbol('PatternRepository'),
  RELATIONSHIP_REPOSITORY: Symbol('RelationshipRepository'),
  PATTERN_SERVICE: Symbol('PatternService'),
  PATTERN_MATCHER: Symbol('PatternMatcher'),
  PATTERN_ANALYZER: Symbol('PatternAnalyzer'),
  PATTERN_STORAGE: Symbol('PatternStorage'),

  // Search services
  SEARCH_STRATEGY: Symbol('SearchStrategy'),
  SEMANTIC_SEARCH: Symbol('SemanticSearch'),
  KEYWORD_SEARCH: Symbol('KeywordSearch'),
  HYBRID_SEARCH: Symbol('HybridSearch'),

  // Vector services
  VECTOR_OPERATIONS: Symbol('VectorOperations'),
  EMBEDDING_SERVICE: Symbol('EmbeddingService'),

  // External services
  LLM_ADAPTER: Symbol('LLMAdapter'),
  LLM_BRIDGE: Symbol('LLMBridge'),

  // Configuration
  DATABASE_CONFIG: Symbol('DatabaseConfig'),
  SEARCH_CONFIG: Symbol('SearchConfig'),
  SERVER_CONFIG: Symbol('ServerConfig'),

  // Factories
  SERVICE_FACTORY: Symbol('ServiceFactory'),
  SEARCH_STRATEGY_FACTORY: Symbol('SearchStrategyFactory'),

  // Migration & Seeding
  MIGRATION_MANAGER: Symbol('MigrationManager'),
  PATTERN_SEEDER: Symbol('PatternSeeder'),
} as const;

export type ServiceToken = (typeof TOKENS)[keyof typeof TOKENS];
