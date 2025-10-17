/**
 * Repository Interfaces
 * Defines contracts for data access layer
 */

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
  pattern: any;
  score: number;
  highlights?: string[];
}

export interface PatternRepository {
  findById(id: string): Promise<any>;
  findByCategory(category: string): Promise<any[]>;
  search(filters: SearchFilters): Promise<SearchResult[]>;
  findAll(): Promise<any[]>;
  count(): Promise<number>;
  countByCategory(): Promise<Record<string, number>>;
  create(pattern: any): Promise<any>;
  update(id: string, pattern: any): Promise<any>;
  delete(id: string): Promise<void>;
  findByIds(ids: string[]): Promise<any[]>;
  findByTags(tags: string[]): Promise<any[]>;
  exists(id: string): Promise<boolean>;
  save(pattern: any): Promise<any>;
}

export interface PatternSearchResult {
  pattern: any;
  score: number;
  highlights?: string[];
}

interface CategoryRepository {
  findAll(): Promise<any[]>;
  findById(id: string): Promise<any>;
  create(category: any): Promise<any>;
  update(id: string, category: any): Promise<any>;
  delete(id: string): Promise<void>;
}

interface ImplementationRepository {
  findByPatternId(patternId: string): Promise<any[]>;
  findById(id: string): Promise<any>;
  create(implementation: any): Promise<any>;
  update(id: string, implementation: any): Promise<any>;
  delete(id: string): Promise<void>;
}

interface VectorRepository {
  findSimilar(embedding: number[], limit: number): Promise<any[]>;
  storeEmbedding(patternId: string, embedding: number[]): Promise<void>;
  deleteEmbedding(patternId: string): Promise<void>;
}

export interface RelationshipRepository {
  findByPatternId(patternId: string): Promise<any[]>;
  findById(id: string): Promise<any>;
  create(relationship: any): Promise<any>;
  update(id: string, relationship: any): Promise<any>;
  delete(id: string): Promise<void>;
  findAll(): Promise<any[]>;
}
