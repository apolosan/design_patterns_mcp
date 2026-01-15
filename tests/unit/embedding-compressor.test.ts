/**
 * Tests for EmbeddingCompressor
 * Testing PCA compression and quantization for embeddings
 * Based on arXiv 2402.06761 (Embedding Compression) and 2402.05964 (Transformer Compression)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingCompressor } from '../../src/services/embedding-compressor.js';

describe('EmbeddingCompressor', () => {
  let compressor: EmbeddingCompressor;
  const testEmbedding = new Array(384).fill(0).map((_, i) => Math.sin(i * 0.1) * 0.5);
  const testBasis = new Array(128).fill(0).map((_, i) => 
    new Array(384).fill(0).map((_, j) => (i === j % 128 ? 1 : 0) * 0.1)
  );

  beforeEach(() => {
    compressor = new EmbeddingCompressor(0.95, 128);
  });

  describe('constructor', () => {
    it('should create compressor with default parameters', () => {
      const defaultCompressor = new EmbeddingCompressor();
      expect(defaultCompressor).toBeDefined();
    });

    it('should validate targetVariance parameter', () => {
      expect(() => new EmbeddingCompressor(0)).not.toThrow();
      expect(() => new EmbeddingCompressor(1)).not.toThrow();
      expect(() => new EmbeddingCompressor(1.1)).toThrow();
      expect(() => new EmbeddingCompressor(-0.1)).toThrow();
    });
  });

  describe('compressPCA', () => {
    it('should compress embedding with PCA', () => {
      const result = compressor.compressPCA(testEmbedding, testBasis);

      expect(result).toHaveProperty('compressed');
      expect(result).toHaveProperty('explainedVariance');
      expect(result).toHaveProperty('retainedDimensions');
      
      expect(result.compressed.length).toBeLessThanOrEqual(testEmbedding.length);
      expect(result.explainedVariance).toBeGreaterThanOrEqual(0);
      expect(result.explainedVariance).toBeLessThanOrEqual(1);
      expect(result.retainedDimensions).toBeGreaterThan(0);
    });

    it('should handle empty embedding', () => {
      expect(() => compressor.compressPCA([], testBasis)).toThrow('Empty embedding');
    });

    it('should validate basis dimensions', () => {
      const invalidBasis = [[1, 2], [3, 4]]; // 2x2 instead of 384
      expect(() => compressor.compressPCA(testEmbedding, invalidBasis)).toThrow('Invalid basis matrix dimensions');
    });

    it('should return original when variance threshold not met', () => {
      // Create basis that doesn't explain variance well
      const poorBasis = testBasis.map(row => row.map(val => val * 0.001));
      const result = compressor.compressPCA(testEmbedding, poorBasis);

      expect(result.compressed.length).toBe(testEmbedding.length);
      expect(result.explainedVariance).toBe(1.0);
    });
  });

  describe('quantize8Bit', () => {
    it('should quantize embedding to 8-bit integers', () => {
      const result = compressor.quantize8Bit(testEmbedding);

      expect(result).toHaveProperty('quantized');
      expect(result).toHaveProperty('scale');
      expect(result).toHaveProperty('zeroPoint');
      expect(result).toHaveProperty('originalShape');

      expect(result.quantized).toBeInstanceOf(Int8Array);
      expect(result.quantized.length).toBe(testEmbedding.length);
      expect(result.scale).toBeGreaterThan(0);
      expect(result.originalShape[0]).toBe(testEmbedding.length);
    });

    it('should handle empty embedding', () => {
      expect(() => compressor.quantize8Bit([])).toThrow('Empty embedding');
    });

    it('should handle constant embedding', () => {
      const constantEmbedding = new Array(100).fill(0.5);
      const result = compressor.quantize8Bit(constantEmbedding);

      expect(result.quantized.length).toBe(constantEmbedding.length);
      expect(result.scale).toBe(0); // All values are the same
    });

    it('should produce values in int8 range', () => {
      const result = compressor.quantize8Bit(testEmbedding);
      
      for (let i = 0; i < result.quantized.length; i++) {
        expect(result.quantized[i]).toBeGreaterThanOrEqual(-128);
        expect(result.quantized[i]).toBeLessThanOrEqual(127);
      }
    });
  });

  describe('dequantize8Bit', () => {
    it('should dequantize back to floating point', () => {
      const quantized = compressor.quantize8Bit(testEmbedding);
      const dequantized = compressor.dequantize8Bit(
        quantized.quantized,
        quantized.scale,
        quantized.zeroPoint
      );

      expect(dequantized.length).toBe(testEmbedding.length);
      
      // Check approximate reconstruction
      for (let i = 0; i < testEmbedding.length; i++) {
        const error = Math.abs(testEmbedding[i] - dequantized[i]);
        expect(error).toBeLessThan(quantized.scale * 2); // Within quantization error
      }
    });

    it('should handle edge cases', () => {
      const quantized = new Int8Array([-128, 0, 127]);
      const scale = 0.1;
      const zeroPoint = 0;
      
      const dequantized = compressor.dequantize8Bit(quantized, scale, zeroPoint);
      
      expect(dequantized[0]).toBeCloseTo(-12.8, 1);
      expect(dequantized[1]).toBeCloseTo(0, 1);
      expect(dequantized[2]).toBeCloseTo(12.7, 1);
    });
  });

  describe('compressAndQuantize', () => {
    it('should compress and quantize in one pass', () => {
      const result = compressor.compressAndQuantize(testEmbedding, testBasis);

      expect(result).toHaveProperty('pca');
      expect(result).toHaveProperty('quantized');
      
      expect(result.pca.compressed.length).toBeLessThanOrEqual(testEmbedding.length);
      expect(result.quantized.quantized.length).toBe(result.pca.compressed.length);
    });
  });

  describe('buildPCABasis', () => {
    it('should build PCA basis from embeddings', () => {
      const embeddings = [
        new Array(384).fill(0).map((_, i) => Math.sin(i * 0.1)),
        new Array(384).fill(0).map((_, i) => Math.cos(i * 0.1)),
        new Array(384).fill(0).map((_, i) => Math.sin(i * 0.2)),
      ];

      const basis = compressor.buildPCABasis(embeddings, 50);

      expect(basis.length).toBeGreaterThan(0);
      expect(basis.length).toBeLessThanOrEqual(50);
      expect(basis[0].length).toBe(384);
    });

    it('should require at least 2 embeddings', () => {
      const singleEmbedding = [new Array(384).fill(0)];
      expect(() => compressor.buildPCABasis(singleEmbedding)).toThrow('Need at least 2 embeddings');
    });

    it('should respect max dimensions parameter', () => {
      const embeddings = [
        new Array(384).fill(0).map((_, i) => Math.random()),
        new Array(384).fill(0).map((_, i) => Math.random()),
        new Array(384).fill(0).map((_, i) => Math.random()),
      ];

      const basis = compressor.buildPCABasis(embeddings, 10);
      expect(basis.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getCompressionStats', () => {
    it('should calculate compression statistics', () => {
      const quantized = compressor.quantize8Bit(testEmbedding);
      const stats = compressor.getCompressionStats(testEmbedding, testEmbedding, quantized);

      expect(stats).toHaveProperty('originalSize');
      expect(stats).toHaveProperty('compressedSize');
      expect(stats).toHaveProperty('compressionRatio');
      expect(stats).toHaveProperty('explainedVariance');
      expect(stats).toHaveProperty('errorRate');

      expect(stats.originalSize).toBe(testEmbedding.length * 4); // float32
      expect(stats.compressedSize).toBe(testEmbedding.length * 1); // int8
      expect(stats.compressionRatio).toBeCloseTo(4, 0.5); // 4x compression
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('compressWithQualityControl', () => {
    it('should compress with quality control', () => {
      const result = compressor.compressWithQualityControl(testEmbedding, testBasis, 0.9, 100);

      expect(result).toHaveProperty('compressed');
      expect(result).toHaveProperty('quantized');
      expect(result).toHaveProperty('stats');

      expect(result.compressed.length).toBeLessThanOrEqual(testEmbedding.length);
      expect(result.stats.compressionRatio).toBeGreaterThan(1);
    });

    it('should fallback when variance threshold not met', () => {
      // Create poor basis that won't meet variance threshold
      const poorBasis = testBasis.map(row => row.map(val => val * 0.001));
      
      const result = compressor.compressWithQualityControl(testEmbedding, poorBasis, 0.99, 100);

      // Should fallback to quantization only
      expect(result.compressed.length).toBe(testEmbedding.length);
    });
  });

  describe('batchCompress', () => {
    it('should compress multiple embeddings', () => {
      const embeddings = [
        new Array(384).fill(0).map((_, i) => Math.sin(i * 0.1)),
        new Array(384).fill(0).map((_, i) => Math.cos(i * 0.1)),
        new Array(384).fill(0).map((_, i) => Math.sin(i * 0.2)),
      ];

      const results = compressor.batchCompress(embeddings, testBasis);

      expect(results.length).toBe(embeddings.length);
      results.forEach(result => {
        expect(result).toHaveProperty('compressed');
        expect(result).toHaveProperty('quantized');
        expect(result).toHaveProperty('stats');
      });
    });

    it('should handle errors gracefully', () => {
      const embeddings = [
        testEmbedding,
        [], // Empty embedding should cause error
        testEmbedding,
      ];

      const results = compressor.batchCompress(embeddings, testBasis);

      expect(results.length).toBe(embeddings.length);
      // All results should be returned (with fallback for errors)
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('estimateSavings', () => {
    it('should estimate memory savings', () => {
      const originalDimensions = 384;
      const savings = compressor.estimateSavings(originalDimensions, 0.95);

      expect(savings).toHaveProperty('originalBytes');
      expect(savings).toHaveProperty('compressedBytes');
      expect(savings).toHaveProperty('quantizedBytes');
      expect(savings).toHaveProperty('savingsPercent');

      expect(savings.originalBytes).toBe(originalDimensions * 4);
      expect(savings.compressedBytes).toBeLessThanOrEqual(savings.originalBytes);
      expect(savings.quantizedBytes).toBeLessThanOrEqual(savings.compressedBytes);
      expect(savings.savingsPercent).toBeGreaterThan(0);
    });

    it('should calculate correct compression ratios', () => {
      const dimensions = 100;
      const savings = compressor.estimateSavings(dimensions, 0.95);

      const expectedCompressedDims = Math.floor(dimensions * 0.95);
      expect(savings.compressedBytes).toBe(expectedCompressedDims * 4);
      expect(savings.quantizedBytes).toBe(expectedCompressedDims * 1);
    });
  });

  describe('createEmbeddingCompressor', () => {
    it('should create compressor with standard config', () => {
      const compressor = new EmbeddingCompressor(0.95, 128);
      expect(compressor).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should compress within reasonable time', () => {
      const largeEmbedding = new Array(1024).fill(0).map((_, i) => Math.random());
      const largeBasis = new Array(256).fill(0).map((_, i) => 
        new Array(1024).fill(0).map((_, j) => (i === j % 256 ? 1 : 0) * 0.1)
      );

      const startTime = Date.now();
      const result = compressor.compressPCA(largeEmbedding, largeBasis);
      const duration = Date.now() - startTime;

      expect(result.compressed.length).toBeLessThanOrEqual(largeEmbedding.length);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle batch compression efficiently', () => {
      const batchSize = 100;
      const embeddings = Array.from({ length: batchSize }, () => 
        new Array(384).fill(0).map(() => Math.random())
      );

      const startTime = Date.now();
      const results = compressor.batchCompress(embeddings, testBasis);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(batchSize);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds for 100 embeddings
    });
  });
});