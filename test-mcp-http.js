#!/usr/bin/env node
/**
 * Test client for Design Patterns MCP HTTP Server
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const SERVER_URL = process.argv[2] || 'http://localhost:3000/mcp';

async function main() {
  console.log(`Connecting to ${SERVER_URL}...`);

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  });

  const transport = new StreamableHTTPClientTransport({
    url: SERVER_URL,
    sessionId: `test-${Math.random().toString(36).slice(2)}`
  });

  try {
    await client.connect(transport);
    console.log('Connected!\n');

    // List tools
    console.log('=== Listing Tools ===');
    const tools = await client.listTools();
    console.log(`Found ${tools.tools.length} tools:\n`);
    tools.tools.forEach((tool, i) => {
      console.log(`${i + 1}. ${tool.name}`);
      console.log(`   ${tool.description?.slice(0, 100)}...`);
    });

    // Test find_patterns tool
    console.log('\n=== Testing find_patterns ===');
    const result = await client.callTool({
      name: 'find_patterns',
      arguments: {
        query: 'How to create objects with many optional parameters',
        maxResults: 3
      }
    });
    console.log(result.content[0].text);

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
