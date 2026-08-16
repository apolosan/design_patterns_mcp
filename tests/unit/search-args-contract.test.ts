/**
 * RED test for IMPROVEMENTS_03.md BUG-007.
 *
 * Bug: src/utils/input-validation.ts line 479 accepts BOTH `searchType`
 * (camelCase, the canonical MCP contract per canonical-tools.ts) AND
 * `search_type` (snake_case, the legacy convention used by lib/mcp-tools.ts
 * and src/types/mcp-args.ts). The undefined coalesce lets incompatible
 * callers slip through and creates ambiguous contract semantics for host
 * LLMs that read the tool definition.
 *
 * Domain contract: validateSearchPatternsArgs MUST enforce the canonical
 * camelCase `searchType`. Snake-case `search_type` arguments MUST be
 * rejected with an MCP InvalidParams error. The legacy lib/mcp-tools.ts
 * path (off the canonical request path) keeps snake_case for its own
 * internal use but does not advertise it.
 */
import { describe, it, expect } from 'vitest';
import { InputValidator } from '../../src/utils/input-validation.js';

describe('search_patterns args contract (BUG-007)', () => {
  it('accepts canonical camelCase searchType', () => {
    const result = InputValidator.validateSearchPatternsArgs({
      query: 'factory method',
      searchType: 'keyword',
    });
    expect(result.searchType).toBe('keyword');
  });

  it('ignores snake_case search_type (legacy field); defaults to hybrid', () => {
    // The canonical MCP schema (canonical-tools.ts) declares searchType with
    // default 'hybrid'. snake_case `search_type` is not part of the contract:
    // passing it must be silently ignored and the canonical default applied.
    const result = InputValidator.validateSearchPatternsArgs({
      query: 'factory method',
      search_type: 'keyword',
    });
    expect(result.searchType).toBe('hybrid');
  });
});
