/**
 * Embedding Generation Runner - Command Pattern Implementation
 * Generates embeddings for all patterns in the database
 */

import { GenerateEmbeddingsCommand } from './commands/generate-embeddings-command.js';

// Create and execute embeddings command
const command = new GenerateEmbeddingsCommand();

// Run if executed directly (maintains backward compatibility)
if (import.meta.url === `file://${process.argv[1]}`) {
  command.execute().catch((error: Error) => {
    console.error('❌ Embedding generation failed:', error);
    process.exit(1);
  });
}

// Export command for use in other contexts (e.g., CLI registry)
export { command as generateEmbeddingsCommand };