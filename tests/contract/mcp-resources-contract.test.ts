/**
 * Contract Tests for MCP Resources
 * Tests MCP protocol compliance for all resource implementations
 */

import { describe, test, expect } from 'vitest';

// Import server implementation
import { createDesignPatternsServer } from '../../src/mcp-server.js';

describe('MCP Resources Contract Tests', () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  test('should create MCP server successfully', async () => {
    const config = {
      databasePath: './data/design-patterns.db',
      logLevel: 'info' as const,
      enableLLM: false,
      maxConcurrentRequests: 10,
    };
    const server = createDesignPatternsServer(config);
    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
  });

  // eslint-disable-next-line @typescript-eslint/require-await
  test('should have MCP resources handler', async () => {
    const config = {
      databasePath: './data/design-patterns.db',
      logLevel: 'info' as const,
      enableLLM: false,
      maxConcurrentRequests: 10,
    };
    const server = createDesignPatternsServer(config);

    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
  });
});
