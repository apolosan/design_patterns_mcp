/**
 * Relationship Setup Runner
 * Sets up pattern relationships from JSON data
 */

import { initializeDatabaseManager, getDatabaseManager, closeDatabaseManager } from '../services/database-manager.js';
import { getPatternStorageService } from '../services/pattern-storage.js';
import { PatternSeeder } from '../services/pattern-seeder.js';
import { logger } from '../services/logger.js';

async function main(): Promise<void> {
  try {
    logger.info('relationships', 'Starting relationship setup script');

    // Initialize database
    const dbConfig = {
      filename: './data/design-patterns.db',
      options: {
        readonly: false,
        fileMustExist: true,
        timeout: 5000,
        verbose: (message: string) => logger.debug('relationships', message),
      },
    };

    await initializeDatabaseManager(dbConfig);
    const dbManager = getDatabaseManager();
    const patternStorage = getPatternStorageService();

    // Initialize pattern seeder for relationships only
    const seederConfig = {
      patternsPath: './data/patterns',
      batchSize: 50,
      skipExisting: true,
    };
    const patternSeeder = new PatternSeeder(dbManager, seederConfig);

    logger.info('relationships', 'Setting up pattern relationships...');

    // Setup relationships by re-seeding (will skip existing patterns)
    const result = await patternSeeder.seedAll();

    logger.info('relationships', `Relationships setup completed: ${result.totalRelationships || 0} total relationships`);

    // Get relationship statistics
    const dbStats = await patternStorage.getPatternStats();
    logger.info('relationships', `Database now has ${dbStats.totalPatterns} patterns with relationships`);

    // Validate relationships
    if ((result.totalRelationships || 0) > 0) {
      logger.info('relationships', 'Relationships validation passed');
    } else {
      logger.warn('relationships', 'No relationships found in database');
    }

    // Close database
    await closeDatabaseManager();
    logger.info('relationships', '✅ Relationship setup completed successfully!');
  } catch (error) {
    console.error('❌ Relationship setup failed:', error);
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