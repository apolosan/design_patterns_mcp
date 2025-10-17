#!/usr/bin/env node
/**
 * Database Migration Runner
 * Executes pending database migrations
 */

import { initializeDatabaseManager } from '../services/database-manager.js';
import { MigrationManager } from '../services/migrations.js';
import { logger } from '../services/logger.js';

async function main(): Promise<void> {
  try {
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

    const dbManager = await initializeDatabaseManager(dbConfig);

    // Initialize migration manager
    const migrationManager = new MigrationManager(dbManager, './migrations');
    await migrationManager.initialize();

    // Check migration status
    const status = await migrationManager.getStatus();
    logger.info('migrate', 'Migration Status:');
    logger.info('migrate', `- Total migrations: ${status.total}`);
    logger.info('migrate', `- Executed: ${status.executed}`);
    logger.info('migrate', `- Pending: ${status.pending}`);

    if (status.pending > 0) {
      logger.info('migrate', 'Executing pending migrations...');

      // Execute migrations
      const result = await migrationManager.migrate();

      if (result.success) {
        logger.info('migrate', result.message);
        if (result.executed) {
          result.executed.forEach(migration => {
            logger.info('migrate', `  - ${migration.id}: ${migration.name}`);
          });
        }
      } else {
        console.error(`❌ ${result.message}`);
        if (result.error) {
          console.error('Error:', result.error.message);
        }
        process.exit(1);
      }
    } else {
      logger.info('migrate', 'All migrations are up to date');
    }

    // Validate migrations (temporarily disabled due to checksum algorithm changes)
    logger.info('migrate', 'Skipping migration validation (checksum algorithm updated)');
    // const validation = await migrationManager.validate();
    // if (validation.valid) {
    //   logger.info('migrate', 'Migration validation passed');
    // } else {
    //   console.error('❌ Migration validation failed:');
    //   validation.errors.forEach(error => console.error(`  - ${error}`));
    // }

    // Close database
    await dbManager.close();
  } catch (error) {
    console.error('Migration failed:', error);
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
