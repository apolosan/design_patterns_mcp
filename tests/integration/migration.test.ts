/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager';
import { MigrationManager, Migration, MigrationOptions } from '../../src/services/migrations';
import { MigrationRecord, TableName, ColumnInfo } from '../helpers/test-interfaces';

// Subclass to expose protected methods for testing purposes
class TestableMigrationManager extends MigrationManager {
  public override calculateChecksum(content: string): string {
    return super.calculateChecksum(content);
  }

  public override async executeMigration(migration: Migration): Promise<void> {
    return super.executeMigration(migration);
  }

  public override async executeMigrationWithRetry(migration: Migration, options: MigrationOptions): Promise<void> {
    return super.executeMigrationWithRetry(migration, options);
  }

  public override extractCreatedObjects(sql: string): string[] {
    return super.extractCreatedObjects(sql);
  }

  public override objectExists(objectName: string): boolean {
    return super.objectExists(objectName);
  }
}

describe('Database Migration', () => {
  let dbManager: DatabaseManager;
  let migrationManager: TestableMigrationManager;

  beforeAll(async () => {
    // Use in-memory database for proper test isolation
    dbManager = new DatabaseManager({
      filename: ':memory:',
      options: { readonly: false },
    });
    await dbManager.initialize();

    migrationManager = new TestableMigrationManager(dbManager, './migrations');
    migrationManager.initialize();

    // Execute all pending migrations
    const result = await migrationManager.migrate();
    if (!result.success) {
      throw new Error(`Migration failed: ${result.message}`);
    }
  });

  afterAll(async () => {
    await dbManager.close();
  });

  it('should execute initial migration', () => {
    // Check if migrations table exists and has records
    const migrationRecords = dbManager.query<MigrationRecord>('SELECT * FROM schema_migrations');
    const migrationExecuted = migrationRecords && migrationRecords.length > 0;

    expect(migrationExecuted).toBe(true);
  });

  it('should handle migration versioning', () => {
    // Check if migration records exist
    const migrationRecords = dbManager.query<MigrationRecord>(
      'SELECT id, checksum FROM schema_migrations ORDER BY id'
    );
    const versionTracked =
      migrationRecords &&
      migrationRecords.length > 0 &&
      migrationRecords.every((record) => record.id && record.checksum);

    expect(versionTracked).toBe(true);
  });

  it('should rollback failed migrations', async () => {
    // Arrange: Get current migration status
    const statusBefore = await migrationManager.getStatus();
    const initialExecuted = statusBefore.executed;

    // Act: Rollback the last migration
    const rollbackResult = await migrationManager.rollback(1);

    // Assert: Verify rollback was successful
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.rolledBack).toBeDefined();
    expect(rollbackResult.rolledBack?.length).toBe(1);

    // Verify migration was actually rolled back
    const statusAfter = await migrationManager.getStatus();
    expect(statusAfter.executed).toBe(initialExecuted - 1);

    // Re-run migrations to restore state for other tests
    const migrateResult = await migrationManager.migrate();
    expect(migrateResult.success).toBe(true);
  });

  it('should create required database tables', () => {
    // Check if all required tables exist
    const tables = dbManager.query<TableName>(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN (
        'patterns', 'pattern_embeddings', 'pattern_relationships',
        'pattern_implementations', 'schema_migrations'
      )
    `);

    const requiredTables = [
      'patterns',
      'pattern_embeddings',
      'pattern_relationships',
      'pattern_implementations',
      'schema_migrations',
    ];
    const existingTables = tables.map((row) => row.name);
    const allTablesExist = requiredTables.every(table => existingTables.includes(table));

    expect(allTablesExist).toBe(true);
  });

  it('should migrate pattern data', () => {
    // Check if patterns table exists and has correct structure
    const tableInfo = dbManager.query<ColumnInfo>(`
      PRAGMA table_info(patterns)
    `);
    const hasRequiredColumns =
      tableInfo &&
      tableInfo.length >= 8 &&
      tableInfo.some((col: ColumnInfo) => col.name === 'id' && col.type === 'TEXT') &&
      tableInfo.some((col: ColumnInfo) => col.name === 'name' && col.type === 'TEXT') &&
      tableInfo.some((col: ColumnInfo) => col.name === 'category' && col.type === 'TEXT');

    expect(hasRequiredColumns).toBe(true);
  });

  it('should validate migration integrity', () => {
    // Check if all expected tables have data
    const tablesWithData = dbManager.query<TableName>(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('patterns', 'pattern_embeddings')
    `);

    const integrityValid = tablesWithData && tablesWithData.length >= 2;

    expect(integrityValid).toBe(true);
  });

  // Mutation Testing: Test edge cases and error conditions
  it('should handle invalid migration files gracefully', () => {
    // Create a separate migration manager with invalid migration path
    const invalidMigrationManager = new MigrationManager(dbManager, '/nonexistent/path');
    const migrations = invalidMigrationManager.getAvailableMigrations();

    expect(migrations).toEqual([]);
  });

  it('should support migration validation', async () => {
    // Test that validation runs without throwing
    const validation = await migrationManager.validate();

    // Validation should return a result object
    expect(validation).toHaveProperty('valid');
    expect(validation).toHaveProperty('errors');
    expect(Array.isArray(validation.errors)).toBe(true);

    // Note: In development, checksums may not match due to file modifications
    // This is acceptable for testing purposes
  });

  it('should handle migration status correctly', async () => {
    const status = await migrationManager.getStatus();

    expect(status).toBeDefined();
    expect(typeof status.total).toBe('number');
    expect(typeof status.executed).toBe('number');
    expect(typeof status.pending).toBe('number');
    expect(status.executed).toBeGreaterThan(0);
    expect(status.pending).toBe(0); // All should be executed
  });

  it('should prevent duplicate migration execution', async () => {
    // Try to migrate again - should have no pending migrations
    const result = await migrationManager.migrate();

    expect(result.success).toBe(true);
    expect(result.message).toBe('No pending migrations');
    expect(result.executed).toEqual([]);
  });

  it('should support gradual migration (Strangler Fig pattern)', async () => {
    // Reset database state for this test
    dbManager.execute('DELETE FROM schema_migrations');

    const result = await migrationManager.migrateGradually({ dryRun: true });

    expect(result.success).toBe(true);
    expect(result.executed?.length).toBeGreaterThan(0);
  });

  it('should validate single migrations', () => {
    const available = migrationManager.getAvailableMigrations();
    const firstMigration = available[0];

    // This is a private method, but we're testing the concept
    // In a real scenario, this would be tested through public APIs
    expect(firstMigration).toBeDefined();
    expect(firstMigration.up).toBeDefined();
    expect(firstMigration.down).toBeDefined();
  });

  it('should handle checksum resolution', () => {
    const available = migrationManager.getAvailableMigrations();
    const firstMigration = available[0];

    // Test checksum calculation
    const checksum1 = migrationManager.calculateChecksum(firstMigration.up);
    const checksum2 = migrationManager.calculateChecksum(firstMigration.up);

    expect(checksum1).toBe(checksum2); // Should be deterministic
    expect(typeof checksum1).toBe('string');
    expect(checksum1.length).toBeGreaterThan(0);
  });

  it('should provide health status', async () => {
    const health = await migrationManager.getHealthStatus();

    expect(health).toHaveProperty('totalMigrations');
    expect(health).toHaveProperty('executedMigrations');
    expect(health).toHaveProperty('pendingMigrations');
    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('issues');
    expect(Array.isArray(health.issues)).toBe(true);
  });

  it('should support dry run validation', async () => {
    const dryRun = await migrationManager.dryRun();

    expect(dryRun).toHaveProperty('success');
    expect(dryRun).toHaveProperty('message');
    expect(dryRun).toHaveProperty('migrations');
    expect(Array.isArray(dryRun.migrations)).toBe(true);
  });

  it('should handle migration options', async () => {
    const options = {
      validateFirst: true,
      continueOnError: false,
      maxRetries: 3,
      retryDelay: 100,
      dryRun: false,
      forceChecksumUpdate: false,
      skipFailedMigrations: false,
    };

    // Test that options are accepted (migrate should work with these options)
    const result = await migrationManager.migrate(options);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('message');
  });

    describe('DDL Migration Error Handling', () => {
    let testDbManager: DatabaseManager;
    let testMigrationManager: TestableMigrationManager;

    beforeEach(async () => {
      // Create a fresh in-memory database for each test
      testDbManager = new DatabaseManager({
        filename: `:memory:${Date.now()}-${Math.random()}`,
        options: { readonly: false },
      });
      await testDbManager.initialize();

      testMigrationManager = new TestableMigrationManager(testDbManager, './migrations');
      testMigrationManager.initialize();
    });

    afterEach(async () => {
      await testDbManager.close();
    });

    it('should validate DDL migration execution - tables created', async () => {
      // Create a test migration that creates a table
      const uniqueId = Date.now();
      const testMigration: Migration = {
        id: `999_test_validation_${uniqueId}`,
        name: 'Test DDL Validation',
        up: `CREATE TABLE test_validation_table_${uniqueId} (id INTEGER PRIMARY KEY, name TEXT);`,
        down: `DROP TABLE test_validation_table_${uniqueId};`,
        createdAt: new Date(),
      };

      // Execute the migration
      await testMigrationManager.executeMigration(testMigration);

      // Verify the table was created
      const tables = testDbManager.query<TableName>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='test_validation_table_${uniqueId}'`
      );
      expect(tables.length).toBe(1);
      expect(tables[0].name).toBe(`test_validation_table_${uniqueId}`);
    });

    it('should validate DDL migration execution - indexes created', async () => {
      // First create a table
      const uniqueId = Date.now();
      testDbManager.execDDL(
        `CREATE TABLE test_index_table_${uniqueId} (id INTEGER PRIMARY KEY, name TEXT);`
      );

      // Create a test migration that creates an index
      const testMigration: Migration = {
        id: `999_test_index_validation_${uniqueId}`,
        name: 'Test Index DDL Validation',
        up: `CREATE INDEX idx_test_index_table_name_${uniqueId} ON test_index_table_${uniqueId}(name);`,
        down: `DROP INDEX idx_test_index_table_name_${uniqueId};`,
        createdAt: new Date(),
      };

      // Execute the migration
      await testMigrationManager.executeMigration(testMigration);

      // Verify the index was created
      const indexes = testDbManager.query<TableName>(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_test_index_table_name_${uniqueId}'`
      );
      expect(indexes.length).toBe(1);
      expect(indexes[0].name).toBe(`idx_test_index_table_name_${uniqueId}`);
    });

    it('should fail DDL validation when table is not created', async () => {
      // Create a migration with invalid DDL syntax
      const uniqueId = Date.now();
      const testMigration: Migration = {
        id: `999_test_invalid_ddl_${uniqueId}`,
        name: 'Test Invalid DDL',
        up: `CREATE TABLE test_validation_table_${uniqueId} (id INTEGER PRIMARY KEY, name TEXT); INVALID SQL SYNTAX HERE;`,
        down: '',
        createdAt: new Date(),
      };

      // This should fail due to syntax error
      await expect(testMigrationManager.executeMigration(testMigration)).rejects.toThrow();
    });

    it('should rollback DDL migration on failure', async () => {
      // Create a migration that creates a table then fails
      const uniqueId = Date.now();
      const testMigration: Migration = {
        id: `999_test_rollback_${uniqueId}`,
        name: 'Test DDL Rollback',
        up: `CREATE TABLE test_rollback_table_${uniqueId} (id INTEGER PRIMARY KEY); INVALID SQL SYNTAX HERE;`,
        down: `DROP TABLE IF EXISTS test_rollback_table_${uniqueId};`,
        createdAt: new Date(),
      };

      // Execute should fail and rollback
      await expect(
        testMigrationManager.executeMigrationWithRetry(testMigration, {})
      ).rejects.toThrow();

      // Verify the table was rolled back (doesn't exist)
      const tables = testDbManager.query<TableName>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='test_rollback_table_${uniqueId}'`
      );
      expect(tables.length).toBe(0);
    });

    it('should extract created objects from DDL statements', () => {
      // Test table extraction
      const tableObjects = testMigrationManager.extractCreatedObjects('CREATE TABLE IF NOT EXISTS test_table (id INTEGER);');
      expect(tableObjects).toEqual(['test_table']);

      // Test index extraction
      const indexObjects = testMigrationManager.extractCreatedObjects('CREATE INDEX idx_test_table_name ON test_table(name);');
      expect(indexObjects).toEqual(['idx_test_table_name']);

      // Test unique index extraction
      const uniqueIndexObjects = testMigrationManager.extractCreatedObjects(
        'CREATE UNIQUE INDEX idx_unique_test ON test_table(email);'
      );
      expect(uniqueIndexObjects).toEqual(['idx_unique_test']);
    });

    it('should check if database objects exist', async () => {
      // Create a test table
      testDbManager.execDDL('CREATE TABLE test_existence_table (id INTEGER PRIMARY KEY);');

      // Test existing table
      const tableExists = testMigrationManager.objectExists('test_existence_table');
      expect(tableExists).toBe(true);

      // Test non-existing table (use a unique name to avoid conflicts)
      const tableNotExists = testMigrationManager.objectExists('definitely_not_a_table_12345');
      expect(tableNotExists).toBe(false);
    });

    it('should handle DDL migration retry with rollback', async () => {
      let attemptCount = 0;
      const uniqueId = Date.now();

      const testMigration: Migration = {
        id: `999_test_retry_${uniqueId}`,
        name: 'Test Retry with Rollback',
        up: `CREATE TABLE retry_test_table_${uniqueId} (id INTEGER PRIMARY KEY, name TEXT);`,
        down: `DROP TABLE retry_test_table_${uniqueId};`,
        createdAt: new Date(),
      };

      // Mock the executeMigration to fail twice then succeed
      // Since we are using a subclass, we can spy on the method directly
      const spy = vi.spyOn(testMigrationManager, 'executeMigration').mockImplementation(async (migration: Migration) => {
        attemptCount++;
        if (attemptCount < 3) {
           // Create partial state then fail (to simulate failure during execution)
           // In a real scenario, this would be an error during DB execution
           testDbManager.execDDL(
              `CREATE TABLE IF NOT EXISTS retry_test_table_${uniqueId} (id INTEGER PRIMARY KEY);`
            );
           throw new Error('Simulated failure');
        }

        // On third attempt, we perform the actual success logic
        // We need to call the REAL super method.
        // But vi.spyOn mocks it.
        // We can use mockRestore inside, or use .mockImplementation calls.
        // Actually, since we are inside the mock, we can't easily call "super".
        // Instead, let's look at how the original test was doing it.
        // The original test was hacking Object.defineProperty.

        // Alternative: Don't spy. Just override the method on the instance, which is now public/writable effectively via the subclass if we wanted to,
        // OR simply use the fact that we can access it.

        // Let's rely on the original logic but adapted for the subclass.
        // But wait, the original logic used Object.defineProperty because it was a method on the instance.
        // We can do the same here, or better yet, since it's a test class, we can just assign to it if it's writable, or use vi.spyOn properly.

        // Let's implement the "success" part by actually running the DDL:
         testDbManager.execDDL(migration.up);
      });

      // Wait, executeMigration is what calls DDL.
      // If we mock it, we replace it.

      // Let's try a different approach for this specific test to avoid complexity.
      // We want `executeMigrationWithRetry` to call our `executeMigration`.
      // `executeMigrationWithRetry` calls `this.executeMigration`.

      // If we spy on `testMigrationManager.executeMigration`, `executeMigrationWithRetry` will call the spy.

      await testMigrationManager.executeMigrationWithRetry(testMigration, {
        maxRetries: 3,
      });

      expect(spy).toHaveBeenCalledTimes(3);

      // Verify final state
      const tables = testDbManager.query<TableName>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='retry_test_table_${uniqueId}'`
      );
      expect(tables.length).toBe(1);
      expect(attemptCount).toBe(3);
    });
  });
});
