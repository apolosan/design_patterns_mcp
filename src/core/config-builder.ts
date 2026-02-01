/**
 * Builder Pattern for MCPServerConfig
 * Provides fluent interface with validation and sensible defaults
 */

import path from 'path';
import { fileURLToPath } from 'url';

export interface MCPServerConfig {
  databasePath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableLLM: boolean;
  maxConcurrentRequests: number;
  enableFuzzyLogic?: boolean;
  // New Blended RAG features
  enableTelemetry?: boolean;
  enableHybridSearch?: boolean;
  enableGraphAugmentation?: boolean;
  embeddingCompression?: boolean;
  // Multi-Level Cache (Phase 2.2)
  enableMultiLevelCache?: boolean;
  cacheConfig?: {
    l1?: { maxSize?: number; defaultTTL?: number };
    l2?: { enabled?: boolean; host?: string; port?: number; keyPrefix?: string };
    l3?: { enabled?: boolean; tableName?: string };
    global?: { writeStrategy?: 'write-through' | 'write-back' };
  };
  // HTTP Transport (Docker deployment)
  transportMode?: 'stdio' | 'http';
  httpPort?: number;
  mcpEndpoint?: string;
  healthCheckPath?: string;
}

interface ConfigBuilderState {
  databasePath?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableLLM?: boolean;
  maxConcurrentRequests?: number;
  enableFuzzyLogic?: boolean;
  enableTelemetry?: boolean;
  enableHybridSearch?: boolean;
  enableGraphAugmentation?: boolean;
  embeddingCompression?: boolean;
  enableMultiLevelCache?: boolean;
  cacheConfig?: MCPServerConfig['cacheConfig'];
  // HTTP Transport (Docker deployment)
  transportMode?: 'stdio' | 'http';
  httpPort?: number;
  mcpEndpoint?: string;
  healthCheckPath?: string;
}

export class MCPServerConfigBuilder {
  private state: ConfigBuilderState = {};

  /**
   * Set database path
   */
  withDatabasePath(path: string): this {
    if (!path || typeof path !== 'string') {
      throw new Error('Database path must be a non-empty string');
    }
    this.state.databasePath = path;
    return this;
  }

  /**
   * Set log level
   */
  withLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): this {
    this.state.logLevel = level;
    return this;
  }

  /**
   * Enable LLM integration
   */
  withLLM(enabled: boolean = true): this {
    this.state.enableLLM = enabled;
    return this;
  }

  /**
   * Set maximum concurrent requests
   */
  withMaxConcurrentRequests(max: number): this {
    if (!Number.isInteger(max) || max < 1 || max > 1000) {
      throw new Error('Max concurrent requests must be an integer between 1 and 1000');
    }
    this.state.maxConcurrentRequests = max;
    return this;
  }

  /**
   * Enable/disable fuzzy logic
   */
  withFuzzyLogic(enabled: boolean = true): this {
    this.state.enableFuzzyLogic = enabled;
    return this;
  }

  /**
   * Enable/disable telemetry
   */
  withTelemetry(enabled: boolean = true): this {
    this.state.enableTelemetry = enabled;
    return this;
  }

  /**
   * Enable/disable hybrid search
   */
  withHybridSearch(enabled: boolean = true): this {
    this.state.enableHybridSearch = enabled;
    return this;
  }

  /**
   * Enable/disable graph augmentation
   */
  withGraphAugmentation(enabled: boolean = true): this {
    this.state.enableGraphAugmentation = enabled;
    return this;
  }

  /**
   * Enable/disable embedding compression
   */
  withEmbeddingCompression(enabled: boolean = true): this {
    this.state.embeddingCompression = enabled;
    return this;
  }

  /**
   * Enable/disable multi-level cache (Phase 2.2)
   */
  withMultiLevelCache(enabled: boolean = true): this {
    this.state.enableMultiLevelCache = enabled;
    return this;
  }

  /**
    * Configure multi-level cache settings
    */
  withCacheConfig(config: MCPServerConfig['cacheConfig']): this {
    this.state.cacheConfig = config;
    return this;
  }

  /**
   * Set transport mode (stdio or http)
   */
  withTransportMode(mode: 'stdio' | 'http'): this {
    if (!mode || (mode !== 'stdio' && mode !== 'http')) {
      throw new Error('Transport mode must be "stdio" or "http"');
    }
    this.state.transportMode = mode;
    return this;
  }

  /**
   * Set HTTP port for Streamable HTTP transport
   */
  withHttpPort(port: number): this {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('HTTP port must be an integer between 1 and 65535');
    }
    this.state.httpPort = port;
    return this;
  }

  /**
   * Set MCP endpoint path for HTTP transport
   */
  withMcpEndpoint(endpoint: string): this {
    if (!endpoint || typeof endpoint !== 'string') {
      throw new Error('MCP endpoint must be a non-empty string');
    }
    if (!endpoint.startsWith('/')) {
      throw new Error('MCP endpoint must start with "/"');
    }
    this.state.mcpEndpoint = endpoint;
    return this;
  }

  /**
   * Set health check path for HTTP transport
   */
  withHealthCheckPath(path: string): this {
    if (!path || typeof path !== 'string') {
      throw new Error('Health check path must be a non-empty string');
    }
    if (!path.startsWith('/')) {
      throw new Error('Health check path must start with "/"');
    }
    this.state.healthCheckPath = path;
    return this;
  }

  /**
   * Build configuration with validation and defaults
   */
  build(): MCPServerConfig {
    // Get the directory of the current module for default database path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const isCompiled = __dirname.includes('dist');
    const projectRoot = isCompiled
      ? path.resolve(__dirname, '..', '..')
      : path.resolve(__dirname, '..');

    const defaultDbPath = path.join(projectRoot, 'data', 'design-patterns.db');

    // Apply defaults and validate
    const config: MCPServerConfig = {
      databasePath: this.state.databasePath ?? defaultDbPath,
      logLevel: this.state.logLevel ?? 'info',
      enableLLM: this.state.enableLLM ?? false,
      maxConcurrentRequests: this.state.maxConcurrentRequests ?? 10,
      enableFuzzyLogic: this.state.enableFuzzyLogic ?? true,
      // New Blended RAG features - default to enabled for optimal performance
      enableTelemetry: this.state.enableTelemetry ?? true,
      enableHybridSearch: this.state.enableHybridSearch ?? true,
      enableGraphAugmentation: this.state.enableGraphAugmentation ?? true,
      embeddingCompression: this.state.embeddingCompression ?? true,
      // Multi-Level Cache (Phase 2.2)
      enableMultiLevelCache: this.state.enableMultiLevelCache ?? true,
      cacheConfig: this.state.cacheConfig,
      // HTTP Transport (Docker deployment)
      transportMode: this.state.transportMode ?? 'stdio',
      httpPort: this.state.httpPort ?? 3000,
      mcpEndpoint: this.state.mcpEndpoint ?? '/mcp',
      healthCheckPath: this.state.healthCheckPath ?? '/health',
    };

    // Additional validation
    this.validateConfig(config);

    return config;
  }

  /**
   * Build from environment variables
   */
  static fromEnvironment(): MCPServerConfigBuilder {
    const builder = new MCPServerConfigBuilder();

    // Database path
    const dbPath = process.env.DATABASE_PATH;
    if (dbPath) {
      builder.withDatabasePath(dbPath);
    }

    // Log level
    const logLevel = process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
    if (logLevel && ['debug', 'info', 'warn', 'error'].includes(logLevel)) {
      builder.withLogLevel(logLevel);
    }

    // LLM
    if (process.env.ENABLE_LLM === 'true') {
      builder.withLLM(true);
    }

    // Max concurrent requests
    const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_REQUESTS ?? '10');
    if (!isNaN(maxConcurrent)) {
      builder.withMaxConcurrentRequests(maxConcurrent);
    }

    // Fuzzy logic
    if (process.env.ENABLE_FUZZY_LOGIC === 'false') {
      builder.withFuzzyLogic(false);
    }

    // Telemetry
    if (process.env.ENABLE_TELEMETRY === 'false') {
      builder.withTelemetry(false);
    }

    // Hybrid search
    if (process.env.ENABLE_HYBRID_SEARCH === 'false') {
      builder.withHybridSearch(false);
    }

    // Graph augmentation
    if (process.env.ENABLE_GRAPH_AUGMENTATION === 'false') {
      builder.withGraphAugmentation(false);
    }

    // Embedding compression
    if (process.env.EMBEDDING_COMPRESSION === 'false') {
      builder.withEmbeddingCompression(false);
    }

    // Multi-level cache
    if (process.env.ENABLE_MULTI_LEVEL_CACHE === 'false') {
      builder.withMultiLevelCache(false);
    }

    // Redis configuration for L2 cache
    if (process.env.REDIS_HOST) {
      builder.withCacheConfig({
        l2: {
          enabled: true,
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT ?? '6379'),
          keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'cache:',
        },
      });
    }

    // HTTP Transport configuration (Docker deployment)
    const transportMode = process.env.TRANSPORT_MODE as 'stdio' | 'http';
    if (transportMode && (transportMode === 'stdio' || transportMode === 'http')) {
      builder.withTransportMode(transportMode);
    }

    const httpPort = parseInt(process.env.HTTP_PORT ?? '0');
    if (!isNaN(httpPort) && httpPort > 0 && httpPort <= 65535) {
      builder.withHttpPort(httpPort);
    }

    const mcpEndpoint = process.env.MCP_ENDPOINT;
    if (mcpEndpoint) {
      builder.withMcpEndpoint(mcpEndpoint);
    }

    const healthCheckPath = process.env.HEALTH_CHECK_PATH;
    if (healthCheckPath) {
      builder.withHealthCheckPath(healthCheckPath);
    }

    return builder;
  }

  /**
   * Create builder with development defaults
   */
  static forDevelopment(): MCPServerConfigBuilder {
    return new MCPServerConfigBuilder()
      .withLogLevel('debug')
      .withMaxConcurrentRequests(20)
      .withFuzzyLogic(true)
      .withTelemetry(true)
      .withHybridSearch(true)
      .withGraphAugmentation(true)
      .withEmbeddingCompression(true)
      .withMultiLevelCache(true);
  }

  /**
   * Create builder with production defaults
   */
  static forProduction(): MCPServerConfigBuilder {
    return new MCPServerConfigBuilder()
      .withLogLevel('info')
      .withMaxConcurrentRequests(50)
      .withFuzzyLogic(true)
      .withTelemetry(true)
      .withHybridSearch(true)
      .withGraphAugmentation(true)
      .withEmbeddingCompression(true)
      .withMultiLevelCache(true);
  }

  /**
   * Validate the final configuration
   */
  private validateConfig(config: MCPServerConfig): void {
    // Database path validation
    if (!config.databasePath.endsWith('.db') && !config.databasePath.endsWith('.sqlite')) {
      console.warn('Database path does not have .db or .sqlite extension');
    }

    // Log level validation
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(config.logLevel)) {
      throw new Error(`Invalid log level: ${config.logLevel}`);
    }

    // Max concurrent requests validation
    if (config.maxConcurrentRequests < 1 || config.maxConcurrentRequests > 1000) {
      throw new Error('Max concurrent requests must be between 1 and 1000');
    }
  }
}