import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { CANONICAL_TOOL_NAMES } from '../../src/mcp/canonical-tools.js';
import { createHttpToolHandlers } from '../../src/mcp/http-tool-handlers.js';

const projectRoot = path.resolve(import.meta.dirname, '../..');

describe('MCP modularization', () => {
  it('keeps mcp-server.ts under 900 lines after extraction', () => {
    const serverPath = path.join(projectRoot, 'src/mcp-server.ts');
    const lineCount = readFileSync(serverPath, 'utf-8').split('\n').length;
    expect(lineCount).toBeLessThan(900);
  });

  it('keeps migrations.ts under 1250 lines after type extraction', () => {
    const migrationsPath = path.join(projectRoot, 'src/services/migrations.ts');
    const lineCount = readFileSync(migrationsPath, 'utf-8').split('\n').length;
    expect(lineCount).toBeLessThan(1250);
  });

  it('does not contain legacy searchPatternsByType in mcp-server', () => {
    const source = readFileSync(path.join(projectRoot, 'src/mcp-server.ts'), 'utf-8');
    expect(source).not.toContain('searchPatternsByType');
    expect(source).not.toContain('keywordSearch');
  });

  it('exports canonical tool names matching HTTP handler definitions', () => {
    expect(CANONICAL_TOOL_NAMES).toHaveLength(5);
    expect(CANONICAL_TOOL_NAMES).toContain('find_patterns');
    expect(typeof createHttpToolHandlers).toBe('function');
  });
});
