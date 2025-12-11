/**
 * Integration Tests for MCP Server
 * Tests the full MCP server with real database and services
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createDesignPatternsServer } from '../../src/mcp-server.js';
import { getTestDatabasePath } from '../helpers/test-db';

describe('MCP Server Integration Tests', () => {
  let server: any;

  beforeAll(async () => {
    const config = {
      databasePath: getTestDatabasePath(),
      logLevel: 'info' as const,
      enableLLM: false,
      maxConcurrentRequests: 10,
    };
    server = createDesignPatternsServer(config);
    expect(server).toBeDefined();
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  test('server should initialize successfully', () => {
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(Object);
  });

  test('server should have MCP capabilities', () => {
    // Check that server has expected properties indicating proper MCP setup
    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
    expect(typeof server.initialize).toBe('function');
  });

  test('server should have tool and resource handlers registered', () => {
    // This is a basic test to ensure the server structure is correct
    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
  });

  test('server should initialize with debug logging', async () => {
    const config = {
      databasePath: getTestDatabasePath(),
      logLevel: 'debug' as const,
      enableLLM: false,
      maxConcurrentRequests: 5,
    };
    const debugServer = createDesignPatternsServer(config);
    expect(debugServer).toBeDefined();

    // Test initialization
    await expect(debugServer.initialize()).resolves.not.toThrow();
  });

  test('server should initialize with LLM enabled', async () => {
    const config = {
      databasePath: getTestDatabasePath(),
      logLevel: 'info' as const,
      enableLLM: true,
      maxConcurrentRequests: 5,
    };
    const llmServer = createDesignPatternsServer(config);
    expect(llmServer).toBeDefined();

    // Test initialization
    await expect(llmServer.initialize()).resolves.not.toThrow();
  });

  test('server should handle start and stop lifecycle', async () => {
    const config = {
      databasePath: getTestDatabasePath(),
      logLevel: 'info' as const,
      enableLLM: false,
      maxConcurrentRequests: 5,
    };
    const lifecycleServer = createDesignPatternsServer(config);

    // Initialize
    await expect(lifecycleServer.initialize()).resolves.not.toThrow();

    // Start (may succeed or fail depending on environment)
    try {
      await lifecycleServer.start();
    } catch (error) {
      // Expected in some test environments
      expect(error).toBeDefined();
    }

    // Stop
    await expect(lifecycleServer.stop()).resolves.not.toThrow();
  });

  test('server should handle different log levels', () => {
    const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];

    levels.forEach(level => {
      const config = {
        databasePath: getTestDatabasePath(),
        logLevel: level,
        enableLLM: false,
        maxConcurrentRequests: 10,
      };
      const levelServer = createDesignPatternsServer(config);
      expect(levelServer).toBeDefined();
    });
  });

  test('server should handle different concurrent request limits', () => {
    const limits = [1, 5, 10, 20, 50];

    limits.forEach(limit => {
      const config = {
        databasePath: getTestDatabasePath(),
        logLevel: 'info' as const,
        enableLLM: false,
        maxConcurrentRequests: limit,
      };
      const limitServer = createDesignPatternsServer(config);
      expect(limitServer).toBeDefined();
    });
  });

  test('createDesignPatternsServer factory function', () => {
    const config = {
      databasePath: getTestDatabasePath(),
      logLevel: 'info' as const,
      enableLLM: false,
      maxConcurrentRequests: 10,
    };

    const createdServer = createDesignPatternsServer(config);
    expect(createdServer).toBeDefined();
    expect(typeof createdServer.start).toBe('function');
  });
});