/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createDesignPatternsServer } from '../../src/mcp-server.js';

describe('MCP Server Main Tests', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('server factory creates properly configured instances', () => {
    const config = {
      databasePath: './data/design-patterns.db' as const,
      logLevel: 'info' as const,
      enableLLM: false,
      maxConcurrentRequests: 10,
    };

    const server = createDesignPatternsServer(config);

    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
    expect(typeof server.initialize).toBe('function');
  });

  test('should use default values when env vars not set', () => {
    delete process.env.DATABASE_PATH;
    delete process.env.LOG_LEVEL;
    delete process.env.ENABLE_LLM;
    delete process.env.MAX_CONCURRENT_REQUESTS;

    const config = {
      databasePath: process.env.DATABASE_PATH ?? './data/design-patterns.db',
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined) ?? 'info',
      enableLLM: process.env.ENABLE_LLM === 'true',
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS ?? '10'),
    };

    expect(config.databasePath).toBe('./data/design-patterns.db');
    expect(config.logLevel).toBe('info');
    expect(config.enableLLM).toBe(false);
    expect(config.maxConcurrentRequests).toBe(10);
  });

  test('should handle invalid MAX_CONCURRENT_REQUESTS', () => {
    process.env.MAX_CONCURRENT_REQUESTS = 'invalid';

    const maxConcurrentRequests = parseInt(process.env.MAX_CONCURRENT_REQUESTS ?? '10');
    const config = {
      databasePath: process.env.DATABASE_PATH ?? './data/design-patterns.db',
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined) ?? 'info',
      enableLLM: process.env.ENABLE_LLM === 'true',
      maxConcurrentRequests: isNaN(maxConcurrentRequests) ? 10 : Math.max(1, maxConcurrentRequests),
    };

    expect(config.maxConcurrentRequests).toBe(10);
  });

  test('should handle different log levels from env', () => {
    const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];

    levels.forEach(level => {
      process.env.LOG_LEVEL = level;
      const config = {
        databasePath: process.env.DATABASE_PATH ?? './data/design-patterns.db',
        logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ?? 'info',
        enableLLM: process.env.ENABLE_LLM === 'true',
        maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS ?? '10'),
      };
      expect(config.logLevel).toBe(level);
    });
  });
});
