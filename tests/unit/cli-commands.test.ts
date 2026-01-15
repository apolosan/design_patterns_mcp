/**
 * Command Pattern Tests
 * Tests for CLI commands using the Command Pattern implementation
 */

import { describe, it, expect } from 'vitest';
import { SeedCommand } from '../../src/cli/commands/seed-command.js';
import { MigrateCommand } from '../../src/cli/commands/migrate-command.js';
import { GenerateEmbeddingsCommand } from '../../src/cli/commands/generate-embeddings-command.js';

describe('CLI Command Pattern', () => {
  describe('Command Interface', () => {
    it('should implement CLICommand interface', () => {
      const command = new SeedCommand();
      expect(command).toHaveProperty('name');
      expect(command).toHaveProperty('description');
      expect(typeof command.execute).toBe('function');
    });

    it('should have correct command names', () => {
      expect(new SeedCommand().name).toBe('seed');
      expect(new MigrateCommand().name).toBe('migrate');
      expect(new GenerateEmbeddingsCommand().name).toBe('generate-embeddings');
    });

    it('should have descriptions', () => {
      expect(new SeedCommand().description).toBeTruthy();
      expect(new MigrateCommand().description).toBeTruthy();
      expect(new GenerateEmbeddingsCommand().description).toBeTruthy();
    });
  });
});