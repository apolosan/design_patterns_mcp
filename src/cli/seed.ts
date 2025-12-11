/**
 * Database Seeder Runner
 * Seeds the database with pattern data from JSON files
 */

import { initializeDatabaseManager, getDatabaseManager, closeDatabaseManager } from '../services/database-manager.js';
import { getPatternStorageService } from '../services/pattern-storage.js';
import { PatternSeeder } from '../services/pattern-seeder.js';
import { logger } from '../services/logger.js';

async function main(): Promise<void> {
  try {
    logger.info('seed', 'Starting seeding script');
    // Initialize database
    const dbConfig = {
      filename: './data/design-patterns.db',
      options: {
        readonly: false,
        fileMustExist: false,
        timeout: 5000,
        verbose: (message: string) => logger.debug('seed', message),
      },
    };

    await initializeDatabaseManager(dbConfig);
    const dbManager = getDatabaseManager();
    const patternStorage = getPatternStorageService();

    // Initialize pattern seeder
    const seederConfig = {
      patternsPath: './data/patterns',
      batchSize: 50,
      skipExisting: true,
    };
    const patternSeeder = new PatternSeeder(dbManager, seederConfig);

    logger.info('seed', 'Starting pattern seeding...');

    // Seed all patterns and relationships
    const result = await patternSeeder.seedAll();
    logger.info('seed', `Seeded ${result.totalPatterns} patterns, ${result.totalImplementations} implementations, and ${result.totalRelationships} relationships`);

    // Log seeding results
    logger.info('seed', `Seeding completed with ${result.totalPatterns} patterns processed`);

    // Get database statistics
    logger.info('seed', 'Database Statistics:');
    const dbStats = await patternStorage.getPatternStats();
    logger.info('seed', `  - Total Patterns: ${dbStats.totalPatterns}`);
    logger.info('seed', `  - Categories: ${dbStats.categories}`);
    logger.info('seed', `  - Implementations: ${dbStats.implementations}`);
    logger.info('seed', `  - Embeddings: ${dbStats.embeddings}`);

    // Get patterns by category
    logger.info('seed', 'Patterns by Category:');
    const categories = await patternStorage.getCategories();
    categories.forEach(cat => {
      logger.info('seed', `  - ${cat.category}: ${cat.count} patterns`);
    });

    // Validate data
    logger.info('seed', 'Validating seeded data...');
    const samplePatterns = await patternStorage.getAllPatterns();
    if (samplePatterns.length > 0) {
      logger.info('seed', 'Data validation passed');
      logger.info('seed', 'Sample patterns loaded:');
      samplePatterns.slice(0, 5).forEach(pattern => {
        logger.info('seed', `  - ${pattern.name} (${pattern.category})`);
      });
      if (samplePatterns.length > 5) {
        logger.info('seed', `  ... and ${samplePatterns.length - 5} more patterns`);
      }
    } else {
      console.error('❌ No patterns found in database');
      process.exit(1);
    }

    // Close database to save changes to file
    await closeDatabaseManager();
    logger.info('seed', '✅ Database saved to file');
    logger.info('seed', '✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
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