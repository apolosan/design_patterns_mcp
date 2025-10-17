/**
 * Factory Pattern for Embedding Strategy Creation
 * Creates appropriate embedding strategies based on configuration and availability
 */

import {
  EmbeddingStrategy,
  SimpleHashEmbeddingStrategy,
  TransformersEmbeddingStrategy,
  OllamaEmbeddingStrategy,
} from '../strategies/embedding-strategy.js';

interface EmbeddingFactoryConfig {
  preferredStrategy?: 'transformers' | 'ollama' | 'simple-hash';
  ollamaBaseUrl?: string;
  fallbackToSimple?: boolean;
  enableLogging?: boolean;
}

export class EmbeddingStrategyFactory {
  private static instance: EmbeddingStrategyFactory;
  private strategies: Map<string, EmbeddingStrategy> = new Map();
  private config: EmbeddingFactoryConfig;

  private constructor(config: EmbeddingFactoryConfig = {}) {
    this.config = {
      preferredStrategy: 'transformers',
      fallbackToSimple: true,
      enableLogging: false,
      ...config,
    };
  }

  /**
   * Singleton pattern for factory instance
   */
  static getInstance(config?: EmbeddingFactoryConfig): EmbeddingStrategyFactory {
    if (!EmbeddingStrategyFactory.instance) {
      EmbeddingStrategyFactory.instance = new EmbeddingStrategyFactory(config);
    }
    return EmbeddingStrategyFactory.instance;
  }

  /**
   * Create and return the best available embedding strategy
   */
  async createStrategy(): Promise<EmbeddingStrategy> {
    const cacheKey = `${this.config.preferredStrategy}_${this.config.ollamaBaseUrl}`;

    // Return cached strategy if available
    const cachedStrategy = this.strategies.get(cacheKey);
    if (cachedStrategy && (await cachedStrategy.isAvailable())) {
      return cachedStrategy;
    } else if (cachedStrategy) {
      // Remove unavailable strategy from cache
      this.strategies.delete(cacheKey);
    }

    // Try preferred strategy first
    let strategy = this.tryCreatePreferredStrategy();

    if (strategy && (await strategy.isAvailable())) {
      this.strategies.set(cacheKey, strategy);
      this.log(`Using ${strategy.name} embedding strategy`);
      return strategy;
    }

    // Fallback chain
    const fallbackStrategies = this.getFallbackOrder();

    for (const strategyType of fallbackStrategies) {
      strategy = this.createSpecificStrategy(strategyType);

      if (strategy && (await strategy.isAvailable())) {
        this.strategies.set(cacheKey, strategy);
        this.log(`Falling back to ${strategy.name} embedding strategy`);
        return strategy;
      }
    }

    // Final fallback to simple hash if enabled
    if (this.config.fallbackToSimple) {
      strategy = new SimpleHashEmbeddingStrategy();
      this.strategies.set(cacheKey, strategy);
      this.log('Using simple hash embedding strategy as final fallback');
      return strategy;
    }

    throw new Error('No embedding strategy available');
  }

  /**
   * Create specific strategy by type
   */
  createSpecificStrategy(type: string): EmbeddingStrategy | null {
    switch (type) {
      case 'transformers':
        return new TransformersEmbeddingStrategy();

      case 'ollama':
        return new OllamaEmbeddingStrategy(this.config.ollamaBaseUrl);

      case 'simple-hash':
        return new SimpleHashEmbeddingStrategy();

      default:
        return null;
    }
  }

  /**
   * Get all available strategies with their status
   */
  async getAvailableStrategies(): Promise<
    Array<{ name: string; available: boolean; model: string }>
  > {
    const strategies = [
      new TransformersEmbeddingStrategy(),
      new OllamaEmbeddingStrategy(this.config.ollamaBaseUrl),
      new SimpleHashEmbeddingStrategy(),
    ];

    const results = await Promise.all(
      strategies.map(async strategy => ({
        name: strategy.name,
        available: await strategy.isAvailable(),
        model: strategy.model,
      }))
    );

    return results;
  }

  /**
   * Clear strategy cache (useful for testing or configuration changes)
   */
  clearCache(): void {
    this.strategies.clear();
  }

  /**
   * Update factory configuration
   */
  updateConfig(newConfig: Partial<EmbeddingFactoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.clearCache(); // Clear cache when config changes
  }

  private tryCreatePreferredStrategy(): EmbeddingStrategy | null {
    if (!this.config.preferredStrategy) return null;

    return this.createSpecificStrategy(this.config.preferredStrategy);
  }

  private getFallbackOrder(): string[] {
    const { preferredStrategy } = this.config;
    const allStrategies = ['transformers', 'ollama', 'simple-hash'];

    // Remove preferred strategy from fallbacks to avoid duplication
    return allStrategies.filter(s => s !== preferredStrategy);
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[EmbeddingFactory] ${message}`);
    }
  }
}

// Note: createEmbeddingStrategy function removed as it was unused

/**
 * Convenience function to check available strategies
 */
export async function getAvailableEmbeddingStrategies(
  config?: EmbeddingFactoryConfig
): Promise<Array<{ name: string; available: boolean; model: string }>> {
  const factory = EmbeddingStrategyFactory.getInstance(config);
  return factory.getAvailableStrategies();
}
