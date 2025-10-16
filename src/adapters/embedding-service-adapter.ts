/**
 * Adapter Pattern for Embedding Service Integration
 * Adapts different embedding strategies to work with existing VectorOperationsService
 */

import { EmbeddingStrategy, EmbeddingVector } from '../strategies/embedding-strategy.js';
import { EmbeddingStrategyFactory } from '../factories/embedding-factory.js';
import { CacheService } from '../services/cache.js';
import { structuredLogger } from '../utils/logger.js';

export interface EmbeddingServiceConfig {
  cacheEnabled?: boolean;
  cacheTTL?: number;
  batchSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
  preferredStrategy?: 'transformers' | 'ollama' | 'simple-hash';
  fallbackToSimple?: boolean;
}

/**
 * Adapter that integrates embedding strategies with the existing system
 */
export class EmbeddingServiceAdapter {
  private strategy: EmbeddingStrategy | null = null;
  private config: Required<EmbeddingServiceConfig>;
  private factory: EmbeddingStrategyFactory;
  private cache: CacheService;

  constructor(config: EmbeddingServiceConfig = {}, cache?: CacheService) {
    const defaultConfig = {
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      batchSize: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      preferredStrategy: 'simple-hash' as const,
      fallbackToSimple: true,
    };

    this.config = { ...defaultConfig, ...config };

    this.cache = cache || new CacheService();

    this.factory = EmbeddingStrategyFactory.getInstance({
      preferredStrategy: this.config.preferredStrategy,
      fallbackToSimple: this.config.fallbackToSimple,
      enableLogging: true,
    });
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
   * Generate embedding for a single text (with caching)
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

    // Generate new embedding with retry logic
    const embedding = await this.generateWithRetry(text);

    // Cache the result
    if (this.config.cacheEnabled) {
      this.cache.setEmbeddings(text, embedding.values, this.config.cacheTTL);
    }

    return embedding.values;
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
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

    // Process uncached texts in batches
    const newEmbeddings = await this.processBatches(uncachedTexts.map(item => item.text));

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
      results[i] = cachedResults.get(i)!;
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
   * Switch to a different strategy
   */
  async switchStrategy(strategyType: 'transformers' | 'ollama' | 'simple-hash'): Promise<void> {
    try {
      const newStrategy = await this.factory.createSpecificStrategy(strategyType);

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
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.strategy!.generateEmbedding(text);
      } catch (error) {
        lastError = error as Error;
        structuredLogger.warn(
          'embedding-adapter',
          `Embedding generation attempt ${attempt} failed`,
          error as Error
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

  private async processBatches(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);

      try {
        const batchEmbeddings = await this.strategy!.batchGenerateEmbeddings(batch);
        results.push(...batchEmbeddings.map(e => e.values));
      } catch (error) {
        // Fallback to individual processing if batch fails
        structuredLogger.warn(
          'embedding-adapter',
          'Batch processing failed, falling back to individual processing',
          error as Error
        );

        for (const text of batch) {
          const embedding = await this.generateWithRetry(text);
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

/**
 * Factory function to create a configured adapter
 */
export function createEmbeddingServiceAdapter(
  config?: EmbeddingServiceConfig
): EmbeddingServiceAdapter {
  return new EmbeddingServiceAdapter(config);
}
