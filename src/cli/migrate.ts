/**
 * CLI Entry Point for Migrate Command
 * Runs database schema migrations
 */

import { MigrateCommand } from './commands/migrate-command.js';

const command = new MigrateCommand();
command.execute().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
