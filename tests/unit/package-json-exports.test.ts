/**
 * RED test for IMPROVEMENTS_03.md BUG-004.
 *
 * Bug: package.json `exports` map uses a misleading `./lib` key that
 * actually resolves to `dist/lib/mcp-tools.js`. Consumers and tooling
 * reading the exports map cannot infer which artifact each subpath
 * provides.
 *
 * Domain contract: each exports subpath key MUST reflect the artifact
 * being exposed. `./tools` resolves to the canonical tools module,
 * `./resources` resolves to the resources module, and `.` resolves to
 * the server runtime. The misleading `./lib` alias is removed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface PkgJson {
  exports?: Record<
    string,
    { types?: string; import?: string; require?: string } | string
  >;
}

describe('package.json — exports subpath naming (BUG-004)', () => {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8')
  ) as PkgJson;
  const exports_ = pkg.exports ?? {};

  it('has a canonical server entry under "."', () => {
    expect(exports_).toHaveProperty('.');
  });

  it('exposes the tools module under "./tools" (matches mcp-tools.js)', () => {
    expect(exports_).toHaveProperty('./tools');
  });

  it('exposes the resources module under "./resources" (matches mcp-resources.js)', () => {
    expect(exports_).toHaveProperty('./resources');
  });

  it('does NOT retain the misleading "./lib" alias', () => {
    expect(exports_).not.toHaveProperty('./lib');
  });
});
