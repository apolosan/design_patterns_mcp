/**
 * Fuzzy Membership Functions for Pattern Relevance Evaluation
 * Implements fuzzy sets for evaluating multiple dimensions of pattern relevance
 */

export interface PatternMembershipInput {
  semanticSimilarity: number; // 0-1
  keywordMatchStrength: number; // 0-1
  patternComplexity: string; // 'Low', 'Medium', 'High'
  contextualFit: number; // 0-1
  programmingLanguage?: string;
}

export interface FuzzyMembershipResult {
  semanticSimilarity: {
    low: number;
    medium: number;
    high: number;
  };
  keywordMatchStrength: {
    weak: number;
    moderate: number;
    strong: number;
  };
  patternComplexity: {
    simple: number;
    moderate: number;
    complex: number;
  };
  contextualFit: {
    poor: number;
    good: number;
    excellent: number;
  };
}

export class PatternMembershipFunctions {
  /**
   * Evaluate semantic similarity using triangular membership functions
   */
  private evaluateSemanticSimilarity(score: number): { low: number; medium: number; high: number } {
    // Triangular fuzzy sets with adjusted boundaries for better discrimination
    let low = 0, medium = 0, high = 0;

    if (score <= 0.4) {
      low = 1;
    } else if (score <= 0.6) {
      low = (0.6 - score) / 0.2;
      medium = (score - 0.4) / 0.2;
    } else if (score <= 0.8) {
      medium = (0.8 - score) / 0.2;
      high = (score - 0.6) / 0.2;
    } else {
      high = 1;
    }

    return { low, medium, high };
  }

  /**
   * Evaluate keyword match strength using trapezoidal membership functions
   */
  private evaluateKeywordMatchStrength(score: number): { weak: number; moderate: number; strong: number } {
    // Trapezoidal fuzzy sets with clearer boundaries
    let weak = 0, moderate = 0, strong = 0;

    if (score <= 0.2) {
      weak = 1;
    } else if (score <= 0.4) {
      weak = (0.4 - score) / 0.2;
      moderate = (score - 0.2) / 0.2;
    } else if (score <= 0.6) {
      moderate = 1;
    } else if (score <= 0.8) {
      moderate = (0.8 - score) / 0.2;
      strong = (score - 0.6) / 0.2;
    } else {
      strong = 1;
    }

    return { weak, moderate, strong };
  }

  /**
   * Evaluate pattern complexity using discrete membership functions
   */
  private evaluatePatternComplexity(complexity: string): { simple: number; moderate: number; complex: number } {
    const lowerComplexity = complexity.toLowerCase();

    switch (lowerComplexity) {
      case 'low':
      case 'simple':
        return { simple: 1.0, moderate: 0.0, complex: 0.0 };
      case 'medium':
      case 'intermediate':
        return { simple: 0.0, moderate: 1.0, complex: 0.0 };
      case 'high':
      case 'complex':
      case 'advanced':
        return { simple: 0.0, moderate: 0.0, complex: 1.0 };
      default:
        // Default to moderate complexity
        return { simple: 0.2, moderate: 0.8, complex: 0.2 };
    }
  }

  /**
   * Evaluate contextual fit using triangular membership functions
   */
  private evaluateContextualFit(score: number): { poor: number; good: number; excellent: number } {
    // Triangular fuzzy sets with clearer boundaries
    let poor = 0, good = 0, excellent = 0;

    if (score <= 0.2) {
      poor = 1;
    } else if (score <= 0.5) {
      poor = (0.5 - score) / 0.3;
      good = (score - 0.2) / 0.3;
    } else if (score <= 0.8) {
      good = 1;
    } else if (score <= 1.0) {
      good = (1.0 - score) / 0.2;
      excellent = (score - 0.8) / 0.2;
    } else {
      excellent = 1;
    }

    return { poor, good, excellent };
  }

  /**
   * Evaluate programming language compatibility (bonus factor)
   */
  private evaluateLanguageCompatibility(patternTags: string[], requestedLanguage?: string): number {
    if (!requestedLanguage) return 0.5; // Neutral if no language specified

    const languageTags = ['javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'go', 'rust', 'php', 'ruby'];
    const requestedLangLower = requestedLanguage.toLowerCase();

    // Check if pattern has language-specific implementations or tags
    const hasLanguageTag = patternTags.some(tag =>
      languageTags.includes(tag.toLowerCase()) && tag.toLowerCase().includes(requestedLangLower.slice(0, 3))
    );

    return hasLanguageTag ? 0.8 : 0.3;
  }

  /**
   * Main evaluation function
   */
  evaluate(input: PatternMembershipInput): FuzzyMembershipResult {
    return {
      semanticSimilarity: this.evaluateSemanticSimilarity(input.semanticSimilarity),
      keywordMatchStrength: this.evaluateKeywordMatchStrength(input.keywordMatchStrength),
      patternComplexity: this.evaluatePatternComplexity(input.patternComplexity),
      contextualFit: this.evaluateContextualFit(input.contextualFit)
    };
  }

  /**
   * Get linguistic interpretation of membership values
   */
  getLinguisticInterpretation(result: FuzzyMembershipResult): {
    semanticLevel: string;
    keywordLevel: string;
    complexityLevel: string;
    fitLevel: string;
  } {
    const getDominant = (values: { [key: string]: number }): string => {
      const entries = Object.entries(values);
      const maxEntry = entries.reduce((max, current) =>
        current[1] > max[1] ? current : max
      );
      return maxEntry[0];
    };

    return {
      semanticLevel: getDominant(result.semanticSimilarity),
      keywordLevel: getDominant(result.keywordMatchStrength),
      complexityLevel: getDominant(result.patternComplexity),
      fitLevel: getDominant(result.contextualFit)
    };
  }
}