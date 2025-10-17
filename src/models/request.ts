/**
 * PatternRequest Model Interface
 * Represents a user's request for pattern recommendations
 */

type ComplexityPreference = 'Simple' | 'Any' | 'Advanced';

export interface PatternRequest {
  /** Unique request identifier */
  id: string;

  /** Natural language problem description */
  query: string;

  /** Relevant source code for analysis */
  codeContext?: string;

  /** Target programming language preference */
  programmingLanguage?: string;

  /** Complexity preference filter */
  complexityPreference?: ComplexityPreference;

  /** Restrict to specific categories */
  categoryFilter?: string[];

  /** Maximum recommendations to return */
  maxResults: number;

  /** Include code examples in response */
  includeExamples: boolean;

  /** Request creation time */
  timestamp: Date;

  /** Response time in milliseconds */
  processingTime?: number;

  /** Additional context metadata */
  userContext?: Record<string, any>;
}

/**
 * Request creation input
 */
interface CreatePatternRequestInput {
  query: string;
  codeContext?: string;
  programmingLanguage?: string;
  complexityPreference?: ComplexityPreference;
  categoryFilter?: string[];
  maxResults?: number;
  includeExamples?: boolean;
  userContext?: Record<string, any>;
}

/**
 * Request processing context
 */
interface RequestProcessingContext {
  request: PatternRequest;
  startTime: Date;
  searchTerms: string[];
  extractedKeywords: string[];
  codeAnalysis?: CodeAnalysisResult;
}

/**
 * Code analysis result from code context
 */
interface CodeAnalysisResult {
  detectedLanguage: string;
  identifiedPatterns: string[];
  complexity: 'Low' | 'Medium' | 'High';
  suggestions: string[];
  confidence: number;
}

/**
 * Request validation result
 */
interface RequestValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Request processing statistics
 */
interface RequestStats {
  totalRequests: number;
  averageProcessingTime: number;
  popularQueries: Array<{
    query: string;
    count: number;
  }>;
  categoryDistribution: Record<string, number>;
}