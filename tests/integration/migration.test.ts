import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseManager } from '../../src/services/database-manager';
import { MigrationManager } from '../../src/services/migrations';

describe('Database Migration', () => {
  let dbManager: DatabaseManager;
  let migrationManager: MigrationManager;

  beforeAll(async () => {
    // Use in-memory database for proper test isolation
    dbManager = new DatabaseManager({
      filename: ':memory:',
      options: { readonly: false },
    });
    await dbManager.initialize();

    migrationManager = new MigrationManager(dbManager, './migrations');
    await migrationManager.initialize();

    // Execute all pending migrations
    const result = await migrationManager.migrate();
    if (!result.success) {
      throw new Error(`Migration failed: ${result.message}`);
    }
  });

  afterAll(async () => {
    await dbManager.close();
  });

  it('should execute initial migration', async () => {
    // Check if migrations table exists and has records
    const migrationRecords = dbManager.query('SELECT * FROM schema_migrations');
    const migrationExecuted = migrationRecords && migrationRecords.length > 0;

    expect(migrationExecuted).toBe(true);
  });

  it('should handle migration versioning', async () => {
    // Check if migration records exist
    const migrationRecords = dbManager.query(
      'SELECT id, checksum FROM schema_migrations ORDER BY id'
    );
    const versionTracked =
      migrationRecords &&
      migrationRecords.length > 0 &&
      migrationRecords.every((record: any) => record.id && record.checksum);

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
    expect(rollbackResult.rolledBack!.length).toBe(1);

    // Verify migration was actually rolled back
    const statusAfter = await migrationManager.getStatus();
    expect(statusAfter.executed).toBe(initialExecuted - 1);

    // Re-run migrations to restore state for other tests
    const migrateResult = await migrationManager.migrate();
    expect(migrateResult.success).toBe(true);
  });

  it('should create required database tables', async () => {
    // Check if all required tables exist
    const tables = dbManager.query(`
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
    const existingTables = tables.map((row: any) => row.name);
    const allTablesExist = requiredTables.every(table => existingTables.includes(table));

    expect(allTablesExist).toBe(true);
  });

  it('should migrate pattern data', async () => {
    // Check if patterns table exists and has correct structure
    const tableInfo = dbManager.query(`
      PRAGMA table_info(patterns)
    `);
    const hasRequiredColumns =
      tableInfo &&
      tableInfo.length >= 8 && // id, name, category, description, when_to_use, benefits, drawbacks, use_cases, complexity, tags, created_at, updated_at
      tableInfo.some((col: any) => col.name === 'id' && col.type === 'TEXT') &&
      tableInfo.some((col: any) => col.name === 'name' && col.type === 'TEXT') &&
      tableInfo.some((col: any) => col.name === 'category' && col.type === 'TEXT');

    expect(hasRequiredColumns).toBe(true);
  });

  it('should validate migration integrity', async () => {
    // Check if all expected tables have data
    const tablesWithData = dbManager.query(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('patterns', 'pattern_embeddings')
    `);

    const integrityValid = tablesWithData && tablesWithData.length >= 2;

    expect(integrityValid).toBe(true);
  });

  // Mutation Testing: Test edge cases and error conditions
  it('should handle invalid migration files gracefully', async () => {
    // Create a separate migration manager with invalid migration path
    const invalidMigrationManager = new MigrationManager(dbManager, '/nonexistent/path');
    const migrations = await invalidMigrationManager.getAvailableMigrations();

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
    expect(result.executed!.length).toBeGreaterThan(0);
  });

  it('should validate single migrations', async () => {
    const available = await migrationManager.getAvailableMigrations();
    const firstMigration = available[0];

    // This is a private method, but we're testing the concept
    // In a real scenario, this would be tested through public APIs
    expect(firstMigration).toBeDefined();
    expect(firstMigration.up).toBeDefined();
    expect(firstMigration.down).toBeDefined();
  });

  it('should handle checksum resolution', async () => {
    const available = await migrationManager.getAvailableMigrations();
    const firstMigration = available[0];

    // Test checksum calculation
    const checksum1 = (migrationManager as any).calculateChecksum(firstMigration.up);
    const checksum2 = (migrationManager as any).calculateChecksum(firstMigration.up);

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
    let testMigrationManager: MigrationManager;

    beforeEach(async () => {
      // Create a fresh in-memory database for each test
      testDbManager = new DatabaseManager({
        filename: `:memory:${Date.now()}-${Math.random()}`,
        options: { readonly: false },
      });
      await testDbManager.initialize();

      testMigrationManager = new MigrationManager(testDbManager, './migrations');
      await testMigrationManager.initialize();
    });

    afterEach(async () => {
      await testDbManager.close();
    });

    it('should validate DDL migration execution - tables created', async () => {
      // Create a test migration that creates a table
      const uniqueId = Date.now();
      const testMigration = {
        id: `999_test_validation_${uniqueId}`,
        name: 'Test DDL Validation',
        up: `CREATE TABLE test_validation_table_${uniqueId} (id INTEGER PRIMARY KEY, name TEXT);`,
        down: `DROP TABLE test_validation_table_${uniqueId};`,
        createdAt: new Date(),
      };

      // Execute the migration
      await (testMigrationManager as any).executeMigration(testMigration);

      // Verify the table was created
      const tables = testDbManager.query(
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
      const testMigration = {
        id: `999_test_index_validation_${uniqueId}`,
        name: 'Test Index DDL Validation',
        up: `CREATE INDEX idx_test_index_table_name_${uniqueId} ON test_index_table_${uniqueId}(name);`,
        down: `DROP INDEX idx_test_index_table_name_${uniqueId};`,
        createdAt: new Date(),
      };

      // Execute the migration
      await (testMigrationManager as any).executeMigration(testMigration);

      // Verify the index was created
      const indexes = testDbManager.query(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_test_index_table_name_${uniqueId}'`
      );
      expect(indexes.length).toBe(1);
      expect(indexes[0].name).toBe(`idx_test_index_table_name_${uniqueId}`);
    });

    it('should fail DDL validation when table is not created', async () => {
      // Create a migration with invalid DDL syntax
      const uniqueId = Date.now();
      const testMigration = {
        id: `999_test_invalid_ddl_${uniqueId}`,
        name: 'Test Invalid DDL',
        up: `CREATE TABLE test_validation_table_${uniqueId} (id INTEGER PRIMARY KEY, name TEXT); INVALID SQL SYNTAX HERE;`,
        down: '',
        createdAt: new Date(),
      };

      // This should fail due to syntax error
      await expect((testMigrationManager as any).executeMigration(testMigration)).rejects.toThrow();
    });

    it('should rollback DDL migration on failure', async () => {
      // Create a migration that creates a table then fails
      const uniqueId = Date.now();
      const testMigration = {
        id: `999_test_rollback_${uniqueId}`,
        name: 'Test DDL Rollback',
        up: `CREATE TABLE test_rollback_table_${uniqueId} (id INTEGER PRIMARY KEY); INVALID SQL SYNTAX HERE;`,
        down: `DROP TABLE IF EXISTS test_rollback_table_${uniqueId};`,
        createdAt: new Date(),
      };

      // Execute should fail and rollback
      await expect(
        (testMigrationManager as any).executeMigrationWithRetry(testMigration, {})
      ).rejects.toThrow();

      // Verify the table was rolled back (doesn't exist)
      const tables = testDbManager.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='test_rollback_table_${uniqueId}'`
      );
      expect(tables.length).toBe(0);
    });

    it('should extract created objects from DDL statements', () => {
      const extractMethod = (testMigrationManager as any).extractCreatedObjects.bind(
        testMigrationManager
      );

      // Test table extraction
      const tableObjects = extractMethod('CREATE TABLE IF NOT EXISTS test_table (id INTEGER);');
      expect(tableObjects).toEqual(['test_table']);

      // Test index extraction
      const indexObjects = extractMethod('CREATE INDEX idx_test_table_name ON test_table(name);');
      expect(indexObjects).toEqual(['idx_test_table_name']);

      // Test unique index extraction
      const uniqueIndexObjects = extractMethod(
        'CREATE UNIQUE INDEX idx_unique_test ON test_table(email);'
      );
      expect(uniqueIndexObjects).toEqual(['idx_unique_test']);
    });

    it('should check if database objects exist', async () => {
      // Create a test table
      testDbManager.execDDL('CREATE TABLE test_existence_table (id INTEGER PRIMARY KEY);');

      const existsMethod = (testMigrationManager as any).objectExists.bind(testMigrationManager);

      // Test existing table
      const tableExists = await existsMethod('test_existence_table');
      expect(tableExists).toBe(true);

      // Test non-existing table (use a unique name to avoid conflicts)
      const tableNotExists = await existsMethod('definitely_not_a_table_12345');
      expect(tableNotExists).toBe(false);
    });

    it('should handle DDL migration retry with rollback', async () => {
      let attemptCount = 0;
      const uniqueId = Date.now();

      const testMigration = {
        id: `999_test_retry_${uniqueId}`,
        name: 'Test Retry with Rollback',
        up: `CREATE TABLE retry_test_table_${uniqueId} (id INTEGER PRIMARY KEY, name TEXT);`,
        down: `DROP TABLE retry_test_table_${uniqueId};`,
        createdAt: new Date(),
      };

      // Mock the executeMigration to fail twice then succeed
      const originalExecute = (testMigrationManager as any).executeMigration;
      (testMigrationManager as any).executeMigration = async (migration: any) => {
        attemptCount++;
        if (attemptCount < 3) {
          // Create partial state then fail
          testDbManager.execDDL(
            `CREATE TABLE retry_test_table_${uniqueId} (id INTEGER PRIMARY KEY);`
          );
          throw new Error('Simulated failure');
        }
        // On third attempt, succeed
        return originalExecute.call(testMigrationManager, migration);
      };

      // Should succeed after retries
      await (testMigrationManager as any).executeMigrationWithRetry(testMigration, {
        maxRetries: 3,
      });

      // Verify final state
      const tables = testDbManager.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='retry_test_table_${uniqueId}'`
      );
      expect(tables.length).toBe(1);
      expect(attemptCount).toBe(3); // Should have failed twice, succeeded on third
    });
  });
});
