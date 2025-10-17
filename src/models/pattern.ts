/**
 * Pattern Model Definitions
 * Core domain models for design patterns
 */

type PatternComplexity = 'low' | 'medium' | 'high';

export type PatternCategory =
  | 'creational'
  | 'structural'
  | 'behavioral'
  | 'architectural'
  | 'concurrency'
  | 'enterprise'
  | 'cloud'
  | 'ai'
  | 'blockchain'
  | 'reactive'
  | 'kotlin'
  | 'other';

interface PatternImplementation {
  id: string;
  patternId: string;
  language: string;
  code: string;
  description: string;
  complexity: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PatternCodeExample {
  language: string;
  code: string;
  description?: string;
}

interface PatternExamples {
  before?: PatternCodeExample;
  after?: PatternCodeExample;
  complete?: PatternCodeExample[];
}

interface PatternRelationship {
  id: string;
  fromPatternId: string;
  toPatternId: string;
  relationshipType: string;
  strength: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Pattern {
  id: string;
  name: string;
  category: string;
  description: string;
  problem: string;
  solution: string;
  when_to_use: string[];
  benefits: string[];
  drawbacks: string[];
  use_cases: string[];
  implementations: PatternImplementation[];
  complexity: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  relationships?: PatternRelationship[];
  examples?: string | PatternExamples;
  popularity?: number;
  relatedPatterns?: Pattern[];
  related_patterns?: any[];
  structure?: string;
  participants?: string[];
  collaborations?: string[];
  consequences?: string[];
  implementation?: string;
  useCases?: string[];
  alsoKnownAs?: string[];
  metadata?: Record<string, any>;
}

interface CreatePatternInput {
  name: string;
  category: string;
  description: string;
  problem: string;
  solution: string;
  when_to_use?: string[];
  benefits?: string[];
  drawbacks?: string[];
  use_cases?: string[];
  complexity?: PatternComplexity;
  tags?: string[];
}

interface UpdatePatternInput {
  name?: string;
  category?: string;
  description?: string;
  problem?: string;
  solution?: string;
  when_to_use?: string[];
  benefits?: string[];
  drawbacks?: string[];
  use_cases?: string[];
  complexity?: PatternComplexity;
  tags?: string[];
}

interface PatternFilters {
  category?: string;
  complexity?: PatternComplexity;
  tags?: string[];
  programmingLanguage?: string;
}

interface PatternSearchResult {
  pattern: Pattern;
  score: number;
  highlights?: string[];
}
