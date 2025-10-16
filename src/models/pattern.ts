/**
 * Pattern Model Interface
 * Represents a design pattern from the comprehensive 200+ pattern catalog
 */

export type PatternComplexity = 'Low' | 'Medium' | 'High';

export type PatternCategory =
  | 'Creational'
  | 'Structural'
  | 'Behavioral'
  | 'Architectural'
  | 'Cloud-Native'
  | 'Microservices'
  | 'AI-ML'
  | 'Functional'
  | 'Reactive'
  | 'Anti-Pattern';

export interface PatternImplementation {
  language: string;
  code: string;
  explanation: string;
}

export interface PatternCodeExample {
  language: string;
  description?: string;
  code: string;
}

export interface PatternExamples {
  [language: string]: PatternCodeExample;
}

export interface PatternRelationship {
  type: string;
  patternId: string;
  description: string;
}

export interface Pattern {
  /** Unique pattern identifier */
  id: string;

  /** Pattern name (e.g., "Factory Method", "Observer", "Reflection Pattern") */
  name: string;

  /** Main category */
  category: string;

  /** Comprehensive pattern description */
  description: string;

  /** The problem this pattern addresses */
  problem: string;

  /** The solution this pattern provides */
  solution: string;

  /** Specific conditions for using this pattern */
  when_to_use: string[];

  /** Benefits of using this pattern */
  benefits: string[];

  /** Drawbacks and trade-offs */
  drawbacks: string[];

  /** Common scenarios where pattern applies */
  use_cases: string[];

  /** Alias for use_cases for backwards compatibility */
  useCases?: string[];

  /** Language-specific implementations */
  implementations: PatternImplementation[];

  /** Related patterns and relationships */
  relatedPatterns?: PatternRelationship[];

  /** Raw related patterns from JSON (string array or object array) */
  related_patterns?: string[] | PatternRelationship[];

  /** Implementation complexity level */
  complexity: string;

  /** Usage frequency score (0.0-1.0) */
  popularity?: number;

  /** Associated tags for categorization */
  tags?: string[];

  /** Pattern structure description */
  structure?: string;

  /** Pattern participants */
  participants?: string;

  /** Pattern collaborations */
  collaborations?: string;

  /** Pattern consequences */
  consequences?: string;

  /** Implementation details (legacy, use implementations array) */
  implementation?: string;

  /** Code examples (optional, indexed by language) */
  examples?: PatternExamples;

  /** Alternative names for this pattern */
  alsoKnownAs?: string[];

  /** Additional metadata */
  metadata?: Record<string, any>;

  /** Creation timestamp */
  createdAt: Date;

  /** Last modification timestamp */
  updatedAt: Date;
}

/**
 * Pattern creation input (without auto-generated fields)
 */
export interface CreatePatternInput {
  id: string;
  name: string;
  category: PatternCategory;
  description: string;
  problem: string;
  solution: string;
  when_to_use: string[];
  benefits: string[];
  drawbacks: string[];
  use_cases: string[];
  implementations: PatternImplementation[];
  relatedPatterns?: PatternRelationship[];
  tags?: string[];
}

/**
 * Pattern update input (all fields optional except id)
 */
export interface UpdatePatternInput extends Partial<CreatePatternInput> {
  id: string;
}

/**
 * Pattern search filters
 */
export interface PatternFilters {
  category?: PatternCategory;
  tags?: string[];
  hasImplementations?: boolean;
}

/**
 * Pattern search result with metadata
 */
export interface PatternSearchResult {
  pattern: Pattern;
  score?: number;
  rank?: number;
  matchedFields?: string[];
}
