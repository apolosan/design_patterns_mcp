import { describe, expect, it } from 'vitest';
import type { PatternRow } from '../../src/mcp/types.js';
import { parseTags } from '../../src/utils/parse-tags.js';

describe('PatternRow.tags consistency', () => {
  it('accepts JSON-string tags (database representation)', () => {
    const row: PatternRow = { id: 'a', name: 'A', category: 'X', tags: '["foo","bar"]' };
    expect(row.tags).toBe('["foo","bar"]');
  });

  it('parses tags string to string[] via parseTags', () => {
    const row: PatternRow = { id: 'a', name: 'A', category: 'X', tags: '["foo","bar"]' };
    const tags = parseTags(row.tags);
    expect(Array.isArray(tags)).toBe(true);
    expect(tags).toEqual(['foo', 'bar']);
  });

  it('handles undefined tags (nullable)', () => {
    const row: PatternRow = { id: 'a', name: 'A', category: 'X' };
    expect(row.tags).toBeUndefined();
    expect(parseTags(row.tags)).toEqual([]);
  });

  it('handles empty string tags', () => {
    const row: PatternRow = { id: 'a', name: 'A', category: 'X', tags: '' };
    expect(parseTags(row.tags)).toEqual([]);
  });

  it('JSON-string format is the canonical database representation', () => {
    // Document the contract: tags in the DB column is JSON-encoded
    const row: PatternRow = { id: 'a', name: 'A', category: 'X', tags: '["x"]' };
    const isJsonString = typeof row.tags === 'string' && row.tags.startsWith('[');
    expect(isJsonString).toBe(true);
  });
});
