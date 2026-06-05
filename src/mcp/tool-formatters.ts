/**
 * MCP tool response formatters (Facade for text output).
 */

import { coerceToStringArray } from '../utils/parse-tags.js';
import type { PatternRecommendation } from '../models/recommendation.js';
import type { PatternRequest } from '../types/search-types.js';
import type { SearchPatternResult } from './types.js';

export function buildPatternRequest(
  query: string,
  options?: {
    categories?: string[];
    maxResults?: number;
    programmingLanguage?: string;
  }
): PatternRequest {
  return {
    id: crypto.randomUUID(),
    query,
    categories: options?.categories,
    maxResults: options?.maxResults,
    programmingLanguage: options?.programmingLanguage,
  };
}

export function formatFindPatternsResult(recommendations: PatternRecommendation[]): string {
  return (
    `Found ${recommendations.length} pattern recommendations:\n\n` +
    recommendations
      .map(
        (rec, index) =>
          `${index + 1}. **${rec.pattern.name}** (${rec.pattern.category})\n` +
          `   ID: ${rec.pattern.id}\n` +
          `   Confidence: ${(rec.confidence * 100).toFixed(1)}%\n` +
          `   Rationale: ${rec.justification.primaryReason}\n` +
          `   Benefits: ${coerceToStringArray(rec.justification.benefits, 'benefits').join(', ') || 'N/A'}\n`
      )
      .join('\n')
  );
}

export function formatSearchResults(
  query: string,
  searchTypeUsed: string,
  degraded: boolean,
  results: SearchPatternResult[]
): string {
  const degradedNotice = degraded
    ? '\nSemantic search unavailable; falling back to keyword search.\n'
    : '\n';

  return (
    `Search results for "${query}" (strategy: ${searchTypeUsed})${degradedNotice}\n` +
    results
      .map(
        (result, index) =>
          `${index + 1}. **${result.pattern.name}** (${result.pattern.category})\n` +
          `   ID: ${result.pattern.id}\n` +
          `   Score: ${(result.score * 100).toFixed(1)}%\n` +
          `   Description: ${result.pattern.description}`
      )
      .join('\n')
  );
}

export function formatSearchResultsFromRecommendations(
  query: string,
  searchTypeUsed: string,
  degraded: boolean,
  recommendations: PatternRecommendation[]
): string {
  const results: SearchPatternResult[] = recommendations.map(rec => ({
    pattern: {
      id: rec.pattern.id,
      name: rec.pattern.name,
      category: rec.pattern.category,
      description: rec.pattern.description,
      complexity: rec.pattern.complexity,
      tags: rec.pattern.tags,
    },
    score: rec.confidence,
  }));

  return formatSearchResults(query, searchTypeUsed, degraded, results);
}
