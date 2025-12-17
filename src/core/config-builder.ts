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
}

interface ConfigBuilderState {
  databasePath?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableLLM?: boolean;
  maxConcurrentRequests?: number;
  enableFuzzyLogic?: boolean;
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
      databasePath: this.state.databasePath || defaultDbPath,
      logLevel: this.state.logLevel || 'info',
      enableLLM: this.state.enableLLM ?? false,
      maxConcurrentRequests: this.state.maxConcurrentRequests || 10,
      enableFuzzyLogic: this.state.enableFuzzyLogic ?? true,
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
    const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10');
    if (!isNaN(maxConcurrent)) {
      builder.withMaxConcurrentRequests(maxConcurrent);
    }

    // Fuzzy logic
    if (process.env.ENABLE_FUZZY_LOGIC === 'false') {
      builder.withFuzzyLogic(false);
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
      .withFuzzyLogic(true);
  }

  /**
   * Create builder with production defaults
   */
  static forProduction(): MCPServerConfigBuilder {
    return new MCPServerConfigBuilder()
      .withLogLevel('info')
      .withMaxConcurrentRequests(50)
      .withFuzzyLogic(true);
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