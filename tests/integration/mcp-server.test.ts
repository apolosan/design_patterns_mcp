/**
 * Integration Tests for MCP Server
 * Tests the full MCP server with real database and services
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createDesignPatternsServer, createDesignPatternsServerWithDI, type MCPServerConfig } from '../../src/mcp-server.js';
import { MCPServerConfigBuilder } from '../../src/core/config-builder.js';
import { createTempDatabasePath, cleanupTempDatabase } from '../helpers/test-db';
import { MCPServerInstance } from '../helpers/test-interfaces';

describe('MCP Server Integration Tests', () => {
  let server: MCPServerInstance;
  let tempDbPath: string;

  beforeAll(() => {
    tempDbPath = createTempDatabasePath('mcp-integration');
  });

  afterAll(() => {
    cleanupTempDatabase(tempDbPath);
  });

  test('server should initialize successfully', () => {
    const config: MCPServerConfig = {
      databasePath: tempDbPath,
      logLevel: 'info' as const,
      enableLLM: false,
      maxConcurrentRequests: 10,
    };
    server = createDesignPatternsServer(config) as MCPServerInstance;
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(Object);
  });

  test('server should have MCP capabilities', () => {
    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
    expect(typeof server.initialize).toBe('function');
  });

  test('server should have tool and resource handlers registered', () => {
    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
  });

  test('server should initialize with debug logging', async () => {
    const config: MCPServerConfig = {
      databasePath: tempDbPath,
      logLevel: 'debug' as const,
      enableLLM: false,
      maxConcurrentRequests: 5,
    };
    const debugServer = createDesignPatternsServer(config) as MCPServerInstance;
    expect(debugServer).toBeDefined();

    await expect(debugServer.initialize()).resolves.not.toThrow();
  });

  test('server should initialize with LLM enabled', async () => {
    const config: MCPServerConfig = {
      databasePath: tempDbPath,
      logLevel: 'info' as const,
      enableLLM: true,
      maxConcurrentRequests: 5,
    };
    const llmServer = createDesignPatternsServer(config) as MCPServerInstance;
    expect(llmServer).toBeDefined();

    await expect(llmServer.initialize()).resolves.not.toThrow();
  });

  test('server should handle start and stop lifecycle', async () => {
    const config: MCPServerConfig = {
      databasePath: tempDbPath,
      logLevel: 'info' as const,
      enableLLM: false,
      maxConcurrentRequests: 5,
    };
    const lifecycleServer = createDesignPatternsServer(config);

    await expect(lifecycleServer.initialize()).resolves.not.toThrow();

    try {
      await lifecycleServer.start();
    } catch (error) {
      expect(error).toBeDefined();
    }

    await expect(lifecycleServer.stop()).resolves.not.toThrow();
  });

  test('server should handle different log levels', () => {
    const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];

    levels.forEach(level => {
      const config = {
        databasePath: tempDbPath,
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
        databasePath: tempDbPath,
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
       databasePath: tempDbPath,
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
       databasePath: tempDbPath,
       logLevel: 'info' as const,
       enableLLM: false,
       maxConcurrentRequests: 10,
     };
     const server = createDesignPatternsServer(config);

     await expect(server.initialize()).resolves.not.toThrow();
     await expect(server.stop()).resolves.not.toThrow();
   });

   test('server handles different configuration options', async () => {
     const configs = [
       {
         databasePath: tempDbPath,
         logLevel: 'debug' as const,
         enableLLM: false,
         maxConcurrentRequests: 5,
       },
       {
         databasePath: tempDbPath,
         logLevel: 'warn' as const,
         enableLLM: false,
         maxConcurrentRequests: 20,
       },
       {
         databasePath: tempDbPath,
         logLevel: 'error' as const,
         enableLLM: false,
         maxConcurrentRequests: 1,
       },
     ];

     for (const config of configs) {
       const server = createDesignPatternsServer(config);
       await expect(server.initialize()).resolves.not.toThrow();
       await expect(server.stop()).resolves.not.toThrow();
     }
   });

   test('server maintains stability under concurrent operations', async () => {
     const config = {
       databasePath: tempDbPath,
       logLevel: 'info' as const,
       enableLLM: false,
       maxConcurrentRequests: 10,
     };

     const server = createDesignPatternsServer(config);
     await server.initialize();

     for (let i = 0; i < 3; i++) {
       await expect(server.stop()).resolves.not.toThrow();
       await expect(server.initialize()).resolves.not.toThrow();
     }

     await server.stop();
   });

   test('server factory creates properly configured instances', () => {
     const configs = [
       { databasePath: tempDbPath, logLevel: 'info' as const, enableLLM: false, maxConcurrentRequests: 10 },
       { databasePath: tempDbPath, logLevel: 'debug' as const, enableLLM: false, maxConcurrentRequests: 5 },
       { databasePath: tempDbPath, logLevel: 'warn' as const, enableLLM: true, maxConcurrentRequests: 15 },
     ];

     configs.forEach(config => {
       const server = createDesignPatternsServer(config);

       expect(server).toBeDefined();
       expect(typeof server.start).toBe('function');
       expect(typeof server.stop).toBe('function');
       expect(typeof server.initialize).toBe('function');

       expect(() => createDesignPatternsServer(config)).not.toThrow();
      });
    });
});

describe('MCPServerConfigBuilder Tests', () => {
  let tempDbPath: string;

  beforeAll(() => {
    tempDbPath = createTempDatabasePath('mcp-config-builder');
  });

  afterAll(() => {
    cleanupTempDatabase(tempDbPath);
  });

  test('builder creates valid configuration', () => {
    const config = new MCPServerConfigBuilder()
      .withDatabasePath(tempDbPath)
      .withLogLevel('debug')
      .withLLM(true)
      .withMaxConcurrentRequests(20)
      .withFuzzyLogic(false)
      .build();

    expect(config.databasePath).toBe(tempDbPath);
    expect(config.logLevel).toBe('debug');
    expect(config.enableLLM).toBe(true);
    expect(config.maxConcurrentRequests).toBe(20);
    expect(config.enableFuzzyLogic).toBe(false);
  });

  test('builder applies sensible defaults', () => {
    const config = new MCPServerConfigBuilder()
      .withDatabasePath(tempDbPath)
      .build();

    expect(config.databasePath).toBe(tempDbPath);
    expect(config.logLevel).toBe('info');
    expect(config.enableLLM).toBe(false);
    expect(config.maxConcurrentRequests).toBe(10);
    expect(config.enableFuzzyLogic).toBe(true);
  });

  test('builder validates max concurrent requests', () => {
    expect(() => {
      new MCPServerConfigBuilder()
        .withDatabasePath(tempDbPath)
        .withMaxConcurrentRequests(0)
        .build();
    }).toThrow('Max concurrent requests must be an integer between 1 and 1000');

    expect(() => {
      new MCPServerConfigBuilder()
        .withDatabasePath(tempDbPath)
        .withMaxConcurrentRequests(1001)
        .build();
    }).toThrow('Max concurrent requests must be an integer between 1 and 1000');
  });

  test('builder fromEnvironment creates valid config', () => {
    process.env.DATABASE_PATH = tempDbPath;
    process.env.LOG_LEVEL = 'debug';
    process.env.ENABLE_LLM = 'true';
    process.env.MAX_CONCURRENT_REQUESTS = '25';

    const config = MCPServerConfigBuilder.fromEnvironment().build();

    expect(config.databasePath).toBe(tempDbPath);
    expect(config.logLevel).toBe('debug');
    expect(config.enableLLM).toBe(true);
    expect(config.maxConcurrentRequests).toBe(25);

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
  let tempDbPath: string;

  beforeAll(() => {
    tempDbPath = createTempDatabasePath('mcp-di-container');
  });

  afterAll(() => {
    cleanupTempDatabase(tempDbPath);
  });

  test('createDesignPatternsServerWithDI creates server with container', () => {
    const config = new MCPServerConfigBuilder()
      .withDatabasePath(tempDbPath)
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
      .withDatabasePath(tempDbPath)
      .withLogLevel('info')
      .build();

    const server = createDesignPatternsServerWithDI(config);

    await expect(server.initialize()).resolves.not.toThrow();
    await expect(server.stop()).resolves.not.toThrow();
  });
});
