/**
 * Adapter Pattern for Embedding Service Integration
 * Adapts different embedding strategies to work with existing VectorOperationsService
 */

import { EmbeddingStrategy, EmbeddingVector } from '../strategies/embedding-strategy.js';
import { EmbeddingStrategyFactory } from '../factories/embedding-factory.js';
import { CacheService } from '../services/cache.js';
import { structuredLogger } from '../utils/logger.js';
import { CircuitBreaker, CircuitBreakerConfig } from '../utils/circuit-breaker.js';

interface EmbeddingServiceConfig {
  cacheEnabled?: boolean;
  cacheTTL?: number;
  batchSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
  preferredStrategy?: 'transformers' | 'ollama' | 'simple-hash';
  fallbackToSimple?: boolean;
  circuitBreakerEnabled?: boolean;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
}

type RequiredEmbeddingServiceConfig = Required<Omit<EmbeddingServiceConfig, 'circuitBreakerConfig'>> & {
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
};

/**
 * Adapter that integrates embedding strategies with the existing system
 */
export class EmbeddingServiceAdapter {
  private strategy: EmbeddingStrategy | null = null;
  private config: RequiredEmbeddingServiceConfig;
  private factory: EmbeddingStrategyFactory;
  private cache: CacheService;
  private circuitBreaker?: CircuitBreaker;

  constructor(config: EmbeddingServiceConfig = {}, cache?: CacheService) {
    const defaultConfig = {
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      batchSize: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      preferredStrategy: 'transformers' as const,
      fallbackToSimple: true,
      circuitBreakerEnabled: true,
    };

    this.config = { ...defaultConfig, ...config };

    this.cache = cache ?? new CacheService();

    this.factory = EmbeddingStrategyFactory.getInstance({
      preferredStrategy: this.config.preferredStrategy,
      fallbackToSimple: this.config.fallbackToSimple,
      enableLogging: true,
    });

    // Initialize circuit breaker if enabled
    if (this.config.circuitBreakerEnabled) {
      const circuitConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        successThreshold: 3,
        name: 'embedding-service',
        ...this.config.circuitBreakerConfig,
      };
      this.circuitBreaker = new CircuitBreaker(circuitConfig);
    }
  }

  /**
   * Initialize the adapter with the best available strategy
   */
  async initialize(): Promise<void> {
    try {
      this.strategy = await this.factory.createStrategy();
      structuredLogger.info('embedding-adapter', `Initialized with ${this.strategy.name} strategy`);
    } catch (error) {
      structuredLogger.error(
        'embedding-adapter',
        'Failed to initialize embedding strategy',
        error as Error
      );
      throw error;
    }
  }

  /**
   * Generate embedding for a single text (with caching and circuit breaker)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.strategy) {
      await this.initialize();
    }

    // Check cache first
    if (this.config.cacheEnabled) {
      const cachedEmbedding = this.cache.getEmbeddings(text);
      if (cachedEmbedding) {
        return cachedEmbedding;
      }
    }

    // Generate new embedding with circuit breaker protection
    const embedding = await this.generateWithCircuitBreaker(text);

    // Cache the result
    if (this.config.cacheEnabled) {
      this.cache.setEmbeddings(text, embedding.values, this.config.cacheTTL);
    }

    return embedding.values;
  }

  /**
   * Generate embeddings for multiple texts (batch processing with circuit breaker)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.strategy) {
      await this.initialize();
    }

    const results: number[][] = [];
    const uncachedTexts: { text: string; index: number }[] = [];
    const cachedResults: Map<number, number[]> = new Map();

    // Check cache for each text
    if (this.config.cacheEnabled) {
      texts.forEach((text, index) => {
        const cachedEmbedding = this.cache.getEmbeddings(text);
        if (cachedEmbedding) {
          cachedResults.set(index, cachedEmbedding);
        } else {
          uncachedTexts.push({ text, index });
        }
      });
    } else {
      uncachedTexts.push(...texts.map((text, index) => ({ text, index })));
    }

    // Process uncached texts in batches with circuit breaker
    const newEmbeddings = await this.processBatchesWithCircuitBreaker(uncachedTexts.map(item => item.text));

    // Cache new embeddings and map to correct positions
    uncachedTexts.forEach((item, i) => {
      const embedding = newEmbeddings[i];
      if (this.config.cacheEnabled) {
        this.cache.setEmbeddings(item.text, embedding, this.config.cacheTTL);
      }
      cachedResults.set(item.index, embedding);
    });

    // Build final results array in original order
    for (let i = 0; i < texts.length; i++) {
      results[i] = cachedResults.get(i) as number[];
    }

    return results;
  }

  /**
   * Get information about the current strategy
   */
  getStrategyInfo(): { name: string; model: string; dimensions: number } | null {
    if (!this.strategy) return null;

    return {
      name: this.strategy.name,
      model: this.strategy.model,
      dimensions: this.strategy.dimensions,
    };
  }

  /**
   * Check if the service is ready
   */
  async isReady(): Promise<boolean> {
    if (!this.strategy) {
      try {
        await this.initialize();
      } catch {
        return false;
      }
    }

    return this.strategy ? await this.strategy.isAvailable() : false;
  }

  /**
   * Get available strategies status
   */
  async getAvailableStrategies(): Promise<
    Array<{ name: string; available: boolean; model: string }>
  > {
    return this.factory.getAvailableStrategies();
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker?.getStats();
  }

  /**
   * Manually reset circuit breaker (for testing/admin purposes)
   */
  resetCircuitBreaker(): void {
    if (this.circuitBreaker) {
      this.circuitBreaker.close();
      structuredLogger.info('embedding-adapter', 'Circuit breaker manually reset');
    }
  }

  /**
   * Switch to a different strategy
   */
  async switchStrategy(strategyType: 'transformers' | 'ollama' | 'simple-hash'): Promise<void> {
    try {
      const newStrategy = this.factory.createSpecificStrategy(strategyType);

      if (!newStrategy || !(await newStrategy.isAvailable())) {
        throw new Error(`Strategy ${strategyType} is not available`);
      }

      this.strategy = newStrategy;
      structuredLogger.info('embedding-adapter', `Switched to ${strategyType} strategy`);
    } catch (error) {
      structuredLogger.error(
        'embedding-adapter',
        `Failed to switch to ${strategyType} strategy`,
        error as Error
      );
      throw error;
    }
  }

  private async generateWithRetry(text: string): Promise<EmbeddingVector> {
    if (!this.strategy) {
      throw new Error('Embedding strategy not initialized');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.strategy.generateEmbedding(text);
      } catch (error) {
        lastError = error as Error;
        structuredLogger.warn(
          'embedding-adapter',
          `Embedding generation attempt ${attempt} failed`,
          { message: (error as Error).message, stack: (error as Error).stack }
        );

        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(
      `Embedding generation failed after ${this.config.retryAttempts} attempts: ${lastError?.message}`
    );
  }

  private async generateWithCircuitBreaker(text: string): Promise<EmbeddingVector> {
    if (!this.circuitBreaker) {
      // Fallback to original retry logic if circuit breaker disabled
      return this.generateWithRetry(text);
    }

    return this.circuitBreaker.execute(async () => {
      return this.generateWithRetry(text);
    });
  }

  private async processBatches(texts: string[]): Promise<number[][]> {
    if (!this.strategy) {
      throw new Error('Embedding strategy not initialized');
    }

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);

      try {
        const batchEmbeddings = await this.strategy.batchGenerateEmbeddings(batch);
        results.push(...batchEmbeddings.map(e => e.values));
      } catch (error) {
        // Fallback to individual processing if batch fails
        structuredLogger.warn(
          'embedding-adapter',
          'Batch processing failed, falling back to individual processing',
          { message: (error as Error).message, stack: (error as Error).stack }
        );

        for (const text of batch) {
          const embedding = await this.generateWithRetry(text);
          results.push(embedding.values);
        }
      }
    }

    return results;
  }

  private async processBatchesWithCircuitBreaker(texts: string[]): Promise<number[][]> {
    if (!this.circuitBreaker) {
      // Fallback to original batch processing if circuit breaker disabled
      return this.processBatches(texts);
    }

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);

      try {
        // Use circuit breaker for batch processing
        const batchEmbeddings = await this.circuitBreaker.execute(async () => {
          return this.strategy?.batchGenerateEmbeddings(batch) ?? [];
        });
        results.push(...batchEmbeddings.map(e => e.values));
      } catch (error) {
        // Fallback to individual processing if batch fails
        structuredLogger.warn(
          'embedding-adapter',
          'Batch processing failed, falling back to individual processing',
          { message: (error as Error).message, stack: (error as Error).stack }
        );

        for (const text of batch) {
          const embedding = await this.generateWithCircuitBreaker(text);
          results.push(embedding.values);
        }
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Note: createEmbeddingServiceAdapter function removed as it was unused
