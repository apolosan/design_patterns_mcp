/**
 * Pattern Data Seeder for Design Patterns MCP Server
 * Loads pattern data from JSON files and seeds the database
 */
import { DatabaseManager } from './database-manager.js';
import { Pattern } from '../models/pattern.js';
import { logger } from './logger.js';
import { isObject } from '../utils/type-guards.js';
import fs from 'fs';
import path from 'path';

interface SeederConfig {
  patternsPath: string;
  batchSize: number;
  skipExisting: boolean;
}

interface RawRelationship {
  targetPatternId?: string;
  patternId?: string;
  name?: string;
  type?: string;
  strength?: number;
  description?: string;
}

interface RawImplementation {
  language?: string;
  approach?: string;
  code?: string;
  explanation?: string;
  dependencies?: string[];
}

interface PatternFileData {
  patterns?: unknown[];
  id?: string;
  [key: string]: unknown;
}

export class PatternSeeder {
  private db: DatabaseManager;
  private config: SeederConfig;

  constructor(db: DatabaseManager, config: SeederConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * Seed all pattern data
   */
  async seedAll(): Promise<SeederResult> {
    const results: SeederResult[] = [];
    let totalPatterns = 0;
    let totalImplementations = 0;
    let totalRelationships = 0;

    try {
      // Get all pattern JSON files
      const patternFiles = this.getPatternFiles();

      // First pass: Load all patterns and collect relationships
      const allPatterns: Pattern[] = [];
      const allRelationships: Array<{ sourceId: string; relationship: string | RawRelationship; filename: string }> = [];

      for (const file of patternFiles) {
        const data = await this.loadPatternFile(file) as PatternFileData;
        const patterns = data.patterns ?? (data.id ? [data] : []);

        for (const pattern of patterns) {
          const typedPattern = pattern as Pattern;
          allPatterns.push(typedPattern);

          // Collect relationships for later insertion
          const relatedPatterns = typedPattern.relatedPatterns ?? (typedPattern as Pattern & { related_patterns?: string[] }).related_patterns;
          const relationships = typedPattern.relationships;

          // Process legacy relatedPatterns format
          if (relatedPatterns) {
            for (const rel of relatedPatterns) {
              allRelationships.push({ sourceId: typedPattern.id, relationship: rel, filename: file });
            }
          }

          // Process new relationships format
          if (relationships) {
            for (const rel of relationships) {
              allRelationships.push({ sourceId: typedPattern.id, relationship: rel, filename: file });
            }
          }
        }
      }

      // Second pass: Insert all patterns
      this.db.transaction(() => {
        for (const pattern of allPatterns) {
          const patternInserted = this.insertPattern(pattern);
          if (patternInserted) {
            totalPatterns++;
          }
        }
      });

      // Third pass: Insert all implementations
      this.db.transaction(() => {
        for (const pattern of allPatterns) {
          if (pattern.implementations) {
            for (const impl of pattern.implementations) {
              const implInserted = this.insertImplementation(pattern.id, impl);
              if (implInserted) {
                totalImplementations++;
              }
            }
          }
        }
      });

      // Fourth pass: Insert all relationships (after all patterns exist)
      this.db.transaction(() => {
        for (const { sourceId, relationship } of allRelationships) {
          // Handle both string and object formats for relationships
          if (typeof relationship === 'string') {
            // String format: relationship is the target pattern name
            const relInserted = this.insertRelationship(sourceId, relationship);
            if (relInserted) {
              totalRelationships++;
            }
          } else if (relationship && typeof relationship === 'object') {
            // Object format: extract target pattern name
            const targetPatternName =
              relationship.patternId ?? relationship.targetPatternId ?? relationship.name;
            if (targetPatternName) {
              const relInserted = this.insertRelationship(sourceId, targetPatternName);
              if (relInserted) {
                totalRelationships++;
              }
            }
          }
        }
      });

      return {
        success: true,
        message: `Successfully seeded ${totalPatterns} patterns, ${totalImplementations} implementations, and ${totalRelationships} relationships`,
        totalPatterns,
        totalImplementations,
        totalRelationships,
        fileResults: results,
      };
    } catch (error) {
      return {
        success: false,
        message: `Seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Seed patterns from a specific file
   */
  async seedFromFile(filePath: string): Promise<SeederResult> {
    try {
      const data = await this.loadPatternFile(filePath) as PatternFileData;
      const patterns = (data.patterns as Pattern[]) || [];

      let patternsInserted = 0;
      let implementationsInserted = 0;
      let relationshipsInserted = 0;

      // Process patterns in batches
      for (let i = 0; i < patterns.length; i += this.config.batchSize) {
        const batch = patterns.slice(i, i + this.config.batchSize);
        const batchResult = this.seedBatch(batch);

        patternsInserted += batchResult.patternsInserted;
        implementationsInserted += batchResult.implementationsInserted;
        relationshipsInserted += batchResult.relationshipsInserted;
      }

      const filename = path.basename(filePath);
      return {
        success: true,
        message: `Seeded ${patternsInserted} patterns from ${filename}`,
        patternsInserted,
        implementationsInserted,
        relationshipsInserted,
        filename,
      };
    } catch (error) {
      const filename = path.basename(filePath);
      return {
        success: false,
        message: `Failed to seed from ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error('Unknown error'),
        filename,
      };
    }
  }

  /**
   * Seed a batch of patterns
   */
  private seedBatch(patterns: Pattern[]): BatchResult {
    let patternsInserted = 0;
    let implementationsInserted = 0;
    let relationshipsInserted = 0;

    // Collect all relationships for deferred insertion
    const allRelationships: Array<{ sourceId: string; relationship: string | RawRelationship }> = [];

    // First pass: Insert all patterns and collect relationships
    this.db.transaction(() => {
      for (const pattern of patterns) {
        const patternInserted = this.insertPattern(pattern);
        if (patternInserted) {
          patternsInserted++;

          // Collect relationships for later insertion
          const relatedPatterns = pattern.relatedPatterns ?? pattern.related_patterns;
          if (relatedPatterns) {
            for (const rel of relatedPatterns) {
              allRelationships.push({ sourceId: pattern.id, relationship: rel });
            }
          }
        }
      }
    });

    // Second pass: Insert implementations
    this.db.transaction(() => {
      for (const pattern of patterns) {
        // Insert implementations
        if (pattern.implementations) {
          for (const impl of pattern.implementations) {
            const implInserted = this.insertImplementation(pattern.id, impl);
            if (implInserted) {
              implementationsInserted++;
            }
          }
        }
      }
    });

    // Third pass: Insert relationships (after all patterns exist)
    this.db.transaction(() => {
      for (const { sourceId, relationship } of allRelationships) {
        // Handle both string and object formats for relationships
        if (typeof relationship === 'string') {
          // String format: relationship is the target pattern name
          const relInserted = this.insertRelationship(sourceId, relationship);
          if (relInserted) {
            relationshipsInserted++;
          }
        } else if (relationship && typeof relationship === 'object') {
          // Object format: extract target pattern name
          const targetPatternName =
            relationship.patternId ?? relationship.targetPatternId ?? relationship.name;
          if (targetPatternName) {
            const relInserted = this.insertRelationship(sourceId, targetPatternName);
            if (relInserted) {
              relationshipsInserted++;
            }
          }
        }
      }
    });

    return {
      patternsInserted,
      implementationsInserted,
      relationshipsInserted,
    };
  }

  /**
   * Insert a pattern into the database
   */
  private insertPattern(pattern: Pattern): boolean {
    try {
      if (this.config.skipExisting) {
        const existing = this.db.queryOne<{ id: string }>('SELECT id FROM patterns WHERE id = ?', [pattern.id]);
        if (existing) {
          return false; // Skip existing
        }
      }

      const sql = `
        INSERT OR REPLACE INTO patterns (
          id, name, category, description, when_to_use, benefits,
          drawbacks, use_cases, complexity, tags, examples, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
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
      console.error(`Failed to insert pattern ${pattern.id}:`, error);
      return false;
    }
  }

  /**
   * Insert a pattern implementation
   */
  private insertImplementation(patternId: string, implementation: RawImplementation): boolean {
    try {
      const sql = `
        INSERT OR REPLACE INTO pattern_implementations (
          id, pattern_id, language, approach, code, explanation,
          dependencies, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
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
      console.error(`Failed to insert implementation for pattern ${patternId}:`, error);
      return false;
    }
  }

  /**
   * Insert a pattern relationship
   */
  private insertRelationship(sourcePatternId: string, relationship: string | RawRelationship): boolean {
    try {
      let targetPatternId: string;
      let type: string;
      let strength: number;
      let description: string;

      // Handle different relationship formats
      if (typeof relationship === 'string') {
        // Legacy format: relationship is target pattern name
        targetPatternId = relationship;
        type = 'related';
        strength = 1.0;
        description = `Related to ${relationship}`;
      } else if (relationship && typeof relationship === 'object') {
        // New format: relationship is an object
        targetPatternId =
          relationship.targetPatternId ?? relationship.patternId ?? relationship.name ?? 'unknown';
        type = relationship.type ?? 'related';
        strength = relationship.strength ?? 1.0;
        description = relationship.description ?? `Related to ${targetPatternId}`;
      } else {
        console.warn(`Invalid relationship format for pattern ${sourcePatternId}:`, relationship);
        return false;
      }

      // Find target pattern ID by name if needed
      let actualTargetId: string;
      if (typeof targetPatternId === 'string' && targetPatternId.length > 0) {
        // Check if it's already an ID (assume IDs don't contain spaces and are lowercase)
        const isId = /^[a-z0-9_-]+$/.test(targetPatternId) && !targetPatternId.includes(' ');

        if (!isId) {
          // It's a pattern name, find the ID
          const targetPattern = this.db.queryOne<{ id: string }>(
            'SELECT id FROM patterns WHERE name = ?',
            [targetPatternId]
          );

          if (!targetPattern) {
            console.warn(
              `Target pattern not found: ${targetPatternId} (referenced by ${sourcePatternId})`
            );
            return false;
          }
          actualTargetId = targetPattern.id;
        } else {
          // Assume it's already an ID
          actualTargetId = targetPatternId;
        }
      } else {
        console.warn(`Invalid targetPatternId for pattern ${sourcePatternId}:`, targetPatternId);
        return false;
      }

      // Check if relationship already exists
      const existing = this.db.queryOne<{ id: string }>(
        'SELECT id FROM pattern_relationships WHERE source_pattern_id = ? AND target_pattern_id = ?',
        [sourcePatternId, actualTargetId]
      );

      if (existing) {
        return false; // Skip duplicate
      }

      const sql = `
        INSERT INTO pattern_relationships (
          id, source_pattern_id, target_pattern_id, type,
          strength, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        crypto.randomUUID(),
        sourcePatternId,
        actualTargetId,
        type,
        strength,
        description,
        new Date().toISOString(),
      ];

      this.db.execute(sql, params);
      return true;
    } catch (error) {
      console.error(`Failed to insert relationship for pattern ${sourcePatternId}:`, error);
      return false;
    }
  }

  /**
   * Get all pattern files
   */
  private getPatternFiles(): string[] {
    try {
      const files = fs
        .readdirSync(this.config.patternsPath)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(this.config.patternsPath, file));

      return files;
    } catch (error) {
      console.error('Failed to read pattern files:', error);
      return [];
    }
  }

  /**
   * Load pattern data from file
   */
  private loadPatternFile(filePath: string): unknown {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed: unknown = JSON.parse(content);

      // Basic validation that it's an object
      if (!isObject(parsed)) {
        throw new Error(`Invalid JSON structure in ${filePath}: expected object, got ${typeof parsed}`);
      }

      return parsed;
    } catch (error) {
      console.error(`Failed to load pattern file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Clear all pattern data
   */
  clearAll(): void {
    this.db.transaction(() => {
      this.db.execute('DELETE FROM pattern_relationships');
      this.db.execute('DELETE FROM pattern_implementations');
      this.db.execute('DELETE FROM patterns');
    });

    logger.info('pattern-seeder', 'All pattern data cleared');
  }

  /**
   * Get seeding statistics
   */
  getStats(): SeederStats {
    const patternCount = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM patterns'
    );
    const implementationCount = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM pattern_implementations'
    );
    const relationshipCount = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM pattern_relationships'
    );

    const categoryStats = this.db.query<{ category: string; count: number }>(
      'SELECT category, COUNT(*) as count FROM patterns GROUP BY category ORDER BY count DESC'
    );

    const languageStats = this.db.query<{ language: string; count: number }>(
      'SELECT language, COUNT(*) as count FROM pattern_implementations GROUP BY language ORDER BY count DESC'
    );

    return {
      totalPatterns: patternCount?.count ?? 0,
      totalImplementations: implementationCount?.count ?? 0,
      totalRelationships: relationshipCount?.count ?? 0,
      patternsByCategory: categoryStats,
      implementationsByLanguage: languageStats,
    };
  }

  /**
   * Validate seeded data
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    try {
      // Check for patterns without implementations
      const patternsWithoutImpl = this.db.query<{ id: string; name: string }>(
        `SELECT p.id, p.name FROM patterns p
         LEFT JOIN pattern_implementations pi ON p.id = pi.pattern_id
         WHERE pi.id IS NULL`
      );

      if (patternsWithoutImpl.length > 0) {
        errors.push(`${patternsWithoutImpl.length} patterns have no implementations`);
      }

      // Check for orphaned implementations
      const orphanedImpl = this.db.query<{ id: string; pattern_id: string }>(
        `SELECT pi.id, pi.pattern_id FROM pattern_implementations pi
         LEFT JOIN patterns p ON pi.pattern_id = p.id
         WHERE p.id IS NULL`
      );

      if (orphanedImpl.length > 0) {
        errors.push(`${orphanedImpl.length} implementations reference non-existent patterns`);
      }

      // Check for self-referencing relationships
      const selfRefs = this.db.query<{ id: string }>(
        `SELECT id FROM pattern_relationships
         WHERE source_pattern_id = target_pattern_id`
      );

      if (selfRefs.length > 0) {
        errors.push(`${selfRefs.length} relationships are self-referencing`);
      }

      // Check for invalid relationship types
      const invalidTypes = this.db.query<{ type: string; count: number }>(
        `SELECT type, COUNT(*) as count FROM pattern_relationships
         WHERE type NOT IN ('similar', 'alternative', 'complementary', 'conflicting',
                           'evolves-to', 'specializes', 'generalizes', 'requires',
                           'extends', 'replaces', 'combines-with', 'contrasts-with')
         GROUP BY type`
      );

      if (invalidTypes.length > 0) {
        errors.push(`${invalidTypes.length} relationships have invalid types`);
      }
    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

interface SeederResult {
  success: boolean;
  message: string;
  patternsInserted?: number;
  implementationsInserted?: number;
  relationshipsInserted?: number;
  filename?: string;
  error?: Error;
  fileResults?: SeederResult[];
  totalPatterns?: number;
  totalImplementations?: number;
  totalRelationships?: number;
}

interface BatchResult {
  patternsInserted: number;
  implementationsInserted: number;
  relationshipsInserted: number;
}

interface SeederStats {
  totalPatterns: number;
  totalImplementations: number;
  totalRelationships: number;
  patternsByCategory: Array<{ category: string; count: number }>;
  implementationsByLanguage: Array<{ language: string; count: number }>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Default seeder configuration
const DEFAULT_SEEDER_CONFIG: SeederConfig = {
  patternsPath: './src/data/patterns',
  batchSize: 10,
  skipExisting: true,
};

// Factory function for creating seeder
export function createPatternSeeder(
  db: DatabaseManager,
  config?: Partial<SeederConfig>
): PatternSeeder {
  const finalConfig = { ...DEFAULT_SEEDER_CONFIG, ...config };
  return new PatternSeeder(db, finalConfig);
}
