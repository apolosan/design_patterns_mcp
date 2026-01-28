/**
 * CLI Entry Point for Generate Embeddings Command
 * Generates embeddings for all patterns in the database
 */

import { GenerateEmbeddingsCommand } from './commands/generate-embeddings-command.js';

const command = new GenerateEmbeddingsCommand();
command.execute().catch((error) => {
  console.error('Embedding generation failed:', error);
  process.exit(1);
});
