#!/usr/bin/env node
/**
 * Post-build sanity check: ensures declared entrypoints exist on disk.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let packageJson;
try {
  packageJson = JSON.parse(
    readFileSync(path.join(projectRoot, 'package.json'), 'utf-8')
  );
} catch (err) {
  console.error('verify-build: failed to read package.json');
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}

const requiredPaths = new Set();
try {
  requiredPaths.add(packageJson.main ?? 'dist/mcp-server.js');
} catch (err) {
  console.error('verify-build: package.json is missing "main" entry');
  process.exit(2);
}

const fixedPaths = [
  'dist/cli/migrate.js',
  'dist/cli/seed.js',
  'dist/cli/generate-embeddings.js',
  'dist/cli/setup-relationships.js',
  'dist/cli/integrity-check.js',
];
for (const entry of fixedPaths) {
  requiredPaths.add(entry);
}

if (packageJson.bin && typeof packageJson.bin === 'object') {
  for (const binPath of Object.values(packageJson.bin)) {
    if (typeof binPath === 'string') {
      requiredPaths.add(binPath.replace(/^\.\//, ''));
    }
  }
}

const missing = [...requiredPaths].filter((relativePath) => {
  if (typeof relativePath !== 'string' || relativePath.length === 0) return false;
  return !existsSync(path.join(projectRoot, relativePath));
});

if (missing.length > 0) {
  console.error('verify-build failed. Missing files:');
  for (const entry of missing) {
    console.error(`  - ${entry}`);
  }
  process.exit(1);
}

console.log(`verify-build ok (${requiredPaths.size} entrypoints)`);
