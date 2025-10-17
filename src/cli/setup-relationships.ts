#!/usr/bin/env node

/**
 * Setup Relationships CLI
 * Creates pattern_relationships table and populates it with relationship data
 * Similar to 'npm run seed' but focused on relationships
 */

import { initializeDatabaseManager, DatabaseManager } from '../services/database-manager.js';
import { getPatternLoaderService, PatternLoaderService } from '../services/pattern-loader.js';
import { logger } from '../services/logger.js';

async function main() {
  try {
    logger.info('setup-relationships', 'Starting relationships setup...');

    // Initialize database first
    const dbConfig = {
      filename: './data/design-patterns.db',
      options: {
        readonly: false,
        fileMustExist: false,
        timeout: 5000,
        verbose: (message: string) => logger.debug('setup-relationships', message),
      },
    };

    const dbManager = await initializeDatabaseManager(dbConfig);
    logger.info('setup-relationships', 'Database initialized');

    // Get pattern loader service (this will use the already initialized database)
    const patternLoader = getPatternLoaderService();

    // Initialize database
    await dbManager.initialize();
    logger.info('setup-relationships', 'Database initialized');

    // Create pattern_relationships table if it doesn't exist
    createRelationshipsTable(dbManager);

    // Process and load relationship data from pattern files
    await loadRelationships(patternLoader);

    // Close database to ensure changes are saved
    await dbManager.close();

    logger.info('setup-relationships', 'Relationships setup completed successfully');
  } catch (error) {
    logger.error('setup-relationships', 'Setup failed', error as Error);
    console.error('❌ Relationships setup failed:', error);
    process.exit(1);
  }
}

/**
 * Create pattern_relationships table with proper schema
 */
function createRelationshipsTable(dbManager: DatabaseManager): void {
  logger.info('setup-relationships', 'Ensuring pattern_relationships table exists...');

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS pattern_relationships (
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

    CREATE INDEX IF NOT EXISTS idx_pattern_relationships_source
      ON pattern_relationships(source_pattern_id);

    CREATE INDEX IF NOT EXISTS idx_pattern_relationships_target
      ON pattern_relationships(target_pattern_id);

    CREATE INDEX IF NOT EXISTS idx_pattern_relationships_type
      ON pattern_relationships(type);
  `;

  try {
    logger.info('setup-relationships', 'Calling execDDL...');
    dbManager.execDDL(createTableSQL);
    logger.info('setup-relationships', 'execDDL completed, checking if table exists...');

    // Verify table was created
    const result = dbManager.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='pattern_relationships';"
    );
    if (result.length > 0) {
      logger.info('setup-relationships', 'pattern_relationships table created/verified');
    } else {
      logger.error('setup-relationships', 'Table creation failed - table not found after execDDL');
      throw new Error('Table creation verification failed');
    }
  } catch (error) {
    logger.error(
      'setup-relationships',
      'Failed to create pattern_relationships table',
      error as Error
    );
    throw error;
  }
}

/**
 * Load relationship data from pattern JSON files
 */
async function loadRelationships(patternLoader: PatternLoaderService): Promise<void> {
  logger.info('setup-relationships', 'Loading relationship data from pattern files...');

  try {
    // Load all pattern categories - this will also process relationships
    // since loadAllPatternCategories calls processPendingRelationships internally
    await patternLoader.loadAllPatternCategories();
    logger.info('setup-relationships', 'Pattern categories and relationships loaded successfully');
  } catch (error) {
    logger.error('setup-relationships', 'Failed to load relationship data', error as Error);
    throw error;
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('setup-relationships', 'Uncaught exception', error);
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, _promise) => {
  logger.error('setup-relationships', 'Unhandled rejection', reason as Error);
  console.error('❌ Unhandled rejection:', reason);
  process.exit(1);
});

// Run the setup
main()
  .then(() => {
    logger.info('setup-relationships', 'Relationships setup completed successfully');
  })
  .catch(error => {
    logger.error(
      'setup-relationships',
      'Main function failed',
      error instanceof Error ? error : new Error(String(error))
    );
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
