import { DatabaseManager } from '../services/database-manager.js';
import { VectorOperationsService } from '../services/vector-operations.js';
import { PatternMatcher } from '../services/pattern-matcher.js';
import { SqlitePatternRepository } from '../repositories/pattern-repository.js';
import { SqlitePatternSeederRepository } from '../repositories/pattern-seeder-repository.js';
import { SemanticSearchService } from '../services/semantic-search.js';
import { LLMBridgeService } from '../services/llm-bridge.js';
import { MigrationManager } from '../services/migrations.js';
import { PatternSeeder } from '../services/pattern-seeder.js';
import { MCPRateLimiter } from '../utils/rate-limiter.js';
import { SimpleContainer, TOKENS } from '../core/container.js';
import { HealthCheckService } from '../health/health-check-service.js';
import { DatabaseHealthCheck } from '../health/database-health-check.js';
import { VectorOperationsHealthCheck } from '../health/vector-operations-health-check.js';
import { LLMBridgeHealthCheck } from '../health/llm-bridge-health-check.js';
import type { MCPServerConfig } from '../mcp-server.js';
import type { Logger } from '../services/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

export interface InitializedServices {
  db: DatabaseManager;
  vectorOps: VectorOperationsService;
  patternMatcher: PatternMatcher;
  semanticSearch: SemanticSearchService;
  llmBridge: LLMBridgeService | null;
  migrationManager: MigrationManager;
  patternSeeder: PatternSeeder;
  rateLimiter: MCPRateLimiter;
  healthCheckService: HealthCheckService | null;
  logger: Logger;
}

export class ServerFacade {
  private container: SimpleContainer | null = null;
  private config: MCPServerConfig;
  private services: InitializedServices | null = null;

  constructor(config: MCPServerConfig, container: SimpleContainer | null = null) {
    this.config = config;
    this.container = container;
  }

  async initialize(): Promise<InitializedServices> {
    if (this.services) {
      return this.services;
    }

    if (this.container) {
      this.services = await this.initializeFromContainer();
    } else {
      this.services = await this.initializeDirectly();
    }

    return this.services;
  }

  private async initializeFromContainer(): Promise<InitializedServices> {
    const container = this.container!;

    const db = container.getService<DatabaseManager>(TOKENS.DATABASE_MANAGER);
    const vectorOps = container.getService<VectorOperationsService>(TOKENS.VECTOR_OPERATIONS);
    const semanticSearch = container.getService<SemanticSearchService>(TOKENS.SEMANTIC_SEARCH);
    const patternMatcher = container.getService<PatternMatcher>(TOKENS.PATTERN_MATCHER);
    const migrationManager = container.getService<MigrationManager>(TOKENS.MIGRATION_MANAGER);
    const patternSeeder = container.getService<PatternSeeder>(TOKENS.PATTERN_SEEDER);
    const rateLimiter = container.getService<MCPRateLimiter>(TOKENS.RATE_LIMITER);
    const logger = container.getService<Logger>(TOKENS.LOGGER);

    let healthCheckService: HealthCheckService | null = null;
    if (container.has(TOKENS.HEALTH_CHECK_SERVICE)) {
      healthCheckService = container.getService<HealthCheckService>(TOKENS.HEALTH_CHECK_SERVICE);
    }

    let llmBridge: LLMBridgeService | null = null;
    if (this.config.enableLLM && container.has(TOKENS.LLM_BRIDGE)) {
      llmBridge = container.getService<LLMBridgeService>(TOKENS.LLM_BRIDGE);
    }

    return {
      db,
      vectorOps,
      patternMatcher,
      semanticSearch,
      llmBridge,
      migrationManager,
      patternSeeder,
      rateLimiter,
      healthCheckService,
      logger,
    };
  }

  private async initializeDirectly(): Promise<InitializedServices> {
    const logger = await import('../services/logger.js').then(m => m.logger);

    const db = new DatabaseManager({
      filename: this.config.databasePath,
      options: {
        verbose:
          this.config.logLevel === 'debug'
            ? (message: string) => logger.debug('database', message)
            : undefined,
      },
    });

    const vectorOps = new VectorOperationsService(db, {
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      similarityThreshold: 0.3,
      maxResults: 10,
      cacheEnabled: true,
    });

    const patternRepo = new SqlitePatternRepository(db);
    const semanticSearch = new SemanticSearchService(patternRepo, vectorOps, {
      modelName: 'all-MiniLM-L6-v2',
      maxResults: 10,
      similarityThreshold: 0.3,
      contextWindow: 512,
      useQueryExpansion: false,
      useReRanking: true,
    });

    const patternMatcher = new PatternMatcher(patternRepo, vectorOps, {
      maxResults: 5,
      minConfidence: 0.05,
      useSemanticSearch: true,
      useKeywordSearch: true,
      useHybridSearch: true,
      semanticWeight: 0.7,
      keywordWeight: 0.3,
      useFuzzyRefinement: this.config.enableFuzzyLogic ?? true,
    });

    let llmBridge: LLMBridgeService | null = null;
    if (this.config.enableLLM) {
      const { LLMBridgeService: LLMBridge } = await import('../services/llm-bridge.js');
      llmBridge = new LLMBridge(db, {
        provider: 'ollama',
        model: 'llama3.2',
        maxTokens: 2000,
        temperature: 0.3,
        timeout: 30000,
      });
    }

    const healthCheckService = new HealthCheckService({ enabled: true, timeout: 30000 });

    const dbCheck = new DatabaseHealthCheck(db);
    const vectorCheck = new VectorOperationsHealthCheck(vectorOps);
    const llmCheck = new LLMBridgeHealthCheck(llmBridge);

    healthCheckService.registerHealthCheck(dbCheck);
    healthCheckService.registerHealthCheck(vectorCheck);
    healthCheckService.registerHealthCheck(llmCheck);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const isCompiled = __dirname.includes('dist');
    // Facade is in src/facades/, so we need to go up 2 levels to reach project root
    const projectRoot = isCompiled
      ? path.resolve(__dirname, '..', '..', '..')
      : path.resolve(__dirname, '..', '..');
    const patternsPath = path.join(projectRoot, 'data', 'patterns');

    const { MigrationManager } = await import('../services/migrations.js');
    const migrationManager = new MigrationManager(db);

    const patternSeederRepo = new SqlitePatternSeederRepository(db);
    const { PatternSeeder } = await import('../services/pattern-seeder.js');
    const patternSeeder = new PatternSeeder(patternSeederRepo, {
      patternsPath,
      batchSize: 100,
      skipExisting: true,
    });

    const rateLimiter = new MCPRateLimiter({
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
      burstLimit: 20,
    });

    return {
      db,
      vectorOps,
      patternMatcher,
      semanticSearch,
      llmBridge,
      migrationManager,
      patternSeeder,
      rateLimiter,
      healthCheckService,
      logger,
    };
  }

  async initializeDatabase(services: InitializedServices): Promise<void> {
    await services.db.initialize();
    services.migrationManager.initialize();
    await services.migrationManager.migrate();
    await services.patternSeeder.seedAll();

    if (services.llmBridge) {
      services.logger.info('server-facade', 'LLM Bridge configured');
    }
  }

  getServices(): InitializedServices | null {
    return this.services;
  }

  getConfig(): MCPServerConfig {
    return this.config;
  }

  isUsingContainer(): boolean {
    return this.container !== null;
  }
}
