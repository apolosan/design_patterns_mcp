import { describe, expect, it, vi } from 'vitest';
import { createDesignPatternsServer, type MCPServerConfig } from '../../src/mcp-server.js';

type TestServerInternals = {
  searchMediator: {
    searchByType: ReturnType<typeof vi.fn>;
  };
  handleSearchPatterns(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }>;
};

describe('mcp-server search_patterns', () => {
  function createTestServer(): TestServerInternals {
    const config: MCPServerConfig = {
      databasePath: './data/design-patterns.db',
      logLevel: 'info',
      enableLLM: false,
      maxConcurrentRequests: 10,
    };

    const server = createDesignPatternsServer(config) as unknown as TestServerInternals;
    server.searchMediator = {
      searchByType: vi.fn(),
    };

    return server;
  }

  it('uses keyword strategy for legacy search_type requests', async () => {
    const server = createTestServer();
    server.searchMediator.searchByType.mockResolvedValue({
      recommendations: [
        {
          pattern: {
            id: 'builder',
            name: 'Builder',
            category: 'Creational',
            description: 'Builds complex objects step by step',
            complexity: 'Intermediate',
            tags: ['creational'],
          },
          confidence: 0.9,
          justification: { primaryReason: 'keyword match' },
        },
      ],
      searchTypeUsed: 'keyword',
      degraded: false,
    });

    const response = await server.handleSearchPatterns({
      query: 'builder',
      search_type: 'keyword',
      limit: 5,
    });

    expect(server.searchMediator.searchByType).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'builder', maxResults: 5 }),
      'keyword'
    );
    expect(response.content[0]?.text).toContain('strategy: keyword');
    expect(response.content[0]?.text).toContain('Builder');
  });

  it('reports degraded fallback when mediator returns keyword fallback', async () => {
    const server = createTestServer();
    server.searchMediator.searchByType.mockResolvedValue({
      recommendations: [
        {
          pattern: {
            id: 'builder',
            name: 'Builder',
            category: 'Creational',
            description: 'Builds complex objects step by step',
            complexity: 'Intermediate',
            tags: ['creational'],
          },
          confidence: 0.5,
          justification: { primaryReason: 'fallback' },
        },
      ],
      searchTypeUsed: 'keyword',
      degraded: true,
    });

    const response = await server.handleSearchPatterns({
      query: 'builder',
      searchType: 'hybrid',
      limit: 5,
    });

    expect(server.searchMediator.searchByType).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'builder', maxResults: 5 }),
      'hybrid'
    );
    expect(response.content[0]?.text).toContain('strategy: keyword');
    expect(response.content[0]?.text).toContain('falling back to keyword search');
  });
});
