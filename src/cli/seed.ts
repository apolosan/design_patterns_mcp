/**
 * CLI Entry Point for Seed Command
 * Seeds the database with pattern data from JSON files
 */

import { SeedCommand } from './commands/seed-command.js';

const command = new SeedCommand();
command.execute().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
