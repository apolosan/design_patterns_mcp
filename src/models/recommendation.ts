/**
 * PatternRecommendation Model Interface
 * Represents a recommended pattern in response to a user request
 */

/**
 * Implementation guidance for the recommended pattern
 */
interface ImplementationGuidance {
  language: string;
  codeSnippet: string;
  explanation: string;
  considerations: string[];
}

/**
 * Alternative pattern suggestion
 */
interface AlternativePattern {
  id: string;
  name: string;
  category: string;
  reason: string;
  score: number;
}

/**
 * Context information for the recommendation
 */
interface RecommendationContext {
  projectContext: string;
  teamContext: string;
  technologyFit: {
    fitScore: number;
    reasons: string[];
    compatibleTech?: string[];
    incompatibleTech?: string[];
    integrationRequirements?: string[];
  };
}

export interface PatternRecommendation {
  /** Unique recommendation ID */
  id: string;

  /** Links to originating request */
  requestId: string;

  /** Pattern details */
  pattern: {
    id: string;
    name: string;
    category: string;
    description: string;
    complexity: string;
    tags?: string[];
  };

  /** Relevance score (0.0-1.0) */
  score?: number;

  /** Position in result ranking */
  rank: number;

  /** Explanation of why pattern was recommended */
  justification: {
    primaryReason: string;
    supportingReasons: string[];
    problemFit: string;
    benefits: string[];
    drawbacks: string[];
  };

  /** Algorithm confidence in recommendation */
  confidence: number;

  /** Implementation guidance */
  implementation: ImplementationGuidance;

  /** Alternative patterns */
  alternatives: AlternativePattern[];

  /** Context information */
  context: RecommendationContext;

  /** Semantic similarity component */
  semanticScore?: number;

  /** Keyword matching component */
  keywordScore?: number;

  /** Code context relevance (if applicable) */
  contextMatch?: number;

  /** Whether LLM provided enhancement */
  llmEnhanced?: boolean;

  /** Additional LLM-generated insights */
  llmExplanation?: string;

  /** Timestamp when recommendation was generated */
  createdAt?: Date;
}

/**
 * Recommendation creation input
 */
interface CreatePatternRecommendationInput {
  requestId: string;
  patternId: string;
  score: number;
  rank: number;
  justification: string;
  confidence: number;
  semanticScore?: number;
  keywordScore?: number;
  contextMatch?: number;
  llmEnhanced?: boolean;
  llmExplanation?: string;
}

/**
 * Recommendation with full pattern data
 */
interface PatternRecommendationWithPattern extends PatternRecommendation {
  pattern: {
    id: string;
    name: string;
    category: string;
    description: string;
    complexity: string;
    tags?: string[];
  };
}

/**
 * Recommendation scoring components
 */
interface RecommendationScore {
  semantic: number;
  keyword: number;
  context?: number;
  final: number;
  confidence: number;
}

/**
 * Recommendation ranking result
 */
interface RecommendationRanking {
  recommendations: PatternRecommendation[];
  totalFound: number;
  processingTime: number;
  searchStrategy: 'semantic' | 'keyword' | 'hybrid';
}

/**
 * Recommendation validation result
 */
interface RecommendationValidation {
  isValid: boolean;
  scoreRange: { min: number; max: number };
  confidenceThreshold: number;
  issues: string[];
}

/**
 * Batch recommendation result
 */
interface BatchRecommendationResult {
  requestId: string;
  recommendations: PatternRecommendation[];
  metadata: {
    totalPatterns: number;
    searchTime: number;
    rankingStrategy: string;
    filtersApplied: string[];
  };
}