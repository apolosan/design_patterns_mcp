/**
 * Seed Command - Seeds database with pattern data
 * Implements Command Pattern for standardized CLI execution
 */

import { BaseCLICommand } from './base-cli-command.js';
import { SimpleContainer, TOKENS } from '../../core/container.js';
import { PatternSeeder } from '../../services/pattern-seeder.js';
import { SqlitePatternSeederRepository } from '../../repositories/pattern-seeder-repository.js';
import { logger } from '../../services/logger.js';

export class SeedCommand extends BaseCLICommand {
  readonly name = 'seed';
  readonly description = 'Seeds the database with pattern data from JSON files';

  protected async run(_args?: string[]): Promise<void> {
    // Create container and get services via DI
    const container = new SimpleContainer();
    const dbManager = container.getService<any>(TOKENS.DATABASE_MANAGER);
    const patternSeederRepo = new SqlitePatternSeederRepository(dbManager);

    // Configuration for seeding
    const seederConfig = {
      patternsPath: './data/patterns',
      batchSize: 50,
      skipExisting: true,
    };

    const patternSeeder = new PatternSeeder(patternSeederRepo, seederConfig);

    logger.info('seed', 'Starting pattern seeding...');

    // Seed all patterns and relationships
    const result = await patternSeeder.seedAll();
    logger.info('seed', `Seeded ${result.totalPatterns} patterns, ${result.totalImplementations} implementations, and ${result.totalRelationships} relationships`);

    // Log seeding results
    logger.info('seed', 'Database Statistics:');
    const stats = patternSeeder.getStats();
    logger.info('seed', `  - Total Patterns: ${stats.totalPatterns}`);
    logger.info('seed', `  - Implementations: ${stats.totalImplementations}`);
    logger.info('seed', `  - Relationships: ${stats.totalRelationships}`);

    // Get patterns by category
    logger.info('seed', 'Patterns by Category:');
    stats.patternsByCategory.forEach(cat => {
      logger.info('seed', `  - ${cat.category}: ${cat.count} patterns`);
    });

    // Validate data
    logger.info('seed', 'Validating seeded data...');
    const validationResult = patternSeeder.validate();
    if (validationResult.valid) {
      logger.info('seed', 'Data validation passed');
    } else {
      logger.warn('seed', 'Data validation warnings:', { errors: validationResult.errors });
    }
  }
}