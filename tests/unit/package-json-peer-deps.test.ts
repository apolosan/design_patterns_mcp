/**
 * RED test for IMPROVEMENTS_03.md BUG-005.
 *
 * Bug: package.json declares @modelcontextprotocol/sdk in BOTH
 * peerDependencies (^1.18.0, optional:false) and dependencies (^1.20.0).
 * Peer deps are conceptually wrong for a server runtime (they apply to
 * libraries), and the version constraint in peer (^1.18.0) is looser
 * than the actual installed (^1.20.0), creating a confusing duplicate.
 *
 * Domain contract: package.json MUST NOT declare @modelcontextprotocol/sdk
 * as a peerDependency. The production dependency declaration in
 * `dependencies` is the single source of truth for runtime SDK resolution.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface PkgJson {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

describe('package.json — no peerDependencies for SDK (BUG-005)', () => {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8')
  ) as PkgJson;

  it('@modelcontextprotocol/sdk is NOT declared in peerDependencies', () => {
    expect(pkg.peerDependencies?.['@modelcontextprotocol/sdk']).toBeUndefined();
  });

  it('@modelcontextprotocol/sdk remains in dependencies (single source of truth)', () => {
    expect(pkg.dependencies?.['@modelcontextprotocol/sdk']).toMatch(/\^1\./);
  });

  it('peerDependenciesMeta has no SDK entry', () => {
    expect(pkg.peerDependenciesMeta?.['@modelcontextprotocol/sdk']).toBeUndefined();
  });
});
