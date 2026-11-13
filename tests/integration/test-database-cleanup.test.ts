/**
 * Acceptance test — "is the temporary database copy deleted after the tests
 * run?"
 *
 * Runs one real test file in a nested vitest process, through the suite's own
 * setup, and inspects the disk after that process has exited. The probe file
 * opens its catalog for writing, inserts a row, exports it on close and
 * creates a scratch database (tests/fixtures/database-cleanup/catalog.probe.ts).
 *
 * Requirements:
 *  - nothing a test file created survives it: neither its catalog copy, nor
 *    its scratch databases, nor the directory that held them (before this was
 *    enforced, scratch databases piled up in temp/test-databases run after
 *    run);
 *  - the file works on a copy, never on data/design-patterns.db, and what it
 *    writes does not reach that file.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const REAL_CATALOG = path.join(PROJECT_ROOT, 'data', 'design-patterns.db');
const VITEST_CLI = path.join(PROJECT_ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const PROBE_CONFIG = path.join('tests', 'fixtures', 'database-cleanup', 'vitest.config.ts');

interface ProbeReport {
  catalogPath: string;
  scratchPath: string;
  patterns: number;
}

function checksum(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Runs the probe file in its own vitest process and returns what it reported. */
function runProbeFile(): ProbeReport {
  const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'database-cleanup-probe-'));
  const reportPath = path.join(reportDir, 'report.json');
  try {
    // The nested process is a fresh run, not a worker of this one.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.startsWith('VITEST'))
    );
    const child = spawnSync(process.execPath, [VITEST_CLI, 'run', '--config', PROBE_CONFIG], {
      cwd: PROJECT_ROOT,
      env: { ...env, DATABASE_CLEANUP_PROBE_REPORT: reportPath },
      encoding: 'utf-8',
      timeout: 120_000,
    });
    if (child.status !== 0 || !fs.existsSync(reportPath)) {
      throw new Error(
        `The probe run failed (exit ${String(child.status)}):\n${child.stdout}\n${child.stderr}`
      );
    }
    return JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as ProbeReport;
  } finally {
    fs.rmSync(reportDir, { recursive: true, force: true });
  }
}

describe('Test database cleanup after a test file finishes', () => {
  it('leaves no catalog copy, scratch database or scratch directory behind, and the real catalog untouched', () => {
    const catalogBefore = checksum(REAL_CATALOG);

    const report = runProbeFile();

    expect(report.patterns).toBeGreaterThan(0);
    expect(path.resolve(report.catalogPath)).not.toBe(REAL_CATALOG);
    expect(fs.existsSync(report.catalogPath)).toBe(false);
    expect(fs.existsSync(report.scratchPath)).toBe(false);
    expect(fs.existsSync(path.dirname(report.catalogPath))).toBe(false);
    expect(fs.existsSync(path.dirname(report.scratchPath))).toBe(false);
    expect(checksum(REAL_CATALOG)).toBe(catalogBefore);
  }, 150_000);
});
