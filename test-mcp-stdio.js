#!/usr/bin/env node
/**
 * Test client for Design Patterns MCP STDIO Server
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER_PATH = process.argv[2] || './dist/src/mcp-server.js';

async function main() {
  console.log(`Connecting to STDIO server: ${SERVER_PATH}...`);

  const client = new Client({
    name: 'test-client-stdio',
    version: '1.0.0'
  });

  const transport = new StdioClientTransport({
    command: 'node',
    args: [SERVER_PATH]
  });

  try {
    await client.connect(transport);
    console.log('Connected!\n');

    console.log('=== Listing Tools ===');
    const tools = await client.listTools();
    console.log(`Found ${tools.tools.length} tools:\n`);
    tools.tools.forEach((tool, i) => {
      console.log(`${i + 1}. ${tool.name}`);
      console.log(`   ${tool.description?.slice(0, 100)}...`);
    });

    console.log('\n=== Testing find_patterns ===');
    const result = await client.callTool({
      name: 'find_patterns',
      arguments: {
        query: 'How to create objects with many optional parameters',
        maxResults: 3
      }
    });
    console.log(result.content[0].text);

    console.log('\n=== Testing search_patterns ===');
    const searchResult = await client.callTool({
      name: 'search_patterns',
      arguments: {
        query: 'factory',
        limit: 3,
        searchType: 'keyword'
      }
    });
    console.log(searchResult.content[0].text);

    console.log('\n=== Testing get_pattern_details ===');
    const detailsResult = await client.callTool({
      name: 'get_pattern_details',
      arguments: {
        patternId: 'builder'
      }
    });
    console.log(detailsResult.content[0].text);

    console.log('\n=== Testing count_patterns ===');
    const countResult = await client.callTool({
      name: 'count_patterns',
      arguments: {
        includeDetails: true
      }
    });
    console.log(countResult.content[0].text);

    console.log('\n✅ STDIO Test completed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
