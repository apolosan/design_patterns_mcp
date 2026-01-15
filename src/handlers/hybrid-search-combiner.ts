/**
 * Hybrid Search Combiner
 * Combines semantic and keyword search results using dynamic alpha tuning
 * Extracted from PatternMatcher following SRP
 */

import { structuredLogger } from '../utils/logger.js';
import type {
  MatchResult,
  DynamicAlphaResult,
  QueryAnalysis,
  HybridCombinerConfig,
} from '../types/search-types.js';

// Technical keywords that suggest more specific/semantic search
const TECHNICAL_KEYWORDS = [
  'pattern',
  'architecture',
  'design',
  'algorithm',
  'data',
  'structure',
  'interface',
  'abstract',
  'factory',
  'singleton',
  'observer',
  'strategy',
  'decorator',
  'adapter',
  'bridge',
  'proxy',
  'facade',
  'flyweight',
  'chain',
  'command',
  'mediator',
  'memento',
  'state',
  'template',
  'visitor',
  'iterator',
];

// Query type indicators
const EXPLORATORY_WORDS = [
  'best',
  'good',
  'how',
  'what',
  'why',
  'explain',
  'learn',
  'understand',
];
const SPECIFIC_WORDS = ['implement', 'code', 'example', 'use', 'apply', 'create', 'write'];

const DEFAULT_CONFIG: HybridCombinerConfig = {
  defaultSemanticWeight: 0.7,
  defaultKeywordWeight: 0.3,
};

/**
 * Dynamic Alpha Tuner - Implements Dynamic Alpha Tuning for Hybrid Retrieval
 * Adjusts the weight between semantic and keyword search based on query characteristics
 */
export class DynamicAlphaTuner {
  calculateAlpha(query: string): DynamicAlphaResult {
    const analysis = this.analyzeQuery(query);
    const { semanticAlpha, keywordAlpha, queryType, confidence } =
      this.computeAlphaFromAnalysis(analysis);

    return {
      semanticAlpha,
      keywordAlpha,
      queryType,
      confidence,
      analysis,
    };
  }

  private analyzeQuery(query: string): QueryAnalysis {
    const normalizedQuery = query.toLowerCase();
    const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);
    const queryLength = query.length;
    const wordCount = words.length;

    const technicalTermCount = words.filter((word) =>
      TECHNICAL_KEYWORDS.some((keyword) => word.includes(keyword))
    ).length;

    const exploratoryScore = EXPLORATORY_WORDS.reduce((score, word) => {
      return score + (normalizedQuery.includes(word) ? 0.15 : 0);
    }, 0);

    const specificityScore = SPECIFIC_WORDS.reduce((score, word) => {
      return score + (normalizedQuery.includes(word) ? 0.12 : 0);
    }, 0);

    const hasCodeSnippet = /`[^`]+`|\{[^{]+\}|\([^(]+\)/.test(query);

    const uniqueChars = new Set(query).size;
    const entropy = uniqueChars / Math.max(queryLength, 1);

    return {
      queryLength,
      wordCount,
      technicalTermCount,
      exploratoryScore: Math.min(exploratoryScore, 0.5),
      specificityScore: Math.min(specificityScore, 0.5),
      hasCodeSnippet,
      entropy,
    };
  }

  private computeAlphaFromAnalysis(
    analysis: QueryAnalysis
  ): Omit<DynamicAlphaResult, 'analysis'> {
    let semanticAlpha = 0.5;
    let keywordAlpha = 0.5;
    let queryType: 'exploratory' | 'specific' | 'balanced' = 'balanced';
    let confidence = 0.5;

    if (analysis.wordCount <= 2 && analysis.specificityScore >= 0.1) {
      semanticAlpha = 0.3;
      keywordAlpha = 0.7;
      queryType = 'specific';
      confidence = 0.7;
    } else if (analysis.wordCount > 5 && analysis.exploratoryScore > 0.2) {
      semanticAlpha = 0.7;
      keywordAlpha = 0.3;
      queryType = 'exploratory';
      confidence = 0.75;
    } else if (analysis.technicalTermCount > 0 && analysis.wordCount > 3) {
      semanticAlpha = 0.6;
      keywordAlpha = 0.4;
      queryType = 'exploratory';
      confidence = 0.65;
    } else if (analysis.hasCodeSnippet) {
      semanticAlpha = 0.4;
      keywordAlpha = 0.6;
      queryType = 'specific';
      confidence = 0.6;
    } else if (analysis.entropy > 0.6 && analysis.wordCount > 3) {
      semanticAlpha = 0.65;
      keywordAlpha = 0.35;
      queryType = 'exploratory';
      confidence = 0.55;
    } else {
      semanticAlpha = 0.5;
      keywordAlpha = 0.5;
      queryType = 'balanced';
      confidence = 0.5;
    }

    if (analysis.queryLength > 100) {
      semanticAlpha += 0.1;
      keywordAlpha -= 0.1;
    } else if (analysis.queryLength < 30) {
      semanticAlpha -= 0.15;
      keywordAlpha += 0.15;
    }

    const total = semanticAlpha + keywordAlpha;
    semanticAlpha = semanticAlpha / total;
    keywordAlpha = keywordAlpha / total;

    return {
      semanticAlpha: Math.max(0.1, Math.min(0.9, semanticAlpha)),
      keywordAlpha: Math.max(0.1, Math.min(0.9, keywordAlpha)),
      queryType,
      confidence: Math.min(0.9, confidence + analysis.technicalTermCount * 0.05),
    };
  }
}

/**
 * Hybrid Search Combiner
 * Combines results from multiple search strategies
 */
export class HybridSearchCombiner {
  private alphaTuner: DynamicAlphaTuner;
  private config: HybridCombinerConfig;

  constructor(config?: Partial<HybridCombinerConfig>) {
    this.alphaTuner = new DynamicAlphaTuner();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate dynamic alpha values for a query
   */
  calculateAlpha(query: string): DynamicAlphaResult {
    return this.alphaTuner.calculateAlpha(query);
  }

  /**
   * Apply weights to semantic matches
   */
  applySemanticWeight(matches: MatchResult[], weight: number): MatchResult[] {
    return matches.map((match) => ({
      ...match,
      confidence: match.confidence * weight,
      metadata: {
        ...match.metadata,
        finalScore: match.confidence * weight,
      },
    }));
  }

  /**
   * Apply weights to keyword matches
   */
  applyKeywordWeight(matches: MatchResult[], weight: number): MatchResult[] {
    return matches.map((match) => ({
      ...match,
      confidence: match.confidence * weight,
      metadata: {
        ...match.metadata,
        finalScore: match.confidence * weight,
      },
    }));
  }

  /**
   * Combine semantic and keyword matches using hybrid scoring
   */
  combineMatches(matches: MatchResult[], alphaResult?: DynamicAlphaResult): MatchResult[] {
    const patternMap = new Map<string, MatchResult[]>();

    for (const match of matches) {
      const existing = patternMap.get(match.pattern.id) ?? [];
      existing.push(match);
      patternMap.set(match.pattern.id, existing);
    }

    const combinedMatches: MatchResult[] = [];

    const semanticWeight = alphaResult?.semanticAlpha ?? this.config.defaultSemanticWeight;
    const keywordWeight = alphaResult?.keywordAlpha ?? this.config.defaultKeywordWeight;

    for (const [, patternMatches] of patternMap) {
      const semanticMatch = patternMatches.find((m) => m.matchType === 'semantic');
      const keywordMatch = patternMatches.find((m) => m.matchType === 'keyword');

      const semanticScore = semanticMatch?.metadata.semanticScore ?? 0;
      const keywordScoreRaw = keywordMatch?.metadata.keywordScore ?? 0;
      const keywordScore = Math.min(keywordScoreRaw / 10, 0.99);

      let finalScore = 0;
      if (semanticScore > 0 && keywordScore > 0) {
        finalScore =
          (semanticWeight * semanticScore + keywordWeight * keywordScore) /
          (semanticWeight + keywordWeight);
      } else if (semanticScore > 0) {
        finalScore = semanticScore;
      } else if (keywordScore > 0) {
        finalScore = keywordScore;
      }

      finalScore = Math.min(Math.max(finalScore, 0), 1);

      const reasons = [
        ...(semanticMatch?.reasons ?? []),
        ...(keywordMatch?.reasons ?? []),
      ];

      combinedMatches.push({
        pattern: patternMatches[0].pattern,
        confidence: finalScore,
        matchType: 'hybrid' as const,
        reasons,
        metadata: {
          semanticScore,
          keywordScore,
          finalScore,
        },
      });
    }

    structuredLogger.debug('hybrid-combiner', 'Combined search results', {
      inputMatches: matches.length,
      outputMatches: combinedMatches.length,
      semanticWeight: semanticWeight.toFixed(3),
      keywordWeight: keywordWeight.toFixed(3),
    });

    return combinedMatches;
  }
}
