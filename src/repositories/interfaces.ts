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
