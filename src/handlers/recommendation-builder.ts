/**
 * Recommendation Builder
 * Builds pattern recommendations from match results
 * Extracted from PatternMatcher following SRP
 */

import { DatabaseManager } from '../services/database-manager.js';
import { structuredLogger } from '../utils/logger.js';
import { parseArrayProperty } from '../utils/parse-tags.js';
import {
  PatternRecommendation,
  ImplementationGuidance,
  AlternativePattern,
} from '../models/recommendation.js';
import type {
  PatternRequest,
  MatchResult,
  DetailedPattern,
  PatternImplementation,
  RecommendationBuilderConfig,
} from '../types/search-types.js';

const DEFAULT_CONFIG: RecommendationBuilderConfig = {
  maxAlternatives: 3,
  maxImplementationExamples: 3,
};

export class RecommendationBuilder {
  private db: DatabaseManager;
  private config: RecommendationBuilderConfig;

  constructor(db: DatabaseManager, config?: Partial<RecommendationBuilderConfig>) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Build pattern recommendations from matches
   */
  buildRecommendations(
    matches: MatchResult[],
    request: PatternRequest
  ): PatternRecommendation[] {
    const startTime = Date.now();
    const recommendations: PatternRecommendation[] = [];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const pattern = this.getDetailedPattern(match.pattern.id);

      if (pattern) {
        const recommendation = this.buildSingleRecommendation(
          match,
          pattern,
          request,
          i + 1,
          matches
        );
        recommendations.push(recommendation);
      }
    }

    const duration = Date.now() - startTime;
    structuredLogger.debug('recommendation-builder', 'Built recommendations', {
      matchCount: matches.length,
      recommendationCount: recommendations.length,
      durationMs: duration,
    });

    return recommendations;
  }

  /**
   * Build a single recommendation
   */
  private buildSingleRecommendation(
    match: MatchResult,
    pattern: DetailedPattern,
    request: PatternRequest,
    rank: number,
    allMatches: MatchResult[]
  ): PatternRecommendation {
    return {
      id: crypto.randomUUID(),
      requestId: request.id,
      pattern: {
        id: pattern.id,
        name: pattern.name,
        category: pattern.category,
        description: pattern.description,
        complexity: pattern.complexity,
        tags: pattern.tags,
      },
      confidence: match.confidence,
      rank,
      justification: {
        primaryReason: match.reasons[0] || 'Pattern matches query requirements',
        supportingReasons: match.reasons.slice(1),
        problemFit: this.generateProblemFit(match, request),
        benefits: pattern.benefits || [],
        drawbacks: pattern.drawbacks || [],
      },
      implementation: this.generateImplementationGuidance(pattern, request),
      alternatives: this.findAlternatives(pattern.id, allMatches),
      context: {
        projectContext: this.extractProjectContext(request),
        teamContext: this.extractTeamContext(request),
        technologyFit: {
          fitScore: 0.8,
          reasons: ['Good fit for the specified programming language'],
          compatibleTech: [request.programmingLanguage ?? 'typescript'],
          incompatibleTech: [],
          integrationRequirements: [],
        },
      },
    };
  }

  /**
   * Get detailed pattern information
   */
  getDetailedPattern(patternId: string): DetailedPattern | null {
    const pattern = this.db.queryOne<{
      id: string;
      name: string;
      category: string;
      description: string;
      when_to_use: string | null;
      benefits: string | null;
      drawbacks: string | null;
      use_cases: string | null;
      complexity: string | null;
      tags: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT id, name, category, description, when_to_use, benefits, drawbacks,
             use_cases, complexity, tags, created_at, updated_at
      FROM patterns WHERE id = ?
    `,
      [patternId]
    );

    if (!pattern) return null;

    return {
      id: pattern.id,
      name: pattern.name,
      category: pattern.category,
      description: pattern.description,
      when_to_use: parseArrayProperty(pattern.when_to_use, 'when_to_use'),
      benefits: parseArrayProperty(pattern.benefits, 'benefits'),
      drawbacks: parseArrayProperty(pattern.drawbacks, 'drawbacks'),
      use_cases: parseArrayProperty(pattern.use_cases, 'use_cases'),
      complexity: pattern.complexity ?? 'Medium',
      tags: parseArrayProperty(pattern.tags, 'tags'),
      created_at: pattern.created_at,
      updated_at: pattern.updated_at,
    };
  }

  /**
   * Generate problem-solution fit explanation
   */
  private generateProblemFit(match: MatchResult, request: PatternRequest): string {
    return `This pattern addresses your requirement for "${request.query}" by providing a proven solution for ${match.pattern.category.toLowerCase()} scenarios.`;
  }

  /**
   * Generate implementation guidance
   */
  private generateImplementationGuidance(
    pattern: DetailedPattern,
    request: PatternRequest
  ): ImplementationGuidance {
    const implementations = this.getPatternImplementations(
      pattern.id,
      request.programmingLanguage
    );

    return {
      steps: [
        'Analyze your current code structure',
        'Identify where the pattern applies',
        'Implement the pattern following the examples',
        'Test the implementation',
        'Refactor as needed',
      ],
      examples: implementations.map((impl: PatternImplementation) => ({
        language: impl.language,
        title: `${pattern.name} in ${impl.language}`,
        code: impl.code,
        explanation: impl.explanation,
      })),
      dependencies: [],
      configuration: [],
      testing: {
        unitTests: ['Test pattern implementation', 'Test edge cases'],
        integrationTests: ['Test pattern interaction with existing code'],
        testScenarios: ['Normal operation', 'Error conditions', 'Boundary cases'],
      },
      performance: {
        impact: 'medium',
        memoryUsage: 'Minimal additional memory',
        cpuUsage: 'Negligible CPU overhead',
        optimizations: ['Consider lazy initialization', 'Use appropriate caching'],
        monitoring: ['Monitor pattern usage', 'Track performance metrics'],
      },
    };
  }

  /**
   * Find alternative patterns
   */
  private findAlternatives(
    patternId: string,
    allMatches: MatchResult[]
  ): AlternativePattern[] {
    const relatedPatterns = this.db.query<{
      target_pattern_id: string;
      type: string;
      description: string;
    }>(
      `
      SELECT target_pattern_id, type, description
      FROM pattern_relationships
      WHERE source_pattern_id = ? AND type IN ('alternative', 'similar')
    `,
      [patternId]
    );

    return relatedPatterns.slice(0, this.config.maxAlternatives).map((rel) => {
      const foundPattern = allMatches.find(
        (m) => m.pattern.id === rel.target_pattern_id
      )?.pattern;
      return {
        id: rel.target_pattern_id,
        name: foundPattern?.name ?? 'Unknown Pattern',
        category: foundPattern?.category ?? 'Unknown',
        reason: rel.description,
        score: 0.7,
      };
    });
  }

  /**
   * Get pattern implementations
   */
  private getPatternImplementations(
    patternId: string,
    language?: string
  ): PatternImplementation[] {
    let sql =
      'SELECT id, language, code, explanation FROM pattern_implementations WHERE pattern_id = ?';
    const params: string[] = [patternId];

    if (language) {
      sql += ' AND language = ?';
      params.push(language);
    }

    sql += ' ORDER BY language, created_at DESC';

    const implementations = this.db.query<PatternImplementation>(sql, params);
    return implementations.slice(0, this.config.maxImplementationExamples);
  }

  /**
   * Extract project context from request
   */
  private extractProjectContext(_request: PatternRequest): string {
    return 'Medium-sized established project with standard architecture patterns';
  }

  /**
   * Extract team context from request
   */
  private extractTeamContext(_request: PatternRequest): string {
    return 'Medium-sized team with intermediate experience, prefers examples and documentation';
  }
}
