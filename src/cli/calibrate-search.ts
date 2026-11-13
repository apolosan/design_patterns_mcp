#!/usr/bin/env node
/**
 * Search Ranking Calibration CLI
 *
 * Measures how the composite ranking behaves on the real catalog and prints the
 * evidence behind FUZZY_RANK_WEIGHT instead of leaving it as an assertion.
 *
 * Ground truth comes from catalog metadata, never from the ranker, so the
 * measurement cannot confirm itself. Only the keyword channel is exercised:
 * enabling the semantic channel would require the embedding model, and the
 * question here is how the fuzzy refinement composes with a scored candidate
 * list, which the keyword channel provides deterministically.
 */
import { DatabaseManager } from '../services/database-manager.js';
import {
  FUZZY_RANK_WEIGHT,
  SearchMediator,
} from '../handlers/search-mediator.js';
import { CacheService } from '../services/cache.js';
import { NEUTRAL_RELEVANCE } from '../services/fuzzy-defuzzification.js';
import {
  buildCalibrationQueries,
  evaluateWeights,
  rankInProductionWindow,
  rankMetrics,
  interpretReport,
  summarizeDiagnostics,
  type CalibrationRow,
  type RankingObservation,
} from '../services/search-calibration.js';
import { parseArrayProperty, parseTags } from '../utils/parse-tags.js';
import type { VectorOperationsService } from '../services/vector-operations.js';

/** Candidate weights, anchors included: 0 is confidence-only, 1 is fuzzy-only. */
const WEIGHTS = [0, 0.15, 0.25, 0.35, 0.5, 0.65, 0.8, 1];
const DEPTH = 5;
const QUERIES_PER_TIER = 12;
const CANDIDATE_POOL = 50;

// The collection size decides whether the recovery pass can fire at all: the
// primary retriever already returns max(10, 2*maxResults) candidates, so a deep
// collection saturates the pool and leaves the applicability index nothing to
// admit. Measure recovery at the request size you ship.
const POOL_OVERRIDE = process.argv
  .slice(2)
  .map((argument) => /^--pool=(\d+)$/.exec(argument))
  .find((match) => match !== null);
const OBSERVED_POOL = POOL_OVERRIDE ? Number(POOL_OVERRIDE[1]) : CANDIDATE_POOL;

interface PatternRow {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string;
  when_to_use: string | null;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function pad(value: string, width: number): string {
  return value.padEnd(width);
}

async function main(): Promise<void> {
  const dbPath = process.env.DATABASE_PATH ?? './data/design-patterns.db';
  const db = new DatabaseManager({ filename: dbPath });

  try {
    await db.initialize();
  } catch (error) {
    console.error(
      `Cannot open ${dbPath}: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error('Run "bun run db:setup" first, or point DATABASE_PATH at a populated database.');
    process.exit(1);
  }

  try {
    const rows = db
      .query<PatternRow>('SELECT id, name, category, description, tags, when_to_use FROM patterns')
      .map((row): CalibrationRow => ({
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description,
        tags: parseTags(row.tags),
        whenToUse: parseArrayProperty(row.when_to_use, 'when_to_use'),
      }));

    if (rows.length === 0) {
      console.error('The patterns table is empty; nothing to calibrate.');
      process.exit(1);
    }

    const queries = buildCalibrationQueries(rows, QUERIES_PER_TIER);
    console.log(`Catalog: ${rows.length} patterns`);
    console.log(
      `Queries: ${queries.length} (up to ${QUERIES_PER_TIER} per tier: name, name+category, description, applicability)\n`
    );

    // The semantic channel stays off: it would need the embedding model, and the
    // measurement target here is the composition over a scored candidate list.
    const vectorOperations = {
      searchSimilar: () => [],
    } as unknown as VectorOperationsService;

    const mediator = new SearchMediator(
      db,
      vectorOperations,
      // A dedicated cache would replay results across queries; one instance is
      // enough because every query key is distinct, and nothing leaks between
      // weight evaluations since those only re-rank the collected pool.
      new CacheService(),
      {
        useSemanticSearch: false,
        useKeywordSearch: true,
        useHybridSearch: false,
        useFuzzyRefinement: true,
        maxResults: OBSERVED_POOL,
        minConfidence: 0.05,
      }
    );

    const observations: RankingObservation[] = [];
    for (const query of queries) {
      const recommendations = await mediator.search({
        id: query.id,
        query: query.query,
        maxResults: OBSERVED_POOL,
      });
      observations.push({
        queryId: query.id,
        tier: query.tier,
        expectedPatternId: query.expectedPatternId,
        results: recommendations.map((recommendation) => ({
          patternId: recommendation.pattern.id,
          confidence: recommendation.confidence,
          fuzzyRelevance: recommendation.justification.fuzzyRelevance,
        })),
      });
    }

    const diagnostics = summarizeDiagnostics(observations);
    console.log('Fuzzy signal diagnostics');
    console.log(`  results collected           ${diagnostics.totalResults}`);
    console.log(`  at the neutral value       ${percent(diagnostics.neutralShare)}`);
    console.log(`  queries where no rule fired ${percent(diagnostics.noRuleShare)}`);
    console.log(`  mean spread inside a query  ${diagnostics.meanIntraQuerySpread.toFixed(3)}`);
    console.log(`  neutral value in use        ${NEUTRAL_RELEVANCE}`);

    console.log(`  collection pool              ${OBSERVED_POOL}\n`);

    const report = evaluateWeights(observations, WEIGHTS, DEPTH);

    console.log(`Ranking quality by weight (MRR@${DEPTH} / P@${DEPTH})`);
    console.log(
      `  ${pad('weight', 8)}${pad('overall', 18)}${pad('cut-first', 11)}${pad('name', 10)}${pad('name+cat', 12)}${pad('desc', 8)}applic.`
    );
    for (const evaluation of report.evaluations) {
      console.log(
        `  ${pad(evaluation.weight.toFixed(2), 8)}` +
          `${pad(`${evaluation.mrr.toFixed(3)} / ${evaluation.precisionAtK.toFixed(3)}`, 18)}` +
          `${pad(evaluation.windowMrr.toFixed(3), 11)}` +
          `${pad(evaluation.byTier.name.mrr.toFixed(3), 10)}` +
          `${pad(evaluation.byTier['name-category'].mrr.toFixed(3), 12)}` +
          `${pad(evaluation.byTier.description.mrr.toFixed(3), 8)}` +
          `${evaluation.byTier.applicability.mrr.toFixed(3)}`
      );
    }
    console.log(
      `  "applic." is the tier built from when_to_use, the hardest one.` +
        `  "cut-first" is the order that was replaced.`
    );
    console.log(
      `  Candidates are collected with maxResults=${OBSERVED_POOL}; the retrievers produce` +
        ` max(10, 2*maxResults), so a collection at ${OBSERVED_POOL} is ${OBSERVED_POOL > 20 ? 'deep enough to saturate the pool (recovery cannot fire)' : 'close to what a caller asking ' + DEPTH + ' receives'}.`
    );

    const baseline = report.evaluations.find((evaluation) => evaluation.weight === 0);
    const best = report.evaluations.reduce((max, current) =>
      current.mrr > max.mrr ? current : max
    );
    // Where the cut happens changes the outcome, so it gets swept instead of
    // assumed: this is the evidence behind scoring before cutting.
    const sweep: string[] = [];
    for (const size of [DEPTH, 10, 20, 35, CANDIDATE_POOL]) {
      const mrrMean =
        observations.reduce(
          (total, observation) =>
            total +
            rankMetrics(
              rankInProductionWindow(observation, FUZZY_RANK_WEIGHT, DEPTH, size),
              observation.expectedPatternId,
              DEPTH
            ).mrr,
          0
        ) / observations.length;
      sweep.push(`${size}->${mrrMean.toFixed(3)}`);
    }

    const verdict = interpretReport(report, diagnostics);
    console.log('');
    console.log(`  confidence-only baseline MRR  ${baseline ? baseline.mrr.toFixed(3) : 'n/a'}`);
    console.log(`  best weight by MRR            ${best.weight.toFixed(2)} (${best.mrr.toFixed(3)})`);
    const inUse =
      report.evaluations.find(
        (evaluation) => Math.abs(evaluation.weight - FUZZY_RANK_WEIGHT) < 1e-9
      ) ?? best;
    console.log(`  FUZZY_RANK_WEIGHT in use      ${FUZZY_RANK_WEIGHT.toFixed(2)}`);
    console.log(
      `  cost of cutting first         ${(inUse.mrr - inUse.windowMrr).toFixed(3)} MRR` +
        ` (${inUse.mrr.toFixed(3)} -> ${inUse.windowMrr.toFixed(3)}), paid by the old order`
    );
    console.log(`  scoring-window sweep (MRR)     ${sweep.join('  ')}`);
    console.log(`  verdict                       ${verdict.kind}`);
    console.log('');
    console.log(`  ${verdict.note}`);
    if (verdict.kind === 'no-signal') {
      console.log(
        '\n  Only the keyword channel ran, and every inference rule conjuncts with\n' +
          '  semantic similarity, which is zero without the semantic channel. Enabling\n' +
          '  it requires real query embeddings; run this again in an environment that\n' +
          '  can produce them to settle the weight for the hybrid path.'
      );
    }
  } catch (error) {
    console.error('Calibration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

void main();
