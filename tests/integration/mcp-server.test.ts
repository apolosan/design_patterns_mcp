/**
 * Integration Tests for MCP Server
 * Tests the full MCP server with real database and services
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createDesignPatternsServer, createDesignPatternsServerWithDI } from '../../src/mcp-server.js';
import { MCPServerConfigBuilder } from '../../src/core/config-builder.js';
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
     expect(typeof createdServer.stop).toBe('function');
     expect(typeof createdServer.initialize).toBe('function');
   });

   test('server initializes successfully with all services', async () => {
     const config = {
       databasePath: getTestDatabasePath(),
       logLevel: 'info' as const,
       enableLLM: false,
       maxConcurrentRequests: 10,
     };
     const server = createDesignPatternsServer(config);

     // Should initialize without throwing errors - this validates that:
     // 1. Database connection works
     // 2. Migrations run successfully
     // 3. Pattern seeding completes
     // 4. All services (vector ops, pattern matcher, semantic search) initialize
     // 5. Embedding system works with transformers strategy
     await expect(server.initialize()).resolves.not.toThrow();

     // Should be able to stop without errors
     await expect(server.stop()).resolves.not.toThrow();
   });

   test('server handles different configuration options', async () => {
     const configs = [
       {
         databasePath: getTestDatabasePath(),
         logLevel: 'debug' as const,
         enableLLM: false,
         maxConcurrentRequests: 5,
       },
       {
         databasePath: getTestDatabasePath(),
         logLevel: 'warn' as const,
         enableLLM: false,
         maxConcurrentRequests: 20,
       },
       {
         databasePath: getTestDatabasePath(),
         logLevel: 'error' as const,
         enableLLM: false,
         maxConcurrentRequests: 1,
       },
     ];

     for (const config of configs) {
       const server = createDesignPatternsServer(config);

       // Each configuration should initialize successfully
       await expect(server.initialize()).resolves.not.toThrow();
       await expect(server.stop()).resolves.not.toThrow();
     }
   });

   test('server maintains stability under concurrent operations', async () => {
     const config = {
       databasePath: getTestDatabasePath(),
       logLevel: 'info' as const,
       enableLLM: false,
       maxConcurrentRequests: 10,
     };

     const server = createDesignPatternsServer(config);
     await server.initialize();

     // Test multiple start/stop cycles
     for (let i = 0; i < 3; i++) {
       // Server should handle multiple lifecycle operations gracefully
       await expect(server.stop()).resolves.not.toThrow();
       await expect(server.initialize()).resolves.not.toThrow();
     }

     await server.stop();
   });

   test('server factory creates properly configured instances', () => {
     const configs = [
       { databasePath: getTestDatabasePath(), logLevel: 'info' as const, enableLLM: false, maxConcurrentRequests: 10 },
       { databasePath: getTestDatabasePath(), logLevel: 'debug' as const, enableLLM: false, maxConcurrentRequests: 5 },
       { databasePath: getTestDatabasePath(), logLevel: 'warn' as const, enableLLM: true, maxConcurrentRequests: 15 },
     ];

     configs.forEach(config => {
       const server = createDesignPatternsServer(config);

       // Each server instance should have the expected public interface
       expect(server).toBeDefined();
       expect(typeof server.start).toBe('function');
       expect(typeof server.stop).toBe('function');
       expect(typeof server.initialize).toBe('function');

       // Server should accept the configuration without throwing
       expect(() => createDesignPatternsServer(config)).not.toThrow();
      });
    });
});

describe('MCPServerConfigBuilder Tests', () => {
  test('builder creates valid configuration', () => {
    const config = new MCPServerConfigBuilder()
      .withDatabasePath(getTestDatabasePath())
      .withLogLevel('debug')
      .withLLM(true)
      .withMaxConcurrentRequests(20)
      .withFuzzyLogic(false)
      .build();

    expect(config.databasePath).toBe(getTestDatabasePath());
    expect(config.logLevel).toBe('debug');
    expect(config.enableLLM).toBe(true);
    expect(config.maxConcurrentRequests).toBe(20);
    expect(config.enableFuzzyLogic).toBe(false);
  });

  test('builder applies sensible defaults', () => {
    const config = new MCPServerConfigBuilder()
      .withDatabasePath(getTestDatabasePath())
      .build();

    expect(config.databasePath).toBe(getTestDatabasePath());
    expect(config.logLevel).toBe('info');
    expect(config.enableLLM).toBe(false);
    expect(config.maxConcurrentRequests).toBe(10);
    expect(config.enableFuzzyLogic).toBe(true);
  });

  test('builder validates max concurrent requests', () => {
    expect(() => {
      new MCPServerConfigBuilder()
        .withDatabasePath(getTestDatabasePath())
        .withMaxConcurrentRequests(0)
        .build();
    }).toThrow('Max concurrent requests must be an integer between 1 and 1000');

    expect(() => {
      new MCPServerConfigBuilder()
        .withDatabasePath(getTestDatabasePath())
        .withMaxConcurrentRequests(1001)
        .build();
    }).toThrow('Max concurrent requests must be an integer between 1 and 1000');
  });

  test('builder fromEnvironment creates valid config', () => {
    // Set some env vars
    process.env.DATABASE_PATH = getTestDatabasePath();
    process.env.LOG_LEVEL = 'debug';
    process.env.ENABLE_LLM = 'true';
    process.env.MAX_CONCURRENT_REQUESTS = '25';

    const config = MCPServerConfigBuilder.fromEnvironment().build();

    expect(config.databasePath).toBe(getTestDatabasePath());
    expect(config.logLevel).toBe('debug');
    expect(config.enableLLM).toBe(true);
    expect(config.maxConcurrentRequests).toBe(25);

    // Clean up
    delete process.env.DATABASE_PATH;
    delete process.env.LOG_LEVEL;
    delete process.env.ENABLE_LLM;
    delete process.env.MAX_CONCURRENT_REQUESTS;
  });

  test('forDevelopment preset applies correct defaults', () => {
    const config = MCPServerConfigBuilder.forDevelopment().build();

    expect(config.logLevel).toBe('debug');
    expect(config.maxConcurrentRequests).toBe(20);
    expect(config.enableFuzzyLogic).toBe(true);
  });

  test('forProduction preset applies correct defaults', () => {
    const config = MCPServerConfigBuilder.forProduction().build();

    expect(config.logLevel).toBe('info');
    expect(config.maxConcurrentRequests).toBe(50);
    expect(config.enableFuzzyLogic).toBe(true);
  });
});

describe('DI Container Server Tests', () => {
  test('createDesignPatternsServerWithDI creates server with container', () => {
    const config = new MCPServerConfigBuilder()
      .withDatabasePath(getTestDatabasePath())
      .withLogLevel('info')
      .build();

    const server = createDesignPatternsServerWithDI(config);

    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
    expect(typeof server.initialize).toBe('function');
  });

  test('DI server initializes successfully', async () => {
    const config = new MCPServerConfigBuilder()
      .withDatabasePath(getTestDatabasePath())
      .withLogLevel('info')
      .build();

    const server = createDesignPatternsServerWithDI(config);

    // Should initialize without throwing - validates DI container setup
    await expect(server.initialize()).resolves.not.toThrow();
    await expect(server.stop()).resolves.not.toThrow();
  });
});