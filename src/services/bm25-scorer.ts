/**
 * BM25 Okapi Scorer for pattern search
 * Standalone implementation — zero external dependencies
 *
 * Based on Okapi BM25 with Robertson-Walker IDF smoothing.
 * References:
 *   - AWS rankBm25.ts (Apache-2.0)
 *   - mem0 bm25.ts (MIT)
 *   - Okapi BM25: https://en.wikipedia.org/wiki/Okapi_BM25
 */

export interface BM25Config {
  /** Term frequency saturation parameter (default: 1.2) */
  k1: number;
  /** Document length normalization parameter (default: 0.75) */
  b: number;
}

export interface BM25Document {
  id: string;
  text: string;
}

export interface BM25ScoreResult {
  id: string;
  score: number;
}

const DEFAULT_BM25_CONFIG: BM25Config = {
  k1: 1.2,
  b: 0.75,
};

export class BM25Scorer {
  private readonly k1: number;
  private readonly b: number;
  private readonly corpusSize: number;
  private readonly avgDocLength: number;
  private readonly idf: Map<string, number> = new Map();
  private readonly docLengths: number[] = [];
  private readonly documents: BM25Document[];
  private readonly tokenCache: Map<number, string[]> = new Map();

  constructor(
    documents: BM25Document[],
    config?: Partial<BM25Config>
  ) {
    this.k1 = config?.k1 ?? DEFAULT_BM25_CONFIG.k1;
    this.b = config?.b ?? DEFAULT_BM25_CONFIG.b;
    this.documents = documents;
    this.corpusSize = documents.length;

    // Compute document lengths
    for (let i = 0; i < documents.length; i++) {
      const tokens = this.tokenize(documents[i].text);
      this.tokenCache.set(i, tokens);
      this.docLengths.push(tokens.length);
    }

    // Average document length
    this.avgDocLength =
      this.docLengths.reduce((a, b) => a + b, 0) / (this.corpusSize || 1);

    // Compute document frequency for each term
    const docFreqs = new Map<string, number>();
    for (const docTokens of this.tokenCache.values()) {
      const uniqueTerms = new Set(docTokens);
      for (const term of uniqueTerms) {
        docFreqs.set(term, (docFreqs.get(term) ?? 0) + 1);
      }
    }

    // Compute IDF for each term (Robertson-Walker smoothing)
    for (const [term, df] of docFreqs) {
      this.idf.set(
        term,
        Math.log((this.corpusSize - df + 0.5) / (df + 0.5) + 1)
      );
    }
  }

  /**
   * Score a query against all documents.
   * Returns results sorted by score descending.
   */
  scoreQuery(query: string): BM25ScoreResult[] {
    const queryTokens = this.tokenize(query);
    const results: BM25ScoreResult[] = [];

    for (let i = 0; i < this.documents.length; i++) {
      const score = this.scoreDocumentTokens(queryTokens, i);
      results.push({ id: this.documents[i].id, score });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Score a query against a single document by index.
   */
  scoreDocumentByIndex(query: string, docIndex: number): number {
    const queryTokens = this.tokenize(query);
    return this.scoreDocumentTokens(queryTokens, docIndex);
  }

  /**
   * Normalize raw BM25 scores to 0-1 range using min-max per query.
   */
  normalizeScores(results: BM25ScoreResult[]): Array<{ id: string; normalized: number }> {
    if (results.length === 0) return [];

    const rawScores = results.map((r) => r.score);
    const min = Math.min(...rawScores);
    const max = Math.max(...rawScores);
    const range = max - min;

    // Single result or all identical scores: it's the best by definition
    if (range === 0) {
      return results.map((r) => ({
        id: r.id,
        normalized: 1.0,
      }));
    }

    return results.map((r) => ({
      id: r.id,
      normalized: (r.score - min) / range,
    }));
  }

  /**
   * Get corpus statistics for diagnostics.
   */
  getStats(): {
    corpusSize: number;
    avgDocLength: number;
    uniqueTerms: number;
  } {
    return {
      corpusSize: this.corpusSize,
      avgDocLength: this.avgDocLength,
      uniqueTerms: this.idf.size,
    };
  }

  // --- Private helpers ---

  private scoreDocumentTokens(queryTokens: string[], docIndex: number): number {
    const docTokens = this.tokenCache.get(docIndex) ?? [];
    const termFreqs = this.computeTF(docTokens);
    const docLen = this.docLengths[docIndex];
    let score = 0;

    for (const token of queryTokens) {
      const idf = this.idf.get(token) ?? 0;
      const tf = termFreqs.get(token) ?? 0;

      // BM25 TF normalization
      const tfNorm =
        (tf * (this.k1 + 1)) /
        (tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength)));

      score += idf * tfNorm;
    }

    return score;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  private computeTF(tokens: string[]): Map<string, number> {
    const freq = new Map<string, number>();
    for (const t of tokens) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    return freq;
  }
}
