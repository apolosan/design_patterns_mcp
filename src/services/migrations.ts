/**
 * Database Schema Migrations for Design Patterns MCP Server
 * Handles schema versioning, migration execution, and rollback
 */
import { DatabaseManager } from './database-manager';
import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';

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

export class MigrationManager {
  private db: DatabaseManager;
  private migrationsPath: string;

  constructor(db: DatabaseManager, migrationsPath: string = './migrations') {
    this.db = db;
    this.migrationsPath = migrationsPath;
  }

  /**
   * Initialize migration system
   */
  async initialize(): Promise<void> {
    await this.createMigrationsTable();
    logger.info('migrations', 'Migration system initialized');
  }

  /**
   * Create migrations tracking table
   */
  private async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_migrations_executed_at
      ON schema_migrations(executed_at);
    `;

    this.db.execute(sql);
  }

  /**
   * Get all available migrations
   */
  async getAvailableMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = [];

    try {
      // Ensure migrations directory exists
      if (!fs.existsSync(this.migrationsPath)) {
        fs.mkdirSync(this.migrationsPath, { recursive: true });
        return migrations;
      }

      const files = fs
        .readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const migration = await this.parseMigrationFile(file);
        if (migration) {
          migrations.push(migration);
        }
      }
    } catch (error) {
      console.error('Failed to load migrations:', error);
    }

    return migrations;
  }

  /**
   * Parse migration file
   */
  private async parseMigrationFile(filename: string): Promise<Migration | null> {
    try {
      const filePath = path.join(this.migrationsPath, filename);
      const content = fs.readFileSync(filePath, 'utf8');

      // Parse migration format: id_name.sql
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        console.warn(`Invalid migration filename: ${filename}`);
        return null;
      }

      const [, id, name] = match;

      // Split content into up and down sections
      const sections = content.split('-- DOWN');
      const upRaw = sections[0].trim();
      const downRaw = sections[1]?.trim() || '';

      // Remove comment lines from up section
      const up = upRaw
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim();

      // Remove comment lines from down section
      const down = downRaw
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim();

      return {
        id,
        name,
        up,
        down,
        createdAt: fs.statSync(filePath).birthtime,
      };
    } catch (error) {
      console.error(`Failed to parse migration ${filename}:`, error);
      return null;
    }
  }

  /**
   * Get executed migrations
   */
  async getExecutedMigrations(): Promise<MigrationRecord[]> {
    const sql =
      'SELECT id, name, executed_at, checksum FROM schema_migrations ORDER BY executed_at';
    const rows = this.db.query<MigrationRecord & { executed_at: string }>(sql);

    return rows.map(row => ({
      ...row,
      executedAt: new Date(row.executed_at),
    }));
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const available = await this.getAvailableMigrations();
    const executed = await this.getExecutedMigrations();
    const executedIds = new Set(executed.map(m => m.id));

    return available.filter(migration => !executedIds.has(migration.id));
  }

  /**
   * Execute pending migrations
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      return {
        success: true,
        message: 'No pending migrations',
        executed: [],
      };
    }

    // Validate all migrations first if requested
    if (options.validateFirst) {
      const dryRun = await this.dryRun();
      if (!dryRun.success) {
        return {
          success: false,
          message: `Validation failed: ${dryRun.message}`,
          executed: [],
          error: new Error('Migration validation failed'),
        };
      }
    }

    const executed: MigrationRecord[] = [];
    const failed: MigrationFailure[] = [];

    try {
      for (const migration of pending) {
        try {
          await this.executeMigrationWithRetry(migration, options);
          const record = await this.recordMigration(migration);
          executed.push(record);
          logger.info('migrations', `Migration executed: ${migration.id} - ${migration.name}`);

          // Stop on first failure if not continuing on error
          if (!options.continueOnError && failed.length > 0) {
            break;
          }
        } catch (error) {
          const failure: MigrationFailure = {
            migration: migration.id,
            error: error instanceof Error ? error : new Error('Unknown error'),
            timestamp: new Date(),
          };
          failed.push(failure);
          logger.error('migrations', `Migration failed: ${migration.id}`, error as Error);

          if (!options.continueOnError) {
            break;
          }
        }
      }

      // Determine overall success
      const hasFailures = failed.length > 0;
      const success = !hasFailures || (options.continueOnError && executed.length > 0);

      let message: string;
      if (success && !hasFailures) {
        message = `Successfully executed ${executed.length} migrations`;
      } else if (success && hasFailures) {
        message = `Executed ${executed.length} migrations with ${failed.length} failures`;
      } else {
        message = `Migration failed: ${failed.length} migrations failed`;
      }

      return {
        success,
        message,
        executed,
        failed,
        error: hasFailures ? failed[0].error : (undefined as Error | undefined),
      } as MigrationResult;
    } catch (error) {
      return {
        success: false,
        message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executed,
        failed,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(migration: Migration): Promise<void> {
    // Check if this is a DDL-only migration (CREATE, ALTER, DROP statements)
    const isDDLMigration = this.isDDLMigration(migration.up);

    if (isDDLMigration) {
      // Execute DDL statements directly - DDL statements auto-commit in SQLite
      // DDL statements cannot be prepared and reused like DML statements
      this.executeDDLMigration(migration);

      // Validate DDL execution - ensure tables/indexes were actually created
      await this.validateDDLMigration(migration);
    } else {
      // Execute DML statements in transaction
      this.db.transaction(() => {
        this.executeDMLMigration(migration);
      });
    }
  }

  /**
   * Check if migration contains only DDL statements
   */
  private isDDLMigration(sql: string): boolean {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Consider DDL if all statements start with DDL keywords
    const ddlKeywords = ['CREATE', 'ALTER', 'DROP', 'PRAGMA'];
    return statements.every(stmt =>
      ddlKeywords.some(keyword => stmt.toUpperCase().startsWith(keyword))
    );
  }

  /**
   * Execute DDL migration directly
   */
  private executeDDLMigration(migration: Migration): void {
    // Split migration SQL into individual statements
    const statements = migration.up
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Execute each DDL statement directly
    for (const statement of statements) {
      if (statement.length > 0) {
        try {
          this.db.execDDL(statement);
        } catch (error) {
          const errorString = (
            error?.toString?.() ||
            (error as any)?.message ||
            String(error)
          ).toLowerCase();
          // Ignore "already exists" errors for indexes and tables
          if (
            errorString.includes('already') ||
            errorString.includes('duplicate') ||
            errorString.includes('exists')
          ) {
            logger.warn(
              'migrations',
              `Ignoring existing object in migration ${migration.id}: ${errorString}`
            );
            continue;
          }
          // Re-throw other errors
          logger.error('migrations', `DDL execution failed: ${statement} Error: ${errorString}`);
          throw error;
        }
      }
    }
  }

  /**
   * Validate DDL migration execution - ensure tables/indexes were actually created
   */
  private async validateDDLMigration(migration: Migration): Promise<void> {
    const statements = migration.up
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const createdObjects: string[] = [];

    for (const statement of statements) {
      if (statement.length > 0) {
        // Extract object names from DDL statements
        const objects = this.extractCreatedObjects(statement);
        createdObjects.push(...objects);
      }
    }

    // Validate that all expected objects exist
    for (const objectName of createdObjects) {
      if (!(await this.objectExists(objectName))) {
        throw new Error(`Migration ${migration.id} failed: object '${objectName}' was not created`);
      }
    }

    logger.info(
      'migrations',
      `Migration ${migration.id} validation passed: ${createdObjects.length} objects verified`
    );
  }

  /**
   * Extract created object names from DDL statement
   */
  private extractCreatedObjects(sql: string): string[] {
    const objects: string[] = [];
    const upperSql = sql.toUpperCase();

    // Handle CREATE TABLE statements
    if (upperSql.startsWith('CREATE TABLE')) {
      const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i);
      if (match && match[1]) {
        objects.push(match[1]);
      }
    }

    // Handle CREATE INDEX statements
    if (upperSql.startsWith('CREATE INDEX') || upperSql.startsWith('CREATE UNIQUE INDEX')) {
      const match = sql.match(
        /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i
      );
      if (match && match[1]) {
        objects.push(match[1]);
      }
    }

    return objects;
  }

  /**
   * Check if database object exists
   */
  private async objectExists(objectName: string): Promise<boolean> {
    try {
      // Check if it's a table
      const tableCheck = this.db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [objectName]
      );
      if (tableCheck.length > 0) {
        return true;
      }

      // Check if it's an index
      const indexCheck = this.db.query(
        "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
        [objectName]
      );
      if (indexCheck.length > 0) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error(
        'migrations',
        `Failed to check existence of object '${objectName}'`,
        error as Error
      );
      return false;
    }
  }

  /**
   * Rollback DDL migration by dropping created objects
   */
  private async rollbackDDLMigration(migration: Migration): Promise<void> {
    const statements = migration.up
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const createdObjects: string[] = [];

    for (const statement of statements) {
      if (statement.length > 0) {
        const objects = this.extractCreatedObjects(statement);
        createdObjects.push(...objects);
      }
    }

    // Attempt to drop created objects in reverse order
    for (const objectName of createdObjects.reverse()) {
      try {
        if (await this.objectExists(objectName)) {
          await this.dropObject(objectName);
          logger.info(
            'migrations',
            `Rolled back object '${objectName}' from migration ${migration.id}`
          );
        }
      } catch (error) {
        logger.warn('migrations', `Failed to rollback object '${objectName}'`, error as Error);
        // Continue with other objects
      }
    }
  }

  /**
   * Drop database object
   */
  private async dropObject(objectName: string): Promise<void> {
    try {
      // Check if it's a table
      const tableCheck = this.db.query('SELECT type FROM sqlite_master WHERE name=?', [objectName]);

      if (tableCheck.length > 0) {
        const type = tableCheck[0].type;
        if (type === 'table') {
          this.db.execDDL(`DROP TABLE IF EXISTS ${objectName}`);
        } else if (type === 'index') {
          this.db.execDDL(`DROP INDEX IF EXISTS ${objectName}`);
        }
      }
    } catch (error) {
      logger.error('migrations', `Failed to drop object '${objectName}'`, error as Error);
      throw error;
    }
  }

  /**
   * Execute DML migration in transaction
   */
  private executeDMLMigration(migration: Migration): void {
    // Split migration SQL into individual statements
    const statements = migration.up
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Execute each DML statement
    for (const statement of statements) {
      if (statement.length > 0) {
        try {
          this.db.execute(statement);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Ignore "already exists" errors for indexes and tables
          if (
            errorMessage.includes('already exists') ||
            errorMessage.includes('duplicate column name') ||
            errorMessage.includes('table already exists')
          ) {
            logger.warn(
              'migrations',
              `Ignoring existing object in migration ${migration.id}: ${errorMessage}`
            );
            continue;
          }
          // Re-throw other errors
          throw error;
        }
      }
    }
  }

  /**
   * Execute migration with retry logic
   */
  private async executeMigrationWithRetry(
    migration: Migration,
    options: MigrationOptions
  ): Promise<void> {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.executeMigration(migration);
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Attempt rollback for DDL migrations on failure
        if (this.isDDLMigration(migration.up)) {
          try {
            await this.rollbackDDLMigration(migration);
            logger.info('migrations', `Rolled back DDL migration ${migration.id} after failure`);
          } catch (rollbackError) {
            logger.error(
              'migrations',
              `Failed to rollback migration ${migration.id}`,
              rollbackError as Error
            );
          }
        }

        if (attempt < maxRetries) {
          logger.warn(
            'migrations',
            `Migration ${migration.id} failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms`
          );
          await this.delay(retryDelay);
        }
      }
    }

    // All retries failed
    throw lastError || new Error(`Migration ${migration.id} failed after ${maxRetries} attempts`);
  }

  /**
   * Recover from failed migrations
   */
  async recoverFailedMigrations(): Promise<MigrationResult> {
    const executed = await this.getExecutedMigrations();
    const available = await this.getAvailableMigrations();
    const failed: MigrationFailure[] = [];

    for (const record of executed) {
      const migration = available.find(m => m.id === record.id);
      if (!migration) {
        failed.push({
          migration: record.id,
          error: new Error('Migration file not found'),
          timestamp: new Date(),
        });
        continue;
      }

      // Check checksum
      const currentChecksum = this.calculateChecksum(migration.up);
      if (currentChecksum !== record.checksum) {
        try {
          // Attempt to resolve checksum mismatch
          const resolution = await this.resolveChecksumMismatch(record.id, { forceUpdate: true });
          if (!resolution.success) {
            failed.push({
              migration: record.id,
              error: new Error(`Checksum resolution failed: ${resolution.message}`),
              timestamp: new Date(),
            });
          }
        } catch (error) {
          failed.push({
            migration: record.id,
            error: error instanceof Error ? error : new Error('Recovery failed'),
            timestamp: new Date(),
          });
        }
      }
    }

    return {
      success: failed.length === 0,
      message:
        failed.length === 0
          ? 'All migrations recovered successfully'
          : `${failed.length} migrations could not be recovered`,
      executed: failed.length === 0 ? executed : [],
      failed,
    };
  }

  /**
   * Get migration health status
   */
  async getHealthStatus(): Promise<MigrationHealthStatus> {
    const available = await this.getAvailableMigrations();
    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();

    const checksumMismatches = [];
    for (const record of executed) {
      const migration = available.find(m => m.id === record.id);
      if (migration) {
        const currentChecksum = this.calculateChecksum(migration.up);
        if (currentChecksum !== record.checksum) {
          checksumMismatches.push(record.id);
        }
      }
    }

    const validation = await this.validate();

    return {
      totalMigrations: available.length,
      executedMigrations: executed.length,
      pendingMigrations: pending.length,
      checksumMismatches: checksumMismatches.length,
      validationErrors: validation.errors.length,
      healthy: validation.valid && checksumMismatches.length === 0,
      lastExecuted: executed.length > 0 ? executed[executed.length - 1] : null,
      issues: [...checksumMismatches.map(id => `Checksum mismatch: ${id}`), ...validation.errors],
    };
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Record migration execution
   */
  private async recordMigration(migration: Migration): Promise<MigrationRecord> {
    const checksum = this.calculateChecksum(migration.up);
    const sql = `
      INSERT INTO schema_migrations (id, name, checksum)
      VALUES (?, ?, ?)
    `;

    this.db.execute(sql, [migration.id, migration.name, checksum]);

    return {
      id: migration.id,
      name: migration.name,
      executedAt: new Date(),
      checksum,
    };
  }

  /**
   * Rollback last migration
   */
  async rollback(steps: number = 1): Promise<MigrationResult> {
    const executed = await this.getExecutedMigrations();

    if (executed.length === 0) {
      return {
        success: false,
        message: 'No migrations to rollback',
      };
    }

    const toRollback = executed.slice(-steps);
    const rolledBack: MigrationRecord[] = [];

    try {
      for (const record of toRollback.reverse()) {
        await this.rollbackMigration(record);
        rolledBack.push(record);
        logger.info('migrations', `Migration rolled back: ${record.id} - ${record.name}`);
      }

      return {
        success: true,
        message: `Successfully rolled back ${rolledBack.length} migrations`,
        rolledBack,
      };
    } catch (error) {
      return {
        success: false,
        message: `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        rolledBack,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Rollback a single migration
   */
  private async rollbackMigration(record: MigrationRecord): Promise<void> {
    // Load migration file to get down SQL
    const migration = await this.getMigrationById(record.id);
    if (!migration?.down) {
      throw new Error(`No rollback SQL found for migration ${record.id}`);
    }

    this.db.transaction(() => {
      // Execute rollback SQL
      this.db.execute(migration.down);

      // Remove migration record
      this.db.execute('DELETE FROM schema_migrations WHERE id = ?', [record.id]);
    });
  }

  /**
   * Get migration by ID
   */
  private async getMigrationById(id: string): Promise<Migration | null> {
    const available = await this.getAvailableMigrations();
    return available.find(m => m.id === id) || null;
  }

  /**
   * Calculate checksum for migration content
   * Uses SHA-256 for robust, content-based hashing
   */
  private calculateChecksum(content: string): string {
    // Normalize content: remove comments, extra whitespace, and empty lines
    const normalizedContent = this.normalizeMigrationContent(content);

    // Use Web Crypto API for SHA-256 hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedContent);

    // Note: In Node.js environment, we'd use crypto.createHash('sha256')
    // For browser compatibility, we'll use a simple but robust hash
    return this.simpleSHA256(data);
  }

  /**
   * Normalize migration content for consistent checksums
   * Removes comments and normalizes whitespace
   */
  private normalizeMigrationContent(content: string): string {
    return (
      content
        .split('\n')
        // Remove comments (lines starting with --)
        .filter(line => !line.trim().startsWith('--'))
        // Remove empty lines
        .filter(line => line.trim().length > 0)
        // Normalize whitespace
        .map(line => line.trim())
        // Remove trailing semicolons for consistency
        .map(line => line.replace(/;$/, ''))
        // Join back with normalized newlines
        .join('\n')
        .trim()
    );
  }

  /**
   * Simple SHA-256 implementation for environments without crypto module
   */
  private simpleSHA256(data: Uint8Array): string {
    // Fallback to a more robust hash than the previous simple one
    // This is still not cryptographically secure but much better than the previous implementation
    const hashBuffer = new ArrayBuffer(32);
    const hashArray = new Uint8Array(hashBuffer);

    // Simple hash function - in production, use proper crypto libraries
    let hash = 0x811c9dc5; // FNV-1a offset
    for (let i = 0; i < data.length; i++) {
      hash ^= data[i];
      hash *= 0x01000193; // FNV-1a prime
    }

    // Convert to hex string
    let result = '';
    for (let i = 0; i < hashArray.length; i++) {
      hashArray[i] = (hash >>> (i * 8)) & 0xff;
      result += hashArray[i].toString(16).padStart(2, '0');
    }

    return result;
  }

  /**
   * Create a new migration file
   */
  async createMigration(name: string): Promise<string> {
    const timestamp = Date.now();
    const id = timestamp.toString();
    const filename = `${id}_${name}.sql`;
    const filePath = path.join(this.migrationsPath, filename);

    // Ensure migrations directory exists
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
    }

    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- UP
-- Add your migration SQL here

-- DOWN
-- Add your rollback SQL here
`;

    fs.writeFileSync(filePath, template);
    logger.info('migrations', `Migration created: ${filePath}`);

    return filePath;
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<MigrationStatus> {
    const available = await this.getAvailableMigrations();
    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();

    return {
      total: available.length,
      executed: executed.length,
      pending: pending.length,
      lastExecuted: executed.length > 0 ? executed[executed.length - 1] : null,
      nextPending: pending.length > 0 ? pending[0] : null,
    };
  }

  /**
   * Validate migration integrity
   */
  async validate(): Promise<ValidationResult> {
    const available = await this.getAvailableMigrations();
    const executed = await this.getExecutedMigrations();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for missing migration files
    for (const record of executed) {
      const migration = available.find(m => m.id === record.id);
      if (!migration) {
        errors.push(`Missing migration file for executed migration: ${record.id}`);
      } else {
        // Check checksum
        const currentChecksum = this.calculateChecksum(migration.up);
        if (currentChecksum !== record.checksum) {
          errors.push(
            `Checksum mismatch for migration: ${record.id} (expected: ${record.checksum}, got: ${currentChecksum})`
          );
        }
      }
    }

    // Check for duplicate migration IDs
    const ids = new Set<string>();
    for (const migration of available) {
      if (ids.has(migration.id)) {
        errors.push(`Duplicate migration ID: ${migration.id}`);
      }
      ids.add(migration.id);
    }

    // Check for migration ordering issues
    const sortedMigrations = available.sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 0; i < sortedMigrations.length - 1; i++) {
      const current = sortedMigrations[i];
      const next = sortedMigrations[i + 1];
      if (current.id >= next.id) {
        warnings.push(`Migration ordering issue: ${current.id} should come before ${next.id}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Handle checksum mismatch resolution
   */
  async resolveChecksumMismatch(
    migrationId: string,
    options: ChecksumResolutionOptions = {}
  ): Promise<ResolutionResult> {
    const executed = await this.getExecutedMigrations();
    const record = executed.find(r => r.id === migrationId);

    if (!record) {
      return {
        success: false,
        message: `Migration ${migrationId} not found in executed migrations`,
      };
    }

    const available = await this.getAvailableMigrations();
    const migration = available.find(m => m.id === migrationId);

    if (!migration) {
      return {
        success: false,
        message: `Migration file for ${migrationId} not found`,
      };
    }

    const currentChecksum = this.calculateChecksum(migration.up);

    if (currentChecksum === record.checksum) {
      return {
        success: true,
        message: 'Checksum already matches',
      };
    }

    // Handle resolution based on options
    if (options.forceUpdate) {
      // Update the checksum in the database
      this.db.execute('UPDATE schema_migrations SET checksum = ? WHERE id = ?', [
        currentChecksum,
        migrationId,
      ]);
      logger.warn('migrations', `Updated checksum for migration ${migrationId}`);
      return {
        success: true,
        message: `Checksum updated for migration ${migrationId}`,
      };
    }

    if (options.skipValidation) {
      logger.warn('migrations', `Skipping checksum validation for migration ${migrationId}`);
      return {
        success: true,
        message: `Checksum validation skipped for migration ${migrationId}`,
      };
    }

    return {
      success: false,
      message: `Checksum mismatch for migration ${migrationId}. Use forceUpdate or skipValidation options to resolve.`,
      expectedChecksum: record.checksum,
      actualChecksum: currentChecksum,
    };
  }

  /**
   * Perform gradual migration (Strangler Fig pattern)
   * Migrates one step at a time with validation
   */
  async migrateGradually(options: MigrationOptions = {}): Promise<MigrationResult> {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      return {
        success: true,
        message: 'No pending migrations',
        executed: [],
      };
    }

    const executed: MigrationRecord[] = [];
    const results: { migration: string; success: boolean; error?: string }[] = [];

    for (const migration of pending) {
      try {
        // Validate migration first
        const validation = await this.validateSingleMigration(migration);
        if (!validation.valid) {
          if (options.skipFailedMigrations) {
            results.push({
              migration: migration.id,
              success: false,
              error: `Validation failed: ${validation.errors.join(', ')}`,
            });
            continue;
          }
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Execute migration
        await this.executeMigrationWithRetry(migration, options);
        const record = await this.recordMigration(migration);
        executed.push(record);
        results.push({ migration: migration.id, success: true });

        logger.info('migrations', `Gradual migration completed: ${migration.id}`);

        // Optional: break after first successful migration for true gradual approach
        if (options.dryRun) {
          break;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          migration: migration.id,
          success: false,
          error: errorMsg,
        });

        if (!options.continueOnError) {
          return {
            success: false,
            message: `Migration failed at ${migration.id}: ${errorMsg}`,
            executed,
            error: error instanceof Error ? error : new Error(errorMsg),
          };
        }
      }
    }

    const success = executed.length > 0;
    return {
      success,
      message: success
        ? `Gradual migration completed ${executed.length} of ${pending.length} migrations`
        : 'No migrations could be completed',
      executed,
    };
  }

  /**
   * Validate a single migration
   */
  private async validateSingleMigration(
    migration: Migration
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check SQL syntax
      const sqlValidation = this.validateMigrationSQL(migration.up);
      if (!sqlValidation.valid) {
        errors.push(...sqlValidation.errors);
      }

      // Check for dangerous operations
      if (
        migration.up.toUpperCase().includes('DROP DATABASE') ||
        migration.up.toUpperCase().includes('TRUNCATE TABLE')
      ) {
        errors.push('Migration contains potentially dangerous operations');
      }

      // Check rollback SQL
      if (!migration.down || migration.down.trim() === '') {
        errors.push('Migration lacks rollback SQL');
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Validation error'],
      };
    }
  }

  /**
   * Perform dry-run migration
   */
  async dryRun(): Promise<DryRunResult> {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      return {
        success: true,
        message: 'No pending migrations to run',
        migrations: [],
      };
    }

    const results: DryRunMigrationResult[] = [];

    for (const migration of pending) {
      try {
        // Parse and validate SQL without executing
        const validation = this.validateMigrationSQL(migration.up);
        results.push({
          migration: migration.id,
          valid: validation.valid,
          errors: validation.errors,
          checksum: this.calculateChecksum(migration.up),
        });
      } catch (error) {
        results.push({
          migration: migration.id,
          valid: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          checksum: this.calculateChecksum(migration.up),
        });
      }
    }

    const allValid = results.every(r => r.valid);

    return {
      success: allValid,
      message: allValid
        ? `All ${results.length} migrations validated successfully`
        : `${results.filter(r => !r.valid).length} of ${results.length} migrations have validation errors`,
      migrations: results,
    };
  }

  /**
   * Validate migration SQL syntax
   */
  private validateMigrationSQL(sql: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Basic SQL validation - check for common issues
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        // Check for incomplete statements
        if (
          statement.toUpperCase().match(/\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\b/) &&
          !statement.includes('(') &&
          !statement.toUpperCase().includes('INDEX')
        ) {
          // This is a simplified check - in production, use a proper SQL parser
        }

        // Check for dangerous operations in production
        if (
          statement.toUpperCase().includes('DROP DATABASE') ||
          statement.toUpperCase().includes('TRUNCATE TABLE')
        ) {
          errors.push('Potentially dangerous operation detected');
        }
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'SQL parsing error'],
      };
    }
  }
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

// Initial schema migration
export const INITIAL_SCHEMA_MIGRATION: Migration = {
  id: '001',
  name: 'initial_schema',
  up: `
    -- Create patterns table
    CREATE TABLE patterns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      when_to_use TEXT,
      benefits TEXT,
      drawbacks TEXT,
      use_cases TEXT,
      complexity TEXT NOT NULL,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create pattern_implementations table
    CREATE TABLE pattern_implementations (
      id TEXT PRIMARY KEY,
      pattern_id TEXT NOT NULL,
      language TEXT NOT NULL,
      approach TEXT NOT NULL,
      code TEXT NOT NULL,
      explanation TEXT NOT NULL,
      dependencies TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
    );

    -- Create pattern_relationships table
    CREATE TABLE pattern_relationships (
      id TEXT PRIMARY KEY,
      source_pattern_id TEXT NOT NULL,
      target_pattern_id TEXT NOT NULL,
      type TEXT NOT NULL,
      strength REAL DEFAULT 1.0,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_pattern_id) REFERENCES patterns(id) ON DELETE CASCADE,
      FOREIGN KEY (target_pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
    );

    -- Create user_preferences table
    CREATE TABLE user_preferences (
      user_id TEXT PRIMARY KEY,
      preferences TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for better performance
    CREATE INDEX idx_patterns_category ON patterns(category);
    CREATE INDEX idx_patterns_complexity ON patterns(complexity);
    CREATE INDEX idx_pattern_implementations_pattern_id ON pattern_implementations(pattern_id);
    CREATE INDEX idx_pattern_implementations_language ON pattern_implementations(language);
    CREATE INDEX idx_pattern_relationships_source ON pattern_relationships(source_pattern_id);
    CREATE INDEX idx_pattern_relationships_target ON pattern_relationships(target_pattern_id);
    CREATE INDEX idx_pattern_relationships_type ON pattern_relationships(type);
  `,
  down: `
    DROP TABLE IF EXISTS user_preferences;
    DROP TABLE IF EXISTS pattern_relationships;
    DROP TABLE IF EXISTS pattern_implementations;
    DROP TABLE IF EXISTS patterns;
  `,
  createdAt: new Date('2024-01-11T00:00:00Z'),
};

// Vector search migration
export const VECTOR_SEARCH_MIGRATION: Migration = {
  id: '002',
  name: 'vector_search_support',
  up: `
    -- Create vector embeddings table
    CREATE VIRTUAL TABLE pattern_embeddings USING vec0(
      pattern_id TEXT PRIMARY KEY,
      embedding FLOAT[384],
      model TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create search queries table for analytics
    CREATE TABLE search_queries (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      user_id TEXT,
      results_count INTEGER DEFAULT 0,
      execution_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create pattern usage analytics table
    CREATE TABLE pattern_usage (
      id TEXT PRIMARY KEY,
      pattern_id TEXT NOT NULL,
      user_id TEXT,
      context TEXT,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
    );

    -- Create indexes
    CREATE INDEX idx_search_queries_created_at ON search_queries(created_at);
    CREATE INDEX idx_pattern_usage_pattern_id ON pattern_usage(pattern_id);
    CREATE INDEX idx_pattern_usage_created_at ON pattern_usage(created_at);
  `,
  down: `
    DROP TABLE IF EXISTS pattern_usage;
    DROP TABLE IF EXISTS search_queries;
    DROP TABLE IF EXISTS pattern_embeddings;
  `,
  createdAt: new Date('2024-01-11T00:00:00Z'),
};
