/**
 * Fuzzy Inference Engine for Pattern Relevance
 *
 * Implements a COMPLETE, factorised rule base over four evidence dimensions.
 *
 * Why factorised: a rule base is complete when at least one rule fires for every
 * input (the standard definition used by fuzzy control literature). Enumerating
 * the full antecedent lattice (3 keyword x 3 semantic x 3 context x 3 complexity)
 * would be 81 rules; factorising by dimension gives completeness for free,
 * because each input partition is total over its own domain, and keeps the rule
 * set readable.
 *
 * Why availability matters: the previous base conjoined seven of its eight rules
 * with semanticSimilarity.high or .medium. With the semantic channel off those
 * degrees are zero, and no t-norm saves a conjunction with zero -- min(0, x) = 0
 * and prod(0, x) = 0 alike. The defect was not the operator, it was treating
 * "channel absent" as "degree zero". Rules that need semantics now check
 * semanticAvailable first and are simply not evaluated when the evidence is
 * missing.
 */
import { FuzzyMembershipResult, PatternMembershipFunctions, PatternMembershipInput } from './fuzzy-membership.js';
import { NEUTRAL_RELEVANCE } from './fuzzy-defuzzification.js';

/**
 * Minimum firing strength that is narrated back to the caller. Rules below it
 * still contribute to the fuzzy output, they are just not listed in
 * fuzzyReasoning, which the MCP formatter prints verbatim.
 */
const NARRATIVE_FLOOR = 0.05;

export interface FuzzyInferenceInput {
  membershipValues: FuzzyMembershipResult;
  patternId: string;
  originalScore: number;
}

export interface FuzzyInferenceOutput {
  fuzzyScore: {
    low: number;
    medium: number;
    high: number;
    very_high: number;
  };
  confidence: number;
  reasoning: string[];
  ruleFirings: Array<{
    rule: string;
    strength: number;
    contribution: number;
  }>;
}

export class FuzzyInferenceEngine {
  private membershipFunctions: PatternMembershipFunctions;

  constructor() {
    this.membershipFunctions = new PatternMembershipFunctions();
  }

  /**
   * Apply fuzzy inference rules to determine overall pattern relevance
   */
  infer(input: FuzzyInferenceInput): FuzzyInferenceOutput {
    const { membershipValues } = input;
    const ruleFirings: Array<{ rule: string; strength: number; contribution: number }> = [];
    const reasoning: string[] = [];

    // Initialize fuzzy output sets
    let lowOutput = 0;
    let mediumOutput = 0;
    let highOutput = 0;
    let veryHighOutput = 0;

    const applyRule = (
      kind: 'low' | 'medium' | 'high' | 'very_high',
      strength: number,
      rule: string,
      message: (strength: number) => string
    ): void => {
      if (!(strength > 0)) return;
      if (kind === 'low') lowOutput = Math.max(lowOutput, strength);
      else if (kind === 'medium') mediumOutput = Math.max(mediumOutput, strength);
      else if (kind === 'high') highOutput = Math.max(highOutput, strength);
      else veryHighOutput = Math.max(veryHighOutput, strength);

      if (strength < NARRATIVE_FLOOR) return;
      ruleFirings.push({ rule, strength, contribution: strength });
      reasoning.push(message(strength));
    };

    const keyword = membershipValues.keywordMatchStrength;
    const context = membershipValues.contextualFit;
    const complexity = membershipValues.patternComplexity;
    // Directly-injected memberships (tests, callers building them by hand) carry
    // no flag; treat that as "the evidence is present" so the rule base behaves
    // as documented instead of silently going inert.
    const semanticAvailable = membershipValues.semanticAvailable ?? true;
    const semantic = membershipValues.semanticSimilarity;

    // ---- Semantic dimension first: it holds the most specific rules ----
    // Specificity precedence: "semantic high AND keyword strong" implies "keyword
    // strong", so when the specific rule fires the generic one would only add a
    // weaker conclusion on top and average the score back down (1.0 high mixed
    // with 1.0 very_high reported 0.875 instead of 0.95).
    // ---- Applicability dimension: the second opinion, and the reason the fuzzy
    // layer has a job. Agreement beats either signal alone, and a strong
    // applicability match with keyword support is a genuine RECOVERY (the primary
    // retriever never saw that vocabulary), so it must be able to reorder. This
    // is what makes the response non-monotone in keyword strength, which is the
    // necessary condition for any ranking gain.
    const applicability = membershipValues.applicabilityMatch;
    if (applicability) {
      applyRule(
        'very_high',
        Math.min(applicability.strong, keyword.strong),
        'Strong applicability AND strong keyword match -> Very High Relevance',
        (st) => `Both retrievers agree (${(st * 100).toFixed(1)}% confidence)`
      );
      applyRule(
        'high',
        Math.min(applicability.strong, Math.max(keyword.strong, keyword.moderate)),
        'Strong applicability with keyword support -> High Relevance',
        (st) => `Recovered by applicability evidence (${(st * 100).toFixed(1)}% confidence)`
      );
      applyRule(
        'medium',
        Math.min(applicability.moderate, Math.max(keyword.strong, keyword.moderate)),
        'Moderate applicability with keyword support -> Medium Relevance',
        (st) => `Supported by applicability evidence (${(st * 100).toFixed(1)}% confidence)`
      );
    }

    if (semanticAvailable) {
      applyRule(
        'very_high',
        Math.min(semantic.high, keyword.strong),
        'High semantic similarity AND strong keyword match -> Very High Relevance',
        (s) => `Strong semantic and keyword alignment (${(s * 100).toFixed(1)}% confidence)`
      );
      applyRule(
        'very_high',
        Math.min(semantic.high, context.excellent),
        'High semantic similarity AND excellent contextual fit -> Very High Relevance',
        (s) => `Excellent semantic-contextual fit (${(s * 100).toFixed(1)}% confidence)`
      );
      applyRule(
        'high',
        Math.min(semantic.medium, keyword.moderate),
        'Medium semantic similarity AND moderate keyword match -> High relevance',
        (s) => `Balanced semantic and keyword evidence (${(s * 100).toFixed(1)}% confidence)`
      );
    }

    // ---- Keyword dimension: a total partition, so one of these always fires ----
    if (veryHighOutput === 0) {
      applyRule(
        'high',
        keyword.strong,
        'Strong keyword match -> High relevance',
        (s) => `Strong keyword match (${(s * 100).toFixed(1)}% confidence)`
      );
    }
    applyRule(
      'medium',
      keyword.moderate,
      'Moderate keyword match -> Medium relevance',
      (s) => `Moderate keyword match (${(s * 100).toFixed(1)}% confidence)`
    );
    applyRule(
      'low',
      keyword.weak,
      'Weak keyword match -> Low relevance',
      (s) => `Weak keyword evidence (${(s * 100).toFixed(1)}% impact)`
    );

    // ---- Contextual dimension: also a total partition, always evaluated ----
    // Not dominated by the levels above: a poor fit is a genuine counter-signal
    // (the pattern does not support what was asked), so it must be able to pull a
    // strong lexical match back down.
    applyRule(
      'high',
      veryHighOutput > 0 ? 0 : context.excellent,
      'Excellent contextual fit -> High relevance',
      (s) => `Excellent contextual fit (${(s * 100).toFixed(1)}% confidence)`
    );
    applyRule(
      'low',
      context.poor,
      'Poor contextual fit -> Low relevance',
      (s) => `Poor contextual fit (${(s * 100).toFixed(1)}% impact)`
    );

    // ---- Refinement: complexity only tempers a moderate keyword hit ----
    applyRule(
      'medium',
      Math.min(complexity.simple, keyword.moderate),
      'Simple pattern with a moderate keyword match -> Medium relevance',
      (s) => `Simple but relevant pattern (${(s * 100).toFixed(1)}% confidence)`
    );

    // No fallback rule: the keyword and contextual partitions are total, so the
    // base is complete and something always fires. If every partition were empty
    // (malformed input) the anchored defuzzifier would report NEUTRAL_RELEVANCE
    // from its full residual mass, and that absence is narrated explicitly.
    if (ruleFirings.length === 0) {
      reasoning.push(
        `No rule fired: relevance anchored at neutral (${(NEUTRAL_RELEVANCE * 100).toFixed(1)}%)`
      );
    }

    const fuzzyScore = {
      low: lowOutput,
      medium: mediumOutput,
      high: highOutput,
      very_high: veryHighOutput
    };

    // Calculate crisp confidence score (will be refined by defuzzification)
    const preliminaryConfidence = this.calculatePreliminaryConfidence(fuzzyScore);

    return {
      fuzzyScore,
      confidence: preliminaryConfidence,
      reasoning,
      ruleFirings
    };
  }

  /**
   * Calculate preliminary confidence from fuzzy outputs using weighted average
   */
  private calculatePreliminaryConfidence(fuzzyScore: { low: number; medium: number; high: number; very_high: number }): number {
    const weights = {
      low: 0.1,      // Very low weight for low relevance
      medium: 0.4,   // Moderate weight for medium relevance
      high: 0.7,     // High weight for high relevance
      very_high: 0.9 // Very high weight for very high relevance
    };

    const weightedSum = fuzzyScore.low * weights.low +
                       fuzzyScore.medium * weights.medium +
                       fuzzyScore.high * weights.high +
                       fuzzyScore.very_high * weights.very_high;

    const totalMembership = fuzzyScore.low + fuzzyScore.medium + fuzzyScore.high + fuzzyScore.very_high;

    // No evidence at all is a legitimate state: report the neutral value.
    // Dividing by zero here produced NaN, masked in the past by a fallback rule
    // that always left some membership behind.
    if (totalMembership === 0) {
      return NEUTRAL_RELEVANCE;
    }

    const preliminary = weightedSum / totalMembership;
    return Number.isFinite(preliminary) ? preliminary : NEUTRAL_RELEVANCE;
  }

  /**
   * Evaluate pattern with full fuzzy inference
   */
  evaluatePattern(input: PatternMembershipInput & { patternId: string; originalScore: number }): FuzzyInferenceOutput {
    const membershipValues = this.membershipFunctions.evaluate(input);

    const inferenceInput: FuzzyInferenceInput = {
      membershipValues,
      patternId: input.patternId,
      originalScore: input.originalScore
    };

    return this.infer(inferenceInput);
  }

  /**
   * Get rule statistics for analysis.
   *
   * Not used by the search pipeline: this is an offline calibration aid for
   * inspecting which rules carry a corpus. Kept deliberately, together with
   * batchDefuzzify / getStatistics on the defuzzifier, so a recalibration does
   * not have to rebuild the aggregation from logs.
   */
  getRuleStatistics(results: FuzzyInferenceOutput[]): {
    mostFiredRules: Array<{ rule: string; count: number; avgStrength: number }>;
    averageConfidence: number;
    ruleDistribution: { [rule: string]: number };
  } {
    const ruleCounts: { [rule: string]: { count: number; totalStrength: number } } = {};
    const confidences: number[] = [];

    results.forEach(result => {
      confidences.push(result.confidence);
      result.ruleFirings.forEach(firing => {
        if (!ruleCounts[firing.rule]) {
          ruleCounts[firing.rule] = { count: 0, totalStrength: 0 };
        }
        ruleCounts[firing.rule].count++;
        ruleCounts[firing.rule].totalStrength += firing.strength;
      });
    });

    const mostFiredRules = Object.entries(ruleCounts)
      .map(([rule, stats]) => ({
        rule,
        count: stats.count,
        avgStrength: stats.totalStrength / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const ruleDistribution: { [rule: string]: number } = {};
    Object.entries(ruleCounts).forEach(([rule, stats]) => {
      ruleDistribution[rule] = stats.count;
    });

    return {
      mostFiredRules,
      averageConfidence: confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0,
      ruleDistribution
    };
  }
}
