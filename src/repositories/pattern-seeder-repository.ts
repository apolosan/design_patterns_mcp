/**
 * Pattern Seeder Repository Implementation
 * Handles database operations for pattern seeding
 */

import type { PatternSeederRepository } from './interfaces.js';
import type { Pattern } from '../models/pattern.js';
import type { DatabaseManager } from '../services/database-manager.js';
import { SqlValue } from '../services/statement-pool.js';
import { logger } from '../services/logger.js';

export class SqlitePatternSeederRepository implements PatternSeederRepository {
  constructor(private db: DatabaseManager) {}

  insertPattern(pattern: Pattern): boolean {
    try {
      const sql = `
        INSERT OR REPLACE INTO patterns (
          id, name, category, description, when_to_use, benefits,
          drawbacks, use_cases, complexity, tags, examples, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params: SqlValue[] = [
        pattern.id,
        pattern.name,
        pattern.category,
        pattern.description,
        JSON.stringify(pattern.when_to_use || []),
        JSON.stringify(pattern.benefits || []),
        JSON.stringify(pattern.drawbacks || []),
        JSON.stringify(pattern.use_cases || []),
        pattern.complexity,
        JSON.stringify(pattern.tags || []),
        pattern.examples ? JSON.stringify(pattern.examples) : null,
        (pattern.createdAt ? new Date(pattern.createdAt) : new Date()).toISOString(),
        (pattern.updatedAt ? new Date(pattern.updatedAt) : new Date()).toISOString(),
      ];

      this.db.execute(sql, params);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('pattern-seeder-repo', `Failed to insert pattern ${pattern.id}`, undefined, errorMsg as any);
      return false;
    }
  }

  insertImplementation(patternId: string, implementation: { language?: string; approach?: string; code?: string; explanation?: string; dependencies?: string[] }): boolean {
    try {
      const sql = `
        INSERT OR REPLACE INTO pattern_implementations (
          id, pattern_id, language, approach, code, explanation,
          dependencies, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params: SqlValue[] = [
        crypto.randomUUID(),
        patternId,
        implementation.language ?? 'unknown',
        implementation.approach ?? 'default',
        implementation.code ?? '',
        implementation.explanation ?? '',
        JSON.stringify(implementation.dependencies ?? []),
        new Date().toISOString(),
      ];

      this.db.execute(sql, params);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('pattern-seeder-repo', `Failed to insert implementation for pattern ${patternId}`, undefined, errorMsg as any);
      return false;
    }
  }

  insertRelationship(sourcePatternId: string, targetPatternId: string, relationship: { type?: string; strength?: number; description?: string }): boolean {
    try {
      const type = relationship.type ?? 'related';
      const strength = relationship.strength ?? 1.0;
      const description = relationship.description ?? `Related to ${targetPatternId}`;

      const existing = this.db.queryOne<{ id: string }>(
        'SELECT id FROM pattern_relationships WHERE source_pattern_id = ? AND target_pattern_id = ?',
        [sourcePatternId, targetPatternId]
      );

      if (existing) {
        return false;
      }

      const sql = `
        INSERT INTO pattern_relationships (
          id, source_pattern_id, target_pattern_id, type,
          strength, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params: SqlValue[] = [
        crypto.randomUUID(),
        sourcePatternId,
        targetPatternId,
        type,
        strength,
        description,
        new Date().toISOString(),
      ];

      this.db.execute(sql, params);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('pattern-seeder-repo', `Failed to insert relationship for pattern ${sourcePatternId}`, undefined, errorMsg as any);
      return false;
    }
  }

  patternExists(id: string): boolean {
    try {
      const result = this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM patterns WHERE id = ?',
        [id]
      );
      return (result?.count ?? 0) > 0;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('pattern-seeder-repo', `Failed to check pattern existence ${id}`, undefined, errorMsg as any);
      return false;
    }
  }

  findPatternIdByName(name: string): string | null {
    try {
      const result = this.db.queryOne<{ id: string }>(
        'SELECT id FROM patterns WHERE name = ?',
        [name]
      );
      return result?.id ?? null;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('pattern-seeder-repo', `Failed to find pattern ID by name ${name}`, undefined, errorMsg as any);
      return null;
    }
  }

  relationshipExists(sourcePatternId: string, targetPatternId: string): boolean {
    try {
      const result = this.db.queryOne<{ id: string }>(
        'SELECT id FROM pattern_relationships WHERE source_pattern_id = ? AND target_pattern_id = ?',
        [sourcePatternId, targetPatternId]
      );
      return result !== undefined;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('pattern-seeder-repo', `Failed to check relationship existence`, undefined, errorMsg as any);
      return false;
    }
  }

  transaction(callback: () => void): void {
    this.db.transaction(callback);
  }
}
