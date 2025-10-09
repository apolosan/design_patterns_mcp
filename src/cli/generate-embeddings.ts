#!/usr/bin/env node
/**
 * Generate Embeddings for Design Patterns using Strategy Pattern
 * Creates vector embeddings for all patterns in the database using best available strategy
 */

import { DatabaseManager, initializeDatabaseManager } from '../services/database-manager.js';
import { VectorOperationsService, createVectorOperationsService } from '../services/vector-operations.js';
import { SemanticSearchService, createSemanticSearchService } from '../services/semantic-search.js';
import { EmbeddingServiceAdapter } from '../adapters/embedding-service-adapter.js';
import { getAvailableEmbeddingStrategies } from '../factories/embedding-factory.js';
import { logger } from '../services/logger.js';

async function main(): Promise<void> {
  try {
    logger.info('generate-embeddings', 'Starting embedding generation with strategy pattern...');

    // Check available strategies
    logger.info('generate-embeddings', 'Checking available embedding strategies...');
    const availableStrategies = await getAvailableEmbeddingStrategies();
    
    for (const strategy of availableStrategies) {
      logger.info('generate-embeddings', `Strategy: ${strategy.name} (${strategy.model}) - Available: ${strategy.available}`);
    }

    // Initialize database
    const dbConfig = {
      filename: './data/design-patterns.db',
      options: {
        readonly: false,
        fileMustExist: false,
        timeout: 5000,
        verbose: (message: string) => logger.debug('generate-embeddings', message)
      }
    };

    const dbManager = await initializeDatabaseManager(dbConfig);
    
    // Initialize embedding adapter with strategy pattern
    const embeddingAdapter = new EmbeddingServiceAdapter({
      cacheEnabled: false, // Disable cache for bulk generation
      batchSize: 20, // Process in larger batches
      retryAttempts: 3,
      retryDelay: 1000,
    });

    await embeddingAdapter.initialize();
    const strategyInfo = embeddingAdapter.getStrategyInfo();
    logger.info('generate-embeddings', `Using strategy: ${strategyInfo?.name} (${strategyInfo?.model})`);

    // Get all patterns
    const patterns = dbManager.query<{ id: string; name: string; description: string }>(
      'SELECT id, name, description FROM patterns'
    );

    logger.info('generate-embeddings', `Found ${patterns.length} patterns to process`);

    // Prepare texts for batch processing
    const texts = patterns.map(pattern => `${pattern.name} ${pattern.description}`);
    const patternIds = patterns.map(pattern => pattern.id);

    // Generate embeddings using batch processing
    logger.info('generate-embeddings', 'Generating embeddings using strategy pattern...');
    const embeddings = await embeddingAdapter.generateEmbeddings(texts);

    logger.info('generate-embeddings', `Generated ${embeddings.length} embeddings`);

    // Store embeddings in database
    logger.info('generate-embeddings', 'Storing embeddings...');

    // Create embeddings table if it doesn't exist
    dbManager.execute(`
      CREATE TABLE IF NOT EXISTS pattern_embeddings (
        pattern_id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        model TEXT NOT NULL,
        strategy TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Validate schema integrity (Fail-Fast Pattern)
    const schemaInfo = dbManager.query<{ name: string }>(
      `PRAGMA table_info(pattern_embeddings)`
    );
    
    const expectedColumns = new Set(['pattern_id', 'embedding', 'model', 'strategy', 'dimensions', 'created_at']);
    const actualColumns = new Set(schemaInfo.map(col => col.name));
    
    if (expectedColumns.size !== actualColumns.size || 
        ![...expectedColumns].every(col => actualColumns.has(col))) {
      const missing = [...expectedColumns].filter(col => !actualColumns.has(col));
      const extra = [...actualColumns].filter(col => !expectedColumns.has(col));
      
      throw new Error(
        `Schema mismatch for pattern_embeddings table!\n` +
        `Expected columns: ${[...expectedColumns].join(', ')}\n` +
        `Actual columns: ${[...actualColumns].join(', ')}\n` +
        `Missing columns: ${missing.join(', ') || 'none'}\n` +
        `Extra columns: ${extra.join(', ') || 'none'}\n` +
        `This usually means migrations need to be re-run. Try: npm run migrate`
      );
    }
    
    logger.info('generate-embeddings', '✓ Schema validation passed - all required columns present');

    // Store embeddings with strategy information
    for (let i = 0; i < patterns.length; i++) {
      const patternId = patternIds[i];
      const embedding = embeddings[i];
      
      dbManager.execute(
        'INSERT OR REPLACE INTO pattern_embeddings (pattern_id, embedding, model, strategy, dimensions) VALUES (?, ?, ?, ?, ?)',
        [
          patternId, 
          JSON.stringify(embedding), 
          strategyInfo?.model || 'unknown',
          strategyInfo?.name || 'unknown',
          embedding.length
        ]
      );

      if ((i + 1) % 50 === 0) {
        logger.info('generate-embeddings', `Stored ${i + 1}/${patterns.length} embeddings`);
      }
    }

    logger.info('generate-embeddings', `Successfully generated and stored embeddings for ${embeddings.length} patterns`);

    // Verify embeddings
    const storedCount = dbManager.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM pattern_embeddings'
    );

    const strategyStats = dbManager.query<{ strategy: string; model: string; count: number }>(
      'SELECT strategy, model, COUNT(*) as count FROM pattern_embeddings GROUP BY strategy, model'
    );

    logger.info('generate-embeddings', `Verification: ${storedCount?.count || 0} embeddings stored`);
    for (const stat of strategyStats) {
      logger.info('generate-embeddings', `  ${stat.strategy} (${stat.model}): ${stat.count} embeddings`);
    }

    // Close database
    await dbManager.close();

    logger.info('generate-embeddings', 'Embedding generation completed successfully!');

  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}