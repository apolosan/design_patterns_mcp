import { describe, expect, it } from 'vitest';
import {
  resolveDatabasePath,
  resolvePatternsPath,
  resolveProjectRoot,
} from '../../src/core/path-resolver.js';

describe('path-resolver', () => {
  it('resolves project root from src modules', () => {
    const root = resolveProjectRoot(
      'file:///workspace/design_patterns_mcp/src/core/config-builder.ts'
    );
    expect(root).toBe('/workspace/design_patterns_mcp');
  });

  it('resolves project root from dist modules', () => {
    const root = resolveProjectRoot('file:///workspace/design_patterns_mcp/dist/mcp-server.js');
    expect(root).toBe('/workspace/design_patterns_mcp');
  });

  it('resolves default runtime paths from module url', () => {
    expect(resolvePatternsPath('file:///workspace/design_patterns_mcp/src/mcp-server.ts')).toBe(
      '/workspace/design_patterns_mcp/data/patterns'
    );
    expect(
      resolveDatabasePath(undefined, 'file:///workspace/design_patterns_mcp/dist/mcp-server.js')
    ).toBe('/workspace/design_patterns_mcp/data/design-patterns.db');
  });

  it('preserves explicit database path overrides', () => {
    expect(
      resolveDatabasePath(
        '/custom/database.db',
        'file:///workspace/design_patterns_mcp/src/mcp-server.ts'
      )
    ).toBe('/custom/database.db');
  });
});
