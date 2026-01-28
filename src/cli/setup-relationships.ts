/**
 * Setup Relationships Command - Builds pattern relationship graph
 * Creates kNN graph from embeddings and adds metadata edges
 */

import { BaseCLICommand } from './commands/base-cli-command.js';
import { getDatabaseManager } from '../services/database-manager.js';
import { createVectorOperationsService } from '../services/vector-operations.js';
import { GraphVectorService } from '../services/graph-vector-service.js';
import { logger } from '../services/logger.js';

class SetupRelationshipsCommand extends BaseCLICommand {
  readonly name = 'setup-relationships';
  readonly description = 'Builds pattern relationship graph from embeddings';

  protected getDbConfig() {
    return {
      filename: './data/design-patterns.db',
      options: {
        readonly: false,
        fileMustExist: true,
        timeout: 5000,
        verbose: (message: string) => logger.debug('setup-relationships', message),
      },
    };
  }

  protected async run(_args?: string[]): Promise<void> {
    const dbManager = getDatabaseManager();
    const vectorOps = createVectorOperationsService(dbManager);

    // Initialize graph vector service
    const graphService = new GraphVectorService(vectorOps, dbManager, {
      k: 10,
      maxHops: 3,
      edgeWeightThreshold: 0.1,
      useMetadataEdges: true,
      rebuildInterval: 3600000,
    });

    logger.info('setup-relationships', 'Building pattern relationship graph...');

    // Build kNN graph from embeddings
    const graph = await graphService.buildKNNGraph();

    // Log results
    const nodeCount = graph.size;
    const totalEdges = Array.from(graph.values()).reduce((sum, n) => sum + n.neighbors.length, 0);

    logger.info('setup-relationships', `Relationship graph built successfully`);
    logger.info('setup-relationships', `  - Nodes (patterns): ${nodeCount}`);
    logger.info('setup-relationships', `  - Edges (relationships): ${totalEdges}`);

    // Validate
    if (nodeCount === 0) {
      throw new Error('No patterns found in graph. Please seed the database first.');
    }

    logger.info('setup-relationships', 'Relationship setup completed successfully');
  }
}

const command = new SetupRelationshipsCommand();
command.execute().catch((error) => {
  console.error('Relationship setup failed:', error);
  process.exit(1);
});
