/**
 * Database Migration Runner
 * Runs database schema migrations
 */

import { initializeDatabaseManager, getDatabaseManager, closeDatabaseManager } from '../services/database-manager.js';
import { MigrationManager } from '../services/migrations.js';
import { logger } from '../services/logger.js';

async function main(): Promise<void> {
  try {
    logger.info('migrate', 'Starting migration script');

    // Initialize database
    const dbConfig = {
      filename: './data/design-patterns.db',
      options: {
        readonly: false,
        fileMustExist: false,
        timeout: 5000,
        verbose: (message: string) => logger.debug('migrate', message),
      },
    };

    await initializeDatabaseManager(dbConfig);
    const dbManager = getDatabaseManager();

    // Initialize migration manager
    const migrationManager = new MigrationManager(dbManager);
    migrationManager.initialize();

    logger.info('migrate', 'Running migrations...');

    // Run migrations
    const result = await migrationManager.migrate();

    if (result.executed && result.executed.length > 0) {
      logger.info('migrate', `Successfully ran ${result.executed.length} migrations`);
      result.executed.forEach(migration => {
        logger.info('migrate', `  - ${migration.name} (${migration.id})`);
      });
    } else {
      logger.info('migrate', 'No new migrations to run');
    }

    // Get migration status
    const status = await migrationManager.getStatus();
    logger.info('migrate', `Migration Status: ${status.executed} executed, ${status.pending} pending`);

    // Close database
    await closeDatabaseManager();
    logger.info('migrate', '✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}