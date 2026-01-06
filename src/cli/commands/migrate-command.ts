/**
 * Migrate Command - Runs database schema migrations
 * Implements Command Pattern for standardized CLI execution
 */

import { BaseCLICommand } from './base-cli-command.js';
import { getDatabaseManager } from '../../services/database-manager.js';
import { MigrationManager } from '../../services/migrations.js';
import { logger } from '../../services/logger.js';

export class MigrateCommand extends BaseCLICommand {
  readonly name = 'migrate';
  readonly description = 'Runs database schema migrations';

  protected getDbConfig() {
    return {
      filename: './data/design-patterns.db',
      options: {
        readonly: false,
        fileMustExist: false,
        timeout: 5000,
        verbose: (message: string) => logger.debug('migrate', message),
      },
    };
  }

  protected async run(_args?: string[]): Promise<void> {
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
  }
}