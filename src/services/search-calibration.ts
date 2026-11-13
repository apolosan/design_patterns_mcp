/**
 * Search calibration harness.
 *
 * Purpose: settle the ranking-composition weight (FUZZY_RANK_WEIGHT) and the
 * "no evidence" value by measurement instead of judgement, and give the analysis
 * helpers a real caller.
 *
 * Ground truth never comes from the ranker: queries are derived from catalog
 * metadata (name, category, description) and the expected answer is the pattern
 * that metadata belongs to. A ranker evaluated against its own output would only
 * confirm itself, so the label has to be independent by construction.
 *
 * The core here is pure — observations in, numbers out — so it is testable
 * without a database, embeddings or the mediator. The CLI feeds it.
 */
import { computeCompositeScore } from '../handlers/search-mediator.js';
import { NEUTRAL_RELEVANCE } from './fuzzy-defuzzification.js';

/** Difficulty tiers. An easy tier must never hide a hard one, so metrics stay split. */
export type CalibrationTier = 'name' | 'name-category' | 'description' | 'applicability';

export interface CalibrationRow {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  /**
   * The "when to use" text. This field is NOT in the primary retriever's index,
   * which is what makes its tier the only one that can show a fusion gain.
   */
  whenToUse?: string[];
}

export interface CalibrationQuery {
  id: string;
  query: string;
  expectedPatternId: string;
  tier: CalibrationTier;
}

export interface RankingObservation {
  queryId: string;
  tier: CalibrationTier;
  expectedPatternId: string;
  results: Array<{ patternId: string; confidence: number; fuzzyRelevance?: number }>;
}

export interface RankMetrics {
  mrr: number;
  precisionAtK: number;
}

export interface WeightEvaluation {
  weight: number;
  mrr: number;
  precisionAtK: number;
  /**
   * MRR when the candidates are cut by confidence before being scored, which is
   * what SearchMediator does at the caller's maxResults. Its distance from `mrr`
   * is the quality production gives up by scoring only the records it returns.
   */
  windowMrr: number;
  byTier: Record<CalibrationTier, RankMetrics>;
}

export interface CalibrationReport {
  evaluations: WeightEvaluation[];
  recommended: number;
}

/** Below this improvement over the confidence-only baseline the fuzzy signal is not paying for itself. */
const MIN_MEANINGFUL_GAIN = 0.01;

/** Weights within this distance of the best form a plateau; the middle is preferred over a peak. */
const PLATEAU_TOLERANCE = 0.005;

const TIERS: readonly CalibrationTier[] = ['name', 'name-category', 'description', 'applicability'];

/**
 * What a measurement run actually licenses you to conclude.
 *
 * The distinction matters: a flat curve produced by a signal that never varies
 * is NOT evidence for the zeroth weight, it is evidence that the experiment
 * could not run. Collapsing the two would turn "I could not measure" into
 * "I measured zero", which is the failure mode this whole harness exists to
 * prevent (see round 15 of the design notes in .agent/).
 */
export type CalibrationVerdict =
  | { kind: 'no-signal'; recommended: 0; note: string }
  | { kind: 'no-gain'; recommended: 0; note: string }
  | { kind: 'measured'; recommended: number; note: string };

/**
 * Deterministic spread selection: pick `count` rows evenly across the input so
 * the sample covers the catalog instead of its first entries. No RNG, so two
 * runs on the same catalog are comparable.
 */
function spread<T>(items: readonly T[], count: number): T[] {
  if (count >= items.length) return [...items];
  const stride = items.length / count;
  const picked: T[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(items[Math.min(items.length - 1, Math.floor(i * stride))]);
  }
  return picked;
}

/** Words of the description that the pattern name does not already give away. */
function descriptionProbe(row: CalibrationRow): string {
  const nameWords = new Set(row.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const words = row.description.split(/\s+/).filter((w) => {
    const bare = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    return bare.length > 0 && !nameWords.has(bare);
  });
  const probe = words.slice(0, 8).join(' ').trim();
  return probe.length > 0 ? probe : row.description.split(/\s+/).slice(0, 8).join(' ');
}

/**
 * Terms of when_to_use that the pattern name does not already give away, longest
 * first: they are the most discriminative and the least likely to appear in the
 * fields the primary index covers.
 */
function applicabilityProbe(row: CalibrationRow): string {
  const nameWords = new Set(row.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const words = (row.whenToUse ?? [])
    .join(' ')
    .split(/\s+/)
    .map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((word) => word.length > 3 && !nameWords.has(word));
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 7).join(' ');
}

function queryForRow(row: CalibrationRow, tier: CalibrationTier): string {
  if (tier === 'name') return row.name;
  if (tier === 'name-category') return `${row.name} ${row.category}`;
  if (tier === 'applicability') return applicabilityProbe(row);
  return descriptionProbe(row);
}

/**
 * Build the calibration query set: `perTier` queries per difficulty tier, each
 * carrying the pattern id that the catalog says is the right answer.
 */
export function buildCalibrationQueries(
  rows: readonly CalibrationRow[],
  perTier: number
): CalibrationQuery[] {
  const ordered = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const queries: CalibrationQuery[] = [];

  for (const tier of TIERS) {
    for (const row of spread(ordered, Math.max(0, Math.floor(perTier)))) {
      const query = queryForRow(row, tier).trim();
      if (query.length === 0) continue;
      queries.push({
        id: `${tier}:${row.id}`,
        query,
        expectedPatternId: row.id,
        tier,
      });
    }
  }

  return queries;
}

/**
 * MRR@k and precision@k for one query. A hit beyond depth k scores zero, which
 * is why the window is applied before looking for the expected id.
 */
export function rankMetrics(
  rankedPatternIds: readonly string[],
  expectedPatternId: string,
  k: number
): RankMetrics {
  const depth = Math.max(1, Math.floor(k));
  const window = rankedPatternIds.slice(0, depth);
  const position = window.indexOf(expectedPatternId);
  return {
    mrr: position === -1 ? 0 : 1 / (position + 1),
    precisionAtK: (position === -1 ? 0 : 1) / depth,
  };
}

/**
 * Re-rank one observation under a candidate weight. Results without a fuzzy
 * relevance keep their search confidence as the fuzzy stand-in, which makes the
 * weight a no-op for them instead of dropping them from the pool.
 */
export function rankWithWeight(observation: RankingObservation, weight: number): string[] {
  return observation.results
    .map((result, index) => ({
      patternId: result.patternId,
      index,
      score: computeCompositeScore(
        result.confidence,
        result.fuzzyRelevance ?? result.confidence,
        weight
      ),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.patternId);
}

/**
 * Re-rank one observation the way production does when the caller asks for
 * `depth` results: cut by confidence first, score inside the window, sort.
 *
 * The difference against rankWithWeight is not cosmetic — it is the difference
 * between "could the signal reorder these" and "could the signal replace them".
 * A pattern the confidence cut removed is absent here no matter how much fuzzy
 * evidence it carries.
 */
export function rankInProductionWindow(
  observation: RankingObservation,
  weight: number,
  depth: number,
  scoringWindow: number = depth
): string[] {
  const requested = Math.max(1, Math.floor(depth));
  const window = Math.max(requested, Math.floor(scoringWindow));
  return observation.results
    .map((result, index) => ({ result, index }))
    .sort((a, b) => b.result.confidence - a.result.confidence || a.index - b.index)
    .slice(0, window)
    .map((entry) => ({
      patternId: entry.result.patternId,
      index: entry.index,
      score: computeCompositeScore(
        entry.result.confidence,
        entry.result.fuzzyRelevance ?? entry.result.confidence,
        weight
      ),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, requested)
    .map((entry) => entry.patternId);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function emptyTierMetrics(): Record<CalibrationTier, RankMetrics> {
  return {
    name: { mrr: 0, precisionAtK: 0 },
    'name-category': { mrr: 0, precisionAtK: 0 },
    description: { mrr: 0, precisionAtK: 0 },
    applicability: { mrr: 0, precisionAtK: 0 },
  };
}

/**
 * Decide the weight from a measured curve.
 *
 * The baseline is confidence-only (weight 0). If the best weight does not clear
 * it by MIN_MEANINGFUL_GAIN, the honest answer is zero: the fuzzy signal is not
 * paying for itself on this corpus. Otherwise the middle of the winning plateau
 * is preferred to a single peak, because a peak fitted to 200-odd catalog-derived
 * queries is an overfit by construction.
 */
export function recommendWeight(
  evaluations: readonly WeightEvaluation[]
): number {
  if (evaluations.length === 0) return 0;
  const baseline =
    evaluations.find((evaluation) => evaluation.weight === 0) ??
    evaluations.reduce((min, current) => (current.weight < min.weight ? current : min));
  const best = evaluations.reduce((max, current) => (current.mrr > max.mrr ? current : max));

  if (best.mrr - baseline.mrr < MIN_MEANINGFUL_GAIN) return 0;

  const plateau = evaluations.filter((evaluation) => evaluation.mrr >= best.mrr - PLATEAU_TOLERANCE);
  return plateau[Math.floor((plateau.length - 1) / 2)].weight;
}

/**
 * Turn a report plus its diagnostics into a verdict the caller can print.
 *
 * A mean intra-query spread of zero means the fuzzy relevance is constant
 * within every result set, so no weight can reorder anything and the curve is
 * uninformative by construction.
 */
export function interpretReport(
  report: CalibrationReport,
  diagnostics: { meanIntraQuerySpread: number },
  options?: { minSpread?: number }
): CalibrationVerdict {
  const minSpread = options?.minSpread ?? 1e-6;

  if (diagnostics.meanIntraQuerySpread < minSpread) {
    return {
      kind: 'no-signal',
      recommended: 0,
      note:
        'The fuzzy relevance never varied inside a result set ' +
        `(mean spread ${diagnostics.meanIntraQuerySpread.toFixed(3)}), so no weight can be evaluated ` +
        'in this search configuration. This is not evidence for weight 0.',
    };
  }

  if (report.recommended === 0) {
    return {
      kind: 'no-gain',
      recommended: 0,
      note:
        'The signal varies but no weight clears the confidence-only baseline by a ' +
        'meaningful margin, so weight 0 is the honest choice for this corpus.',
    };
  }

  const chosen = report.evaluations.find((evaluation) => evaluation.weight === report.recommended);
  return {
    kind: 'measured',
    recommended: report.recommended,
    note:
      `Weight ${report.recommended.toFixed(2)} beats the confidence-only baseline ` +
      `(MRR ${chosen ? chosen.mrr.toFixed(3) : 'n/a'}).`,
  };
}

/** Evaluate every candidate weight on the same observations. */
export function evaluateWeights(
  observations: readonly RankingObservation[],
  weights: readonly number[],
  k: number
): CalibrationReport {
  const evaluations = weights.map((weight) => {
    const perQuery = observations.map((observation) =>
      rankMetrics(rankWithWeight(observation, weight), observation.expectedPatternId, k)
    );
    const perQueryWindowed = observations.map((observation) =>
      rankMetrics(
        rankInProductionWindow(observation, weight, k),
        observation.expectedPatternId,
        k
      )
    );
    const byTier = emptyTierMetrics();
    for (const tier of TIERS) {
      const tierIndices = observations
        .map((observation, index) => ({ observation, index }))
        .filter((entry) => entry.observation.tier === tier)
        .map((entry) => entry.index);
      byTier[tier] = {
        mrr: mean(tierIndices.map((index) => perQuery[index].mrr)),
        precisionAtK: mean(tierIndices.map((index) => perQuery[index].precisionAtK)),
      };
    }
    return {
      weight,
      mrr: mean(perQuery.map((metrics) => metrics.mrr)),
      precisionAtK: mean(perQuery.map((metrics) => metrics.precisionAtK)),
      windowMrr: mean(perQueryWindowed.map((metrics) => metrics.mrr)),
      byTier,
    };
  });

  return { evaluations, recommended: recommendWeight(evaluations) };
}

/**
 * Diagnostics that tell a flat curve caused by an absent signal apart from one
 * caused by the ranking being insensitive to the weight:
 *   - neutralShare: how often the fuzzy pass had nothing to say (all mass was
 *     residual), which also decides whether the neutral value deserves its own
 *     calibration;
 *   - noRuleShare: how often NOTHING fired for any returned result;
 *   - meanIntraQuerySpread: average max-min fuzzy relevance inside one result
 *     set. Near zero means no weight can ever reorder that set.
 */
export function summarizeDiagnostics(observations: readonly RankingObservation[]): {
  neutralShare: number;
  noRuleShare: number;
  meanIntraQuerySpread: number;
  totalResults: number;
} {
  const allResults = observations.flatMap((observation) => observation.results);
  const withFuzzy = allResults.filter(
    (result): result is { patternId: string; confidence: number; fuzzyRelevance: number } =>
      typeof result.fuzzyRelevance === 'number'
  );

  const isNeutral = (value: number): boolean => Math.abs(value - NEUTRAL_RELEVANCE) < 1e-9;
  const neutralShare =
    withFuzzy.length === 0
      ? 0
      : withFuzzy.filter((result) => isNeutral(result.fuzzyRelevance)).length / withFuzzy.length;

  const queriesWithNothingFired = observations.filter((observation) => {
    const values = observation.results
      .map((result) => result.fuzzyRelevance)
      .filter((value): value is number => typeof value === 'number');
    return values.length > 0 && values.every(isNeutral);
  }).length;
  const noRuleShare = observations.length === 0 ? 0 : queriesWithNothingFired / observations.length;

  const spreads = observations
    .map((observation) => {
      const values = observation.results
        .map((result) => result.fuzzyRelevance)
        .filter((value): value is number => typeof value === 'number');
      return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
    });

  return {
    neutralShare,
    noRuleShare,
    meanIntraQuerySpread: mean(spreads),
    totalResults: allResults.length,
  };
}
