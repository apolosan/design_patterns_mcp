/**
 * Fuzzy Membership Functions for Pattern Relevance Evaluation
 * Implements fuzzy sets for evaluating multiple dimensions of pattern relevance
 *
 * The semantic dimension carries an explicit availability flag: when the search
 * pipeline has no semantic similarity to offer (keyword-only search), the
 * dimension is UNAVAILABLE, which is not the same as "degree zero". Conjoining an
 * unavailable antecedent as if it were zero vetoes the whole rule, which is what
 * made the old rule base inert. Callers may use the degrees for reporting, but
 * the inference engine must branch on the flag.
 */
export interface PatternMembershipInput {
  /** Semantic similarity 0-1, or absent when the channel did not contribute */
  semanticSimilarity?: number;
  keywordMatchStrength: number; // 0-1
  /** Match against fields the primary retriever does not index, or absent */
  applicabilityMatch?: number;
  patternComplexity: string; // 'Low', 'Medium', 'High', ...
  contextualFit: number; // 0-1
  programmingLanguage?: string;
}

export interface FuzzyMembershipResult {
  /**
   * False when no semantic evidence was supplied; the degrees are then zero.
   * Optional so callers that build membership values by hand do not have to guess
   * it; the inference engine treats an absent flag as "evidence present" and
   * PatternMembershipFunctions.evaluate always sets it explicitly.
   */
  semanticAvailable?: boolean;
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
  /**
   * Fuzzified applicability match. Absent means the applicability index had
   * nothing to say about this pattern (it covers 49.7% of the catalog), which is
   * different from "no match".
   */
  applicabilityMatch?: {
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
    // Triangular fuzzy sets calibrated for realistic cosine similarity range (0.1-0.7)
    let low = 0, medium = 0, high = 0;

    if (score <= 0.25) {
      low = 1;
    } else if (score <= 0.45) {
      low = (0.45 - score) / 0.2;
      medium = (score - 0.25) / 0.2;
    } else if (score <= 0.65) {
      medium = (0.65 - score) / 0.2;
      high = (score - 0.45) / 0.2;
    } else {
      high = 1;
    }

    return { low, medium, high };
  }

  /**
   * Evaluate keyword match strength using trapezoidal membership functions
   */
  private evaluateKeywordMatchStrength(score: number): { weak: number; moderate: number; strong: number } {
    // Trapezoidal sets over the normalised keyword confidence that the keyword
    // handler actually produces: BM25 is max-normalised per query and capped at
    // 0.99, so the top hit of every query lands near 1.0 while mid-ranked hits
    // cluster around 0.3-0.7. Saturating "strong" at 0.8 keeps it meaning "top of
    // this query's scale" instead of "any hit at all".
    // Measured over the 710-pattern catalog with 14 representative queries
    // (top-10 only): min 0.00, p25 0.42, p50 0.58, p75 0.80, p90 1.00, and the
    // rank-1 hit is 1.00 for every query while the rank-5 hit can fall to 0.16.
    // The moderate plateau is what keeps the set monotone: without it a 0.50 hit
    // scored "less strong" than a 0.40 hit.
    const WEAK_PEAK = 0.1;
    const PLATEAU_START = 0.2;
    const PLATEAU_END = 0.55;
    const STRONG_TOP = 0.8;

    let weak = 0, moderate = 0, strong = 0;

    if (score <= WEAK_PEAK) {
      weak = 1;
    } else if (score <= PLATEAU_START) {
      weak = (PLATEAU_START - score) / (PLATEAU_START - WEAK_PEAK);
      moderate = (score - WEAK_PEAK) / (PLATEAU_START - WEAK_PEAK);
    } else if (score <= PLATEAU_END) {
      moderate = 1;
    } else if (score <= STRONG_TOP) {
      const ramp = STRONG_TOP - PLATEAU_END;
      moderate = (STRONG_TOP - score) / ramp;
      strong = (score - PLATEAU_END) / ramp;
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
      case 'low to medium':
      case 'medium':
      case 'intermediate':
      case 'moderate':
        return { simple: 0.0, moderate: 1.0, complex: 0.0 };
      case 'medium to high':
      case 'high':
      case 'complex':
      case 'advanced':
      case 'very high':
      case 'very complex':
      case 'expert':
        return { simple: 0.0, moderate: 0.0, complex: 1.0 };
      default:
        // Unknown label stays on the moderate set so the triple is still a valid
        // partition (the previous 0.2/0.8/0.2 summed to 1.2).
        return { simple: 0.0, moderate: 1.0, complex: 0.0 };
    }
  }

  /**
   * Evaluate contextual fit using triangular membership functions
   */
  private evaluateContextualFit(score: number): { poor: number; good: number; excellent: number } {
    // Triangular fuzzy sets calibrated for realistic fit range (0.1-0.8)
    let poor = 0, good = 0, excellent = 0;

    if (score <= 0.15) {
      poor = 1;
    } else if (score <= 0.40) {
      poor = (0.40 - score) / 0.25;
      good = (score - 0.15) / 0.25;
    } else if (score <= 0.65) {
      good = 1;
    } else if (score <= 1.0) {
      good = (1.0 - score) / 0.35;
      excellent = (score - 0.65) / 0.35;
    } else {
      excellent = 1;
    }

    return { poor, good, excellent };
  }

  /**
   * Main evaluation function
   */
  evaluate(input: PatternMembershipInput): FuzzyMembershipResult {
    const semanticAvailable = typeof input.semanticSimilarity === 'number';

    return {
      semanticAvailable,
      semanticSimilarity: semanticAvailable
        ? this.evaluateSemanticSimilarity(input.semanticSimilarity as number)
        : { low: 0, medium: 0, high: 0 },
      keywordMatchStrength: this.evaluateKeywordMatchStrength(input.keywordMatchStrength),
      applicabilityMatch:
        typeof input.applicabilityMatch === 'number'
          ? this.evaluateKeywordMatchStrength(input.applicabilityMatch)
          : undefined,
      patternComplexity: this.evaluatePatternComplexity(input.patternComplexity),
      contextualFit: this.evaluateContextualFit(input.contextualFit),
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
      semanticLevel: result.semanticAvailable
        ? getDominant(result.semanticSimilarity)
        : 'unavailable',
      keywordLevel: getDominant(result.keywordMatchStrength),
      complexityLevel: getDominant(result.patternComplexity),
      fitLevel: getDominant(result.contextualFit)
    };
  }
}
