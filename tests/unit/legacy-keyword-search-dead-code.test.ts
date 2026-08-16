/**
 * Audit guard for IMPROVEMENTS_03.md BUG-016.
 *
 * Per CHANGELOG v0.6.0 (2026-06-05): "Removed dead code
 * searchPatternsByType / keywordSearch" from the production request path.
 *
 * The internal `keywordSearch` method in src/services/pattern-matcher.ts
 * is active keyword-matching logic (callsite inside the same class), not
 * legacy dead code, and is therefore NOT covered by this assertion.
 *
 * Domain contract: production server code paths (mcp-server.ts,
 * src/mcp/*, src/lib/mcp-tools.ts) MUST NOT contain references to the
 * removed legacy symbols `keywordSearch` or `searchPatternsByType`. This
 * test guards against accidental reintroduction.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = join(import.meta.dirname, '..', '..');

const PRODUCTION_PATHS = [
  'src/mcp-server.ts',
  'src/mcp',
  'src/lib/mcp-tools.ts',
];

const FORBIDDEN_SYMBOLS = ['searchPatternsByType', 'keywordSearch'];

function listFiles(dir: string): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      entries.push(...listFiles(full));
    } else if (name.endsWith('.ts')) {
      entries.push(full);
    }
  }
  return entries;
}

function gatherProductionFiles(paths: string[]): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const abs = join(projectRoot, p);
    const st = statSync(abs);
    if (st.isDirectory()) {
      out.push(...listFiles(abs));
    } else {
      out.push(abs);
    }
  }
  return out;
}

describe('production code paths free of removed legacy symbols (BUG-016)', () => {
  const files = gatherProductionFiles(PRODUCTION_PATHS);

  for (const symbol of FORBIDDEN_SYMBOLS) {
    it(`no production file references removed symbol '${symbol}'`, () => {
      const offenders = files.filter((f) => {
        const source = readFileSync(f, 'utf-8');
        return source.includes(symbol);
      });
      expect(offenders).toEqual([]);
    });
  }
});
