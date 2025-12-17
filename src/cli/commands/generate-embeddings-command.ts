/**
 * Generate Embeddings Command - Generates embeddings for patterns
 * Implements Command Pattern for standardized CLI execution
 */

import { BaseCLICommand } from './base-cli-command.js';
import { getDatabaseManager } from '../../services/database-manager.js';
import { createVectorOperationsService } from '../../services/vector-operations.js';
import { EmbeddingStrategyFactory } from '../../factories/embedding-factory.js';
import { logger } from '../../services/logger.js';

export class GenerateEmbeddingsCommand extends BaseCLICommand {
  readonly name = 'generate-embeddings';
  readonly description = 'Generates embeddings for all patterns in the database';

  protected getDbConfig() {
    return {
      filename: './data/design-patterns.db',
      options: {
        readonly: false,
        fileMustExist: true,
        timeout: 5000,
        verbose: (message: string) => logger.debug('embeddings', message),
      },
    };
  }

  protected async run(args?: string[]): Promise<void> {
    const dbManager = getDatabaseManager();
    const vectorOps = createVectorOperationsService(dbManager);

    // Initialize embedding factory
    const embeddingFactory = EmbeddingStrategyFactory.getInstance();
    const embeddingService = await embeddingFactory.createStrategy();

    logger.info('embeddings', 'Generating embeddings for all patterns...');

    // Generate embeddings using the vector operations service
    await vectorOps.rebuildEmbeddings(async (text: string) => {
      const embedding = await embeddingService.generateEmbedding(text);
      return embedding.values; // Extract the number array from EmbeddingVector
    });

    // Get embedding statistics
    const stats = vectorOps.getStats();
    logger.info('embeddings', `Embedding generation completed: ${stats.totalVectors} embeddings created`);

    // Validate embeddings
    if (stats.totalVectors > 0) {
      logger.info('embeddings', 'Embeddings validation passed');
    } else {
      throw new Error('No embeddings were generated');
    }
  }
}