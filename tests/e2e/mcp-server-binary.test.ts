import { existsSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CANONICAL_TOOL_NAMES } from '../../src/mcp/canonical-tools.js';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const serverPath = path.join(projectRoot, 'dist/mcp-server.js');
const databasePath = path.join(projectRoot, 'data/design-patterns.db');

const CANONICAL_TOOLS = [...CANONICAL_TOOL_NAMES].sort();

describe('MCP server compiled binary E2E', () => {
  it('exposes canonical tools via stdio JSON-RPC', async () => {
    expect(existsSync(serverPath)).toBe(true);
    expect(existsSync(databasePath)).toBe(true);

    const client = new Client({
      name: 'e2e-binary-test',
      version: '1.0.0',
    });

    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        ...process.env,
        DATABASE_PATH: databasePath,
        LOG_LEVEL: 'error',
        ENABLE_LLM: 'false',
      },
    });

    try {
      await client.connect(transport);

      const tools = await client.listTools();
      expect(tools.tools.map(tool => tool.name).sort()).toEqual(CANONICAL_TOOLS);

      const countResult = await client.callTool({
        name: 'count_patterns',
        arguments: { includeDetails: false },
      });

      const countBlocks = countResult.content as Array<{ type: string; text?: string }>;
      const countText = countBlocks.find(block => block.type === 'text');
      expect(countText?.text).toMatch(/Total design patterns/i);

      const searchResult = await client.callTool({
        name: 'search_patterns',
        arguments: {
          query: 'factory',
          searchType: 'keyword',
          limit: 2,
        },
      });

      const searchBlocks = searchResult.content as Array<{ type: string; text?: string }>;
      const searchText = searchBlocks.find(block => block.type === 'text');
      expect(searchText?.text).toContain('strategy: keyword');
    } finally {
      await client.close();
    }
  }, 90000);
});
