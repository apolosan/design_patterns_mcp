/**
 * Repository Interfaces
 * Defines contracts for data access layer
 */

import { Pattern } from '../models/pattern.js';
import { Relationship, CreateRelationshipInput, UpdateRelationshipInput } from '../models/relationship.js';

export interface SearchFilters {
  query?: string;
  category?: string;
  categories?: string[];
  programmingLanguage?: string;
  complexity?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  pattern: Pattern;
  score: number;
  highlights?: string[];
}

export interface PatternRepository {
  findById(id: string): Promise<Pattern | null>;
  findByCategory(category: string): Promise<Pattern[]>;
  search(filters: SearchFilters): Promise<SearchResult[]>;
  findAll(): Promise<Pattern[]>;
  count(): Promise<number>;
  countByCategory(): Promise<Record<string, number>>;
  create(pattern: Pattern): Promise<Pattern>;
  update(id: string, pattern: Partial<Pattern>): Promise<Pattern>;
  delete(id: string): Promise<void>;
  findByIds(ids: string[]): Promise<Pattern[]>;
  findByTags(tags: string[]): Promise<Pattern[]>;
  exists(id: string): Promise<boolean>;
  save(pattern: Pattern): Promise<Pattern>;
  findAllSummaries(): Promise<Array<{id: string; name: string; category: string; description: string; complexity: string; tags: string}>>;
  findRelatedPatterns(sourcePatternId: string, types?: string[]): Promise<Array<{target_pattern_id: string; type: string; description: string}>>;
  findImplementations(patternId: string, language?: string): Promise<Array<{id: string; language: string; code: string; explanation: string}>>;
}

export interface PatternSearchResult {
  pattern: Pattern;
  score: number;
  highlights?: string[];
}







export interface RelationshipRepository {
  findByPatternId(patternId: string): Promise<Relationship[]>;
  findById(id: string): Promise<Relationship | null>;
  create(relationship: CreateRelationshipInput): Promise<Relationship>;
  update(id: string, relationship: UpdateRelationshipInput): Promise<Relationship | null>;
  delete(id: string): Promise<void>;
  findAll(): Promise<Relationship[]>;
}

export interface VectorRepository {
  store(patternId: string, embedding: number[], model: string, dimensions: number): Promise<void>;
  retrieve(patternId: string): Promise<number[] | null>;
  delete(patternId: string): Promise<void>;
  exists(patternId: string): Promise<boolean>;
  getAllVectors(): Promise<Array<{ patternId: string; embedding: number[]; model: string }>>;
  getStats(): Promise<{ totalVectors: number; embeddingModel: string; dimensions: number }>;
}

export interface PatternSeederRepository {
  insertPattern(pattern: Pattern): boolean;
  insertImplementation(patternId: string, implementation: { language?: string; approach?: string; code?: string; explanation?: string; dependencies?: string[] }): boolean;
  insertRelationship(sourcePatternId: string, targetPatternId: string, relationship: { type?: string; strength?: number; description?: string }): boolean;
  patternExists(id: string): boolean;
  findPatternIdByName(name: string): string | null;
  relationshipExists(sourcePatternId: string, targetPatternId: string): boolean;
  transaction(callback: () => void): void;
}
