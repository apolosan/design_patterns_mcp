/**
 * Search Types - Shared types for search handlers
 * Extracted to support the refactored search architecture
 */

/**
 * Pattern summary for search results
 */
export interface PatternSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  complexity?: string;
  tags?: string[];
}

/**
 * Pattern request from user
 */
export interface PatternRequest {
  id: string;
  query: string;
  categories?: string[];
  maxResults?: number;
  programmingLanguage?: string;
}

/**
 * Match result from search operations
 */
export interface MatchResult {
  pattern: PatternSummary;
  confidence: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
  reasons: string[];
  metadata: {
    semanticScore?: number;
    keywordScore?: number;
    finalScore: number;
  };
}

/**
 * Query analysis result from Dynamic Alpha Tuner
 */
export interface QueryAnalysis {
  queryLength: number;
  wordCount: number;
  technicalTermCount: number;
  exploratoryScore: number;
  specificityScore: number;
  hasCodeSnippet: boolean;
  entropy: number;
}

/**
 * Dynamic alpha tuning result
 */
export interface DynamicAlphaResult {
  semanticAlpha: number;
  keywordAlpha: number;
  queryType: 'exploratory' | 'specific' | 'balanced';
  confidence: number;
  analysis: QueryAnalysis;
}

/**
 * Detailed pattern information
 */
export interface DetailedPattern {
  id: string;
  name: string;
  category: string;
  description: string;
  when_to_use: string[];
  benefits: string[];
  drawbacks: string[];
  use_cases: string[];
  complexity: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Pattern implementation
 */
export interface PatternImplementation {
  id: string;
  language: string;
  code: string;
  explanation: string;
}

/**
 * Search handler interface - implemented by all search handlers
 */
export interface SearchHandler {
  search(request: PatternRequest): Promise<MatchResult[]>;
}

/**
 * Search handler configuration
 */
export interface SearchHandlerConfig {
  maxResults: number;
  minConfidence: number;
}

/**
 * Semantic search handler configuration
 */
export interface SemanticSearchHandlerConfig extends SearchHandlerConfig {
  similarityThreshold: number;
}

/**
 * Keyword search handler configuration
 */
export interface KeywordSearchHandlerConfig extends SearchHandlerConfig {
  broadSearchThreshold: number;
}

/**
 * Hybrid search combiner configuration
 */
export interface HybridCombinerConfig {
  defaultSemanticWeight: number;
  defaultKeywordWeight: number;
}

/**
 * Recommendation builder configuration
 */
export interface RecommendationBuilderConfig {
  maxAlternatives: number;
  maxImplementationExamples: number;
}
