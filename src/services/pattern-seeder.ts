/**
 * Pattern Data Seeder for Design Patterns MCP Server
 * Loads pattern data from JSON files and seeds database
 */
import { Pattern } from '../models/pattern.js';
import { logger } from './logger.js';
import { isObject } from '../utils/type-guards.js';
import { validatePattern } from '../utils/pattern-schema-validation.js';
import { type PatternSeederRepository } from '../repositories/interfaces.js';
import fs from 'fs';
import path from 'path';

interface RawRelationship {
  targetPatternId?: string;
  target_pattern_id?: string;
  patternId?: string;
  name?: string;
  type?: string;
  strength?: number;
  description?: string;
}

interface PatternFileData {
  patterns?: unknown[];
  id?: string;
  [key: string]: unknown;
}

interface SeederConfig {
  patternsPath: string;
  batchSize: number;
  skipExisting: boolean;
}

export class PatternSeeder {
  private patternSeederRepo: PatternSeederRepository;
  private config: SeederConfig;

  constructor(patternSeederRepo: PatternSeederRepository, config: SeederConfig) {
    this.patternSeederRepo = patternSeederRepo;
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
        const loadedData = await this.loadPatternFile(file);

        if (!this.isPatternFileData(loadedData)) {
          logger.warn('pattern-seeder', `Skipping invalid pattern file: ${file}`);
          continue;
        }

        const data = loadedData;
        const patternsList = Array.isArray(data.patterns) ? data.patterns : (data.id ? [data] : []);

        for (const pattern of patternsList) {
          if (!this.isValidPattern(pattern)) {
             logger.warn('pattern-seeder', `Skipping invalid pattern in file ${file}`, { patternData: String(pattern) });
             continue;
           }

           const schemaResult = validatePattern(pattern);
           if (!schemaResult.valid) {
             logger.warn('pattern-seeder', `Schema validation warnings in file ${file}`, {
               errors: schemaResult.errors.map(e => `${e.field}: ${e.message}`),
               warnings: schemaResult.warnings.map(w => `${w.field}: ${w.message}`)
             });
           }

          const typedPattern = pattern;
          allPatterns.push(typedPattern);

          // Collect relationships for later insertion
          const relatedPatterns = typedPattern.relatedPatterns ?? typedPattern.related_patterns;
          const relationships = typedPattern.relationships;

          // Process legacy relatedPatterns format
          if (relatedPatterns) {
            for (const rel of relatedPatterns) {
              const relValue = typeof rel === 'string' ? rel : (rel as Pattern).id || (rel as Pattern).name;
              if (relValue) {
                allRelationships.push({ sourceId: typedPattern.id, relationship: relValue, filename: file });
              }
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
      this.patternSeederRepo.transaction(() => {
        for (const pattern of allPatterns) {
          if (this.patternSeederRepo.patternExists(pattern.id)) continue;
          const patternInserted = this.patternSeederRepo.insertPattern(pattern);
          if (patternInserted) {
            totalPatterns++;
          }
        }
      });

      // Third pass: Insert all implementations
      this.patternSeederRepo.transaction(() => {
        for (const pattern of allPatterns) {
          if (pattern.implementations) {
            for (const impl of pattern.implementations) {
              const implInserted = this.patternSeederRepo.insertImplementation(pattern.id, impl);
              if (implInserted) {
                totalImplementations++;
              }
            }
          }
        }
      });

      // Fourth pass: Insert all relationships (after all patterns exist)
      this.patternSeederRepo.transaction(() => {
        for (const { sourceId, relationship } of allRelationships) {
          const relInserted = this.insertRelationship(sourceId, relationship);
          if (relInserted) {
            totalRelationships++;
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
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Seeding failed: ${errorMsg}`,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Type guard for PatternFileData
   */
  private isPatternFileData(data: unknown): data is PatternFileData {
    if (!isObject(data)) return false;

    // Check if it has patterns array OR an id (single pattern)
    if ('patterns' in data && Array.isArray(data.patterns)) {
      return true;
    }

    if ('id' in data && typeof data.id === 'string') {
      return true;
    }

    return false;
  }

  /**
   * Type guard for Pattern
   */
  private isValidPattern(data: unknown): data is Pattern {
    if (!isObject(data)) return false;

    // Check required fields based on Pattern interface
    const requiredFields = ['id', 'name', 'category', 'description'];
    for (const field of requiredFields) {
      if (!(field in data) || typeof (data as Record<string, unknown>)[field] !== 'string') {
        return false;
      }
    }

    return true;
  }

  /**
   * Seed patterns from a specific file
   */
  async seedFromFile(filePath: string): Promise<SeederResult> {
    try {
      const loadedData = await this.loadPatternFile(filePath);

      if (!this.isPatternFileData(loadedData)) {
        throw new Error('Invalid pattern file structure');
      }

      const data = loadedData;
      const patternsList = Array.isArray(data.patterns) ? data.patterns : (data.id ? [data] : []);

      // Filter valid patterns
      const patterns: Pattern[] = [];
      for (const p of patternsList) {
        if (this.isValidPattern(p)) {
          patterns.push(p);
        } else {
          logger.warn('pattern-seeder', `Skipping invalid pattern in file ${filePath}`, { patternData: String(p) });
        }
      }

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
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Failed to seed from ${filename}: ${errorMsg}`,
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
    this.patternSeederRepo.transaction(() => {
      for (const pattern of patterns) {
        if (this.patternSeederRepo.patternExists(pattern.id)) continue;
        const wasInserted = this.patternSeederRepo.insertPattern(pattern);
        if (wasInserted) {
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
    this.patternSeederRepo.transaction(() => {
      for (const pattern of patterns) {
        if (pattern.implementations) {
          for (const impl of pattern.implementations) {
            const wasInserted = this.patternSeederRepo.insertImplementation(pattern.id, impl);
            if (wasInserted) {
              implementationsInserted++;
            }
          }
        }
      }
    });

    // Third pass: Insert relationships (after all patterns exist)
    this.patternSeederRepo.transaction(() => {
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
   * Insert a pattern relationship - delegated to repository
   */
  private insertRelationship(sourcePatternId: string, relationship: string | RawRelationship): boolean {
    let targetPatternId: string;
    let type: string;
    let strength: number;
    let description: string;

    if (typeof relationship === 'string') {
      targetPatternId = relationship;
      type = 'related';
      strength = 1.0;
      description = `Related to ${relationship}`;
    } else if (relationship && typeof relationship === 'object') {
      targetPatternId =
        relationship.targetPatternId ?? relationship.target_pattern_id ?? relationship.patternId ?? relationship.name ?? 'unknown';
      type = relationship.type ?? 'related';
      strength = relationship.strength ?? 1.0;
      description = relationship.description ?? `Related to ${targetPatternId}`;
    } else {
      logger.warn('pattern-seeder', `Invalid relationship format for pattern ${sourcePatternId}`, { relationship });
      return false;
    }

    // Find target pattern ID by name if needed
    let actualTargetId: string;
    if (typeof targetPatternId === 'string' && targetPatternId.length > 0) {
      const isId = /^[a-z0-9_-]+$/.test(targetPatternId) && !targetPatternId.includes(' ');

      if (!isId) {
        const foundId = this.patternSeederRepo.findPatternIdByName(targetPatternId);
        if (!foundId) {
          logger.warn('pattern-seeder', `Target pattern not found: ${targetPatternId}`, { sourcePatternId });
          return false;
        }
        actualTargetId = foundId;
      } else {
        actualTargetId = targetPatternId;
        if (!this.patternSeederRepo.patternExists(actualTargetId)) {
          logger.warn('pattern-seeder', `Target pattern ID not found: ${actualTargetId}`, { sourcePatternId });
          return false;
        }
      }
    } else {
      logger.warn('pattern-seeder', `Invalid targetPatternId for pattern ${sourcePatternId}`, { targetPatternId });
      return false;
    }

    // Check if relationship already exists
    if (this.patternSeederRepo.relationshipExists(sourcePatternId, actualTargetId)) {
      return false;
    }

    return this.patternSeederRepo.insertRelationship(sourcePatternId, actualTargetId, {
      type,
      strength,
      description,
    });
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err : new Error(String(err));
      logger.error('pattern-seeder', 'Failed to read pattern files', errorMsg);
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('pattern-seeder', `Failed to load pattern file ${filePath}`, undefined, errorMsg as any);
      throw error;
    }
  }

  /**
   * Clear all pattern data
   * Note: This is a placeholder - actual clearing would need to be added to PatternSeederRepository interface
   */
  clearAll(): void {
    logger.warn('pattern-seeder', 'clearAll not yet implemented via repository - would need to add clear methods to PatternSeederRepository interface');
    logger.info('pattern-seeder', 'All pattern data cleared');
  }

  /**
   * Get seeding statistics
   * Note: This is a placeholder - stats queries would need to be added to PatternSeederRepository interface
   */
  getStats(): SeederStats {
    logger.warn('pattern-seeder', 'getStats still uses placeholder - consider adding to PatternSeederRepository interface');
    return {
      totalPatterns: 0,
      totalImplementations: 0,
      totalRelationships: 0,
      patternsByCategory: [],
      implementationsByLanguage: [],
    };
  }

  /**
   * Validate seeded data
   * Note: This is a placeholder - validation would need to be added to PatternSeederRepository interface
   */
  validate(): ValidationResult {
    logger.warn('pattern-seeder', 'validate still uses placeholder - consider adding to PatternSeederRepository interface');
    return {
      valid: true,
      errors: [],
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
  patternSeederRepo: PatternSeederRepository,
  config?: Partial<SeederConfig>
): PatternSeeder {
  const finalConfig = { ...DEFAULT_SEEDER_CONFIG, ...config };
  return new PatternSeeder(patternSeederRepo, finalConfig);
}
