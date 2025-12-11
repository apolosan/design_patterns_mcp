/**
 * Embedding Generation Runner
 * Generates embeddings for all patterns in the database
 */

import { initializeDatabaseManager, getDatabaseManager, closeDatabaseManager } from '../services/database-manager.js';
import { createVectorOperationsService } from '../services/vector-operations.js';
import { EmbeddingStrategyFactory } from '../factories/embedding-factory.js';
import { logger } from '../services/logger.js';

async function main(): Promise<void> {
  try {
    logger.info('embeddings', 'Starting embedding generation script');

    // Initialize database
    const dbConfig = {
      filename: './data/design-patterns.db',
      options: {
        readonly: false,
        fileMustExist: true,
        timeout: 5000,
        verbose: (message: string) => logger.debug('embeddings', message),
      },
    };

    await initializeDatabaseManager(dbConfig);
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
      console.error('❌ No embeddings were generated');
      process.exit(1);
    }

    // Close database
    await closeDatabaseManager();
    logger.info('embeddings', '✅ Embedding generation completed successfully!');
  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
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