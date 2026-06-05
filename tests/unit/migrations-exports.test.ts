import { describe, expect, it } from 'vitest';
import * as Migrations from '../../src/services/migrations.js';
import type {
  Migration,
  MigrationOptions,
  MigrationResult,
  MigrationStatus,
  ValidationResult,
  MigrationHealthStatus,
} from '../../src/services/migrations.js';
import type {
  MigrationRecord,
  MigrationFailure,
  ChecksumResolutionOptions,
  ResolutionResult,
  DryRunMigrationResult,
  DryRunResult,
} from '../../src/services/migrations/types.js';

describe('migrations module public exports', () => {
  it('exports MigrationManager class (runtime)', () => {
    expect(typeof Migrations.MigrationManager).toBe('function');
  });

  it('exposes Migration type at compile time', () => {
    const _type: Migration = {} as Migration;
    expect(_type).toBeDefined();
  });

  it('exposes MigrationOptions at compile time', () => {
    const _type: MigrationOptions = {} as MigrationOptions;
    expect(_type).toBeDefined();
  });

  it('exposes MigrationResult at compile time', () => {
    const _type: MigrationResult = {} as MigrationResult;
    expect(_type).toBeDefined();
  });

  it('exposes MigrationStatus at compile time', () => {
    const _type: MigrationStatus = {} as MigrationStatus;
    expect(_type).toBeDefined();
  });

  it('exposes ValidationResult at compile time', () => {
    const _type: ValidationResult = {} as ValidationResult;
    expect(_type).toBeDefined();
  });

  it('exposes MigrationHealthStatus at compile time', () => {
    const _type: MigrationHealthStatus = {} as MigrationHealthStatus;
    expect(_type).toBeDefined();
  });

  it('exposes additional types in migrations/types.ts for module completeness', () => {
    const _a: MigrationRecord = {} as MigrationRecord;
    const _b: MigrationFailure = {} as MigrationFailure;
    const _c: ChecksumResolutionOptions = {} as ChecksumResolutionOptions;
    const _d: ResolutionResult = {} as ResolutionResult;
    const _e: DryRunMigrationResult = {} as DryRunMigrationResult;
    const _f: DryRunResult = {} as DryRunResult;
    expect([_a, _b, _c, _d, _e, _f]).toBeDefined();
  });
});
