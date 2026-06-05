/**
 * Migration system type definitions.
 */

export interface Migration {
  id: string;
  name: string;
  up: string;
  down: string;
  createdAt: Date;
}

export interface MigrationRecord {
  id: string;
  name: string;
  executedAt: Date;
  checksum: string;
}

export interface MigrationOptions {
  validateFirst?: boolean;
  continueOnError?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  dryRun?: boolean;
  forceChecksumUpdate?: boolean;
  skipFailedMigrations?: boolean;
}

export interface MigrationFailure {
  migration: string;
  error: Error;
  timestamp: Date;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  executed?: MigrationRecord[];
  rolledBack?: MigrationRecord[];
  failed?: MigrationFailure[];
  error?: Error;
}

export interface MigrationStatus {
  total: number;
  executed: number;
  pending: number;
  lastExecuted: MigrationRecord | null;
  nextPending: Migration | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface MigrationHealthStatus {
  totalMigrations: number;
  executedMigrations: number;
  pendingMigrations: number;
  checksumMismatches: number;
  validationErrors: number;
  healthy: boolean;
  lastExecuted: MigrationRecord | null;
  issues: string[];
}

export interface ChecksumResolutionOptions {
  forceUpdate?: boolean;
  skipValidation?: boolean;
}

export interface ResolutionResult {
  success: boolean;
  message: string;
  expectedChecksum?: string;
  actualChecksum?: string;
}

export interface DryRunMigrationResult {
  migration: string;
  valid: boolean;
  errors: string[];
  checksum: string;
}

export interface DryRunResult {
  success: boolean;
  message: string;
  migrations: DryRunMigrationResult[];
}
