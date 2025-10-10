/**
 * Pattern Data Seeder for Design Patterns MCP Server
 * Loads pattern data from JSON files and seeds the database
 */
import { DatabaseManager } from './database-manager.js';
import { Pattern } from '../models/pattern.js';
import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';

export interface SeederConfig {
  patternsPath: string;
  batchSize: number;
  skipExisting: boolean;
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
      const patternFiles = await this.getPatternFiles();

      // First pass: Load all patterns and collect relationships
      const allPatterns: Pattern[] = [];
      const allRelationships: Array<{ sourceId: string; relationship: any; filename: string }> = [];

      for (const file of patternFiles) {
        const data = await this.loadPatternFile(file);
        const patterns = data.patterns || (data.id ? [data] : []);

        for (const pattern of patterns) {
          allPatterns.push(pattern);

          // Collect relationships for later insertion
          if (pattern.relatedPatterns) {
            for (const rel of pattern.relatedPatterns) {
              allRelationships.push({ sourceId: pattern.id, relationship: rel, filename: file });
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
          // Check if target pattern exists before inserting relationship
          const targetPatternId = relationship.patternId || relationship.targetPatternId;
          const targetExists = this.db.queryOne('SELECT id FROM patterns WHERE id = ?', [
            targetPatternId,
          ]);

          if (targetExists) {
            const relInserted = this.insertRelationship(sourceId, relationship);
            if (relInserted) {
              totalRelationships++;
            }
          } else {
            console.warn(
              `Skipping relationship from ${sourceId} to ${targetPatternId} - target pattern does not exist`
            );
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
      const data = await this.loadPatternFile(filePath);
      const patterns = data.patterns || [];

      let patternsInserted = 0;
      let implementationsInserted = 0;
      let relationshipsInserted = 0;

      // Process patterns in batches
      for (let i = 0; i < patterns.length; i += this.config.batchSize) {
        const batch = patterns.slice(i, i + this.config.batchSize);
        const batchResult = await this.seedBatch(batch);

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
  private async seedBatch(patterns: Pattern[]): Promise<BatchResult> {
    let patternsInserted = 0;
    let implementationsInserted = 0;
    let relationshipsInserted = 0;

    // Collect all relationships for deferred insertion
    const allRelationships: Array<{ sourceId: string; relationship: any }> = [];

    // First pass: Insert all patterns and collect relationships
    this.db.transaction(() => {
      for (const pattern of patterns) {
        const patternInserted = this.insertPattern(pattern);
        if (patternInserted) {
          patternsInserted++;

          // Collect relationships for later insertion
          if (pattern.relatedPatterns) {
            for (const rel of pattern.relatedPatterns) {
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
        const relInserted = this.insertRelationship(sourceId, relationship);
        if (relInserted) {
          relationshipsInserted++;
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
        const existing = this.db.queryOne('SELECT id FROM patterns WHERE id = ?', [pattern.id]);
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
  private insertImplementation(patternId: string, implementation: any): boolean {
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
        implementation.language || 'unknown',
        implementation.approach || 'default',
        implementation.code || '',
        implementation.explanation || '',
        JSON.stringify(implementation.dependencies || []),
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
  private insertRelationship(sourcePatternId: string, relationship: any): boolean {
    try {
      const sql = `
        INSERT OR REPLACE INTO pattern_relationships (
          id, source_pattern_id, target_pattern_id, type,
          strength, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        crypto.randomUUID(),
        sourcePatternId,
        relationship.patternId || relationship.targetPatternId || '',
        relationship.type || 'related',
        relationship.strength || 1.0,
        relationship.description || '',
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
  private async getPatternFiles(): Promise<string[]> {
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
  private async loadPatternFile(filePath: string): Promise<any> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load pattern file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Clear all pattern data
   */
  async clearAll(): Promise<void> {
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
  async getStats(): Promise<SeederStats> {
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
      totalPatterns: patternCount?.count || 0,
      totalImplementations: implementationCount?.count || 0,
      totalRelationships: relationshipCount?.count || 0,
      patternsByCategory: categoryStats,
      implementationsByLanguage: languageStats,
    };
  }

  /**
   * Validate seeded data
   */
  async validate(): Promise<ValidationResult> {
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

export interface SeederResult {
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

export interface BatchResult {
  patternsInserted: number;
  implementationsInserted: number;
  relationshipsInserted: number;
}

export interface SeederStats {
  totalPatterns: number;
  totalImplementations: number;
  totalRelationships: number;
  patternsByCategory: Array<{ category: string; count: number }>;
  implementationsByLanguage: Array<{ language: string; count: number }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Default seeder configuration
export const DEFAULT_SEEDER_CONFIG: SeederConfig = {
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
