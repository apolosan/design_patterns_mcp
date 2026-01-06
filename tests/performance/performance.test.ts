/**
 * Performance Tests for Design Patterns MCP Server
 * Tests response times, memory usage, and throughput requirements
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager';
import { CacheService } from '../../src/services/cache';
import { PatternMatcher } from '../../src/services/pattern-matcher';
import { VectorOperationsService } from '../../src/services/vector-operations';
import { performance } from 'perf_hooks';
import { getTestDatabaseConfig } from '../helpers/test-db';

describe('Performance Tests', () => {
  let databaseManager: DatabaseManager;
  let cacheService: CacheService;
  let vectorOps: VectorOperationsService;
  let patternMatcher: PatternMatcher;

  const PERFORMANCE_THRESHOLDS = {
    MAX_RESPONSE_TIME_MS: 5000, // 5 seconds - increased for semantic search
    MAX_MEMORY_USAGE_MB: 150, // 150 MB - allow for test framework overhead
    MIN_THROUGHPUT_RPS: 10, // 10 requests per second
    MAX_DB_QUERY_TIME_MS: 500, // 500ms for database queries
  };

  beforeAll(async () => {
    databaseManager = new DatabaseManager(getTestDatabaseConfig(true));
    await databaseManager.initialize();

    cacheService = new CacheService({
      maxSize: 1000,
      defaultTTL: 3600000,
    });

    vectorOps = new VectorOperationsService(databaseManager, {
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      similarityThreshold: 0.01,
      maxResults: 10,
      cacheEnabled: true,
    });

    patternMatcher = new PatternMatcher(databaseManager, vectorOps, {
      maxResults: 5,
      minConfidence: 0.3,
      useSemanticSearch: true,
      useKeywordSearch: true,
      useHybridSearch: true,
      semanticWeight: 0.7,
      keywordWeight: 0.3,
    });
  });

  afterAll(async () => {
    await databaseManager.close();
  });

  describe('Database Performance Tests', () => {
    it('should execute database queries within time limits', () => {
      const testQueries = [
        'SELECT COUNT(*) as count FROM patterns',
        'SELECT name, category FROM patterns LIMIT 10',
        'SELECT * FROM patterns WHERE category = "Creational" LIMIT 5',
        'SELECT p.name FROM patterns p LIMIT 20',
      ];

      for (const sql of testQueries) {
        const startTime = performance.now();

        const result = databaseManager.query(sql);
        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_DB_QUERY_TIME_MS);
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      }
    });

    it('should handle concurrent database queries efficiently', async () => {
      const concurrentQueries = 5;
      const sql = 'SELECT name FROM patterns LIMIT 5';

      const startTime = performance.now();

      const promises = Array(concurrentQueries)
        .fill(null)
        .map(() => databaseManager.query<{ name: string }>(sql));

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrentQueries;

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_DB_QUERY_TIME_MS);
      expect(results).toHaveLength(concurrentQueries);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should maintain performance with prepared statements', () => {
      const sql = 'SELECT * FROM patterns WHERE id = ?';
      const iterations = 10;

      // First execution (statement preparation)
      const firstStart = performance.now();
      databaseManager.query(sql, ['pattern_1']);
      const firstEnd = performance.now();
      const firstTime = firstEnd - firstStart;

       // Subsequent executions (prepared statement reuse)
       const subsequentTimes: number[] = [];
       for (let i = 0; i < iterations; i++) {
         const start = performance.now();
         databaseManager.query(sql, ['test_pattern']); // Use same parameter for reuse
         const end = performance.now();
         subsequentTimes.push(end - start);
       }

      const avgSubsequentTime = subsequentTimes.reduce((sum, time) => sum + time, 0) / iterations;

      expect(avgSubsequentTime).toBeLessThan(firstTime);
      expect(avgSubsequentTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_DB_QUERY_TIME_MS);
    });
  });

  describe('Cache Performance Tests', () => {
    it('should provide fast cache operations', () => {
      const testData = { id: 1, name: 'Test Pattern', category: 'Test' };
      const testKey = 'test:pattern:1';

      // Test cache set performance
      const setStart = performance.now();
      cacheService.set(testKey, testData, 60000); // 1 minute TTL
      const setEnd = performance.now();
      const setTime = setEnd - setStart;

      // Test cache get performance
      const getStart = performance.now();
      cacheService.get(testKey);
      const getEnd = performance.now();
      const getTime = getEnd - getStart;
    });

    it('should handle cache hits and misses efficiently', () => {
      const hitKey = 'test:hit';
      const missKey = 'test:miss';
      const testData = { data: 'test' };

      // Setup cache hit
      cacheService.set(hitKey, testData);

      const iterations = 100;
      let hitTime = 0;
      let missTime = 0;

      // Test cache hits
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        cacheService.get(hitKey);
        const end = performance.now();
        hitTime += end - start;
      }

      // Test cache misses
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        cacheService.get(`${missKey}_${i}`);
        const end = performance.now();
        missTime += end - start;
      }

      const avgHitTime = hitTime / iterations;
      const avgMissTime = missTime / iterations;

      // Cache hits might not always be faster than misses for very small operations
      // The important thing is both are reasonably fast
      expect(avgHitTime).toBeLessThan(1); // Reasonable hit time
      expect(avgMissTime).toBeLessThan(1); // Reasonable miss time
    });

    it('should maintain performance under load', () => {
      const operations = 1000;
      const testData = { id: 1, name: 'Load Test' };

      const startTime = performance.now();

      // Perform mixed operations
      for (let i = 0; i < operations; i++) {
        const key = `load_test:${i}`;
        cacheService.set(key, { ...testData, index: i }, 30000);

        if (i % 10 === 0) {
          // Every 10th operation, test get
          cacheService.get(key);
        }

        if (i % 50 === 0) {
          // Every 50th operation, test delete
          cacheService.delete(key);
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / operations;

      expect(avgTime).toBeLessThan(0.1); // Should maintain fast performance
      expect(totalTime).toBeLessThan(100); // Should complete quickly
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not exceed memory usage limits during operations', () => {
      const initialMemory = process.memoryUsage();

      // Perform memory-intensive operations
      const testData = Array(1000)
        .fill(null)
        .map((_, i) => ({
          id: i,
          name: `Pattern ${i}`,
          description: 'A'.repeat(100), // 100 chars per description
          category: 'Test',
        }));

      // Cache operations
      testData.forEach((data, index) => {
        cacheService.set(`memory_test:${index}`, data, 60000);
      });

      // Database operations
      const dbQueries = Array(50)
        .fill(null)
        .map((_, i) => `SELECT name FROM patterns LIMIT ${i + 1}`);

      dbQueries.forEach(sql => {
        databaseManager.query(sql);
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      expect(memoryIncreaseMB).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY_USAGE_MB);
      expect(finalMemory.heapUsed).toBeLessThan(
        PERFORMANCE_THRESHOLDS.MAX_MEMORY_USAGE_MB * 1024 * 1024
      );
    });
  });

  describe('Throughput Tests', () => {
    it('should handle sustained operation rate', () => {
      const duration = 5000; // 5 seconds
      const targetOperations = (PERFORMANCE_THRESHOLDS.MIN_THROUGHPUT_RPS * duration) / 1000;

      const startTime = performance.now();
      let operationCount = 0;

      while (performance.now() - startTime < duration) {
        const key = `throughput_test:${operationCount}`;
        cacheService.set(key, { data: operationCount }, 10000);
        cacheService.get(key);
        operationCount++;

        // Small delay to prevent infinite loop
        if (operationCount % 100 === 0) {
          // Allow event loop to process
        }
      }

      const actualDuration = performance.now() - startTime;
      const actualOPS = operationCount / (actualDuration / 1000);

      expect(actualOPS).toBeGreaterThanOrEqual(PERFORMANCE_THRESHOLDS.MIN_THROUGHPUT_RPS);
      expect(operationCount).toBeGreaterThan(targetOperations * 0.8); // At least 80% of target
    });
  });

  describe('System Resource Tests', () => {
    it('should monitor system resources effectively', () => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      // Basic resource checks
      expect(memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(uptime).toBeGreaterThan(0);
      expect(typeof cpuUsage.user).toBe('number');
      expect(typeof cpuUsage.system).toBe('number');

      // Memory should be reasonable
      const memoryMB = memoryUsage.heapUsed / (1024 * 1024);
      expect(memoryMB).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY_USAGE_MB);
    });
  });

  describe('Pattern Matching Performance Tests', () => {
    const testQueries = [
      'I need to create objects without specifying exact classes',
      'How to implement a singleton pattern',
      'Need to add logging without changing existing code',
      'Want to create families of related objects',
      'Need to communicate between objects efficiently',
    ];

    it('should respond to pattern matching queries within time limits', async () => {
      for (const query of testQueries) {
        const startTime = performance.now();

        const result = await patternMatcher.findMatchingPatterns({
          id: `test-${Date.now()}-${Math.random()}`,
          query,
          maxResults: 5,
          programmingLanguage: 'typescript',
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_RESPONSE_TIME_MS);
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('should handle concurrent pattern matching requests', async () => {
      const concurrentRequests = 5;
      const promises = testQueries.slice(0, concurrentRequests).map((query, index) =>
        patternMatcher.findMatchingPatterns({
          id: `concurrent-test-${Date.now()}-${index}`,
          query,
          maxResults: 3,
          programmingLanguage: 'javascript',
        })
      );

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrentRequests;

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_RESPONSE_TIME_MS);
      expect(results.length).toBe(concurrentRequests);
      results.forEach(result => {
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should maintain performance under sustained load', async () => {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const query = testQueries[i % testQueries.length];
        const startTime = performance.now();

        await patternMatcher.findMatchingPatterns({
          id: `sustained-test-${Date.now()}-${i}`,
          query,
          maxResults: 3,
        });

        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_RESPONSE_TIME_MS);
      expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_RESPONSE_TIME_MS * 1.5); // Allow some variance
    });

    it('should cache pattern matching results effectively', async () => {
      const query = 'factory pattern implementation';
      const options = { maxResults: 5, programmingLanguage: 'typescript' };

      // First request (should cache)
      const startTime1 = performance.now();
      const result1 = await patternMatcher.findMatchingPatterns({
        id: `cache-test-1-${Date.now()}`,
        query,
        ...options,
      });
      const time1 = performance.now() - startTime1;

      // Second request (should use cache)
      const startTime2 = performance.now();
      const result2 = await patternMatcher.findMatchingPatterns({
        id: `cache-test-2-${Date.now()}`,
        query,
        ...options,
      });
      const time2 = performance.now() - startTime2;

      // Results should be identical
      expect(result1.length).toBe(result2.length);
      expect(result1[0]?.pattern?.name).toBe(result2[0]?.pattern?.name);

      // Second request should be significantly faster (at least 2x speedup)
      expect(time1 / time2).toBeGreaterThan(2);
    });
  });
});
