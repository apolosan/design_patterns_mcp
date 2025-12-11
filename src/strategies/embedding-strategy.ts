/**
 * Strategy Pattern for Embedding Generation
 * Defines different algorithms for generating text embeddings
 */

export interface EmbeddingVector {
  dimensions: number;
  values: number[];
  model: string;
  normalized: boolean;
}

export interface EmbeddingStrategy {
  readonly name: string;
  readonly dimensions: number;
  readonly model: string;

  generateEmbedding(text: string): Promise<EmbeddingVector>;
  batchGenerateEmbeddings(texts: string[]): Promise<EmbeddingVector[]>;
  isAvailable(): Promise<boolean>;
}

/**
 * Simple Hash-based Embedding Strategy (fallback)
 */
export class SimpleHashEmbeddingStrategy implements EmbeddingStrategy {
  readonly name = 'simple-hash';
  readonly dimensions = 384;
  readonly model = 'simplified-hash';

  async generateEmbedding(text: string): Promise<EmbeddingVector> {
    const words = text.toLowerCase().split(/\s+/);
    const embedding: number[] = new Array(this.dimensions).fill(0);

    // Improved hash-based algorithm
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordHash = this.simpleHash(word);

      for (let j = 0; j < Math.min(word.length, 10); j++) {
        const charCode = word.charCodeAt(j);
        const position = (wordHash + j + i * 7) % embedding.length;
        embedding[position] += (charCode / 255) * 0.5 + Math.sin(wordHash * j) * 0.3;
      }
    }

    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalizedValues = embedding.map(val => val / (norm || 1));

    return Promise.resolve({
      dimensions: this.dimensions,
      values: normalizedValues,
      model: this.model,
      normalized: true,
    });
  }

  async batchGenerateEmbeddings(texts: string[]): Promise<EmbeddingVector[]> {
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }

  async isAvailable(): Promise<boolean> {
    return Promise.resolve(true); // Always available as fallback
  }

  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Transformers.js Embedding Strategy (primary)
 */
export class TransformersEmbeddingStrategy implements EmbeddingStrategy {
  readonly name = 'transformers-js';
  readonly dimensions = 384;
  readonly model = 'all-MiniLM-L6-v2';

  private pipeline: {
    (texts: string[], options?: Record<string, unknown>): Promise<{ data: number[] | Float32Array }>;
    (text: string, options?: Record<string, unknown>): Promise<{ data: number[] | Float32Array }>;
  } | null = null;
  private isInitialized = false;

  async generateEmbedding(text: string): Promise<EmbeddingVector> {
    await this.initialize();

    if (!this.pipeline) {
      throw new Error('Transformers.js pipeline not available');
    }

    try {
      const response = await this.pipeline([text], {
        pooling: 'mean',
        normalize: true,
      });

      const data = response.data as unknown;
      if (!Array.isArray(data) && !(data instanceof Float32Array)) {
        throw new Error('Invalid embedding data: expected array or Float32Array of numbers');
      }

      const arrayData = Array.isArray(data) ? data : Array.from(data);
      if (!arrayData.every((v) => typeof v === 'number')) {
        throw new Error('Invalid embedding data: expected array of numbers');
      }

      const values = arrayData;

      return {
        dimensions: this.dimensions,
        values,
        model: this.model,
        normalized: true,
      };
    } catch (error) {
      throw new Error(
        `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async batchGenerateEmbeddings(texts: string[]): Promise<EmbeddingVector[]> {
    await this.initialize();

    if (!this.pipeline) {
      throw new Error('Transformers.js pipeline not available');
    }

    try {
      const response = await this.pipeline(texts, {
        pooling: 'mean',
        normalize: true,
      });

      const data = response.data as unknown;
      if (!Array.isArray(data) && !(data instanceof Float32Array)) {
        throw new Error('Invalid embedding data: expected array or Float32Array of numbers');
      }

      const embeddingData = Array.isArray(data)
        ? (data as number[])
        : Array.from(data);

      // Handle batch response
      const embeddings: EmbeddingVector[] = [];
      for (let i = 0; i < texts.length; i++) {
        const values = embeddingData.slice(i * this.dimensions, (i + 1) * this.dimensions);
        embeddings.push({
          dimensions: this.dimensions,
          values,
          model: this.model,
          normalized: true,
        });
      }

      return embeddings;
    } catch (error) {
      throw new Error(
        `Batch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.initialize();
      return this.pipeline !== null;
    } catch {
      return false;
    }
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Dynamic import to avoid issues if @xenova/transformers is not installed
      const transformersModule = await import('@xenova/transformers').catch(() => null);

      if (transformersModule) {
        this.pipeline = await transformersModule.pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2'
        );
      } else {
        throw new Error('Transformers.js module not available');
      }

      this.isInitialized = true;
    } catch (error) {
      console.warn('Transformers.js not available, will use fallback strategy');
      this.isInitialized = true; // Prevent retries
      this.pipeline = null;
    }
  }
}

/**
 * Ollama Embedding Strategy (alternative)
 */
export class OllamaEmbeddingStrategy implements EmbeddingStrategy {
  readonly name = 'ollama';
  readonly dimensions = 384;
  readonly model = 'all-minilm:l6-v2';

  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generateEmbedding(text: string): Promise<EmbeddingVector> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json() as { embedding: number[] };

      return {
        dimensions: data.embedding.length,
        values: data.embedding,
        model: this.model,
        normalized: false, // Ollama may not normalize by default
      };
    } catch (error) {
      throw new Error(
        `Ollama embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async batchGenerateEmbeddings(texts: string[]): Promise<EmbeddingVector[]> {
    // Ollama doesn't support batch processing, so we process sequentially
    const embeddings: EmbeddingVector[] = [];

    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) return false;

      const data = await response.json() as { models?: { name: string }[] };
      return (
        data.models?.some(
          (model: { name: string }) => model.name.includes('all-minilm') || model.name.includes('embedding')
        ) || false
      );
    } catch {
      return false;
    }
  }
}
