/**
 * Database Initialization Script
 * Sets up the database, runs migrations, and seeds initial data
 */
import { initializeDatabaseManager, DatabaseManager } from '../services/database-manager.js';
import { MigrationManager } from '../services/migrations.js';
import { createPatternSeeder } from '../services/pattern-seeder.js';
import { logger, createLogger, LogLevel } from '../services/logger.js';

export interface InitConfig {
  databasePath: string;
  migrationsPath: string;
  patternsPath: string;
}

export const DEFAULT_INIT_CONFIG: InitConfig = {
  databasePath: './data/design-patterns.db',
  migrationsPath: './migrations',
  patternsPath: './data/patterns',
};

/**
 * Initialize the database with schema and data
 */
export async function initializeDatabase(
  config: InitConfig = DEFAULT_INIT_CONFIG
): Promise<InitResult> {
  let db: DatabaseManager | null = null;

  try {
    logger.info('db-init', 'Initializing database...');

    // Initialize database manager
    db = await initializeDatabaseManager({
      filename: config.databasePath,
      options: {
        verbose: (message: string) => logger.debug('db-init', message),
      },
    });

    // Initialize migration manager
    const migrationManager = new MigrationManager(db, config.migrationsPath);
    await migrationManager.initialize();

    // Run migrations with graceful degradation
    logger.info('db-init', 'Running migrations...');
    const migrationResult = await migrationManager.migrate();

    if (!migrationResult.success) {
      logger.error('db-init', `Migration failed: ${migrationResult.message}`);
      logger.warn('db-init', 'Continuing with existing schema - database may be partially initialized');
      // Don't throw - allow continuing with existing schema
    } else {
      logger.info(
        'db-init',
        `Migrations completed: ${migrationResult.executed?.length || 0} executed`
      );
    }

    // Seed pattern data
    logger.info('db-init', 'Seeding pattern data...');
    const seeder = createPatternSeeder(db, {
      patternsPath: config.patternsPath,
      batchSize: 10,
      skipExisting: false, // Changed to false to allow updates
    });

    const seedResult = await seeder.seedAll();

    if (!seedResult.success) {
      logger.error('db-init', `Seeding failed: ${seedResult.message}`);
      logger.warn('db-init', 'Continuing with existing data - some patterns may be missing');
      // Don't throw - allow continuing with partial data
    } else {
      logger.info(
        'db-init',
        `Seeding completed: ${seedResult.totalPatterns || 0} patterns, ${seedResult.totalImplementations || 0} implementations`
      );
    }

    // Validate data
    logger.info('db-init', 'Validating seeded data...');
    const validationResult = await seeder.validate();

    if (!validationResult.valid) {
      console.warn('Data validation warnings:', validationResult.errors);
    }

    // Get final stats
    const stats = await seeder.getStats();

    return {
      success: true,
      message: 'Database initialization completed successfully',
      stats: {
        patterns: stats.totalPatterns,
        implementations: stats.totalImplementations,
        relationships: stats.totalRelationships,
        categories: stats.patternsByCategory.length,
        languages: stats.implementationsByLanguage.length,
      },
      migrationsExecuted: migrationResult.executed?.length || 0,
      validationErrors: validationResult.errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Database initialization failed:', errorMessage);

    return {
      success: false,
      message: `Database initialization failed: ${errorMessage}`,
      error: error instanceof Error ? error : new Error(errorMessage),
    };
  } finally {
    // Close database connection
    if (db) {
      await db.close();
    }
  }
}

/**
 * Check database health and status
 */
export async function checkDatabaseHealth(
  config: InitConfig = DEFAULT_INIT_CONFIG
): Promise<HealthResult> {
  let db: DatabaseManager | null = null;

  try {
    db = await initializeDatabaseManager({
      filename: config.databasePath,
    });

    const healthCheck = await db.healthCheck();

    if (!healthCheck.healthy) {
      return {
        healthy: false,
        message: healthCheck.error || 'Database health check failed',
      };
    }

    // Get additional stats
    const stats = db.getStats();
    const seeder = createPatternSeeder(db);
    const seederStats = await seeder.getStats();

    return {
      healthy: true,
      message: 'Database is healthy',
      stats: {
        databaseSize: stats.databaseSize,
        tableCount: stats.tableCount,
        patterns: seederStats.totalPatterns,
        implementations: seederStats.totalImplementations,
        relationships: seederStats.totalRelationships,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      healthy: false,
      message: `Health check failed: ${errorMessage}`,
      error: error instanceof Error ? error : new Error(errorMessage),
    };
  } finally {
    if (db) {
      await db.close();
    }
  }
}

export interface InitResult {
  success: boolean;
  message: string;
  stats?: {
    patterns: number;
    implementations: number;
    relationships: number;
    categories: number;
    languages: number;
  };
  migrationsExecuted?: number;
  validationErrors?: string[];
  error?: Error;
}

export interface HealthResult {
  healthy: boolean;
  message: string;
  stats?: {
    databaseSize: number;
    tableCount: number;
    patterns: number;
    implementations: number;
    relationships: number;
  };
  error?: Error;
}

// CLI runner
if (import.meta.url === `file://${process.argv[1]}`) {
  logger.info('db-init', 'Starting db init script...');
  const command = process.argv[2] || 'init';
  logger.info('db-init', 'Command:', command);

  if (command === 'init' || command === 'seed') {
    logger.info('db-init', 'Initializing database...');
    logger.info('db-init', 'Starting database initialization...');
    initializeDatabase()
      .then(result => {
        if (result.success) {
          logger.info('db-init', '✅', result.message);
          if (result.stats) {
            logger.info('db-init', '📊 Stats:', result.stats);
          }
          process.exit(0);
        } else {
          console.error('❌', result.message);
          process.exit(1);
        }
      })
      .catch(error => {
        console.error('❌ Initialization error:', error);
        process.exit(1);
      });
  } else if (command === 'health') {
    logger.info('db-init', 'Checking database health...');
    checkDatabaseHealth()
      .then(result => {
        if (result.healthy) {
          logger.info('db-init', '✅', result.message);
          if (result.stats) {
            logger.info('db-init', '📊 Stats:', result.stats);
          }
        } else {
          logger.info('db-init', '❌', result.message);
        }
      })
      .catch(error => {
        console.error('❌ Health check error:', error);
      });
  } else {
    logger.info('db-init', 'Usage: bun run src/db/init.ts [init|seed|health]');
    process.exit(1);
  }
}
