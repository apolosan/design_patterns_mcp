/**
 * Relationship Model Interface
 * Represents relationships between design patterns
 */

/** Canonical relationship vocabulary (single source of truth for type and validation). */
export const RELATIONSHIP_TYPES = [
  'related',
  'extends',
  'implements',
  'uses',
  'similar',
  'alternative',
  'complements',
  'conflicts',
  'prerequisite',
  'successor',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export interface Relationship {
  /** Unique relationship identifier */
  id: string;

  /** Source pattern ID */
  sourcePatternId: string;

  /** Target pattern ID */
  targetPatternId: string;

  /** Type of relationship */
  type: RelationshipType;

  /** Strength of relationship (0.0 to 1.0) */
  strength: number;

  /** Human-readable description */
  description: string;

  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Relationship creation input
 */
export interface CreateRelationshipInput {
  sourcePatternId: string;
  targetPatternId: string;
  type: RelationshipType;
  strength?: number;
  description: string;
}

/**
 * Relationship update input
 */
export interface UpdateRelationshipInput extends Partial<CreateRelationshipInput> {
  id: string;
}

/**
 * Relationship filters for queries
 */
export interface RelationshipFilters {
  sourcePatternId?: string;
  targetPatternId?: string;
  type?: RelationshipType;
  minStrength?: number;
}

/**
 * Relationship with pattern details
 */
export interface RelationshipWithPatterns extends Relationship {
  sourcePattern: {
    id: string;
    name: string;
    category: string;
  };
  targetPattern: {
    id: string;
    name: string;
    category: string;
  };
}
