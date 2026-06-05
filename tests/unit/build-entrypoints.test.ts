import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const packageJsonPath = path.join(projectRoot, 'package.json');

interface PackageJson {
  main?: string;
  module?: string;
  types?: string;
  bin?: Record<string, string>;
  exports?: Record<string, { import?: string; require?: string; types?: string } | string>;
  scripts?: Record<string, string>;
}

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJson;
}

function collectDeclaredDistPaths(pkg: PackageJson): string[] {
  const paths = new Set<string>();

  for (const value of [pkg.main, pkg.module, pkg.types]) {
    if (value) {
      paths.add(value);
    }
  }

  if (pkg.bin) {
    for (const value of Object.values(pkg.bin)) {
      paths.add(value);
    }
  }

  if (pkg.exports) {
    for (const entry of Object.values(pkg.exports)) {
      if (typeof entry === 'string') {
        paths.add(entry.replace(/^\.\//, ''));
        continue;
      }
      for (const value of [entry.import, entry.require, entry.types]) {
        if (value) {
          paths.add(value.replace(/^\.\//, ''));
        }
      }
    }
  }

  return [...paths];
}

function collectScriptDistPaths(scripts: Record<string, string> | undefined): string[] {
  if (!scripts) {
    return [];
  }

  const matches = Object.values(scripts).flatMap((script) =>
    [...script.matchAll(/\bdist\/[\w./-]+\.js\b/g)].map((match) => match[0])
  );

  return [...new Set(matches)];
}

describe('build entrypoints', () => {
  it('does not reference obsolete dist/src paths in package metadata', () => {
    const pkg = readPackageJson();
    const declaredPaths = collectDeclaredDistPaths(pkg);

    expect(declaredPaths.length).toBeGreaterThan(0);
    expect(declaredPaths.every((entry) => !entry.includes('dist/src/'))).toBe(true);
  });

  it('does not reference obsolete dist/src paths in npm scripts', () => {
    const pkg = readPackageJson();
    const scriptPaths = collectScriptDistPaths(pkg.scripts);

    expect(scriptPaths.length).toBeGreaterThan(0);
    expect(scriptPaths.every((entry) => !entry.includes('dist/src/'))).toBe(true);
  });

  it('declares canonical dist/mcp-server.js entrypoint that exists after build', () => {
    const pkg = readPackageJson();
    expect(pkg.main).toBe('dist/mcp-server.js');

    const mainPath = path.join(projectRoot, pkg.main ?? '');
    expect(existsSync(mainPath)).toBe(true);
  });

  it('declares CLI bin paths that exist after build', () => {
    const pkg = readPackageJson();
    const expectedBins = [
      'dist/mcp-server.js',
      'dist/cli/migrate.js',
      'dist/cli/seed.js',
      'dist/cli/generate-embeddings.js',
    ];

    for (const expected of expectedBins) {
      expect(pkg.bin?.['design-patterns-mcp'] ?? pkg.bin?.[Object.keys(pkg.bin ?? {})[0] ?? '']).toBeDefined();
      expect(existsSync(path.join(projectRoot, expected))).toBe(true);
    }
  });
});
