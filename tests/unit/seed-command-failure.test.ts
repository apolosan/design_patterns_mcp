/**
 * Regression test — `bun run seed` must exit with failure when seeding fails
 * (review F9).
 *
 * Before the fix SeedCommand logged "Seeded undefined patterns..." and only
 * failed when the database happened to be empty; on an already-populated
 * database a failed seed was reported as success.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/services/pattern-seeder.js', () => ({
  PatternSeeder: class {
    seedAll() {
      return Promise.resolve({ success: false, message: 'Seeding failed: disk full' });
    }
  },
}));

vi.mock('../../src/services/database-manager.js', () => ({
  getDatabaseManager: () => ({}),
}));

vi.mock('../../src/services/pattern-storage.js', () => ({
  getPatternStorageService: () => ({
    // A populated database: the old code reached "Data validation passed".
    getPatternStats: () =>
      Promise.resolve({ totalPatterns: 700, categories: 90, implementations: 10, embeddings: 700 }),
    getCategories: () => Promise.resolve([{ category: 'Creational', count: 8 }]),
    getAllPatterns: () => Promise.resolve([{ name: 'Builder', category: 'Creational' }]),
  }),
}));

describe('SeedCommand on a failed seed', () => {
  it('rejects with the seeder failure message even when the database already holds patterns', async () => {
    const { SeedCommand } = await import('../../src/cli/commands/seed-command.js');
    const command = new SeedCommand() as unknown as { run: () => Promise<void> };

    await expect(command.run()).rejects.toThrow('disk full');
  });
});
