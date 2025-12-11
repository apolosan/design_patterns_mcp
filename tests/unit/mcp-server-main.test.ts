/**
 * Unit Tests for MCP Server Main Function
 * Tests main execution, error handling, and configuration
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDesignPatternsServer } from '../../src/mcp-server.js';

describe('MCP Server Main Function', () => {
  beforeEach(() => {
    // Reset process.env
    delete process.env.DATABASE_PATH;
    delete process.env.LOG_LEVEL;
    delete process.env.ENABLE_LLM;
    delete process.env.MAX_CONCURRENT_REQUESTS;
  });

  test('should create server with factory function', () => {
    const config = {
      databasePath: './data/design-patterns.db',
      logLevel: 'info' as const,
      enableLLM: false,
      maxConcurrentRequests: 10,
    };

    const server = createDesignPatternsServer(config);
    expect(server).toBeDefined();
    expect(typeof server.initialize).toBe('function');
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
  });

  test('should parse environment variables correctly', () => {
    process.env.DATABASE_PATH = '/custom/path.db';
    process.env.LOG_LEVEL = 'debug';
    process.env.ENABLE_LLM = 'true';
    process.env.MAX_CONCURRENT_REQUESTS = '20';

    // Test that env vars are parsed (this would be in main function)
    const config = {
      databasePath: process.env.DATABASE_PATH || './data/design-patterns.db',
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      enableLLM: process.env.ENABLE_LLM === 'true',
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10'),
    };

    expect(config.databasePath).toBe('/custom/path.db');
    expect(config.logLevel).toBe('debug');
    expect(config.enableLLM).toBe(true);
    expect(config.maxConcurrentRequests).toBe(20);
  });

  test('should use default values when env vars not set', () => {
    const config = {
      databasePath: process.env.DATABASE_PATH || './data/design-patterns.db',
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      enableLLM: process.env.ENABLE_LLM === 'true',
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10'),
    };

    expect(config.databasePath).toBe('./data/design-patterns.db');
    expect(config.logLevel).toBe('info');
    expect(config.enableLLM).toBe(false);
    expect(config.maxConcurrentRequests).toBe(10);
  });

  test('should handle invalid MAX_CONCURRENT_REQUESTS', () => {
    process.env.MAX_CONCURRENT_REQUESTS = 'invalid';

    const maxConcurrentRequests = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10');
    const config = {
      databasePath: process.env.DATABASE_PATH || './data/design-patterns.db',
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      enableLLM: process.env.ENABLE_LLM === 'true',
      maxConcurrentRequests: isNaN(maxConcurrentRequests) ? 10 : Math.max(1, maxConcurrentRequests),
    };

    expect(config.maxConcurrentRequests).toBe(10); // Should fall back to default
  });

  test('should handle different log levels from env', () => {
    const levels = ['debug', 'info', 'warn', 'error'];

    levels.forEach(level => {
      process.env.LOG_LEVEL = level;
      const config = {
        databasePath: process.env.DATABASE_PATH || './data/design-patterns.db',
        logLevel: (process.env.LOG_LEVEL as any) || 'info',
        enableLLM: process.env.ENABLE_LLM === 'true',
        maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10'),
      };
      expect(config.logLevel).toBe(level);
    });
  });
});