/**
 * Seed Command - Seeds database with pattern data
 * Implements Command Pattern for standardized CLI execution
 */

import { BaseCLICommand } from './base-cli-command.js';
import { getDatabaseManager } from '../../services/database-manager.js';
import { getPatternStorageService } from '../../services/pattern-storage.js';
import { PatternSeeder } from '../../services/pattern-seeder.js';
import { logger } from '../../services/logger.js';

export class SeedCommand extends BaseCLICommand {
  readonly name = 'seed';
  readonly description = 'Seeds the database with pattern data from JSON files';

  protected async run(args?: string[]): Promise<void> {
    const dbManager = getDatabaseManager();
    const patternStorage = getPatternStorageService();

    // Configuration for seeding
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
      throw new Error('No patterns found in database after seeding');
    }
  }
}