/**
 * Pattern Model Definitions
 * Core domain models for design patterns
 */

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
  description?: string;
  explanation: string;
  approach?: string;
  dependencies?: string[];
  complexity?: string;
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
   related_patterns?: string[];
   structure?: string;
   participants?: string[];
   collaborations?: string[];
   consequences?: string[];
   implementation?: string;
   useCases?: string[];
   alsoKnownAs?: string[];
   metadata?: Record<string, unknown>;
}


