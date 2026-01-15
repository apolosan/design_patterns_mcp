/**
 * Unit tests for Advanced Embedding Compressor
 * Testing compression techniques from arXiv 2402.06761
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  AdvancedEmbeddingCompressor, 
  CompressionTechnique,
  AdvancedCompressionConfig,
  createAdvancedEmbeddingCompressor 
} from '../../src/services/advanced-embedding-compressor.js';

describe('AdvancedEmbeddingCompressor', () => {
  let compressor: AdvancedEmbeddingCompressor;
  let testEmbedding: number[];

  beforeEach(() => {
    // Create test embedding (384 dimensions, typical for sentence transformers)
    testEmbedding = Array.from({ length: 384 }, (_, i) => 
      Math.sin(i * 0.1) * 0.5 + Math.random() * 0.1
    );
    
    compressor = new AdvancedEmbeddingCompressor({
      targetVariance: 0.95,
      maxDimensions: 128,
      quantizationBits: 8,
      useKnowledgeDistillation: true,
      productQuantizationClusters: 256,
      adaptiveThreshold: 0.7,
      minAccuracyDrop: 0.05,
    });
  });

  describe('Compression Techniques', () => {
    it('should compress with PCA technique', async () => {
      const result = await compressor.compress(testEmbedding, CompressionTechnique.PCA);
      
      expect(result).toBeDefined();
      expect(result.technique).toBe(CompressionTechnique.PCA);
      expect(result.compressed).toBeDefined();
      expect(result.stats).toBeDefined();
      
      // Verify compression stats
      expect(result.stats.compressionRatio).toBeGreaterThan(1);
      expect(result.stats.memorySavings).toBeGreaterThan(0);
      expect(result.stats.explainedVariance).toBeGreaterThanOrEqual(0);
      expect(result.stats.explainedVariance).toBeLessThanOrEqual(1);
      expect(result.stats.accuracyDrop).toBeGreaterThanOrEqual(0);
      expect(result.stats.accuracyDrop).toBeLessThanOrEqual(1);
    });

    it('should compress with 8-bit quantization', async () => {
      const result = await compressor.compress(testEmbedding, CompressionTechnique.QUANTIZATION_8BIT);
      
      expect(result).toBeDefined();
      expect(result.technique).toBe(CompressionTechnique.QUANTIZATION_8BIT);
      expect(result.compressed).toBeInstanceOf(Int8Array);
      expect(result.stats.compressionRatio).toBeGreaterThan(1);
      expect(result.metadata.quantizationScale).toBeDefined();
      expect(result.metadata.quantizationZeroPoint).toBeDefined();
    });

    it('should compress with 4-bit quantization', async () => {
      const result = await compressor.compress(testEmbedding, CompressionTechnique.QUANTIZATION_4BIT);
      
      expect(result).toBeDefined();
      expect(result.technique).toBe(CompressionTechnique.QUANTIZATION_4BIT);
      expect(result.compressed).toBeInstanceOf(Int8Array); // 4-bit packed in Int8Array
      expect(result.stats.compressionRatio).toBeGreaterThan(2); // 4-bit should have higher compression
    });

    it('should compress with knowledge distillation', async () => {
      const result = await compressor.compress(testEmbedding, CompressionTechnique.KNOWLEDGE_DISTILLATION);
      
      expect(result).toBeDefined();
      expect(result.technique).toBe(CompressionTechnique.KNOWLEDGE_DISTILLATION);
      expect(Array.isArray(result.compressed)).toBe(true);
      expect(result.compressed.length).toBeLessThanOrEqual(testEmbedding.length);
      expect(result.metadata.distillationTeacher).toBe('default-teacher');
    });

    it('should compress with product quantization', async () => {
      const result = await compressor.compress(testEmbedding, CompressionTechnique.PRODUCT_QUANTIZATION);
      
      expect(result).toBeDefined();
      expect(result.technique).toBe(CompressionTechnique.PRODUCT_QUANTIZATION);
      expect(Array.isArray(result.compressed)).toBe(true);
      expect(result.metadata.productQuantizationCodebooks).toBeDefined();
      expect(result.stats.reconstructionError).toBeGreaterThanOrEqual(0);
    });

    it('should use adaptive compression selection', async () => {
      const result = await compressor.compress(testEmbedding, CompressionTechnique.ADAPTIVE);
      
      expect(result).toBeDefined();
      expect(result.technique).toBeDefined();
      expect(result.stats.accuracyDrop).toBeLessThanOrEqual(compressor['config'].minAccuracyDrop);
    });
  });

  describe('Batch Compression', () => {
    it('should compress multiple embeddings', async () => {
      const embeddings = [
        testEmbedding,
        Array.from({ length: 384 }, (_, i) => Math.cos(i * 0.1) * 0.5 + Math.random() * 0.1),
        Array.from({ length: 384 }, (_, i) => Math.sin(i * 0.2) * 0.3 + Math.random() * 0.2),
      ];

      const results = await compressor.batchCompress(embeddings, CompressionTechnique.QUANTIZATION_8BIT);
      
      expect(results).toHaveLength(embeddings.length);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.technique).toBe(CompressionTechnique.QUANTIZATION_8BIT);
        expect(result.compressed).toBeDefined();
        expect(result.stats.compressionRatio).toBeGreaterThan(1);
      });
    });

    it('should handle batch compression with fallback', async () => {
      const embeddings = [
        testEmbedding,
        [], // Empty embedding should trigger fallback
        testEmbedding,
      ];

      const results = await compressor.batchCompress(embeddings, CompressionTechnique.QUANTIZATION_8BIT);
      
      expect(results).toHaveLength(embeddings.length);
      // All results should be valid
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.compressed).toBeDefined();
      });
    });
  });

  describe('Configuration', () => {
    it('should respect configuration limits', async () => {
      const config: Partial<AdvancedCompressionConfig> = {
        maxDimensions: 64,
        minAccuracyDrop: 0.01, // Very strict accuracy requirement
      };
      
      const strictCompressor = new AdvancedEmbeddingCompressor(config);
      const result = await strictCompressor.compress(testEmbedding, CompressionTechnique.ADAPTIVE);
      
      expect(result.stats.accuracyDrop).toBeLessThanOrEqual(0.01);
      if (result.technique === CompressionTechnique.PCA) {
        expect(result.compressed.length).toBeLessThanOrEqual(64);
      }
    });

    it('should use different quantization bits', async () => {
      const config8bit: Partial<AdvancedCompressionConfig> = { quantizationBits: 8 };
      const config4bit: Partial<AdvancedCompressionConfig> = { quantizationBits: 4 };
      
      const compressor8bit = new AdvancedEmbeddingCompressor(config8bit);
      const compressor4bit = new AdvancedEmbeddingCompressor(config4bit);
      
      const result8bit = await compressor8bit.compress(testEmbedding, CompressionTechnique.QUANTIZATION_8BIT);
      const result4bit = await compressor4bit.compress(testEmbedding, CompressionTechnique.QUANTIZATION_4BIT);
      
      // 4-bit should have higher or equal compression ratio
      expect(result4bit.stats.compressionRatio).toBeGreaterThanOrEqual(result8bit.stats.compressionRatio);
      // But potentially higher accuracy drop
      expect(result4bit.stats.accuracyDrop).toBeGreaterThanOrEqual(result8bit.stats.accuracyDrop);
    });
  });

  describe('Performance Metrics', () => {
    it('should provide meaningful performance metrics', async () => {
      const result = await compressor.compress(testEmbedding, CompressionTechnique.QUANTIZATION_8BIT);
      
      expect(result.stats).toHaveProperty('originalSize');
      expect(result.stats).toHaveProperty('compressedSize');
      expect(result.stats).toHaveProperty('compressionRatio');
      expect(result.stats).toHaveProperty('memorySavings');
      expect(result.stats).toHaveProperty('inferenceSpeedup');
      
      // Verify calculations
      expect(result.stats.compressionRatio).toBeCloseTo(
        result.stats.originalSize / result.stats.compressedSize,
        2
      );
      expect(result.stats.memorySavings).toBeCloseTo(
        ((result.stats.originalSize - result.stats.compressedSize) / result.stats.originalSize) * 100,
        1
      );
    });

    it('should complete compression within reasonable time', async () => {
      const startTime = Date.now();
      const result = await compressor.compress(testEmbedding, CompressionTechnique.QUANTIZATION_8BIT);
      const duration = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Factory Function', () => {
    it('should create compressor with factory function', () => {
      const compressor = createAdvancedEmbeddingCompressor({
        maxDimensions: 96,
        targetVariance: 0.9,
      });
      
      expect(compressor).toBeInstanceOf(AdvancedEmbeddingCompressor);
    });

    it('should create compressor with default config', () => {
      const compressor = createAdvancedEmbeddingCompressor();
      
      expect(compressor).toBeInstanceOf(AdvancedEmbeddingCompressor);
      // Default config should be applied
      expect(compressor['config'].maxDimensions).toBe(128);
      expect(compressor['config'].targetVariance).toBe(0.95);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty embeddings', async () => {
      const emptyEmbedding: number[] = [];
      const result = await compressor.compress(emptyEmbedding, CompressionTechnique.QUANTIZATION_8BIT);
      
      expect(result).toBeDefined();
      expect(result.compressed).toHaveLength(0);
      expect(result.stats.compressionRatio).toBe(1);
    });

    it('should handle invalid compression technique', async () => {
      const invalidTechnique = 'invalid' as CompressionTechnique;
      
      await expect(
        compressor.compress(testEmbedding, invalidTechnique)
      ).rejects.toThrow();
    });

    it('should handle knowledge distillation when disabled', async () => {
      const noKDCompressor = new AdvancedEmbeddingCompressor({
        useKnowledgeDistillation: false,
      });
      
      await expect(
        noKDCompressor.compress(testEmbedding, CompressionTechnique.KNOWLEDGE_DISTILLATION)
      ).rejects.toThrow('Knowledge distillation not enabled');
    });
  });

  describe('Adaptive Selection', () => {
    it('should analyze embedding characteristics', () => {
      const analysis = compressor['adaptiveSelector'].analyzeEmbedding(testEmbedding);
      
      expect(analysis).toBeDefined();
      expect(analysis.recommendedTechnique).toBeDefined();
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
      expect(analysis.reasons).toBeInstanceOf(Array);
      expect(analysis.reasons.length).toBeGreaterThan(0);
    });

    it('should select appropriate technique based on embedding', () => {
      // Test with small embedding
      const smallEmbedding = Array.from({ length: 64 }, () => Math.random() - 0.5);
      const technique1 = compressor['selectCompressionTechnique'](smallEmbedding);
      
      // Test with sparse embedding (many zeros)
      const sparseEmbedding = Array.from({ length: 384 }, (_, i) => 
        i % 10 === 0 ? Math.random() : 0
      );
      const technique2 = compressor['selectCompressionTechnique'](sparseEmbedding);
      
      expect(technique1).toBeDefined();
      expect(technique2).toBeDefined();
      // Different embeddings might get different recommendations
    });
  });
});