#!/usr/bin/env node
/**
 * Pattern Relationship Integrity Check CLI
 * Verifies all pattern relationships are valid
 */
import { DatabaseManager } from '../services/database-manager.js';
import { RelationshipIntegrityChecker } from '../services/relationship-integrity-checker.js';
import { validatePatternFile, formatValidationResult } from '../utils/pattern-schema-validation.js';
import fs from 'fs';
import path from 'path';

interface CLIOptions {
  fix: boolean;
  verbose: boolean;
  schemaCheck: boolean;
  jsonOutput: boolean;
}

async function main(): Promise<void> {
  const options: CLIOptions = parseArguments();

  const dbPath = process.env.DATABASE_PATH || './data/design-patterns.db';
  const db = new DatabaseManager({ filename: dbPath });

  try {
    await db.initialize();

    if (options.schemaCheck) {
      await runSchemaValidation(options.verbose);
    }

    await runIntegrityCheck(db, options);

  } catch (error) {
    console.error('Integrity check failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

function parseArguments(): CLIOptions {
  const args = process.argv.slice(2);
  return {
    fix: args.includes('--fix'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    schemaCheck: args.includes('--schema') || args.includes('-s'),
    jsonOutput: args.includes('--json')
  };
}

async function runSchemaValidation(verbose: boolean): Promise<void> {
  console.log('Running schema validation...');
  console.log('');

  const patternsPath = './data/patterns';
  const files = fs.readdirSync(patternsPath).filter(f => f.endsWith('.json'));

  let totalErrors = 0;
  let totalWarnings = 0;
  const results: Array<{ file: string; valid: boolean; errors: number; warnings: number }> = [];

  for (const file of files) {
    const filePath = path.join(patternsPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = validatePatternFile(filePath, content);

    if (verbose || !result.valid) {
      console.log(formatValidationResult(result, file));
      console.log('');
    }

    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
    results.push({ file, valid: result.valid, errors: result.errors.length, warnings: result.warnings.length });
  }

  console.log('═'.repeat(50));
  console.log('SCHEMA VALIDATION SUMMARY');
  console.log('═'.repeat(50));
  console.log(`Total files: ${files.length}`);
  console.log(`Valid: ${results.filter(r => r.valid).length}`);
  console.log(`Invalid: ${results.filter(r => !r.valid).length}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Total warnings: ${totalWarnings}`);
  console.log('');

  if (totalErrors > 0) {
    console.log('Schema validation FAILED');
    process.exit(1);
  } else if (verbose) {
    console.log('Schema validation passed');
  }
}

async function runIntegrityCheck(db: DatabaseManager, options: CLIOptions): Promise<void> {
  console.log('Running relationship integrity check...');
  console.log('');

  const checker = new RelationshipIntegrityChecker(db);
  const result = await checker.checkIntegrity();

  if (options.jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(checker.formatReport(result));
  console.log('');

  if (result.brokenReferences.length > 0 && options.fix) {
    console.log('Fixing broken references...');
    const fixResult = await checker.fixBrokenReferences();
    console.log(`Fixed: ${fixResult.fixed}`);
    console.log(`Failed: ${fixResult.failed}`);

    if (fixResult.errors.length > 0) {
      console.log('');
      console.log('Errors:');
      for (const error of fixResult.errors) {
        console.log(`  - ${error}`);
      }
    }

    console.log('');
    console.log('Running check again to verify...');
    const recheck = await checker.checkIntegrity();
    if (recheck.valid) {
      console.log('All issues fixed!');
    } else {
      console.log('Some issues remain. Consider manual review.');
    }
  }

  if (!result.valid && !options.fix) {
    console.log('Integrity check FAILED');
    console.log('');
    console.log('To fix automatically, run:');
    console.log('  bun run integrity-check --fix');
    process.exit(1);
  }

  console.log(`Check completed in ${result.duration}ms`);
}

main().catch(console.error);
