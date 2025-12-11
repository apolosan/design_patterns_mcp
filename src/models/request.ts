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
   userContext?: Record<string, unknown>;
}





