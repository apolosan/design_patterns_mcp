/**
 * Database Seeder Runner - Command Pattern Implementation
 * Seeds the database with pattern data from JSON files
 */

import { SeedCommand } from './commands/seed-command.js';

// Create and execute seed command
const command = new SeedCommand();

// Run if executed directly (maintains backward compatibility)
if (import.meta.url === `file://${process.argv[1]}`) {
  command.execute().catch((error: Error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
}

// Export command for use in other contexts (e.g., CLI registry)
export { command as seedCommand };