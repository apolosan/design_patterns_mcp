/**
 * Integration Tests for Builder Pattern and Health Check Pattern
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPServerConfigBuilder } from '../../src/core/config-builder.js';
import { HealthCheckService } from '../../src/health/health-check-service.js';
import { DatabaseHealthCheck } from '../../src/health/database-health-check.js';
import { VectorOperationsHealthCheck } from '../../src/health/vector-operations-health-check.js';
import { EmbeddingServiceHealthCheck } from '../../src/health/embedding-service-health-check.js';
import { DatabaseManager, DatabaseConfig } from '../../src/services/database-manager.js';
import { VectorOperationsService, VectorConfig } from '../../src/services/vector-operations.js';
import { EmbeddingServiceAdapter } from '../../src/adapters/embedding-service-adapter.js';

// Mock database manager for testing
vi.mock('../../src/services/database-manager.js', () => ({
  DatabaseManager: vi.fn().mockImplementation(() => ({
    queryOne: vi.fn().mockReturnValue({ count: 42 }),
    getStats: vi.fn().mockReturnValue({ totalQueries: 100, databaseSize: 1024 }),
    healthCheck: vi.fn().mockReturnValue({ healthy: true, lastCheck: new Date() }),
  })),
}));

// Mock vector operations service
vi.mock('../../src/services/vector-operations.js', () => ({
  VectorOperationsService: vi.fn().mockImplementation(() => ({
    getStats: vi.fn().mockReturnValue({
      totalVectors: 100,
      embeddingModel: 'test-model',
      dimensions: 384,
    }),
    findSimilarPatterns: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockReturnValue({ healthy: true, lastCheck: new Date() }),
  })),
}));

// Mock embedding service adapter
vi.mock('../../src/adapters/embedding-service-adapter.js', () => ({
  EmbeddingServiceAdapter: vi.fn().mockImplementation(() => ({
    isReady: vi.fn().mockResolvedValue(true),
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    getStrategyInfo: vi.fn().mockReturnValue({
      name: 'test-strategy',
      model: 'test-model',
      dimensions: 384,
    }),
    getCircuitBreakerStats: vi.fn().mockReturnValue({
      state: 'closed',
      failureCount: 0,
      successCount: 5,
    }),
    healthCheck: vi.fn().mockReturnValue({ healthy: true, lastCheck: new Date() }),
  })),
}));

describe('Builder Pattern Integration', () => {
  describe('MCPServerConfigBuilder', () => {
    it('should build default configuration', () => {
      const config = new MCPServerConfigBuilder().build();

      expect(config.databasePath).toContain('design-patterns.db');
      expect(config.logLevel).toBe('info');
      expect(config.enableLLM).toBe(false);
      expect(config.maxConcurrentRequests).toBe(10);
      expect(config.enableFuzzyLogic).toBe(true);
    });

    it('should build configuration with custom values', () => {
      const config = new MCPServerConfigBuilder()
        .withDatabasePath('/custom/path.db')
        .withLogLevel('debug')
        .withLLM(true)
        .withMaxConcurrentRequests(50)
        .withFuzzyLogic(false)
        .build();

      expect(config.databasePath).toBe('/custom/path.db');
      expect(config.logLevel).toBe('debug');
      expect(config.enableLLM).toBe(true);
      expect(config.maxConcurrentRequests).toBe(50);
      expect(config.enableFuzzyLogic).toBe(false);
    });

    it('should build from environment variables', () => {
      // Mock environment variables
      vi.stubEnv('DATABASE_PATH', '/env/path.db');
      vi.stubEnv('LOG_LEVEL', 'warn');
      vi.stubEnv('ENABLE_LLM', 'true');
      vi.stubEnv('MAX_CONCURRENT_REQUESTS', '25');
      vi.stubEnv('ENABLE_FUZZY_LOGIC', 'false');

      const config = MCPServerConfigBuilder.fromEnvironment().build();

      expect(config.databasePath).toBe('/env/path.db');
      expect(config.logLevel).toBe('warn');
      expect(config.enableLLM).toBe(true);
      expect(config.maxConcurrentRequests).toBe(25);
      expect(config.enableFuzzyLogic).toBe(false);

      vi.unstubAllEnvs();
    });

    it('should validate configuration values', () => {
      expect(() => {
        new MCPServerConfigBuilder().withMaxConcurrentRequests(-1);
      }).toThrow('Max concurrent requests must be an integer between 1 and 1000');

      expect(() => {
        new MCPServerConfigBuilder().withMaxConcurrentRequests(2000);
      }).toThrow('Max concurrent requests must be an integer between 1 and 1000');
    });

    it('should provide preset configurations', () => {
      const devConfig = MCPServerConfigBuilder.forDevelopment().build();
      expect(devConfig.logLevel).toBe('debug');
      expect(devConfig.maxConcurrentRequests).toBe(20);

      const prodConfig = MCPServerConfigBuilder.forProduction().build();
      expect(prodConfig.logLevel).toBe('info');
      expect(prodConfig.maxConcurrentRequests).toBe(50);
    });
  });
});

describe('Health Check Pattern Integration', () => {
  let healthCheckService: HealthCheckService;

  beforeEach(() => {
    healthCheckService = new HealthCheckService({ enabled: true, timeout: 5000 });
  });

  describe('HealthCheckService', () => {
    it('should register and run health checks', async () => {
      const dbConfig: DatabaseConfig = { filename: ':memory:' };
      const db = new DatabaseManager(dbConfig);
      const dbCheck = new DatabaseHealthCheck(db);

      healthCheckService.registerHealthCheck(dbCheck);

      const report = await healthCheckService.checkAll();

      expect(report.overall).toBeDefined();
      expect(report.checks).toHaveLength(1);
      expect(report.checks[0].name).toBe('database');
      expect(report.checks[0].status).toBeDefined();
    });

    it('should run specific health check', async () => {
      const dbConfig: DatabaseConfig = { filename: ':memory:' };
      const db = new DatabaseManager(dbConfig);
      const dbCheck = new DatabaseHealthCheck(db);

      healthCheckService.registerHealthCheck(dbCheck);

      const result = await healthCheckService.check('database');

      expect(result.name).toBe('database');
      expect(result.status).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should run health checks by tags', async () => {
      const dbConfig: DatabaseConfig = { filename: ':memory:' };
      const db = new DatabaseManager(dbConfig);
      const dbCheck = new DatabaseHealthCheck(db);

      healthCheckService.registerHealthCheck(dbCheck);

      const report = await healthCheckService.checkByTags(['database']);

      expect(report.checks).toHaveLength(1);
      expect(report.checks[0].name).toBe('database');
    });
  });

  describe('Specific Health Checks', () => {
    it('should run database health check', async () => {
      const dbConfig: DatabaseConfig = { filename: ':memory:' };
      const db = new DatabaseManager(dbConfig);
      const dbCheck = new DatabaseHealthCheck(db);

      const result = await dbCheck.check();

      expect(result.name).toBe('database');
      expect(result.status).toBeDefined();
      expect(result.tags).toContain('database');
      expect(result.tags).toContain('critical');
    });

    it('should run vector operations health check', async () => {
      const dbConfig: DatabaseConfig = { filename: ':memory:' };
      const db = new DatabaseManager(dbConfig);

      const vectorConfig: VectorConfig = {
        model: 'all-MiniLM-L6-v2',
        dimensions: 384,
        similarityThreshold: 0.3,
        maxResults: 10,
        cacheEnabled: true
      };

      const vectorOps = new VectorOperationsService(db, vectorConfig);
      const vectorCheck = new VectorOperationsHealthCheck(vectorOps);

      const result = await vectorCheck.check();

      expect(result.name).toBe('vector-operations');
      expect(result.status).toBeDefined();
      expect(result.tags).toContain('vector-operations');
    });

    it('should run embedding service health check', async () => {
      const embeddingAdapter = new EmbeddingServiceAdapter();
      const embeddingCheck = new EmbeddingServiceHealthCheck(embeddingAdapter);

      const result = await embeddingCheck.check();

      expect(result.name).toBe('embedding-service');
      expect(result.status).toBeDefined();
      expect(result.tags).toContain('embeddings');
    });
  });
});
