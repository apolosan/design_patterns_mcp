/**
 * PatternRecommendation Model Interface
 * Represents a recommended pattern in response to a user request
 */

/**
 * Implementation guidance for the recommended pattern
 */
export interface ImplementationGuidance {
  steps: string[];
  examples: ImplementationExample[];
  dependencies: string[];
  configuration: string[];
  testing: {
    unitTests: string[];
    integrationTests: string[];
    testScenarios: string[];
  };
  performance: {
    impact: string;
    memoryUsage: string;
    cpuUsage: string;
    optimizations: string[];
    monitoring: string[];
  };
}

/**
 * Example implementation for a pattern
 */
export interface ImplementationExample {
  language: string;
  title: string;
  code: string;
  explanation: string;
}

/**
 * Alternative pattern suggestion
 */
export interface AlternativePattern {
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

