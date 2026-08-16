/**
 * RED test for IMPROVEMENTS_03.md BUG-010.
 *
 * Bug: src/mcp/canonical-tools.ts:18 advertises find_patterns as
 * "Find design patterns matching a problem description using semantic search".
 *
 * However the production search pipeline (src/handlers/search-mediator.ts)
 * blends three signals:
 *   1. semantic similarity (all-MiniLM-L6-v2)
 *   2. keyword/TF-IDF match
 *   3. fuzzy inference refinement
 *
 * The description is the public contract that host LLMs read to decide
 * when to invoke the tool. Drifting it from "semantic only" to the actual
 * hybrid+fuzzy behaviour produces wrong tool selection.
 *
 * Domain contract: find_patterns.description MUST mention hybrid OR
 * blended, AND mention category metadata, so the description reflects
 * what the caller actually gets back.
 */
import { describe, it, expect } from 'vitest';
import { CANONICAL_TOOL_DEFINITIONS } from '../../src/mcp/canonical-tools.js';

describe('canonical tool definitions — find_patterns description (BUG-010)', () => {
  const find = CANONICAL_TOOL_DEFINITIONS.find((t) => t.name === 'find_patterns');

  it('exports a definition for find_patterns', () => {
    expect(find).toBeDefined();
  });

  it('description mentions hybrid or blended search strategy', () => {
    expect(find?.description.toLowerCase()).toMatch(/hybrid|blended|combined/);
  });

  it('description mentions category metadata returned to caller', () => {
    expect(find?.description.toLowerCase()).toContain('category');
  });
});
