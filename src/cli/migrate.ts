/**
 * Database Migration Runner - Command Pattern Implementation
 * Runs database schema migrations
 */

import { MigrateCommand } from './commands/migrate-command.js';

// Create and execute migrate command
const command = new MigrateCommand();

// Run if executed directly (maintains backward compatibility)
if (import.meta.url === `file://${process.argv[1]}`) {
  command.execute().catch((error: Error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
}

// Export command for use in other contexts (e.g., CLI registry)
export { command as migrateCommand };