/**
 * Base CLI Command with Common Database Lifecycle Management
 * Provides standardized database initialization, error handling, and logging
 */

import { initializeDatabaseManager, closeDatabaseManager } from '../../services/database-manager.js';
import { logger } from '../../services/logger.js';
import type { CLICommand, DBConfig } from './cli-command.js';

export abstract class BaseCLICommand implements CLICommand {
  abstract readonly name: string;
  readonly description?: string;

  /**
   * Override to provide database configuration for this command
   * Return undefined if command doesn't require database access
   */
  protected getDbConfig(): DBConfig | undefined {
    return {
      filename: './data/design-patterns.db',
      options: {
        readonly: false,
        fileMustExist: false,
        timeout: 5000,
        verbose: (message: string) => logger.debug(this.name, message),
      },
    };
  }

  /**
   * Hook called before command execution
   */
  protected async preExecute(_args?: string[]): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Main command logic - must be implemented by subclasses
   */
  protected abstract run(args?: string[]): Promise<void>;

  /**
   * Hook called after command execution
   */
  protected async postExecute(_args?: string[]): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Execute command with full lifecycle management
   */
  async execute(args?: string[]): Promise<void> {
    logger.info(this.name, `Starting ${this.name} command`);

    const dbConfig = this.getDbConfig();
    let openedDb = false;

    try {
      // Initialize database if required
      if (dbConfig) {
        await initializeDatabaseManager(dbConfig);
        openedDb = true;
      }

      // Execute command lifecycle
      await this.preExecute(args);
      await this.run(args);
      await this.postExecute(args);

      logger.info(this.name, `✅ ${this.name} completed successfully`);
    } catch (error) {
      logger.error(this.name, `${this.name} failed`, error as Error);

      // Re-throw for testing compatibility, scripts should catch and exit
      throw error;
    } finally {
      // Clean up database connection if we opened it
      if (openedDb) {
        try {
          await closeDatabaseManager();
          logger.debug(this.name, 'Database connection closed');
        } catch (closeError) {
          logger.warn(this.name, 'Error closing database connection', closeError as Error);
        }
      }
    }
  }
}