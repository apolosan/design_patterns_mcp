/**
 * Repository Interfaces
 * Defines contracts for data access layer following Repository Pattern
 */

import type { Pattern } from '../models/pattern.js';
import type { PatternCategory } from '../models/pattern-category.js';
import type { Implementation } from '../models/implementation.js';
import type {
  Relationship,
  CreateRelationshipInput,
  UpdateRelationshipInput,
  RelationshipFilters,
  RelationshipWithPatterns,
} from '../models/relationship.js';

export interface SearchFilters {
  category?: string;
  tags?: string[];
  complexity?: string;
  language?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  pattern: Pattern;
  score: number;
  highlights?: string[];
}

export interface PatternRepository {
  // Basic CRUD operations
  findById(id: string): Promise<Pattern | null>;
  findByName(name: string): Promise<Pattern | null>;
  findAll(filters?: SearchFilters): Promise<Pattern[]>;
  save(pattern: Pattern): Promise<Pattern>;
  update(id: string, pattern: Partial<Pattern>): Promise<Pattern | null>;
  delete(id: string): Promise<boolean>;

  // Search operations
  findByCategory(category: string, limit?: number): Promise<Pattern[]>;
  findByTags(tags: string[], matchAll?: boolean): Promise<Pattern[]>;
  search(query: string, filters?: SearchFilters): Promise<SearchResult[]>;

  // Bulk operations
  findByIds(ids: string[]): Promise<Pattern[]>;
  saveMany(patterns: Pattern[]): Promise<Pattern[]>;
  count(filters?: SearchFilters): Promise<number>;
  exists(id: string): Promise<boolean>;
}

export interface CategoryRepository {
  findAll(): Promise<PatternCategory[]>;
  findById(id: string): Promise<PatternCategory | null>;
  findByName(name: string): Promise<PatternCategory | null>;
  save(category: PatternCategory): Promise<PatternCategory>;
  update(id: string, category: Partial<PatternCategory>): Promise<PatternCategory | null>;
  delete(id: string): Promise<boolean>;
  getPatternCount(categoryId: string): Promise<number>;
}

export interface ImplementationRepository {
  findByPatternId(patternId: string): Promise<Implementation[]>;
  findByLanguage(language: string): Promise<Implementation[]>;
  findById(id: string): Promise<Implementation | null>;
  save(implementation: Implementation): Promise<Implementation>;
  update(id: string, implementation: Partial<Implementation>): Promise<Implementation | null>;
  delete(id: string): Promise<boolean>;
  deleteByPatternId(patternId: string): Promise<number>;
}

export interface RelationshipRepository {
  findBySourceId(sourceId: string): Promise<Relationship[]>;
  findByTargetId(targetId: string): Promise<Relationship[]>;
  findByType(type: string): Promise<Relationship[]>;
  findByPatternId(patternId: string): Promise<Relationship[]>;
  findWithPatterns(filters?: RelationshipFilters): Promise<RelationshipWithPatterns[]>;
  findById(id: string): Promise<Relationship | null>;
  save(input: CreateRelationshipInput): Promise<Relationship>;
  update(id: string, input: UpdateRelationshipInput): Promise<Relationship | null>;
  delete(sourceId: string, targetId: string): Promise<boolean>;
  deleteById(id: string): Promise<boolean>;
  exists(sourceId: string, targetId: string): Promise<boolean>;
  count(filters?: RelationshipFilters): Promise<number>;
}

export interface VectorRepository {
  saveEmbedding(id: string, embedding: Float32Array): Promise<void>;
  findSimilar(
    embedding: Float32Array,
    limit: number,
    threshold?: number
  ): Promise<Array<{ id: string; score: number }>>;
  deleteEmbedding(id: string): Promise<boolean>;
  hasEmbedding(id: string): Promise<boolean>;
  rebuildIndex(): Promise<void>;
}
