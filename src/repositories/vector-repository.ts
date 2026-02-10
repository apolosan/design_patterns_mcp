/**
 * Vector Repository Implementation
 * Concrete implementation of VectorRepository using SQLite
 */

import type { VectorRepository } from './interfaces.js';
import type { DatabaseManager } from '../services/database-manager.js';

interface VectorRow {
  pattern_id: string;
  embedding: string;
  model: string;
  strategy: string;
  dimensions: number;
  created_at: string;
}

export class SqliteVectorRepository implements VectorRepository {
  constructor(private db: DatabaseManager) {}

  async store(
    patternId: string,
    embedding: number[],
    model: string,
    dimensions: number
  ): Promise<void> {
    const embeddingStr = JSON.stringify(embedding);
    const now = new Date().toISOString();

    const sql = `
      INSERT OR REPLACE INTO pattern_embeddings (
        pattern_id, embedding, model, strategy, dimensions, created_at
      ) VALUES (?, ?, ?, 'cosine', ?, ?)
    `;

    this.db.execute(sql, [patternId, embeddingStr, model, dimensions, now]);
  }

  async retrieve(patternId: string): Promise<number[] | null> {
    const row = this.db.queryOne<VectorRow>(
      'SELECT embedding FROM pattern_embeddings WHERE pattern_id = ?',
      [patternId]
    );

    if (!row) {
      return null;
    }

    try {
      return JSON.parse(row.embedding);
    } catch {
      return null;
    }
  }

  async delete(patternId: string): Promise<void> {
    this.db.execute('DELETE FROM pattern_embeddings WHERE pattern_id = ?', [patternId]);
  }

  async exists(patternId: string): Promise<boolean> {
    const result = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM pattern_embeddings WHERE pattern_id = ?',
      [patternId]
    );
    return Promise.resolve((result?.count ?? 0) > 0);
  }

  async getAllVectors(): Promise<
    Array<{ patternId: string; embedding: number[]; model: string }>
  > {
    const rows = this.db.query<VectorRow>(
      'SELECT pattern_id, embedding, model FROM pattern_embeddings ORDER BY created_at ASC'
    );

    const vectors: Array<{ patternId: string; embedding: number[]; model: string }> = [];

    for (const row of rows) {
      try {
        const embedding = JSON.parse(row.embedding);
        vectors.push({
          patternId: row.pattern_id,
          embedding,
          model: row.model,
        });
      } catch {
        continue;
      }
    }

    return vectors;
  }

  async getStats(): Promise<{
    totalVectors: number;
    embeddingModel: string;
    dimensions: number;
  }> {
    const countResult = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM pattern_embeddings'
    );

    const modelResult = this.db.queryOne<{ model: string }>(
      'SELECT model FROM pattern_embeddings ORDER BY created_at DESC LIMIT 1'
    );

    const dimsResult = this.db.queryOne<{ dimensions: number }>(
      'SELECT dimensions FROM pattern_embeddings ORDER BY created_at DESC LIMIT 1'
    );

    return {
      totalVectors: countResult?.count ?? 0,
      embeddingModel: modelResult?.model ?? 'unknown',
      dimensions: dimsResult?.dimensions ?? 0,
    };
  }
}
